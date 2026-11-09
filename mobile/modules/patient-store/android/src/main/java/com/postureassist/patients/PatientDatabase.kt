package com.postureassist.patients

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class StoreException(val code: String) : RuntimeException(code)

class PatientDatabase(private val context: Context) :
  SQLiteOpenHelper(context, "posture-patients.db", null, 9) {

  init {
    setWriteAheadLoggingEnabled(true)
  }

  override fun onConfigure(db: SQLiteDatabase) {
    db.setForeignKeyConstraintsEnabled(true)
  }

  override fun onCreate(db: SQLiteDatabase) {
    // SQLiteOpenHelper 在事务内创建表并更新 user_version，失败不留下半成品。
    executeSchema(db, R.raw.patient_schema)
    executeSchema(db, R.raw.observation_schema)
    executeSchema(db, R.raw.observation_media_schema)
  }

  private fun executeSchema(db: SQLiteDatabase, resource: Int) {
    val source = context.resources.openRawResource(resource)
      .bufferedReader().use { it.readText() }
    source.split(';').map { it.trim() }.filter { it.isNotEmpty() }.forEach {
      db.execSQL(it)
    }
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    if (newVersion != 9 || oldVersion !in 1..8) {
      throw StoreException("SCHEMA_UNSUPPORTED")
    }
    if (oldVersion < 8) upgradeObservations(db, oldVersion)
    executeSchema(db, R.raw.patient_photo_upgrade)
  }

  private fun upgradeObservations(db: SQLiteDatabase, oldVersion: Int) {
    if (oldVersion >= 5) {
      // 先复制视频关联，再移除旧表，避免级联删除已有视频索引。
      executeSchema(db, R.raw.observation_media_upgrade_prepare)
      executeSchema(db, R.raw.observation_upgrade_prepare)
      executeSchema(db, R.raw.observation_schema)
      executeSchema(db, R.raw.observation_media_schema)
      executeSchema(db, R.raw.observation_upgrade_copy_with_media)
      return
    }
    if (oldVersion == 1) {
      executeSchema(db, R.raw.observation_schema)
    } else {
      // 同一升级事务中扩展任务约束，逐列保留旧报告和关键点索引。
      executeSchema(db, R.raw.observation_upgrade_prepare)
      executeSchema(db, R.raw.observation_schema)
      executeSchema(db, R.raw.observation_upgrade_copy)
    }
    executeSchema(db, R.raw.observation_media_schema)
  }

  override fun onDowngrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    // 不删除新版本数据来强行打开旧版应用。
    throw StoreException("SCHEMA_UNSUPPORTED")
  }
}
