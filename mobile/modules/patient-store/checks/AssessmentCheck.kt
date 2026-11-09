package com.postureassist.patients

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

fun main() {
  val record = JSONObject("""{
    "id":"assessment-1","patientId":"patient-1","scale":"berg","score":0,
    "assessedOn":"2026-11-09","assessor":"T-03","notes":null,
    "createdAt":"2026-11-09T10:00:00.000Z"
  }""")
  check(assessmentSnapshotMatches(JSONObject(record.toString()), record))
  val changes = mapOf(
    "id" to "assessment-2", "patientId" to "patient-2", "scale" to "barthel",
    "score" to 1, "assessedOn" to "2026-11-08", "assessor" to "T-04",
    "notes" to "更正备注", "createdAt" to "2026-11-09T10:01:00.000Z"
  )
  changes.forEach { (key, value) ->
    val changed = JSONObject(record.toString()).put(key, value)
    check(!assessmentSnapshotMatches(record, changed)) { "变化未被发现：$key" }
    val missing = JSONObject(record.toString()).apply { remove(key) }
    check(!assessmentSnapshotMatches(missing, record)) { "缺失字段未被发现：$key" }
  }
  check(!assessmentSnapshotMatches(JSONObject(record.toString()).put("score", "0"), record))
  check(!assessmentSnapshotMatches(JSONObject(record.toString()).put("notes", ""), record))
  val noted = JSONObject(record.toString()).put("notes", "首次记录")
  check(assessmentSnapshotMatches(JSONObject(noted.toString()), noted))
  check(!assessmentSnapshotMatches(noted, record))
  val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
  val input = JSONObject(record.toString()).put("assessedOn", today)
  for ((scale, maximum) in mapOf("fma_upper" to 66, "fma_lower" to 34, "berg" to 56, "barthel" to 100)) {
    val zero = JSONObject(input.toString()).put("scale", scale).put("score", 0)
    check(parseAssessmentValues(zero).score == 0)
    check(parseAssessmentValues(zero).notes == null)
    check(parseAssessmentValues(JSONObject(zero.toString()).put("score", maximum)).score == maximum)
    for (score in listOf(-1, maximum + 1, 0.5, "0", JSONObject.NULL)) {
      expectInvalid(JSONObject(zero.toString()).put("score", score))
    }
  }
  for ((key, value) in mapOf(
    "scale" to "unknown", "assessor" to " ", "notes" to "文".repeat(501)
  )) {
    expectInvalid(JSONObject(input.toString()).put(key, value))
  }
  expectInvalid(JSONObject(input.toString()).put("assessor", "文".repeat(61)))
  for (date in listOf("2026-02-29", "2026-1-01", "2999-01-01", "1899-12-31")) {
    expectInvalid(JSONObject(input.toString()).put("assessedOn", date))
  }
  val trimmed = parseAssessmentValues(
    JSONObject(input.toString()).put("assessor", " T-03 ").put("notes", " 更正备注 ")
  )
  check(trimmed.assessor == "T-03" && trimmed.notes == "更正备注")
  println("Assessment validation and snapshot checks passed")
}

private fun expectInvalid(input: JSONObject) {
  val failure = runCatching { parseAssessmentValues(input) }.exceptionOrNull()
  check(failure is StoreException && failure.code == "INVALID_RECORD")
}
