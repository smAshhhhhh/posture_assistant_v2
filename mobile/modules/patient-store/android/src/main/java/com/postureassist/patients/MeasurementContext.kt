package com.postureassist.patients

import org.json.JSONObject

internal fun validateMeasurementContext(context: JSONObject, taskId: String) {
  requireRecord(context.optionalInteger("metricDefinitionVersion") == 1)
  requireRecord(context.recordText("validationStatus") == "engineering_unvalidated")
  val protocol = context.getJSONObject("taskProtocol")
  requireRecord(protocol.recordText("taskType") == taskId)
  requireRecord(protocol.recordText("category") == "free_observation")
  listOf("protocolId", "protocolVersion", "startPosition", "interpretation").forEach {
    protocol.recordText(it)
  }
  listOf("movementInstructions", "cameraRequirements", "assistanceRules",
    "compensationRules").forEach { key ->
    val items = protocol.getJSONArray(key)
    requireRecord(items.length() in 1..20)
    for (index in 0 until items.length()) {
      requireRecord(items.get(index) is String && items.getString(index).isNotBlank())
    }
  }
  val definitions = context.getJSONArray("metricDefinitions")
  val expectedKeys = mutableSetOf(
    "angle_range", "minimum_angle", "maximum_angle", "repetitions", "active_duration"
  )
  expectedKeys += when (taskId) {
    "sit_to_stand" -> setOf("mean_rise_duration", "mean_descent_duration")
    "march_in_place" -> setOf("left_steps", "right_steps", "alternation_errors",
      "mean_step_duration", "cadence")
    "short_walk" -> setOf("left_cycles", "right_cycles", "mean_left_cycle_duration",
      "mean_right_cycle_duration", "left_knee_range", "right_knee_range",
      "knee_range_difference", "cycle_duration_difference")
    else -> emptySet()
  }
  requireRecord(definitions.length() == expectedKeys.size)
  for (index in 0 until definitions.length()) {
    val definition = definitions.getJSONObject(index)
    val key = definition.recordText("key")
    requireRecord(expectedKeys.remove(key))
    requireRecord(definition.recordText("id") == "$taskId/$key/v1")
    requireRecord(definition.optionalInteger("version") == 1)
    definition.recordText("label")
    definition.recordText("definition")
    val unit = when {
      key in setOf("angle_range", "minimum_angle", "maximum_angle", "left_knee_range",
        "right_knee_range", "knee_range_difference") -> "degree"
      key == "cadence" -> "step_per_minute"
      key in setOf("left_steps", "right_steps") ||
        (key == "repetitions" && taskId == "march_in_place") -> "step"
      key == "active_duration" || key.contains("duration") -> "millisecond"
      else -> "count"
    }
    requireRecord(definition.recordText("unit") == unit)
    val plane = when (unit) {
      "degree" -> "2d_image"
      "step", "count" -> "count"
      else -> "temporal"
    }
    requireRecord(definition.recordText("measurementPlane") == plane)
  }
}
