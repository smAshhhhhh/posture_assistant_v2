package com.postureassist.patients

import org.json.JSONObject
import java.util.UUID

internal fun validateLegacyObservation(report: JSONObject, pose: JSONObject) {
  val id = report.recordText("id")
  requireRecord(UUID.fromString(id).toString() == id)
  requireRecord(report.optInt("schemaVersion") == 1 && pose.optInt("schemaVersion") == 1)
  requireRecord(id == pose.recordText("id"))
  requireRecord(!report.recordText("patientId").startsWith("design-"))
  requireRecord(report.recordText("patientCode").matches(Regex("^[A-Z0-9][A-Z0-9_-]{1,31}$")))
  requireRecord((report.optionalInteger("patientRevision") ?: 0) >= 1)
  requireRecord(report.recordText("observedAt").matches(
    Regex("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$")
  ))
  val versions = when (report.recordText("taskId")) {
    "elbow_flexion_extension" -> "elbow-side-v1" to "elbow-2d-v1"
    "shoulder_flexion" -> "shoulder-side-v1" to "shoulder-2d-v1"
    "seated_knee_extension" -> "knee-seated-side-v1" to "knee-2d-v1"
    "seated_trunk_lean" -> "trunk-seated-side-v1" to "trunk-inclination-2d-v1"
    "sit_to_stand" -> "sit-stand-side-v1" to "sit-stand-2d-v1"
    "march_in_place" -> "march-standing-side-v1" to "march-alternation-2d-v1"
    "short_walk" -> "walk-straight-side-v1" to "walk-knee-cycle-2d-v1"
    else -> throw StoreException("INVALID_RECORD")
  }
  requireRecord(report.recordText("affectedSide") in setOf("left", "right"))
  requireRecord(report.recordText("observedAt") == pose.recordText("observedAt"))
  requireRecord(report.recordText("modelVersion") == pose.recordText("modelVersion"))
  requireRecord(report.recordText("protocolVersion") == versions.first)
  requireRecord(report.recordText("analysisVersion") == versions.second)
  requireRecord(report.recordText("cameraView") == "side")
  val duration = pose.optionalInteger("durationMs")
  requireRecord(duration != null && duration in 0..86_400_000)
  requireRecord(duration == report.optionalInteger("durationMs"))
  requireRecord(pose.opt("isTruncated") is Boolean)
  val status = report.recordText("taskStatus")
  requireRecord(status in setOf("completed", "partial", "assisted", "unable", "stopped_safety"))
  val assistance = report.recordText("assistance")
  requireRecord(assistance in setOf("none", "manual_or_device"))
  requireRecord(status != "completed" || assistance == "none")
  requireRecord(status != "assisted" || assistance == "manual_or_device")
  val reason = report.optionalText("safetyStopReason")
  requireRecord(report.has("safetyStopReason"))
  requireRecord(reason == null || status == "stopped_safety")
  requireRecord(reason == null || reason in setOf("pain", "dizziness", "fatigue", "other"))
  val quality = report.recordText("captureQuality")
  requireRecord(quality in setOf("valid", "degraded", "invalid_capture"))
  val analysis = report.getJSONObject("analysis")
  requireRecord(analysis.recordText("captureQuality") == quality)
  validateAnalysis(analysis, report, checkNotNull(duration))
  if (report.recordText("taskId") == "sit_to_stand") {
    validateSitToStand(analysis, duration)
  } else {
    requireRecord(!analysis.has("sitToStand"))
  }
  if (report.recordText("taskId") == "march_in_place") {
    validateMarchInPlace(analysis, duration)
  } else {
    requireRecord(!analysis.has("marchInPlace"))
  }
  if (pose.getBoolean("isTruncated")) requireRecord(quality == "invalid_capture")
  if (report.recordText("taskId") == "short_walk") {
    validateShortWalk(analysis, report.recordText("affectedSide"))
  } else {
    requireRecord(!analysis.has("shortWalk"))
  }
  if (quality == "invalid_capture") {
    listOf("minAngle", "maxAngle", "rangeOfMotion", "repetitions").forEach {
      requireRecord(analysis.has(it) && analysis.isNull(it))
    }
    requireRecord(report.has("repetitions") && report.isNull("repetitions"))
  }
  val frames = pose.getJSONArray("frames")
  requireRecord(frames.length() <= 9000)
  var previous = -1
  for (index in 0 until frames.length()) {
    val frame = frames.getJSONObject(index)
    val timestamp = frame.optionalInteger("timestampMs")
    requireRecord(timestamp != null && timestamp > previous && timestamp <= checkNotNull(duration))
    previous = checkNotNull(timestamp)
    val width = frame.optionalInteger("imageWidth")
    val height = frame.optionalInteger("imageHeight")
    requireRecord(width != null && width in 1..16384)
    requireRecord(height != null && height in 1..16384)
    requireRecord(frame.opt("isInPreview") is Boolean)
    val points = frame.getJSONArray("landmarks")
    requireRecord(points.length() == 0 || points.length() == 33)
    for (pointIndex in 0 until points.length()) {
      val point = points.getJSONObject(pointIndex)
      listOf("x", "y", "visibility", "presence").forEach { key ->
        val value = point.get(key)
        requireRecord(value is Number && value.toDouble().isFinite())
        val number = (value as Number).toDouble()
        requireRecord(if (key == "x" || key == "y") number in -10.0..10.0 else number in 0.0..1.0)
      }
    }
  }
  val series = analysis.getJSONArray("series")
  requireRecord(series.length() == frames.length())
  for (index in 0 until series.length()) {
    requireRecord(series.getJSONObject(index).optionalInteger("timestampMs") ==
      frames.getJSONObject(index).optionalInteger("timestampMs"))
  }
}

private fun validateAnalysis(analysis: JSONObject, report: JSONObject, duration: Int) {
  val coverage = analysis.boundedNumber("coverage", 1.0)
  analysis.boundedNumber("longestGapMs", duration.toDouble())
  val series = analysis.getJSONArray("series")
  requireRecord(series.length() <= 9000)
  val validCount = analysis.optionalInteger("validSampleCount")
  requireRecord(validCount != null && validCount in 0..series.length())
  val invalid = report.recordText("captureQuality") == "invalid_capture"
  var previous = -1
  val angles = mutableListOf<Double>()
  for (index in 0 until series.length()) {
    val sample = series.getJSONObject(index)
    requireRecord(sample.has("angle"))
    val timestamp = sample.optionalInteger("timestampMs")
    requireRecord(timestamp != null && timestamp > previous && timestamp <= duration)
    previous = checkNotNull(timestamp)
    if (sample.isNull("angle")) continue
    requireRecord(!invalid)
    angles.add(sample.boundedNumber("angle", 180.0))
  }
  if (invalid) return
  requireRecord(duration >= 2000 && angles.size >= 15 && validCount == angles.size && coverage >= 0.5)
  val minimum = analysis.boundedNumber("minAngle", 180.0)
  val maximum = analysis.boundedNumber("maxAngle", 180.0)
  val range = analysis.boundedNumber("rangeOfMotion", 180.0)
  requireRecord(kotlin.math.abs(minimum - angles.min()) <= 1e-6)
  requireRecord(kotlin.math.abs(maximum - angles.max()) <= 1e-6)
  requireRecord(kotlin.math.abs(range - (maximum - minimum)) <= 1e-6)
  val repetitions = analysis.optionalInteger("repetitions")
  requireRecord(repetitions != null && repetitions in 0..9000)
  requireRecord(repetitions == report.optionalInteger("repetitions"))
}

private fun JSONObject.boundedNumber(key: String, maximum: Double): Double {
  val value = get(key)
  requireRecord(value is Number)
  val number = (value as Number).toDouble()
  requireRecord(number.isFinite() && number in 0.0..maximum)
  return number
}
