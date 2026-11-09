package com.postureassist.patients

import org.json.JSONObject

internal data class AssessmentValues(
  val scale: String,
  val score: Int,
  val assessedOn: String,
  val assessor: String,
  val notes: String?
)

internal fun parseAssessmentValues(input: JSONObject): AssessmentValues {
  val scale = input.recordText("scale")
  val maximum = mapOf("fma_upper" to 66, "fma_lower" to 34, "berg" to 56, "barthel" to 100)[scale]
    ?: throw StoreException("INVALID_RECORD")
  val score = input.optionalInteger("score") ?: throw StoreException("INVALID_RECORD")
  requireRecord(score in 0..maximum)
  val assessor = input.recordText("assessor")
  requireRecord(assessor.length <= 60)
  val assessedOn = input.recordText("assessedOn")
  validateDate(assessedOn)
  val notes = input.optionalText("notes")
  requireRecord(notes == null || notes.length <= 500)
  return AssessmentValues(scale, score, assessedOn, assessor, notes)
}

internal fun assessmentSnapshotMatches(expected: JSONObject, stored: JSONObject): Boolean =
  listOf(
    "id", "patientId", "scale", "score", "assessedOn", "assessor", "notes", "createdAt"
  ).all { key ->
    expected.has(key) && stored.has(key) && expected.get(key) == stored.get(key)
  }
