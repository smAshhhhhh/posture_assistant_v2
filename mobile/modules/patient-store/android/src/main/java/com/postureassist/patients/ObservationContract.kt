package com.postureassist.patients

import org.json.JSONArray
import org.json.JSONObject

internal fun validateObservation(report: JSONObject, pose: JSONObject) {
  requireRecord(report.optInt("schemaVersion") == 2)
  requireRecord(!report.has("analysis") && !report.has("safetyStopReason"))
  requireRecord(!report.has("sourceSchemaVersion") && !report.has("legacySafetyStopReason"))
  val status = report.recordText("taskStatus")
  requireRecord(status in setOf("completed", "partial", "assisted", "unable"))
  val task = report.getJSONObject("taskAnalysis")
  val taskId = report.recordText("taskId")
  requireRecord(task.recordText("recordingId") == report.recordText("id"))
  requireRecord(task.recordText("taskId") == taskId && task.recordText("taskStatus") == status)
  listOf("protocolVersion", "analysisVersion").forEach {
    requireRecord(task.recordText(it) == report.recordText(it))
  }
  val common = task.getJSONObject("commonMetrics")
  requireRecord(common.keys().asSequence().toSet() == setOf("durationMs", "repetitions"))
  requireRecord(common.optionalInteger("durationMs") == report.optionalInteger("durationMs"))
  requireRecord(common.has("repetitions") && report.has("repetitions"))
  requireRecord(common.optionalInteger("repetitions") == report.optionalInteger("repetitions"))
  val result = task.getJSONObject("taskResult")
  requireRecord(result.keys().asSequence().all { it == "angle" || it == "metrics" })
  val analysis = JSONObject(task.getJSONObject("qualityAssessment").toString())
  requireRecord(analysis.keys().asSequence().toSet() ==
    setOf("captureQuality", "coverage", "validSampleCount", "longestGapMs"))
  val angle = result.getJSONObject("angle")
  requireRecord(angle.keys().asSequence().toSet() ==
    setOf("minAngle", "maxAngle", "rangeOfMotion", "series"))
  listOf("minAngle", "maxAngle", "rangeOfMotion", "series").forEach {
    analysis.put(it, angle.get(it))
  }
  analysis.put("repetitions", common.get("repetitions"))
  val specialized = when (taskId) {
    "sit_to_stand" -> "sitToStand"
    "march_in_place" -> "marchInPlace"
    "short_walk" -> "shortWalk"
    else -> null
  }
  if (specialized != null) analysis.put(specialized, result.getJSONObject("metrics"))
  else requireRecord(!result.has("metrics"))
  val normalizedReport = JSONObject(report.toString()).apply {
    put("schemaVersion", 1)
    put("analysis", analysis)
    put("safetyStopReason", JSONObject.NULL)
  }
  val normalizedPose = normalizePoseRecording(pose)
  validateLegacyObservation(normalizedReport, normalizedPose)
  validateCaptureBoundaries(analysis, pose, taskId, normalizedPose.getJSONArray("frames"))
}

internal fun normalizePoseRecording(pose: JSONObject): JSONObject {
  val metadata = pose.getJSONObject("metadata")
  validatePoseMetadata(metadata)
  val segments = pose.getJSONArray("segments")
  requireRecord(segments.length() <= 9000)
  val frames = JSONArray()
  var durationMs = 0L
  var previousEnd = 0L
  for (index in 0 until segments.length()) {
    val segment = segments.getJSONObject(index)
    requireRecord(segment.optionalInteger("segmentIndex") == index)
    val start = segment.optionalInteger("startedAtMs") ?: throw StoreException("INVALID_RECORD")
    val duration = segment.optionalInteger("durationMs") ?: throw StoreException("INVALID_RECORD")
    requireRecord(start >= previousEnd && duration >= 0 && start.toLong() + duration <= 86_400_000)
    previousEnd = start.toLong() + duration
    validateImageSpace(segment)
    val dimensions = segment.optJSONObject("imageDimensions")
    if (!metadata.isNull("imageDimensions") && dimensions != null) {
      listOf("imageDimensions", "preprocessing").forEach { key ->
        requireRecord(jsonEquivalent(metadata.get(key), segment.get(key)))
      }
    }
    val rawFrames = segment.getJSONArray("frames")
    requireRecord(rawFrames.length() == 0 || dimensions != null)
    val videoOffset = segment.optionalInteger("videoOffsetMs")
    requireRecord(videoOffset != null && videoOffset in 0..86_400_000)
    requireRecord(segment.has("videoSegmentId"))
    val videoId = segment.optionalText("videoSegmentId")
    if (videoId != null) {
      val id = pose.recordText("id")
      requireRecord(videoId.matches(Regex("$id-[0-9]+\\.mp4")))
      val video = pose.optJSONObject("video")
      requireRecord(video != null)
      if (video != null && video.isNull("error")) {
        val videos = video.getJSONArray("segments")
        requireRecord((0 until videos.length()).any {
          videos.getJSONObject(it).recordText("fileName") == videoId
        })
      }
    }
    var previousFrame = -1
    for (frameIndex in 0 until rawFrames.length()) {
      val frame = rawFrames.getJSONObject(frameIndex)
      val atMs = frame.optionalInteger("timestampMs") ?: throw StoreException("INVALID_RECORD")
      requireRecord(atMs > previousFrame && atMs >= 0 && atMs < duration)
      requireRecord(frame.keys().asSequence().toSet() == setOf("timestampMs", "landmarks"))
      val landmarks = frame.getJSONArray("landmarks")
      for (pointIndex in 0 until landmarks.length()) {
        val point = landmarks.getJSONObject(pointIndex)
        requireRecord(point.keys().asSequence().toSet() ==
          setOf("x", "y", "z", "visibility", "presence"))
        val depth = point.get("z")
        requireRecord(depth is Number && depth.toDouble().isFinite() &&
          depth.toDouble() in -10.0..10.0)
      }
      previousFrame = atMs
      frames.put(JSONObject().apply {
        put("timestampMs", durationMs + atMs)
        put("imageWidth", dimensions?.getInt("width") ?: 1)
        put("imageHeight", dimensions?.getInt("height") ?: 1)
        put("isInPreview", true)
        put("segmentIndex", index)
        put("landmarks", frame.getJSONArray("landmarks"))
      })
    }
    durationMs += duration
  }
  requireRecord(durationMs <= 86_400_000 && durationMs == pose.optionalInteger("durationMs")?.toLong())
  requireRecord(frames.length() <= 9000)
  return JSONObject(pose.toString()).apply {
    put("schemaVersion", 1)
    put("modelVersion", metadata.recordText("modelVersion"))
    put("frames", frames)
  }
}

private fun validatePoseMetadata(metadata: JSONObject) {
  requireRecord(metadata.optInt("schemaVersion") == 2)
  metadata.recordText("modelVersion")
  requireRecord(metadata.recordText("timeBasis") == "segment_relative_monotonic_ms")
  requireRecord(metadata.optionalInteger("samplingIntervalMs") == 100)
  val coordinates = metadata.getJSONObject("coordinateSystem")
  mapOf("space" to "normalized_image", "origin" to "top_left", "xDirection" to "right",
    "yDirection" to "down", "depth" to "mediapipe_relative_non_metric",
    "depthOrigin" to "hip_midpoint", "zDirection" to "toward_camera_negative"
  ).forEach { (key, expected) ->
    requireRecord(coordinates.recordText(key) == expected)
  }
  val order = listOf(
    "nose", "left_eye_inner", "left_eye", "left_eye_outer", "right_eye_inner", "right_eye",
    "right_eye_outer", "left_ear", "right_ear", "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist",
    "left_pinky", "right_pinky", "left_index", "right_index", "left_thumb", "right_thumb",
    "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle",
    "left_heel", "right_heel", "left_foot_index", "right_foot_index"
  )
  val actual = metadata.getJSONArray("landmarkOrder")
  requireRecord(actual.length() == order.size)
  order.forEachIndexed { index, name -> requireRecord(actual.getString(index) == name) }
  validateImageSpace(metadata)
}

private fun validateImageSpace(value: JSONObject) {
  requireRecord(value.has("imageDimensions") && value.has("preprocessing"))
  if (value.isNull("imageDimensions") && value.isNull("preprocessing")) return
  val dimensions = value.getJSONObject("imageDimensions")
  val input = value.getJSONObject("preprocessing")
  val source = input.getJSONObject("sourceImageDimensions")
  val sourceWidth = source.optionalInteger("width") ?: throw StoreException("INVALID_RECORD")
  val sourceHeight = source.optionalInteger("height") ?: throw StoreException("INVALID_RECORD")
  requireRecord(sourceWidth in 1..16384 && sourceHeight in 1..16384)
  val crop = input.getJSONObject("cropRect")
  val left = crop.optionalInteger("left") ?: throw StoreException("INVALID_RECORD")
  val top = crop.optionalInteger("top") ?: throw StoreException("INVALID_RECORD")
  val width = crop.optionalInteger("width") ?: throw StoreException("INVALID_RECORD")
  val height = crop.optionalInteger("height") ?: throw StoreException("INVALID_RECORD")
  requireRecord(left in 0 until sourceWidth && top in 0 until sourceHeight)
  requireRecord(width in 1..(sourceWidth - left) && height in 1..(sourceHeight - top))
  val rotation = input.optionalInteger("rotationDegrees")
  requireRecord(rotation in listOf(0, 90, 180, 270))
  val swaps = rotation == 90 || rotation == 270
  requireRecord(dimensions.optionalInteger("width") == if (swaps) height else width)
  requireRecord(dimensions.optionalInteger("height") == if (swaps) width else height)
  requireRecord(input.recordText("imageSpace") == "cropped_upright_model_input")
  requireRecord(input.opt("mirrored") == false)
  val matrix = input.getJSONArray("bufferToModelMatrix")
  requireRecord(matrix.length() == 9)
  for (index in 0..8) {
    val element = matrix.get(index)
    requireRecord(element is Number && element.toDouble().isFinite() &&
      element.toDouble() in -1_000_000.0..1_000_000.0)
  }
  val expected = when (rotation) {
    0 -> listOf(1, 0, -left, 0, 1, -top, 0, 0, 1)
    90 -> listOf(0, -1, top + height, 1, 0, -left, 0, 0, 1)
    180 -> listOf(-1, 0, left + width, 0, -1, top + height, 0, 0, 1)
    else -> listOf(0, 1, -top, -1, 0, left + width, 0, 0, 1)
  }
  expected.forEachIndexed { index, number ->
    requireRecord(kotlin.math.abs(matrix.getDouble(index) - number) <= 0.01)
  }
}

private fun jsonEquivalent(first: Any, second: Any): Boolean {
  if (first is JSONObject && second is JSONObject) {
    val keys = first.keys().asSequence().toSet()
    return keys == second.keys().asSequence().toSet() && keys.all {
      jsonEquivalent(first.get(it), second.get(it))
    }
  }
  if (first is JSONArray && second is JSONArray) {
    return first.length() == second.length() && (0 until first.length()).all {
      jsonEquivalent(first.get(it), second.get(it))
    }
  }
  if (first is Number && second is Number) return first.toDouble() == second.toDouble()
  return first == second
}

private fun validateCaptureBoundaries(
  analysis: JSONObject, pose: JSONObject, taskId: String, normalized: JSONArray
) {
  val ranges = mutableListOf<LongRange>()
  val segments = pose.getJSONArray("segments")
  var offset = 0L
  for (index in 0 until segments.length()) {
    val duration = segments.getJSONObject(index).getLong("durationMs")
    ranges.add(offset until offset + duration)
    offset += duration
  }
  val events = when (taskId) {
    "sit_to_stand" -> analysis.getJSONObject("sitToStand").getJSONArray("cycles")
    "march_in_place" -> analysis.getJSONObject("marchInPlace").getJSONArray("steps")
    "short_walk" -> analysis.getJSONObject("shortWalk").getJSONArray("cycles")
    else -> JSONArray()
  }
  for (index in 0 until events.length()) {
    val event = events.getJSONObject(index)
    val start = event.getLong("startedAtMs")
    val end = if (taskId == "short_walk") event.getLong("confirmedAtMs")
      else event.getLong("endedAtMs")
    requireRecord(ranges.any { start in it && end in it })
  }
  val series = analysis.getJSONArray("series")
  for (index in 0 until series.length()) {
    val current = series.getJSONObject(index)
    val segment = current.optionalInteger("segmentIndex")
    requireRecord(segment != null && segment >= 0 && segment < segments.length())
    requireRecord(segment == normalized.getJSONObject(index).getInt("segmentIndex"))
    if (index == 0) continue
    if (normalized.getJSONObject(index).getInt("segmentIndex") !=
      normalized.getJSONObject(index - 1).getInt("segmentIndex")) {
      requireRecord(segment != series.getJSONObject(index - 1).optionalInteger("segmentIndex"))
    }
  }
}
