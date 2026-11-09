package com.postureassist.patients

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.text.Normalizer
import java.util.Locale
import java.util.UUID

class PatientRecords(private val database: PatientDatabase, context: Context) {
  private val photos = PatientPhotos(context)
  fun list(): String {
    val result = JSONArray()
    database.readableDatabase.rawQuery(
      """SELECT patients.*, (SELECT MAX(observed_at) FROM observations
        WHERE observations.patient_id = patients.id) AS last_observed_at
        FROM patients ORDER BY updated_at DESC, id""", null
    ).use { cursor ->
      while (cursor.moveToNext()) result.put(readPatient(cursor))
    }
    return result.toString()
  }

  fun save(payload: String): String {
    val input = JSONObject(payload)
    val code = Normalizer.normalize(input.recordText("patientCode"), Normalizer.Form.NFKC)
      .uppercase(Locale.ROOT)
    requireRecord(code.matches(Regex("^[A-Z0-9][A-Z0-9_-]{1,31}$")))
    requireRecord(input.opt("hasConsent") == true)
    val side = input.recordText("affectedSide")
    requireRecord(side in setOf("left", "right"))
    val age = input.optionalInteger("ageYears")
    requireRecord(age == null || age in 0..120)
    val onset = input.optionalText("onsetDate")
    onset?.let { validateDate(it) }
    val ability = input.optionalText("abilityLevel")
    requireRecord(ability == null || ability in setOf("mild", "moderate", "severe"))
    val assessor = if (ability == null) null else input.recordText("abilityAssessor")
    val assessedOn = if (ability == null) null else input.recordText("abilityAssessedOn")
    requireRecord(assessor == null || assessor.length <= 60)
    assessedOn?.let { validateDate(it) }
    val currentId = input.optionalText("id")
    val revision = input.optionalInteger("revision")
    requireRecord(currentId == null || !currentId.startsWith("design-"))
    val id = currentId ?: UUID.randomUUID().toString()
    val now = currentTimestamp()
    val db = database.writableDatabase
    var previousPhoto: String? = null
    var nextPhoto: String? = null
    var committed = false
    db.beginTransaction()
    try {
      db.rawQuery(
        "SELECT id FROM patients WHERE patient_code = ? AND id <> ?", arrayOf(code, id)
      ).use { if (it.moveToFirst()) throw StoreException("DUPLICATE_CODE") }
      if (currentId != null) {
        previousPhoto = find(db, id).optionalText("photoFile")
      }
      nextPhoto = if (input.has("photoUri")) {
        photos.persist(input.optionalText("photoUri"), previousPhoto)
      } else previousPhoto
      val values = ContentValues().apply {
        put("patient_code", code)
        put("photo_file", nextPhoto)
        put("age_years", age)
        put("affected_side", side)
        put("onset_date", onset)
        put("ability_level", ability)
        put("ability_assessor", assessor)
        put("ability_assessed_on", assessedOn)
        put("updated_at", now)
      }
      if (currentId == null) {
        values.put("id", id)
        values.put("created_at", now)
        values.put("consent_recorded_at", now)
        values.put("revision", 1)
        db.insertOrThrow("patients", null, values)
      } else {
        requireRecord(revision != null && revision > 0)
        values.put("revision", checkNotNull(revision) + 1)
        val changed = db.update(
          "patients", values, "id = ? AND revision = ?", arrayOf(id, revision.toString())
        )
        if (changed != 1) throw StoreException("CONFLICT")
      }
      val saved = find(db, id)
      db.setTransactionSuccessful()
      committed = true
      return saved.toString()
    } finally {
      try {
        db.endTransaction()
      } catch (error: Exception) {
        committed = false
        throw error
      } finally {
        // 事务失败只回收本次副本，成功后才移除旧头像。
        if (!committed && nextPhoto != previousPhoto) nextPhoto?.let { photos.file(it).delete() }
        if (committed && previousPhoto != nextPhoto) previousPhoto?.let { photos.file(it).delete() }
      }
    }
  }

  private fun find(db: SQLiteDatabase, id: String): JSONObject {
    db.rawQuery("""SELECT patients.*, (SELECT MAX(observed_at) FROM observations
      WHERE observations.patient_id = patients.id) AS last_observed_at
      FROM patients WHERE id = ?""", arrayOf(id)).use {
      if (!it.moveToFirst()) throw StoreException("NOT_FOUND")
      return readPatient(it)
    }
  }

  private fun readPatient(cursor: Cursor): JSONObject {
    val mappings = mapOf(
      "id" to "id", "patientCode" to "patient_code", "affectedSide" to "affected_side",
      "onsetDate" to "onset_date", "abilityLevel" to "ability_level",
      "abilityAssessor" to "ability_assessor", "abilityAssessedOn" to "ability_assessed_on",
      "consentRecordedAt" to "consent_recorded_at", "createdAt" to "created_at",
      "updatedAt" to "updated_at", "lastObservedAt" to "last_observed_at"
    )
    return JSONObject().apply {
      mappings.forEach { (key, column) ->
        val index = cursor.getColumnIndexOrThrow(column)
        put(key, if (cursor.isNull(index)) JSONObject.NULL else cursor.getString(index))
      }
      val ageIndex = cursor.getColumnIndexOrThrow("age_years")
      put("ageYears", if (cursor.isNull(ageIndex)) JSONObject.NULL else cursor.getInt(ageIndex))
      put("revision", cursor.getInt(cursor.getColumnIndexOrThrow("revision")))
      val photoIndex = cursor.getColumnIndexOrThrow("photo_file")
      val photoFile = if (cursor.isNull(photoIndex)) null else cursor.getString(photoIndex)
      put("photoFile", photoFile ?: JSONObject.NULL)
      put("photoUri", photoFile?.let { photos.uri(it) } ?: JSONObject.NULL)
    }
  }
}
