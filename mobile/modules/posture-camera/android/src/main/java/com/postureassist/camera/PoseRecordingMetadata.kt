package com.postureassist.camera

import org.json.JSONArray
import org.json.JSONObject

internal fun recordingMetadata(modelVersion: String) = JSONObject().apply {
  put("schemaVersion", 2)
  put("modelVersion", modelVersion)
  put("coordinateSystem", JSONObject().apply {
    put("space", "normalized_image")
    put("origin", "top_left")
    put("xDirection", "right")
    put("yDirection", "down")
    put("depth", "mediapipe_relative_non_metric")
    put("depthOrigin", "hip_midpoint")
    put("zDirection", "toward_camera_negative")
  })
  put("landmarkOrder", JSONArray(listOf(
    "nose", "left_eye_inner", "left_eye", "left_eye_outer", "right_eye_inner", "right_eye",
    "right_eye_outer", "left_ear", "right_ear", "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist",
    "left_pinky", "right_pinky", "left_index", "right_index", "left_thumb", "right_thumb",
    "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle",
    "left_heel", "right_heel", "left_foot_index", "right_foot_index"
  )))
  put("imageDimensions", JSONObject.NULL)
  put("preprocessing", JSONObject.NULL)
  put("timeBasis", "segment_relative_monotonic_ms")
  put("samplingIntervalMs", 100)
}

internal fun PoseOutput.imageDimensions() = JSONObject()
  .put("width", imageWidth).put("height", imageHeight)

internal fun PoseOutput.preprocessing() = JSONObject().apply {
  val transform = FloatArray(9)
  geometry.bufferToImage.getValues(transform)
  put("imageSpace", "cropped_upright_model_input")
  put("sourceImageDimensions", JSONObject()
    .put("width", geometry.sourceWidth).put("height", geometry.sourceHeight))
  put("cropRect", JSONObject().apply {
    put("left", geometry.crop.left)
    put("top", geometry.crop.top)
    put("width", geometry.crop.width())
    put("height", geometry.crop.height())
  })
  put("rotationDegrees", geometry.rotationDegrees)
  put("mirrored", false)
  put("bufferToModelMatrix", JSONArray(transform.map { it.toDouble() }))
}
