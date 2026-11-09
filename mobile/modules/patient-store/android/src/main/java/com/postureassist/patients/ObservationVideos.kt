package com.postureassist.patients

import android.content.Context
import android.content.ContentValues
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.UUID

internal fun videoFile(directory: File, id: String, index: Int, name: String): File {
  requireRecord(UUID.fromString(id).toString() == id)
  requireRecord(index in 0..899 && name == "$id-$index.mp4")
  return File(directory, name)
}

internal fun fileSha256(file: File): String {
  val digest = MessageDigest.getInstance("SHA-256")
  file.inputStream().use { input ->
    val buffer = ByteArray(65536)
    var count = input.read(buffer)
    while (count > 0) {
      digest.update(buffer, 0, count)
      count = input.read(buffer)
    }
  }
  return digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
}

internal class ObservationVideos(private val context: Context) {
  private val directory = File(context.filesDir, "observation-videos")

  fun stage(id: String, pose: JSONObject, created: MutableList<File>): JSONObject? =
    stageObservationVideo(File(context.cacheDir, "capture-videos"), directory, id, pose, created)

  fun get(database: PatientDatabase, id: String): String {
    val db = database.readableDatabase
    db.rawQuery("SELECT id FROM observations WHERE id = ?", arrayOf(id)).use {
      if (!it.moveToFirst()) throw StoreException("NOT_FOUND")
    }
    db.rawQuery(
      "SELECT manifest_json FROM observation_media WHERE observation_id = ?", arrayOf(id)
    ).use { cursor ->
      if (!cursor.moveToFirst()) return "null"
      val manifest = JSONObject(cursor.getString(0))
      val segments = manifest.getJSONArray("segments")
      if (segments.length() == 0) throw StoreException("VIDEO_MISSING")
      val playable = JSONArray()
      var bytes = 0L
      for (index in 0 until segments.length()) {
        val segment = segments.getJSONObject(index)
        val file = videoFile(directory, id, index, segment.recordText("fileName"))
        if (!file.isFile || file.length() != segment.getLong("bytes") ||
          fileSha256(file) != segment.getString("sha256")) throw StoreException("VIDEO_MISSING")
        bytes += file.length()
        playable.put(JSONObject()
          .put("uri", Uri.fromFile(file).toString())
          .put("durationMs", segment.getLong("durationMs")))
      }
      return JSONObject().put("segments", playable).put("bytes", bytes)
        .put("isPartial", manifest.getBoolean("isPartial")).toString()
    }
  }

  fun insert(database: PatientDatabase, id: String, manifest: JSONObject) {
    database.writableDatabase.insertOrThrow("observation_media", null, ContentValues().apply {
      put("observation_id", id)
      put("manifest_json", manifest.toString())
    })
  }
}

internal fun stageObservationVideo(
  sourceDirectory: File,
  directory: File,
  id: String,
  pose: JSONObject,
  created: MutableList<File>
): JSONObject? {
  if (!pose.has("video")) return null
  val video = pose.getJSONObject("video")
  val segments = video.getJSONArray("segments")
  requireRecord(segments.length() <= 900)
  requireRecord(video.has("error") &&
    (video.isNull("error") || video.getString("error") == "recording_failed"))
  check(directory.isDirectory || directory.mkdirs())
  val stored = JSONArray()
  for (index in 0 until segments.length()) {
    val segment = segments.getJSONObject(index)
    val name = segment.recordText("fileName")
    val duration = segment.optionalInteger("durationMs")
    requireRecord(duration != null && duration in 1..86_400_000)
    val source = videoFile(sourceDirectory, id, index, name)
    val destination = videoFile(directory, id, index, name)
    if (!source.isFile || source.length() == 0L) throw StoreException("VIDEO_MISSING")
    val temporary = File(directory, "$name.tmp")
    created.add(temporary)
    FileOutputStream(temporary).use { output ->
      source.inputStream().use { it.copyTo(output) }
      output.fd.sync()
    }
    if (destination.exists()) check(destination.delete())
    check(temporary.renameTo(destination))
    created.add(destination)
    stored.put(JSONObject().apply {
      put("fileName", name)
      put("durationMs", duration)
      put("bytes", destination.length())
      put("sha256", fileSha256(destination))
    })
  }
  return JSONObject().put("segments", stored).put("isPartial", !video.isNull("error"))
}

