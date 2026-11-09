package com.postureassist.patients

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.UUID

internal data class DataScope(val kind: String, val id: String?) {
  companion object {
    fun parse(payload: String): DataScope {
      val input = JSONObject(payload)
      val kind = input.recordText("kind")
      requireRecord(kind in setOf("all", "patient", "observation"))
      val id = if (kind == "all") null else input.recordText("id")
      if (id != null) requireRecord(UUID.fromString(id).toString() == id)
      return DataScope(kind, id)
    }
  }
}

internal class LocalDataRecords(private val database: PatientDatabase, private val context: Context) {
  private val directory = File(context.filesDir, "observations")
  private val videoDirectory = File(context.filesDir, "observation-videos")
  private val photoDirectory = File(context.filesDir, "patient-photos")

  private fun photoOrphans(): List<File> {
    val referenced = rows(database.readableDatabase, "SELECT photo_file FROM patients")
    val names = (0 until referenced.length()).mapNotNull {
      referenced.getJSONObject(it).optionalText("photo_file")
    }.toSet()
    return photoDirectory.listFiles()?.filter { it.isFile && it.name !in names } ?: emptyList()
  }

  private fun videoPaths(): Set<String> {
    val referenced = rows(database.readableDatabase, "SELECT observation_id, manifest_json FROM observation_media")
    return mediaFiles(referenced).map { it.name }.toSet()
  }

  private fun mediaFiles(media: JSONArray): List<File> {
    val files = mutableListOf<File>()
    for (rowIndex in 0 until media.length()) {
      val row = media.getJSONObject(rowIndex)
      val segments = JSONObject(row.getString("manifest_json")).getJSONArray("segments")
      for (index in 0 until segments.length()) {
        files.add(videoFile(videoDirectory, row.getString("observation_id"), index,
          segments.getJSONObject(index).getString("fileName")))
      }
    }
    return files
  }

  private fun videoOrphans(): List<File> {
    val names = videoPaths()
    return videoDirectory.listFiles()?.filter { it.isFile && it.name !in names } ?: emptyList()
  }

  fun stats(): String {
    val db = database.readableDatabase
    val referenced = rows(db, "SELECT pose_file FROM observations")
    val paths = (0 until referenced.length()).map {
      referenced.getJSONObject(it).getString("pose_file")
    }.toSet()
    val files = directory.listFiles()?.filter { it.isFile } ?: emptyList()
    val dbFile = context.getDatabasePath("posture-patients.db")
    return JSONObject().apply {
      put("patients", scalar(db, "SELECT COUNT(*) FROM patients"))
      put("assessments", scalar(db, "SELECT COUNT(*) FROM clinical_assessments"))
      put("observations", scalar(db, "SELECT COUNT(*) FROM observations"))
      put("databaseBytes", listOf(dbFile, File(dbFile.path + "-wal"), File(dbFile.path + "-shm"))
        .sumOf { if (it.isFile) it.length() else 0L })
      put("poseBytes", files.sumOf { it.length() })
      put("videoBytes", videoDirectory.listFiles()?.filter { it.isFile }?.sumOf { it.length() } ?: 0L)
      put("photoBytes", photoDirectory.listFiles()?.filter { it.isFile }?.sumOf { it.length() } ?: 0L)
      put("orphanFiles", orphanObservationFiles(directory, paths).size +
        videoOrphans().size + photoOrphans().size)
    }.toString()
  }

  fun snapshot(scope: DataScope): JSONObject {
    val db = database.readableDatabase
    val where = when (scope.kind) {
      "patient" -> " WHERE id = ?"
      "observation" -> " WHERE id = (SELECT patient_id FROM observations WHERE id = ?)"
      else -> ""
    }
    val args = scope.id?.let { arrayOf(it) } ?: emptyArray()
    val patients = rows(db, "SELECT * FROM patients$where ORDER BY id", args)
    if (scope.kind != "all" && patients.length() == 0) throw StoreException("NOT_FOUND")
    val assessments = if (scope.kind == "observation") JSONArray() else rows(
      db, "SELECT * FROM clinical_assessments" +
        (if (scope.kind == "patient") " WHERE patient_id = ?" else "") + " ORDER BY id", args
    )
    // 报告曲线按条读取，预览和删除不能一次载入全部长序列。
    val observations = rows(db, """SELECT id, patient_id, task_id, observed_at, affected_side,
      task_status, capture_quality, duration_ms, repetitions, pose_file, pose_bytes,
      pose_sha256, created_at FROM observations""" + when (scope.kind) {
      "patient" -> " WHERE patient_id = ?"
      "observation" -> " WHERE id = ?"
      else -> ""
    } + " ORDER BY id", args)
    val media = rows(db, """SELECT observation_id, manifest_json FROM observation_media
      WHERE observation_id IN (SELECT id FROM observations""" + when (scope.kind) {
      "patient" -> " WHERE patient_id = ?"
      "observation" -> " WHERE id = ?"
      else -> ""
    } + ") ORDER BY observation_id", args)
    return JSONObject().apply {
      put("patients", patients)
      put("assessments", assessments)
      put("observations", observations)
      put("videos", media)
    }
  }

  fun preview(scope: DataScope): String = deletionPreview(scope, snapshot(scope)).toString()

  fun delete(scope: DataScope, token: String): String {
    requireRecord(token.matches(Regex("^[a-f0-9]{64}$")))
    val db = database.writableDatabase
    val files = mutableListOf<File>()
    db.beginTransaction()
    try {
      val snapshot = snapshot(scope)
      if (deletionPreview(scope, snapshot).getString("token") != token) throw StoreException("CONFLICT")
      val observations = snapshot.getJSONArray("observations")
      if (scope.kind != "observation") {
        val patients = snapshot.getJSONArray("patients")
        val photos = PatientPhotos(context)
        for (index in 0 until patients.length()) {
          patients.getJSONObject(index).optionalText("photo_file")?.let {
            files.add(photos.file(it))
          }
        }
      }
      files.addAll(mediaFiles(snapshot.getJSONArray("videos")))
      for (index in 0 until observations.length()) {
        val row = observations.getJSONObject(index)
        files.add(poseFile(row.getString("id"), row.getString("pose_file")))
      }
      val source = context.resources.openRawResource(R.raw.local_data_delete)
        .bufferedReader().use { it.readText() }
      source.split(';').map { it.trim() }.filter { it.isNotEmpty() }.forEach { sql ->
        db.execSQL(sql, arrayOf(scope.kind, scope.id))
      }
      db.setTransactionSuccessful()
    } finally { db.endTransaction() }
    // 先提交索引删除，文件失败留作可重试清理，不能让保留的记录失去文件。
    files.forEach { it.delete() }
    return stats()
  }

  fun cleanOrphans(): String {
    val referenced = rows(database.readableDatabase, "SELECT pose_file FROM observations")
    val paths = (0 until referenced.length()).map {
      referenced.getJSONObject(it).getString("pose_file")
    }.toSet()
    orphanObservationFiles(directory, paths).forEach {
      if (!it.delete()) throw StoreException("STORE_FAILED")
    }
    // 不进入 capture-videos 临时目录，避免清理当前尚未保存的录像。
    videoOrphans().forEach { if (!it.delete()) throw StoreException("STORE_FAILED") }
    photoOrphans().forEach { if (!it.delete()) throw StoreException("STORE_FAILED") }
    return stats()
  }

  fun poseFile(id: String, path: String): File {
    return observationPoseFile(directory, id, path)
  }
}

internal fun observationPoseFile(directory: File, id: String, path: String): File {
  requireRecord(UUID.fromString(id).toString() == id)
  if (path != "observations/$id.json") throw StoreException("DATA_CORRUPT")
  return File(directory, "$id.json")
}

internal fun orphanObservationFiles(directory: File, paths: Set<String>): List<File> =
  directory.listFiles()?.filter { it.isFile && "observations/${it.name}" !in paths } ?: emptyList()

internal fun deletionPreview(scope: DataScope, snapshot: JSONObject): JSONObject {
  val token = MessageDigest.getInstance("SHA-256")
    .digest((scope.toString() + snapshot.toString()).toByteArray(Charsets.UTF_8))
    .joinToString("") { "%02x".format(it.toInt() and 0xff) }
  return JSONObject().apply {
    put("token", token)
    put("patients", if (scope.kind == "observation") 0 else snapshot.getJSONArray("patients").length())
    put("assessments", snapshot.getJSONArray("assessments").length())
    put("observations", snapshot.getJSONArray("observations").length())
  }
}

private fun scalar(db: SQLiteDatabase, sql: String): Long = db.rawQuery(sql, null).use {
  check(it.moveToFirst())
  it.getLong(0)
}

internal fun rows(db: SQLiteDatabase, sql: String, args: Array<String> = emptyArray()): JSONArray {
  val result = JSONArray()
  db.rawQuery(sql, args).use { cursor ->
    while (cursor.moveToNext()) {
      result.put(JSONObject().apply {
        cursor.columnNames.forEachIndexed { index, name ->
          put(name, when (cursor.getType(index)) {
            android.database.Cursor.FIELD_TYPE_NULL -> JSONObject.NULL
            android.database.Cursor.FIELD_TYPE_INTEGER -> cursor.getLong(index)
            android.database.Cursor.FIELD_TYPE_FLOAT -> cursor.getDouble(index)
            else -> cursor.getString(index)
          })
        }
      })
    }
  }
  return result
}
