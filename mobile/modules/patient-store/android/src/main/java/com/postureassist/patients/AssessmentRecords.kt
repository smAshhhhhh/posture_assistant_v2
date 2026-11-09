package com.postureassist.patients

import android.content.ContentValues
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class AssessmentRecords(private val database: PatientDatabase) {
  fun list(patientId: String): String {
    val db = database.readableDatabase
    requirePatient(db, patientId)
    val result = JSONArray()
    db.rawQuery(
      "SELECT * FROM clinical_assessments WHERE patient_id = ? " +
        "ORDER BY assessed_on DESC, created_at DESC, id", arrayOf(patientId)
    ).use { cursor ->
      while (cursor.moveToNext()) result.put(readAssessment(cursor))
    }
    return result.toString()
  }

  fun add(payload: String): String {
    val input = JSONObject(payload)
    val patientId = input.recordText("patientId")
    requireRecord(!patientId.startsWith("design-"))
    val values = assessmentValues(input)
    val id = UUID.randomUUID().toString()
    values.put("id", id)
    values.put("patient_id", patientId)
    values.put("created_at", currentTimestamp())
    val db = database.writableDatabase
    db.beginTransaction()
    try {
      requirePatient(db, patientId)
      db.insertOrThrow("clinical_assessments", null, values)
      val saved = find(db, id, patientId).toString()
      db.setTransactionSuccessful()
      return saved
    } finally {
      db.endTransaction()
    }
  }

  fun update(payload: String): String {
    val input = JSONObject(payload)
    val current = input.getJSONObject("current")
    val values = assessmentValues(input.getJSONObject("values"))
    return mutate(current) { db, id, patientId ->
      val changed = db.update(
        "clinical_assessments", values, "id = ? AND patient_id = ?", arrayOf(id, patientId)
      )
      check(changed == 1)
      find(db, id, patientId).toString()
    }
  }

  fun delete(payload: String): String = mutate(JSONObject(payload)) { db, id, patientId ->
    val changed = db.delete(
      "clinical_assessments", "id = ? AND patient_id = ?", arrayOf(id, patientId)
    )
    check(changed == 1)
    id
  }

  private fun mutate(
    current: JSONObject,
    action: (SQLiteDatabase, String, String) -> String
  ): String {
    val id = current.recordText("id")
    val patientId = current.recordText("patientId")
    requireRecord(!id.startsWith("design-") && !patientId.startsWith("design-"))
    val db = database.writableDatabase
    db.beginTransaction()
    try {
      val stored = find(db, id, patientId)
      // 同一事务内核对完整原值，旧页面不能覆盖或删除已变更的评估。
      if (!assessmentSnapshotMatches(current, stored)) {
        throw StoreException("ASSESSMENT_CONFLICT")
      }
      val result = action(db, id, patientId)
      db.setTransactionSuccessful()
      return result
    } finally {
      db.endTransaction()
    }
  }

  private fun requirePatient(db: SQLiteDatabase, patientId: String) {
    db.rawQuery("SELECT id FROM patients WHERE id = ?", arrayOf(patientId)).use {
      if (!it.moveToFirst()) throw StoreException("NOT_FOUND")
    }
  }

  private fun find(db: SQLiteDatabase, id: String, patientId: String): JSONObject =
    db.rawQuery(
      "SELECT * FROM clinical_assessments WHERE id = ? AND patient_id = ?",
      arrayOf(id, patientId)
    ).use {
      if (!it.moveToFirst()) throw StoreException("ASSESSMENT_NOT_FOUND")
      readAssessment(it)
    }
}

private fun readAssessment(cursor: Cursor): JSONObject = JSONObject().apply {
  mapOf(
    "id" to "id", "patientId" to "patient_id", "scale" to "scale",
    "assessedOn" to "assessed_on", "assessor" to "assessor",
    "notes" to "notes", "createdAt" to "created_at"
  ).forEach { (key, column) ->
    val index = cursor.getColumnIndexOrThrow(column)
    put(key, if (cursor.isNull(index)) JSONObject.NULL else cursor.getString(index))
  }
  put("score", cursor.getInt(cursor.getColumnIndexOrThrow("score")))
}

private fun assessmentValues(input: JSONObject): ContentValues {
  val values = parseAssessmentValues(input)
  return ContentValues().apply {
    put("scale", values.scale)
    put("score", values.score)
    put("assessed_on", values.assessedOn)
    put("assessor", values.assessor)
    put("notes", values.notes)
  }
}
