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
    if (report.getString("taskId") != "sit_to_stand") continue
    validateObservation(report, pose)
    accepted++
    fun reject(change: (JSONObject) -> Unit) {
      val changed = JSONObject(report.toString())
      change(changed.getJSONObject("analysis"))
      check(runCatching { validateObservation(changed, pose) }.isFailure)
      rejected++
    }
    reject { it.remove("sitToStand") }
    if (report.getString("captureQuality") == "invalid_capture") {
      reject { it.getJSONObject("sitToStand").put("meanRiseDurationMs", 0) }
      continue
    }
    reject { it.getJSONObject("sitToStand").put("cycles", JSONArray()) }
    reject { it.getJSONObject("sitToStand").put("meanRiseDurationMs", 1) }
    reject { it.getJSONObject("sitToStand").getJSONArray("cycles")
      .getJSONObject(0).put("standingAtMs", 0) }
    reject { it.getJSONObject("sitToStand").getJSONArray("cycles")
      .getJSONObject(0).put("endedAtMs", pose.getInt("durationMs")) }
    reject { it.getJSONArray("series").getJSONObject(17).put("angle", JSONObject.NULL) }
  }
  check(accepted == 4 && rejected == 16)
  println("Kotlin sit-to-stand validation: $accepted reports accepted; $rejected invalid reports rejected")
}
