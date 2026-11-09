package com.postureassist.patients

import android.database.sqlite.SQLiteDatabase

internal fun readObservationReport(db: SQLiteDatabase, id: String): String {
  val length = db.rawQuery(
    "SELECT length(report_json) FROM observations WHERE id = ?", arrayOf(id)
  ).use { cursor ->
    if (!cursor.moveToFirst()) throw StoreException("NOT_FOUND")
    cursor.getInt(0)
  }
  val output = StringBuilder(length)
  var offset = 1
  // SQLite 按字符分片，避免长报告超过 CursorWindow 的单行容量。
  while (offset <= length) {
    db.rawQuery(
      "SELECT substr(report_json, ?, 65536) FROM observations WHERE id = ?",
      arrayOf(offset.toString(), id)
    ).use { cursor ->
      if (!cursor.moveToFirst()) throw StoreException("NOT_FOUND")
      output.append(cursor.getString(0))
    }
    offset += 65536
  }
  return output.toString()
}
