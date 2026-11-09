package com.postureassist.patients

import android.content.Context
import org.json.JSONObject

class AppPreferences(context: Context) {
  private val preferences = context.getSharedPreferences("capture-preferences", Context.MODE_PRIVATE)

  fun load(): String = JSONObject().apply {
    put("showSkeleton", preferences.getBoolean("showSkeleton", true))
    put("showCaptureHints", preferences.getBoolean("showCaptureHints", true))
    put("defaultAssistance", preferences.getBoolean("defaultAssistance", false))
  }.toString()

  fun save(payload: String): String {
    val input = JSONObject(payload)
    val keys = listOf("showSkeleton", "showCaptureHints", "defaultAssistance")
    keys.forEach { requireRecord(input.opt(it) is Boolean) }
    val editor = preferences.edit()
    keys.forEach { editor.putBoolean(it, input.getBoolean(it)) }
    check(editor.commit())
    return load()
  }
}
