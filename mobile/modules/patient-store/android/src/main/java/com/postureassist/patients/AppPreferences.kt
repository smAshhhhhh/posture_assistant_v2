package com.postureassist.patients

import android.content.Context
import org.json.JSONObject

class AppPreferences(context: Context) {
  private val preferences = context.getSharedPreferences("capture-preferences", Context.MODE_PRIVATE)

  fun load(): String = JSONObject().apply {
    put("showSkeleton", preferences.getBoolean("showSkeleton", true))
    put("showCaptureHints", preferences.getBoolean("showCaptureHints", true))
    put("defaultAssistance", preferences.getBoolean("defaultAssistance", false))
    put("poseModel", preferences.getString("poseModel", "lite"))
  }.toString()

  fun save(payload: String): String {
    val input = JSONObject(payload)
    val keys = listOf("showSkeleton", "showCaptureHints", "defaultAssistance")
    keys.forEach { requireRecord(input.opt(it) is Boolean) }
    // 兼容旧 JS 保存偏好，但不接受未知型号。
    val model = if (input.has("poseModel")) input.getString("poseModel")
      else preferences.getString("poseModel", "lite")
    requireRecord(model in setOf("lite", "full", "heavy"))
    val editor = preferences.edit()
    keys.forEach { editor.putBoolean(it, input.getBoolean(it)) }
    editor.putString("poseModel", model)
    check(editor.commit())
    return load()
  }
}
