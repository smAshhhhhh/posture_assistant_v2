package com.postureassist.patients

import android.content.ContentValues
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.UUID

class ObservationRecords(private val database: PatientDatabase, private val context: Context) {
  private val directory = File(context.filesDir, "observations")
  private val videos = ObservationVideos(context)

  fun list(): String {
    val rows = JSONArray()
    database.readableDatabase.rawQuery(
      """SELECT id, patient_id, task_id, observed_at, affected_side, task_status,
        capture_quality, duration_ms, repetitions FROM observations
        ORDER BY observed_at DESC, id""", null
    ).use { cursor ->
      while (cursor.moveToNext()) {
        // 列表只读摘要列，避免每次加载所有报告曲线。
        rows.put(JSONObject().apply {
          put("id", cursor.getString(0))
          put("patientId", cursor.getString(1))
          put("taskId", cursor.getString(2))
          put("observedAt", cursor.getString(3))
          put("affectedSide", cursor.getString(4))
          put("taskStatus", cursor.getString(5))
          put("captureQuality", cursor.getString(6))
          put("durationMs", cursor.getLong(7))
          put("repetitions", if (cursor.isNull(8)) JSONObject.NULL else cursor.getInt(8))
        })
      }
    }
    return rows.toString()
  }

  fun get(id: String): String {
    database.readableDatabase.rawQuery(
      "SELECT pose_file, pose_bytes, pose_sha256 FROM observations WHERE id = ?",
      arrayOf(id)
    ).use {
      if (!it.moveToFirst()) throw StoreException("NOT_FOUND")
      val expected = "observations/$id.json"
      if (it.getString(0) != expected) throw StoreException("DATA_CORRUPT")
      val file = File(directory, "$id.json")
      if (!file.isFile || file.length() != it.getLong(1)) throw StoreException("DATA_CORRUPT")
      val digest = MessageDigest.getInstance("SHA-256")
      file.inputStream().use { input ->
        val buffer = ByteArray(65536)
        var count = input.read(buffer)
        while (count > 0) {
          digest.update(buffer, 0, count)
          count = input.read(buffer)
        }
      }
      if (digest.digest().toHex() != it.getString(2)) throw StoreException("DATA_CORRUPT")
      return readObservationReport(database.readableDatabase, id)
    }
  }

  fun save(reportPayload: String, posePayload: String): String {
    val report = JSONObject(reportPayload)
    val pose = JSONObject(posePayload)
    validateObservation(report, pose)
    val id = report.recordText("id")
    val patientId = report.recordText("patientId")
    val bytes = posePayload.toByteArray(Charsets.UTF_8)
    val hash = MessageDigest.getInstance("SHA-256").digest(bytes).toHex()
    val db = database.writableDatabase
    db.rawQuery("SELECT pose_sha256 FROM observations WHERE id = ?", arrayOf(id)).use {
      if (it.moveToFirst()) {
        // 回执丢失后重试同一记录不重复写入，也不覆盖已有报告。
        if (it.getString(0) != hash || readObservationReport(db, id) != reportPayload) {
          throw StoreException("CONFLICT")
        }
        return get(id)
      }
    }
    db.rawQuery("SELECT id FROM patients WHERE id = ?", arrayOf(patientId)).use {
      if (!it.moveToFirst()) throw StoreException("NOT_FOUND")
    }
    check(directory.isDirectory || directory.mkdirs())
    val temporary = File(directory, "$id-${UUID.randomUUID()}.tmp")
    val destination = File(directory, "$id.json")
    var committed = false
    val stagedVideos = mutableListOf<File>()
    try {
      val videoManifest = videos.stage(id, pose, stagedVideos)
      FileOutputStream(temporary).use {
        it.write(bytes)
        it.fd.sync()
      }
      // 先落盘再提交数据库，失败时删除孤立文件，不留下缺少关键点的报告。
      if (destination.exists()) check(destination.delete())
      check(temporary.renameTo(destination))
      db.beginTransaction()
      try {
        val values = ContentValues().apply {
          put("id", id)
          put("patient_id", patientId)
          put("task_id", report.recordText("taskId"))
          put("observed_at", report.recordText("observedAt"))
          put("affected_side", report.recordText("affectedSide"))
          put("task_status", report.recordText("taskStatus"))
          put("capture_quality", report.recordText("captureQuality"))
          put("duration_ms", pose.getLong("durationMs"))
          put("repetitions", report.optionalInteger("repetitions"))
          put("report_json", reportPayload)
          put("pose_file", "observations/$id.json")
          put("pose_bytes", bytes.size)
          put("pose_sha256", hash)
          put("created_at", currentTimestamp())
        }
        db.insertOrThrow("observations", null, values)
        if (videoManifest != null) videos.insert(database, id, videoManifest)
        db.setTransactionSuccessful()
      } finally {
        db.endTransaction()
      }
      committed = true
      // 已提交私有副本后清理采集缓存；清理失败不撤销已保存记录。
      runCatching {
        pose.optJSONObject("video")?.getJSONArray("segments")?.let { segments ->
          for (index in 0 until segments.length()) {
            videoFile(File(context.cacheDir, "capture-videos"), id, index,
              segments.getJSONObject(index).getString("fileName")).delete()
          }
        }
      }
      return reportPayload
    } finally {
      temporary.delete()
      if (!committed) destination.delete()
      if (!committed) stagedVideos.forEach { it.delete() }
    }
  }
}

private fun ByteArray.toHex(): String =
  joinToString("") { "%02x".format(it.toInt() and 0xff) }
