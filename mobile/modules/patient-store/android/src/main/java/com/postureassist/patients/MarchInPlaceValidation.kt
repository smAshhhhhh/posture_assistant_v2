package com.postureassist.patients

import org.json.JSONObject

internal fun validateMarchInPlace(analysis: JSONObject, duration: Int) {
  val metrics = analysis.getJSONObject("marchInPlace")
  val steps = metrics.getJSONArray("steps")
  val invalid = analysis.recordText("captureQuality") == "invalid_capture"
  requireRecord(steps.length() <= 9000)
  requireRecord(steps.length() == if (invalid) 0 else analysis.optionalInteger("repetitions"))
  val series = analysis.getJSONArray("series")
  var previousEnd = -1.0
  var previousSegment = -1
  var previousSide = ""
  var leftSteps = 0
  var alternationErrors = 0
  var totalDuration = 0.0
  for (index in 0 until steps.length()) {
    val step = steps.getJSONObject(index)
    val side = step.recordText("side")
    val segment = step.optionalInteger("segmentIndex")
    val start = step.marchNumber("startedAtMs", 0.0, duration.toDouble())
    val peak = step.marchNumber("peakAtMs", 0.0, duration.toDouble())
    val end = step.marchNumber("endedAtMs", 0.0, duration.toDouble())
    step.marchNumber("liftRatio", 0.08, 1.0)
    requireRecord(side in setOf("left", "right"))
    requireRecord(segment != null && segment in 0..9000 && segment >= previousSegment)
    requireRecord(start > previousEnd && peak >= start && peak < end && end - start in 150.0..3000.0)
    var hasBreak = false
    var priorBetweenTime = -1.0
    for (sampleIndex in 0 until series.length()) {
      val sample = series.getJSONObject(sampleIndex)
      val time = sample.getDouble("timestampMs")
      if (time < previousEnd || time > start) continue
      if (sample.isNull("angle") || (priorBetweenTime >= 0 && time - priorBetweenTime > 250)) {
        hasBreak = true
      }
      priorBetweenTime = time
    }
    requireRecord(previousSegment < 0 || segment == previousSegment || hasBreak)
    var evidenceStart = if (segment == previousSegment) previousEnd else -1.0
    if (segment != previousSegment) {
      for (sampleIndex in 0 until series.length()) {
        val time = series.getJSONObject(sampleIndex).getDouble("timestampMs")
        if (time <= start - 500) evidenceStart = time
      }
    }
    requireRecord(evidenceStart >= 0)
    var previousTime = -1.0
    val found = mutableSetOf<Double>()
    for (sampleIndex in 0 until series.length()) {
      val sample = series.getJSONObject(sampleIndex)
      val time = sample.getDouble("timestampMs")
      if (time < evidenceStart || time > end) continue
      requireRecord(!sample.isNull("angle"))
      requireRecord(previousTime < 0 || time - previousTime <= 250)
      found.add(time)
      previousTime = time
    }
    requireRecord(listOf(start, peak, end).all { it in found })
    if (side == "left") leftSteps++
    if (previousSegment == segment && previousSide == side) alternationErrors++
    totalDuration += end - start
    previousEnd = end
    previousSegment = checkNotNull(segment)
    previousSide = side
  }
  val expected = mapOf(
    "leftSteps" to if (invalid) null else leftSteps.toDouble(),
    "rightSteps" to if (invalid) null else (steps.length() - leftSteps).toDouble(),
    "alternationErrors" to if (invalid) null else alternationErrors.toDouble(),
    "meanStepDurationMs" to if (steps.length() == 0) null else totalDuration / steps.length(),
    "cadencePerMinute" to if (steps.length() == 0) null else steps.length() * 60000.0 / duration,
  )
  expected.forEach { (key, correct) ->
    requireRecord(metrics.has(key))
    if (correct == null) {
      requireRecord(metrics.isNull(key))
    } else {
      val actual = metrics.marchNumber(key, 0.0, Double.MAX_VALUE)
      requireRecord(kotlin.math.abs(actual - correct) <= 1e-6)
    }
  }
}

private fun JSONObject.marchNumber(key: String, minimum: Double, maximum: Double): Double {
  val value = get(key)
  requireRecord(value is Number)
  val number = (value as Number).toDouble()
  requireRecord(number.isFinite() && number in minimum..maximum)
  return number
}
