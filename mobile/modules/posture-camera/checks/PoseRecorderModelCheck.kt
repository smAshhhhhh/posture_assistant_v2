package com.postureassist.camera

import org.json.JSONObject

fun main() {
  val recorder = PoseRecorder()
  for (model in PoseModel.entries) {
    check(PoseModel.fromId(model.id) == model)
    recorder.begin(false, model.version)
    recorder.pause()
    recorder.begin(true, model.version)
    recorder.pause()
    val otherModel = PoseModel.entries.first { it != model }
    check(runCatching { recorder.begin(true, otherModel.version) }.isFailure)
    val recording = JSONObject(recorder.finish())
    check(recording.getString("modelVersion") == model.version)
    recorder.clear()
  }
  check(runCatching { PoseModel.fromId("unknown") }.isFailure)
  println("模型版本记录与暂停恢复一致性检查通过")
}
