package com.postureassist.camera

import org.json.JSONObject

fun main() {
  val recorder = PoseRecorder()
  for (model in PoseModel.entries) {
    check(PoseModel.fromId(model.id) == model)
    recorder.begin(false, model.version)
    check(recorder.startVideoClock())
    val firstVideo = recorder.videoFileName()
    recorder.pause()
    recorder.addVideo(firstVideo, 1)
    recorder.begin(true, model.version)
    check(recorder.startVideoClock())
    val secondVideo = recorder.videoFileName()
    recorder.pause()
    recorder.addVideo(secondVideo, 1)
    val otherModel = PoseModel.entries.first { it != model }
    check(runCatching { recorder.begin(true, otherModel.version) }.isFailure)
    val recording = JSONObject(recorder.finish())
    check(recording.getJSONObject("metadata").getString("modelVersion") == model.version)
    val segments = recording.getJSONArray("segments")
    check(segments.length() == 2)
    var duration = 0L
    for (index in 0 until segments.length()) {
      val segment = segments.getJSONObject(index)
      check(segment.getInt("segmentIndex") == index)
      check(segment.getJSONArray("frames").length() == 0)
      check(segment.getString("videoSegmentId") == if (index == 0) firstVideo else secondVideo)
      check(segment.getLong("videoOffsetMs") == 0L)
      duration += segment.getLong("durationMs")
    }
    check(duration == recording.getLong("durationMs"))
    recorder.clear()
  }
  check(runCatching { PoseModel.fromId("unknown") }.isFailure)
  println("模型版本记录与暂停恢复一致性检查通过")
}
