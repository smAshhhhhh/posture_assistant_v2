package com.postureassist.patients

import android.content.Context
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.security.MessageDigest
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

internal class LocalDataExport(private val database: PatientDatabase, private val context: Context) {
  fun prepare(scope: DataScope, includePose: Boolean, metrics: String): File {
    val records = LocalDataRecords(database, context)
    val snapshot = records.snapshot(scope)
    return writeDataExport(
      File(context.cacheDir, "data-exports"), File(context.filesDir, "observations"),
      snapshot, scope, includePose, database.readableDatabase.version,
      readReport = { id -> readObservationReport(database.readableDatabase, id) },
      photoDirectory = File(context.filesDir, "patient-photos"),
      metricRecords = JSONArray(metrics)
    )
  }
}

internal fun writeDataExport(
  directory: File,
  poseDirectory: File,
  snapshot: JSONObject,
  scope: DataScope,
  includePose: Boolean,
  schemaVersion: Int,
  readReport: (String) -> String,
  photoDirectory: File? = null,
  metricRecords: JSONArray = JSONArray()
): File {
  val metricsById = mutableMapOf<String, JSONObject>()
  for (index in 0 until metricRecords.length()) {
    val entry = metricRecords.getJSONObject(index)
    val id = entry.recordText("recordingId")
    requireRecord(metricsById.put(id, entry) == null)
  }
  val observations = snapshot.getJSONArray("observations")
  // 指标准备期间可能有删除或新保存，范围变化时要求重新导出。
  val selectedIds = (0 until observations.length()).map {
    observations.getJSONObject(it).getString("id")
  }.toSet()
  if (metricsById.keys != selectedIds) throw StoreException("CONFLICT")
  check(directory.isDirectory || directory.mkdirs())
  // 导出队列串行，清除上次进程中断遗留的私有临时包。
  directory.listFiles()?.filter { it.isFile }?.forEach { check(it.delete()) }
  val output = File(directory, "${UUID.randomUUID()}.zip")
  try {
    ZipOutputStream(output.outputStream().buffered()).use { zip ->
      zip.json("manifest.json", JSONObject().apply {
        put("format", "posture-assistant-export")
        put("version", 2)
        put("metricSchemaVersion", 1)
        put("createdAt", currentTimestamp())
        put("includesPose", includePose)
        put("includesVideo", false)
        put("includesPatientPhotos", photoDirectory != null)
        put("scope", scope.kind)
        put("scopeId", scope.id ?: JSONObject.NULL)
        put("databaseSchemaVersion", schemaVersion)
        put("recordFields", "patients.json 与 assessments.json 使用数据库列名；reports 使用报告 schema。")
        put("notice", "包含健康相关资料，文件未加密，请妥善保管；当前不支持导入。")
      })
      zip.json("patients.json", snapshot.getJSONArray("patients"))
      if (photoDirectory != null) {
        val patients = snapshot.getJSONArray("patients")
        for (index in 0 until patients.length()) {
          val name = patients.getJSONObject(index).optionalText("photo_file") ?: continue
          val id = name.removeSuffix(".jpg")
          if (UUID.fromString(id).toString() + ".jpg" != name) throw StoreException("DATA_CORRUPT")
          val photo = File(photoDirectory, name)
          if (!photo.isFile) throw StoreException("DATA_CORRUPT")
          zip.putNextEntry(ZipEntry("patient-photos/$name"))
          photo.inputStream().use { it.copyTo(zip) }
          zip.closeEntry()
        }
      }
      zip.json("assessments.json", snapshot.getJSONArray("assessments"))
      for (index in 0 until observations.length()) {
        val row = observations.getJSONObject(index)
        val id = row.getString("id")
        val file = observationPoseFile(poseDirectory, id, row.getString("pose_file"))
        val report = JSONObject(readReport(id))
        val metrics = checkNotNull(metricsById[id])
        listOf("taskId", "protocolVersion", "analysisVersion").forEach {
          requireRecord(metrics.recordText(it) == report.recordText(it))
        }
        zip.json("reports/$id.json", report)
        zip.json("metrics/$id.json", metrics)
        if (!includePose) continue
        if (!file.isFile || file.length() != row.getLong("pose_bytes")) {
          throw StoreException("DATA_CORRUPT")
        }
        zip.putNextEntry(ZipEntry("pose/$id.json"))
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
          val buffer = ByteArray(65536)
          var count = input.read(buffer)
          while (count > 0) {
            digest.update(buffer, 0, count)
            zip.write(buffer, 0, count)
            count = input.read(buffer)
          }
        }
        zip.closeEntry()
        val hash = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
        if (hash != row.getString("pose_sha256")) throw StoreException("DATA_CORRUPT")
      }
    }
    return output
  } catch (error: Exception) {
    output.delete()
    throw error
  }
}

private fun ZipOutputStream.json(name: String, value: Any) {
  putNextEntry(ZipEntry(name))
  write(value.toString().toByteArray(Charsets.UTF_8))
  closeEntry()
}
