package com.postureassist.patients

import java.io.File
import org.json.JSONArray
import org.json.JSONObject

fun main(args: Array<String>) {
  val fixtures = JSONObject(File(args[0]).readText()).getJSONArray("jointReports")
  var accepted = 0
  var rejected = 0
  for (index in 0 until fixtures.length()) {
    val entry = fixtures.getJSONObject(index)
    val report = entry.getJSONObject("report")
    val pose = entry.getJSONObject("pose")
    if (report.getString("taskId") != "short_walk") continue
    validateObservation(report, pose)
    accepted++
    fun reject(change: (JSONObject) -> Unit) {
      val changed = JSONObject(report.toString())
      change(changed.getJSONObject("analysis"))
      check(runCatching { validateObservation(changed, pose) }.isFailure)
      rejected++
    }
    reject { it.remove("shortWalk") }
    val keys = listOf("leftCycles", "rightCycles", "meanLeftCycleDurationMs",
      "meanRightCycleDurationMs", "leftKneeRange", "rightKneeRange",
      "kneeRangeDifference", "cycleDurationDifferenceMs")
    if (report.getString("captureQuality") == "invalid_capture") {
      for (key in keys) reject { it.getJSONObject("shortWalk").put(key, 0) }
      continue
    }
    for (key in keys) reject { it.getJSONObject("shortWalk").put(key, 1) }
    reject { it.getJSONObject("shortWalk").put("cycles", JSONArray()) }
    fun rejectCycle(key: String, value: Any) {
      reject { it.getJSONObject("shortWalk").getJSONArray("cycles").getJSONObject(0).put(key, value) }
    }
    rejectCycle("side", "both")
    rejectCycle("segmentIndex", -1)
    rejectCycle("startedAtMs", 901)
    rejectCycle("extensionAtMs", 0)
    rejectCycle("endedAtMs", 2501)
    rejectCycle("confirmedAtMs", 2500)
    rejectCycle("travelRatio", 0.01)
    fun rejectSample(key: String, value: Any) {
      reject { it.getJSONObject("shortWalk").getJSONArray("samples").getJSONObject(12).put(key, value) }
    }
    rejectSample("leftKneeAngle", 0)
    rejectSample("rightKneeAngle", JSONObject.NULL)
    rejectSample("segmentIndex", 1)
    rejectSample("timestampMs", 1201)
    reject { val samples = it.getJSONObject("shortWalk").getJSONArray("samples")
      for (sampleIndex in 0 until samples.length()) samples.getJSONObject(sampleIndex).put("hipOffsetRatio", 0) }
    reject { it.put("sitToStand", JSONObject()) }
  }
  check(accepted == 4 && rejected == 64)
  println("Kotlin short walk validation: $accepted reports accepted; $rejected invalid reports rejected")
}
