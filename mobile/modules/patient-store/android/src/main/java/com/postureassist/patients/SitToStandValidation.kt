package com.postureassist.patients

import org.json.JSONObject

internal fun validateSitToStand(analysis: JSONObject, duration: Int) {
  val metrics = analysis.getJSONObject("sitToStand")
  val cycles = metrics.getJSONArray("cycles")
  val invalid = analysis.recordText("captureQuality") == "invalid_capture"
  requireRecord(cycles.length() <= 9000)
  requireRecord(cycles.length() == if (invalid) 0 else analysis.optionalInteger("repetitions"))
  val series = analysis.getJSONArray("series")
  var previousEnd = -1.0
  var riseTotal = 0.0
  var descentTotal = 0.0
  for (index in 0 until cycles.length()) {
    val cycle = cycles.getJSONObject(index)
    val start = cycle.stageTime("startedAtMs", duration)
    val standing = cycle.stageTime("standingAtMs", duration)
    val descent = cycle.stageTime("descentStartedAtMs", duration)
    val end = cycle.stageTime("endedAtMs", duration)
    requireRecord(start > previousEnd && start < standing && standing + 300 <= descent &&
      descent < end && end + 300 <= duration)
    var previous = -1.0
    var captureSegment: Int? = null
    val found = mutableSetOf<Double>()
    var confirmedAt = -1.0
    for (sampleIndex in 0 until series.length()) {
      val sample = series.getJSONObject(sampleIndex)
      val time = sample.getDouble("timestampMs")
      if (time < start) continue
      requireRecord(!sample.isNull("angle"))
      requireRecord(previous < 0 || time - previous <= 250)
      requireRecord(previous < 0 || sample.optionalInteger("segmentIndex") == captureSegment)
      captureSegment = sample.optionalInteger("segmentIndex")
      found.add(time)
      previous = time
      if (time >= end + 300) {
        confirmedAt = time
        break
      }
    }
    requireRecord(confirmedAt >= 0 && listOf(start, standing, descent, end).all { it in found })
    previousEnd = confirmedAt
    riseTotal += standing - start
    descentTotal += end - descent
  }
  for ((key, total) in listOf(
    "meanRiseDurationMs" to riseTotal, "meanDescentDurationMs" to descentTotal
  )) {
    requireRecord(metrics.has(key))
    if (cycles.length() == 0) {
      requireRecord(metrics.isNull(key))
    } else {
      val actual = metrics.stageTime(key, duration)
      requireRecord(kotlin.math.abs(actual - total / cycles.length()) <= 1e-6)
    }
  }
}

private fun JSONObject.stageTime(key: String, duration: Int): Double {
  val value = get(key)
  requireRecord(value is Number)
  val number = (value as Number).toDouble()
  requireRecord(number.isFinite() && number in 0.0..duration.toDouble())
  return number
}
