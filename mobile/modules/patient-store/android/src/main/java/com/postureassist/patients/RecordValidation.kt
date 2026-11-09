package com.postureassist.patients

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.text.ParsePosition
import java.util.Date
import java.util.Locale
import java.util.TimeZone

internal fun requireRecord(condition: Boolean) {
  if (!condition) throw StoreException("INVALID_RECORD")
}

internal fun JSONObject.optionalText(key: String): String? {
  if (!has(key) || isNull(key)) return null
  val value = get(key)
  requireRecord(value is String)
  return (value as String).trim().ifEmpty { null }
}

internal fun JSONObject.recordText(key: String): String =
  optionalText(key) ?: throw StoreException("INVALID_RECORD")

internal fun validateDate(value: String) {
  val format = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }
  val position = ParsePosition(0)
  val parsed = format.parse(value, position)
  requireRecord(parsed != null && position.index == value.length)
  requireRecord(value.matches(Regex("^\\d{4}-\\d{2}-\\d{2}$")))
  requireRecord(value >= "1900-01-01" && value <= format.format(Date()))
}

// 兼容最低 API 24，不依赖 API 26 才提供的 java.time。
internal fun currentTimestamp(): String =
  SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
  }.format(Date())

internal fun JSONObject.optionalInteger(key: String): Int? {
  if (!has(key) || isNull(key)) return null
  val value = get(key)
  requireRecord(value is Number)
  val number = (value as Number).toDouble()
  requireRecord(number.isFinite() && number == number.toInt().toDouble())
  return number.toInt()
}
