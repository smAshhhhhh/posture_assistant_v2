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
  private var frames = JSONArray()
  private var activeSinceMs: Long? = null
  private var elapsedMs = 0L
  private var lastSampleMs = -100L
  private var isTruncated = false
  private var videoSegments = JSONArray()
  private var videoFailed = false
  private var hasVideoStarted = false
  @Synchronized fun recordingId(): String? = record?.getString("id")

  @Synchronized fun videoFileName(): String {
    check(videoSegments.length() < 900) { "录像片段数量超出限制" }
    return "${checkNotNull(record).getString("id")}-${videoSegments.length()}.mp4"
  }

  @Synchronized fun addVideo(fileName: String, durationMs: Long) {
    videoSegments.put(JSONObject().put("fileName", fileName).put("durationMs", durationMs))
  }

  @Synchronized fun failVideo() { videoFailed = true }

  @Synchronized fun begin(resume: Boolean) {
    check(activeSinceMs == null) { "采集已开始" }
    if (!resume) {
      frames = JSONArray()
      elapsedMs = 0L
      lastSampleMs = -100L
      isTruncated = false
      videoSegments = JSONArray()
      videoFailed = false
      record = JSONObject().apply {
        put("schemaVersion", 1)
        put("id", UUID.randomUUID().toString())
        put("observedAt", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
          timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date()))
        put("modelVersion", "pose_landmarker_lite/float16/1")
      }
    }
    check(record != null) { "缺少采集会话" }
    hasVideoStarted = false
    activeSinceMs = SystemClock.uptimeMillis()
  }

  @Synchronized fun startVideoClock(): Boolean {
    if (activeSinceMs == null) return false
    // 等编码器真正启动再对齐关键点起点，避免把准备编码的时间当作观察。
    activeSinceMs = SystemClock.uptimeMillis()
    hasVideoStarted = true
    return true
  }

  @Synchronized fun pause() {
    val started = activeSinceMs ?: return
    if (hasVideoStarted) elapsedMs += SystemClock.uptimeMillis() - started
    activeSinceMs = null
    hasVideoStarted = false
    // 暂停前后不跨区间连接角度曲线或动作周期。
    lastSampleMs = elapsedMs
    if (record != null) {
      val last = frames.optJSONObject(frames.length() - 1)?.optLong("timestampMs") ?: -1L
      val boundary = JSONObject().apply {
        put("timestampMs", elapsedMs)
        put("imageWidth", 1)
        put("imageHeight", 1)
        put("isInPreview", false)
        put("landmarks", JSONArray())
      }
      if (elapsedMs == last) frames.put(frames.length() - 1, boundary)
      else if (frames.length() < 9000) frames.put(boundary)
      else isTruncated = true
    }
  }

  @Synchronized fun append(result: PoseOutput, isInPreview: Boolean, sampledAtMs: Long) {
    val started = activeSinceMs ?: return
    if (!hasVideoStarted) return
    // 使用分析开始时的单调时钟，丢弃开始或恢复之前仍在途的帧。
    if (sampledAtMs < started) return
    val timestamp = elapsedMs + sampledAtMs - started
    if (timestamp - lastSampleMs < 100L) return
    lastSampleMs = timestamp
    if (frames.length() >= 9000) {
      isTruncated = true
      return
    }
    val points = JSONArray()
    result.landmarks.forEach { point ->
      points.put(JSONObject().apply {
        put("x", point.x().toDouble())
        put("y", point.y().toDouble())
        put("visibility", point.visibility().orElse(0f).toDouble())
        put("presence", point.presence().orElse(0f).toDouble())
      })
    }
    frames.put(JSONObject().apply {
      put("timestampMs", timestamp)
      put("imageWidth", result.imageWidth)
      put("imageHeight", result.imageHeight)
      put("isInPreview", isInPreview)
      put("landmarks", points)
    })
  }

  @Synchronized fun finish(): String {
    if (activeSinceMs != null) pause()
    return checkNotNull(record) { "缺少采集会话" }.apply {
      put("durationMs", elapsedMs)
      put("isTruncated", isTruncated)
      put("frames", frames)
      put("video", JSONObject().apply {
        put("segments", videoSegments)
        put("error", if (videoFailed) "recording_failed" else JSONObject.NULL)
      })
    }.toString()
  }

  @Synchronized fun clear() {
    check(activeSinceMs == null) { "采集尚未停止" }
    record = null
    frames = JSONArray()
  }
}
