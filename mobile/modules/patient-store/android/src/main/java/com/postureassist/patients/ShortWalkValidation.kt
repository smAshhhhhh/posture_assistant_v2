package com.postureassist.patients

import org.json.JSONObject
import kotlin.math.abs

private data class WalkSample(
  val time: Double,
  val segment: Int,
  val left: Double?,
  val right: Double?,
  val hip: Double?,
) {
  fun angle(side: String): Double? = if (side == "left") left else right
}

private data class WalkSwing(val peak: WalkSample, val minimum: Double, val extension: Double)

private data class WalkCycle(
  val side: String,
  val segment: Int,
  val start: Double,
  val extension: Double,
  val end: Double,
  val confirmation: Double,
  val travel: Double,
)

internal fun validateShortWalk(analysis: JSONObject, affectedSide: String) {
  val metrics = analysis.getJSONObject("shortWalk")
  val invalid = analysis.recordText("captureQuality") == "invalid_capture"
  val rawSamples = metrics.getJSONArray("samples")
  val series = analysis.getJSONArray("series")
  requireRecord(rawSamples.length() == series.length())
  var previous: WalkSample? = null
  val samples = mutableListOf<WalkSample>()
  for (index in 0 until rawSamples.length()) {
    val raw = rawSamples.getJSONObject(index)
    val segment = raw.optionalInteger("segmentIndex")
    requireRecord(segment != null && segment in 0..9000)
    val sample = WalkSample(
      raw.walkNumber("timestampMs", 0.0, 86400000.0), checkNotNull(segment),
      raw.nullableWalkNumber("leftKneeAngle", 0.0, 180.0),
      raw.nullableWalkNumber("rightKneeAngle", 0.0, 180.0),
      raw.nullableWalkNumber("hipOffsetRatio", -16384.0, 16384.0),
    )
    val timeline = series.getJSONObject(index)
    requireRecord(timeline.getDouble("timestampMs") == sample.time)
    requireRecord(timeline.nullableWalkNumber("angle", 0.0, 180.0) == sample.angle(affectedSide))
    val missing = sample.left == null
    requireRecord(missing == (sample.right == null) && missing == (sample.hip == null))
    requireRecord(!invalid || missing)
    previous?.let { before ->
      requireRecord(sample.segment >= before.segment)
      val continuous = !missing && before.left != null && sample.time - before.time <= 250
      requireRecord(!continuous || sample.segment == before.segment)
      requireRecord(before.left == null || missing || continuous || sample.segment > before.segment)
    }
    previous = sample
    samples.add(sample)
  }
  val cycles = if (invalid) emptyList() else listOf("left", "right")
    .flatMap { detectWalkCycles(samples, it) }
    .sortedWith(compareBy<WalkCycle> { it.end }.thenBy { it.side })
  val rawCycles = metrics.getJSONArray("cycles")
  requireRecord(rawCycles.length() == cycles.size)
  cycles.forEachIndexed { index, cycle ->
    val raw = rawCycles.getJSONObject(index)
    requireRecord(raw.recordText("side") == cycle.side)
    val expected = mapOf(
      "segmentIndex" to cycle.segment.toDouble(), "startedAtMs" to cycle.start,
      "extensionAtMs" to cycle.extension, "endedAtMs" to cycle.end,
      "confirmedAtMs" to cycle.confirmation, "travelRatio" to cycle.travel,
    )
    expected.forEach { (key, value) ->
      requireRecord(abs(raw.walkNumber(key, 0.0, 86400000.0) - value) <= 1e-6)
    }
  }
  validateWalkSummary(metrics, samples, cycles, invalid)
  val selectedCount = cycles.count { it.side == affectedSide }
  requireRecord(if (invalid) analysis.isNull("repetitions")
    else analysis.optionalInteger("repetitions") == selectedCount)
}

private fun detectWalkCycles(samples: List<WalkSample>, side: String): List<WalkCycle> {
  val result = mutableListOf<WalkCycle>()
  var armed = false
  var candidate: WalkSwing? = null
  var previousSwing: WalkSwing? = null
  var previousSample: WalkSample? = null
  for (sample in samples) {
    val angle = sample.angle(side)
    val before = previousSample
    if (angle == null || before == null || before.segment != sample.segment ||
      sample.time - before.time > 250) {
      armed = false
      candidate = null
      previousSwing = null
    }
    previousSample = sample
    if (angle == null) continue
    if (angle >= 155) {
      val current = candidate
      if (current != null && current.minimum <= 135) {
        val completed = current.copy(extension = sample.time)
        val prior = previousSwing
        if (prior != null) {
          val elapsed = completed.peak.time - prior.peak.time
          val evidence = samples.filter { it.time >= prior.peak.time && it.time <= completed.peak.time }
          val travel = walkTravel(evidence)
          val opposite = if (side == "left") "right" else "left"
          val oppositeAtStart = prior.peak.angle(opposite)
          val oppositeAtEnd = completed.peak.angle(opposite)
          if (elapsed in 400.0..6000.0 && travel != null &&
            oppositeAtStart != null && oppositeAtStart >= 155 &&
            oppositeAtEnd != null && oppositeAtEnd >= 155) {
            result.add(WalkCycle(side, sample.segment, prior.peak.time, prior.extension,
              completed.peak.time, sample.time, travel))
          }
        }
        previousSwing = completed
      }
      candidate = null
      armed = true
    } else if (armed) {
      val current = candidate
      if (current == null || angle < current.minimum) candidate = WalkSwing(sample, angle, 0.0)
      val prior = previousSwing
      if (prior != null && sample.time - prior.peak.time > 6000) previousSwing = null
    }
  }
  return result
}

private fun walkTravel(samples: List<WalkSample>): Double? {
  val first = samples.firstOrNull()?.hip ?: return null
  val last = samples.lastOrNull()?.hip ?: return null
  val travel = last - first
  if (abs(travel) < 0.25) return null
  var backward = 0.0
  for (index in 1 until samples.size) {
    val before = samples[index - 1].hip ?: return null
    val after = samples[index].hip ?: return null
    backward += maxOf(0.0, -kotlin.math.sign(travel) * (after - before))
  }
  return if (backward <= 0.15) abs(travel) else null
}

private fun validateWalkSummary(
  metrics: JSONObject,
  samples: List<WalkSample>,
  cycles: List<WalkCycle>,
  invalid: Boolean,
) {
  val left = cycles.filter { it.side == "left" }
  val right = cycles.filter { it.side == "right" }
  fun mean(items: List<WalkCycle>): Double? = if (invalid || items.isEmpty()) null
    else items.sumOf { it.end - it.start } / items.size
  fun range(side: String): Double? {
    val angles = samples.mapNotNull { it.angle(side) }
    return if (invalid || angles.isEmpty()) null else angles.max() - angles.min()
  }
  val leftMean = mean(left)
  val rightMean = mean(right)
  val leftRange = range("left")
  val rightRange = range("right")
  val expected = mapOf(
    "leftCycles" to if (invalid) null else left.size.toDouble(),
    "rightCycles" to if (invalid) null else right.size.toDouble(),
    "meanLeftCycleDurationMs" to leftMean,
    "meanRightCycleDurationMs" to rightMean,
    "leftKneeRange" to leftRange,
    "rightKneeRange" to rightRange,
    "kneeRangeDifference" to if (leftRange == null || rightRange == null) null else leftRange - rightRange,
    "cycleDurationDifferenceMs" to if (leftMean == null || rightMean == null) null else leftMean - rightMean,
  )
  expected.forEach { (key, correct) ->
    val actual = metrics.nullableWalkNumber(key, -86400000.0, 86400000.0)
    requireRecord(if (correct == null) actual == null else actual != null && abs(actual - correct) <= 1e-6)
  }
}

private fun JSONObject.walkNumber(key: String, minimum: Double, maximum: Double): Double {
  val value = get(key)
  requireRecord(value is Number)
  val number = (value as Number).toDouble()
  requireRecord(number.isFinite() && number in minimum..maximum)
  return number
}

private fun JSONObject.nullableWalkNumber(key: String, minimum: Double, maximum: Double): Double? {
  requireRecord(has(key))
  return if (isNull(key)) null else walkNumber(key, minimum, maximum)
}
