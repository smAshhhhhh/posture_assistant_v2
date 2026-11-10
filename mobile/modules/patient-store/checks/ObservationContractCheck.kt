package com.postureassist.patients

import java.io.File
import org.json.JSONObject

fun main(args: Array<String>) {
  val fixtures = JSONObject(File(args[0]).readText()).getJSONArray("currentReports")
  var accepted = 0
  var rejected = 0
  for (index in 0 until fixtures.length()) {
    val entry = fixtures.getJSONObject(index)
    val report = entry.getJSONObject("report")
    val pose = entry.getJSONObject("pose")
    validateObservation(report, pose)
    accepted++
    fun reject(change: (JSONObject, JSONObject) -> Unit) {
      val changedReport = JSONObject(report.toString())
      val changedPose = JSONObject(pose.toString())
      change(changedReport, changedPose)
      check(runCatching { validateObservation(changedReport, changedPose) }.isFailure)
      rejected++
    }
    reject { changed, _ -> changed.put("taskStatus", "stopped_safety") }
    reject { changed, _ -> changed.getJSONObject("taskAnalysis").put("taskStatus",
      if (report.getString("taskStatus") == "unable") "completed" else "unable") }
    reject { changed, _ -> changed.remove("measurementContext") }
    reject { changed, _ -> changed.getJSONObject("measurementContext")
      .getJSONObject("taskProtocol").put("taskType", "other") }
    reject { changed, _ -> changed.getJSONObject("measurementContext")
      .put("metricDefinitionVersion", 2) }
    reject { changed, _ -> changed.getJSONObject("measurementContext")
      .getJSONArray("metricDefinitions").getJSONObject(0).put("unit", "count") }
    reject { _, changed -> changed.getJSONObject("metadata").put("schemaVersion", 1) }
    val segments = pose.getJSONArray("segments")
    if (segments.length() == 0) continue
    reject { _, changed -> changed.getJSONArray("segments").getJSONObject(0).put("segmentIndex", 1) }
    val segment = segments.getJSONObject(0)
    if (segment.isNull("imageDimensions")) continue
    reject { _, changed -> changed.getJSONArray("segments").getJSONObject(0)
      .getJSONObject("preprocessing").getJSONArray("bufferToModelMatrix").put(0, 9) }
    val series = report.getJSONObject("taskAnalysis").getJSONObject("taskResult")
      .getJSONObject("angle").getJSONArray("series")
    if (series.length() == 0) continue
    reject { changed, _ -> changed.getJSONObject("taskAnalysis").getJSONObject("taskResult")
      .getJSONObject("angle").getJSONArray("series").getJSONObject(0).remove("segmentIndex") }
    reject { changed, _ -> changed.getJSONObject("taskAnalysis").getJSONObject("taskResult")
      .getJSONObject("angle").getJSONArray("series").getJSONObject(0).put("segmentIndex", 0.5) }
    reject { _, changed -> changed.getJSONArray("segments").getJSONObject(0)
      .getJSONArray("frames").getJSONObject(0).put("isInPreview", true) }
  }
  check(accepted >= 28 && rejected >= 100)
  println("新版原生契约：$accepted 份报告通过，$rejected 份非法记录被拒绝")
}
