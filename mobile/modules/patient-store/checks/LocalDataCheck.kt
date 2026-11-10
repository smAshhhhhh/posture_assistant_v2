package com.postureassist.patients

import java.io.File
import org.json.JSONObject

fun main(args: Array<String>) {
  val patientId = "12345678-1234-4234-8234-123456789abc"
  for (kind in listOf("patient", "observation")) {
    check(DataScope.parse("""{"kind":"$kind","id":"$patientId"}""").id == patientId)
  }
  for (payload in listOf(
    """{"kind":"invalid"}""", """{"kind":"patient","id":"../escape"}"""
  )) {
    check(runCatching { DataScope.parse(payload) }.isFailure)
  }
  val snapshot = JSONObject("""{
    "patients":[{"id":"p1","revision":1}],
    "assessments":[],"observations":[{"id":"o1"}]
  }""")
  val scope = DataScope("patient", patientId)
  val original = deletionPreview(scope, snapshot)
  check(original.getInt("patients") == 1)
  check(original.getInt("observations") == 1)
  val sameSnapshot = deletionPreview(scope, JSONObject(snapshot.toString()))
  check(original.getString("token") == sameSnapshot.getString("token"))
  snapshot.getJSONArray("patients").getJSONObject(0).put("revision", 2)
  check(original.getString("token") != deletionPreview(scope, snapshot).getString("token"))
  snapshot.getJSONArray("observations").put(JSONObject("""{"id":"o2"}"""))
  check(original.getString("token") != deletionPreview(scope, snapshot).getString("token"))
  check(deletionPreview(DataScope("observation", patientId), snapshot).getInt("patients") == 0)
  val root = java.nio.file.Files.createTempDirectory(File(args[0]).toPath(), "data-check-").toFile()
  val poses = File(root, "poses").apply { mkdir() }
  val exports = File(root, "exports").apply { mkdir() }
  try {
    val poseFile = File(poses, "$patientId.json").apply { writeText("""{"frames":[]}""") }
    val reportOnlyId = "12345678-1234-4234-8234-123456789def"
    val reportOnlyFile = File(poses, "$reportOnlyId.json").apply { writeText("{}") }
    File(poses, "unused.tmp").writeText("temporary")
    File(poses, "nested").mkdir()
    val paths = setOf("observations/$patientId.json", "observations/$reportOnlyId.json")
    val orphans = orphanObservationFiles(poses, paths)
    check(orphans.size == 1 && orphans[0].name == "unused.tmp")
    orphans.forEach { check(it.delete()) }
    check(poseFile.exists() && reportOnlyFile.exists() && File(poses, "nested").isDirectory)
    check(orphanObservationFiles(poses, paths).isEmpty())
    val hash = java.security.MessageDigest.getInstance("SHA-256")
      .digest(poseFile.readBytes()).joinToString("") { "%02x".format(it.toInt() and 0xff) }
    val row = JSONObject().apply {
      put("id", patientId)
      put("pose_file", "observations/$patientId.json")
      put("pose_bytes", poseFile.length())
      put("pose_sha256", hash)
      put("report_json", """{"schemaVersion":1,"id":"$patientId",
        "taskId":"short_walk","protocolVersion":"walk-straight-side-v1",
        "analysisVersion":"walk-knee-cycle-2d-v1"}""")
    }
    val exportSnapshot = JSONObject().apply {
      put("patients", org.json.JSONArray("""[{"id":"p1","age_years":null}]"""))
      put("assessments", org.json.JSONArray())
      put("observations", org.json.JSONArray().put(row))
    }
    val readReport: (String) -> String = { row.getString("report_json") }
    val metricRecords = org.json.JSONArray().put(JSONObject().apply {
      put("recordingId", patientId)
      put("taskId", "short_walk")
      put("protocolVersion", "walk-straight-side-v1")
      put("analysisVersion", "walk-knee-cycle-2d-v1")
      put("metrics", org.json.JSONArray())
    })
    fun export(includePose: Boolean, photos: File? = null): File = writeDataExport(
      exports, poses, exportSnapshot, scope, includePose, 10, readReport, photos, metricRecords
    )
    val full = export(true)
    java.util.zip.ZipFile(full).use { zip ->
      val names = zip.entries().asSequence().map { it.name }.toSet()
      check(names == setOf(
        "manifest.json", "patients.json", "assessments.json",
        "reports/$patientId.json", "pose/$patientId.json", "metrics/$patientId.json"
      ))
      val exportedPose = zip.getInputStream(zip.getEntry("pose/$patientId.json"))
        .bufferedReader().readText()
      check(exportedPose == poseFile.readText())
      val manifest = JSONObject(
        zip.getInputStream(zip.getEntry("manifest.json")).bufferedReader().readText()
      )
      check(manifest.getInt("version") == 2 && manifest.getBoolean("includesPose"))
      check(manifest.getInt("metricSchemaVersion") == 1)
      val metrics = JSONObject(zip.getInputStream(zip.getEntry("metrics/$patientId.json"))
        .bufferedReader().readText())
      check(metrics.getString("recordingId") == patientId)
      check(!manifest.getBoolean("includesVideo"))
    }
    row.put("pose_sha256", "0".repeat(64))
    check(runCatching {
      export(true)
    }.isFailure)
    check(exports.listFiles()?.isEmpty() == true)
    check(poseFile.delete())
    val summary = export(false)
    java.util.zip.ZipFile(summary).use { zip ->
      check(zip.getEntry("pose/$patientId.json") == null)
      check(zip.getEntry("reports/$patientId.json") != null)
    }
    val photos = File(root, "photos").apply { mkdir() }
    val photoName = "$patientId.jpg"
    val photo = File(photos, photoName).apply { writeBytes(byteArrayOf(1, 2, 3, 4)) }
    val patient = exportSnapshot.getJSONArray("patients").getJSONObject(0)
    patient.put("photo_file", photoName)
    try {
      val withPhotos = export(false, photos)
      java.util.zip.ZipFile(withPhotos).use { zip ->
        val entry = checkNotNull(zip.getEntry("patient-photos/$photoName"))
        check(zip.getInputStream(entry).use { it.readBytes() }.contentEquals(photo.readBytes()))
        val manifest = JSONObject(
          zip.getInputStream(zip.getEntry("manifest.json")).bufferedReader().readText()
        )
        check(manifest.getBoolean("includesPatientPhotos"))
      }
      patient.put("photo_file", "../escape.jpg")
      check(runCatching {
        export(false, photos)
      }.isFailure)
      check(exports.listFiles()?.isEmpty() == true)
      patient.put("photo_file", photoName)
      check(photo.delete())
      check(runCatching {
        export(false, photos)
      }.isFailure)
      check(exports.listFiles()?.isEmpty() == true)
    } finally {
      photo.delete()
      check(photos.delete())
      patient.remove("photo_file")
    }
    row.put("pose_file", "../escape")
    check(runCatching {
      export(false)
    }.isFailure)
  } finally {
    exports.listFiles()?.forEach { check(it.delete()) }
    poses.listFiles()?.forEach { check(it.delete()) }
    check(exports.delete())
    check(poses.delete())
    check(root.delete())
  }
  println("Kotlin data scope, ZIP integrity, patient photos, optional pose and orphan checks passed")
  checkVideoStaging(File(args[0]))
}

private fun checkVideoStaging(parent: File) {
  val id = "12345678-1234-4234-8234-123456789abc"
  val root = java.nio.file.Files.createTempDirectory(parent.toPath(), "video-check-").toFile()
  val source = File(root, "capture").apply { mkdir() }
  val stored = File(root, "stored").apply { mkdir() }
  val created = mutableListOf<File>()
  try {
    check(stageObservationVideo(source, stored, id, JSONObject(), created) == null)
    val first = File(source, "$id-0.mp4").apply { writeBytes(ByteArray(131072) { (it % 255).toByte() }) }
    val second = File(source, "$id-1.mp4").apply { writeText("second test segment") }
    val pose = JSONObject("""{"video":{"error":"recording_failed","segments":[
      {"fileName":"$id-0.mp4","durationMs":1000},
      {"fileName":"$id-1.mp4","durationMs":2000}]}}""")
    val manifest = checkNotNull(stageObservationVideo(source, stored, id, pose, created))
    check(manifest.getBoolean("isPartial"))
    val segments = manifest.getJSONArray("segments")
    for ((index, original) in listOf(first, second).withIndex()) {
      val file = videoFile(stored, id, index, original.name)
      check(file.readBytes().contentEquals(original.readBytes()))
      check(segments.getJSONObject(index).getLong("bytes") == original.length())
      check(segments.getJSONObject(index).getString("sha256") == fileSha256(file))
    }
    val oldHash = fileSha256(first)
    first.appendText("corrupted")
    check(fileSha256(first) != oldHash)
    check(runCatching { videoFile(stored, id, 0, "../outside.mp4") }.isFailure)
    check(runCatching { videoFile(stored, id, 1, "$id-0.mp4") }.isFailure)
    val invalid = JSONObject(pose.toString())
    invalid.getJSONObject("video").getJSONArray("segments").getJSONObject(1)
      .put("fileName", "../outside.mp4")
    val failed = mutableListOf<File>()
    check(runCatching { stageObservationVideo(source, stored, id, invalid, failed) }.isFailure)
    // 模拟保存失败后的清理，采集源保留以便用户重试。
    failed.forEach { it.delete() }
    check(first.exists() && second.exists())
    check(second.delete())
    check(runCatching { stageObservationVideo(source, stored, id, pose, failed) }.isFailure)
    failed.forEach { it.delete() }
  } finally {
    stored.listFiles()?.forEach { check(it.delete()) }
    source.listFiles()?.forEach { check(it.delete()) }
    check(stored.delete())
    check(source.delete())
    check(root.delete())
  }
  println("Kotlin video copy, digest, path validation and failed-save cleanup checks passed")
}

