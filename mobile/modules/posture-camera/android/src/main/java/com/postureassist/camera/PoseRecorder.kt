package com.postureassist.camera

import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

class PoseRecorder {
  private var record: JSONObject? = null
  private var segments = JSONArray()
  private var segment: JSONObject? = null
  private var recordingSinceMs: Long? = null
  private var activeSinceMs: Long? = null
  private var segmentSinceMs = 0L
  private var elapsedMs = 0L
  private var lastSampleMs = -100L
  private var frameCount = 0
  private var isTruncated = false
  private var videoSegments = JSONArray()
  private var videoFailed = false
  private var hasVideoStarted = false
  private var hasImageSpace = false
  private var hasMixedImageSpace = false

  @Synchronized fun recordingId(): String? = record?.getString("id")

  @Synchronized fun videoFileName(): String {
    check(videoSegments.length() < 900) { "录像片段数量超出限制" }
    return "${checkNotNull(record).getString("id")}-${videoSegments.length()}.mp4"
  }

  @Synchronized fun addVideo(fileName: String, durationMs: Long) {
    videoSegments.put(JSONObject().put("fileName", fileName).put("durationMs", durationMs))
  }

  @Synchronized fun failVideo() { videoFailed = true }

  @Synchronized fun begin(resume: Boolean, modelVersion: String) {
    check(activeSinceMs == null) { "采集已开始" }
    if (!resume) {
      segments = JSONArray()
      segment = null
      recordingSinceMs = null
      elapsedMs = 0L
      frameCount = 0
      isTruncated = false
      videoSegments = JSONArray()
      videoFailed = false
      hasImageSpace = false
      hasMixedImageSpace = false
      record = JSONObject().apply {
        put("id", UUID.randomUUID().toString())
        put("observedAt", timestamp())
        put("metadata", recordingMetadata(modelVersion))
      }
    }
    val current = checkNotNull(record) { "缺少采集会话" }
    check(current.getJSONObject("metadata").getString("modelVersion") == modelVersion) {
      "同一观察不能混用模型"
    }
    hasVideoStarted = false
    activeSinceMs = SystemClock.uptimeMillis()
  }

  @Synchronized fun startVideoClock(): Boolean {
    if (activeSinceMs == null) return false
    val now = SystemClock.uptimeMillis()
    activeSinceMs = now
    if (recordingSinceMs == null) {
      recordingSinceMs = now
      record?.put("observedAt", timestamp())
    }
    hasVideoStarted = true
    openSegment(now)
    return true
  }

  private fun openSegment(atMs: Long) {
    if (segments.length() >= 9000) {
      isTruncated = true
      return
    }
    segmentSinceMs = atMs
    lastSampleMs = atMs - 100L
    segment = JSONObject().apply {
      put("segmentIndex", segments.length())
      put("startedAtMs", atMs - checkNotNull(recordingSinceMs))
      put("durationMs", 0)
      put("videoSegmentId", videoFileName())
      put("videoOffsetMs", atMs - checkNotNull(activeSinceMs))
      put("imageDimensions", JSONObject.NULL)
      put("preprocessing", JSONObject.NULL)
      put("frames", JSONArray())
    }.also { segments.put(it) }
  }

  private fun closeSegment(atMs: Long) {
    val current = segment ?: return
    val frames = current.getJSONArray("frames")
    val lastFrameMs = frames.optJSONObject(frames.length() - 1)?.getLong("timestampMs") ?: -1L
    // 帧时间使用半开区间，保证相邻片段的分析时间严格递增。
    val duration = maxOf(atMs - segmentSinceMs, lastFrameMs + 1)
    current.put("durationMs", duration)
    elapsedMs += duration
    segment = null
  }

  @Synchronized fun pause() {
    if (activeSinceMs == null) return
    if (hasVideoStarted) closeSegment(SystemClock.uptimeMillis())
    activeSinceMs = null
    hasVideoStarted = false
  }

  @Synchronized fun append(result: PoseOutput, sampledAtMs: Long) {
    val started = activeSinceMs ?: return
    if (!hasVideoStarted || sampledAtMs < started || sampledAtMs - lastSampleMs < 100L) return
    if (frameCount >= 9000) {
      isTruncated = true
      return
    }
    var current = segment ?: return
    val dimensions = result.imageDimensions()
    val preprocessing = result.preprocessing()
    val changed = !current.isNull("preprocessing") &&
      (current.getJSONObject("preprocessing").toString() != preprocessing.toString() ||
       current.getJSONObject("imageDimensions").toString() != dimensions.toString())
    if (changed) {
      closeSegment(sampledAtMs)
      openSegment(sampledAtMs)
      current = segment ?: return
    }
    current.put("imageDimensions", dimensions)
    current.put("preprocessing", preprocessing)
    val metadata = checkNotNull(record).getJSONObject("metadata")
    if (!hasImageSpace) {
      metadata.put("imageDimensions", dimensions).put("preprocessing", preprocessing)
      hasImageSpace = true
    } else if (!hasMixedImageSpace &&
      (metadata.getJSONObject("preprocessing").toString() != preprocessing.toString() ||
       metadata.getJSONObject("imageDimensions").toString() != dimensions.toString())) {
      // 公共图像空间变化后仅使用各片段的准确值。
      hasMixedImageSpace = true
      metadata.put("imageDimensions", JSONObject.NULL).put("preprocessing", JSONObject.NULL)
    }
    val points = JSONArray()
    result.landmarks.forEach { point ->
      points.put(JSONObject().apply {
        put("x", point.x().toDouble())
        put("y", point.y().toDouble())
        put("z", point.z().toDouble())
        put("visibility", point.visibility().orElse(0f).toDouble())
        put("presence", point.presence().orElse(0f).toDouble())
      })
    }
    current.getJSONArray("frames").put(JSONObject()
      .put("timestampMs", sampledAtMs - segmentSinceMs).put("landmarks", points))
    lastSampleMs = sampledAtMs
    frameCount += 1
  }

  @Synchronized fun finish(): String {
    if (activeSinceMs != null) pause()
    return checkNotNull(record) { "缺少采集会话" }.apply {
      put("durationMs", elapsedMs)
      put("isTruncated", isTruncated)
      put("segments", segments)
      put("video", JSONObject().put("segments", videoSegments)
        .put("error", if (videoFailed) "recording_failed" else JSONObject.NULL))
    }.toString()
  }

  @Synchronized fun clear() {
    check(activeSinceMs == null) { "采集尚未停止" }
    record = null
    segments = JSONArray()
    segment = null
  }

  private fun timestamp(): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
      timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date())
}
