package com.postureassist.camera

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import androidx.camera.core.ImageProxy
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import org.json.JSONObject
import java.security.MessageDigest

data class PoseOutput(
  val landmarks: List<NormalizedLandmark>,
  val imageWidth: Int,
  val imageHeight: Int,
  internal val geometry: PoseImageGeometry,
  val frameTimestampMs: Long
)

class PoseEngine(private val context: Context) : AutoCloseable {
  private var landmarker: PoseLandmarker? = null
  private var lastTimestampMs = -1L

  // 模型初始化、推理和释放始终在同一个工作线程执行。
  fun initialize() {
    val expected = context.assets.open("pose-model-lock.json").bufferedReader().use {
      JSONObject(it.readText())
    }
    val digest = MessageDigest.getInstance("SHA-256")
    context.assets.open("pose_landmarker_lite.task").use { stream ->
      val buffer = ByteArray(65_536)
      var count = stream.read(buffer)
      while (count > 0) {
        digest.update(buffer, 0, count)
        count = stream.read(buffer)
      }
    }
    val actual = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
    check(expected.getString("version") == "float16/1") { "模型版本不匹配" }
    check(actual == expected.getString("sha256")) { "模型校验失败" }

    val baseOptions = BaseOptions.builder()
      .setModelAssetPath("pose_landmarker_lite.task")
      .setDelegate(Delegate.CPU)
      .build()
    val options = PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setRunningMode(RunningMode.VIDEO)
      .setNumPoses(1)
      .setMinPoseDetectionConfidence(0.5f)
      .setMinPosePresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .build()
    landmarker = PoseLandmarker.createFromOptions(context, options)
  }

  fun analyze(image: ImageProxy): PoseOutput {
    val timestampMs = image.imageInfo.timestamp / 1_000_000L
    check(timestampMs > lastTimestampMs) { "相机时间戳未递增" }
    lastTimestampMs = timestampMs
    val geometry = PoseImageGeometry(
      image.cropRect, image.imageInfo.rotationDegrees,
      image.imageInfo.sensorToBufferTransformMatrix
    )
    val raw = image.toBitmap()
    try {
      val rotation = Matrix().apply { postRotate(image.imageInfo.rotationDegrees.toFloat()) }
      val crop = geometry.crop
      // 只识别预览视口对应的图像，避免跟踪到画面之外的人体。
      val upright = Bitmap.createBitmap(
        raw, crop.left, crop.top, crop.width(), crop.height(), rotation, true
      )
      try {
        val input = BitmapImageBuilder(upright).build()
        try {
          val result = checkNotNull(landmarker).detectForVideo(input, timestampMs)
          return PoseOutput(
            result.landmarks().firstOrNull() ?: emptyList(),
            upright.width,
            upright.height,
            geometry,
            timestampMs
          )
        } finally {
          input.close()
        }
      } finally {
        if (upright !== raw) upright.recycle()
      }
    } finally {
      raw.recycle()
    }
  }

  override fun close() {
    landmarker?.close()
    landmarker = null
  }
}
