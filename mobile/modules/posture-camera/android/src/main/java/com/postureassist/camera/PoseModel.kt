package com.postureassist.camera

internal enum class PoseModel(val id: String) {
  LITE("lite"),
  FULL("full"),
  HEAVY("heavy");

  val assetName: String get() = "pose_landmarker_$id.task"
  val lockName: String get() = "pose-model-$id-lock.json"
  val assetStem: String get() = "pose_landmarker_$id"
  val version: String get() = "$assetStem/float16/1"

  companion object {
    fun fromId(id: String): PoseModel =
      entries.firstOrNull { it.id == id } ?: error("未知的姿态模型")
  }
}
