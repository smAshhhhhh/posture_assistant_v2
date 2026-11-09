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
    if (report.getString("taskId") != "march_in_place") continue
    validateObservation(report, pose)
    accepted++
    fun reject(change: (JSONObject) -> Unit) {
      val changed = JSONObject(report.toString())
      change(changed.getJSONObject("analysis"))
      check(runCatching { validateObservation(changed, pose) }.isFailure)
      rejected++
    }
    reject { it.remove("marchInPlace") }
    if (report.getString("captureQuality") == "invalid_capture") {
      for (key in listOf("leftSteps", "rightSteps", "alternationErrors", "meanStepDurationMs", "cadencePerMinute")) {
        reject { it.getJSONObject("marchInPlace").put(key, 0) }
      }
      continue
    }
    reject { it.getJSONObject("marchInPlace").put("steps", JSONArray()) }
    for (key in listOf("leftSteps", "rightSteps", "alternationErrors", "meanStepDurationMs", "cadencePerMinute")) {
      reject { it.getJSONObject("marchInPlace").put(key, 1) }
    }
    fun rejectStep(key: String, value: Any) {
      reject { it.getJSONObject("marchInPlace").getJSONArray("steps").getJSONObject(0).put(key, value) }
    }
    rejectStep("side", "both")
    rejectStep("segmentIndex", -1)
    rejectStep("liftRatio", 0.01)
    rejectStep("peakAtMs", 0)
    rejectStep("startedAtMs", 901)
    rejectStep("endedAtMs", pose.getInt("durationMs"))
    reject { it.getJSONObject("marchInPlace").getJSONArray("steps").getJSONObject(1)
      .put("segmentIndex", 2) }
    reject { it.getJSONObject("marchInPlace").getJSONArray("steps").getJSONObject(1)
      .put("startedAtMs", 1000) }
    reject { it.getJSONArray("series").getJSONObject(11).put("angle", JSONObject.NULL) }
  }
  check(accepted == 4 && rejected == 44)
  println("Kotlin march validation: $accepted reports accepted; $rejected invalid reports rejected")
}
