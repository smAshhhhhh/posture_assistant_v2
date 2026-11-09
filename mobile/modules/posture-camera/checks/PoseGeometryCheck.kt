package com.postureassist.camera

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.RectF
import kotlin.math.abs

private fun close(actual: Float, expected: Float) {
  check(abs(actual - expected) < 0.02f) { "$actual != $expected" }
}

private fun rotated(x: Float, y: Float, width: Int, height: Int, rotation: Int): FloatArray =
  when (rotation) {
    0 -> floatArrayOf(x, y)
    90 -> floatArrayOf(height - y, x)
    180 -> floatArrayOf(width - x, height - y)
    270 -> floatArrayOf(y, width - x)
    else -> error("不支持的方向")
  }

private fun verifyMapping(rotation: Int, crop: Rect, mirror: Boolean): Int {
  // 模拟分析流与预览流各自裁切传感器，覆盖非居中裁切和不同宽高比。
  val sensorToBuffer = Matrix().apply {
    setRectToRect(RectF(200f, 300f, 3800f, 2700f), RectF(0f, 0f, 640f, 480f), Matrix.ScaleToFit.FILL)
  }
  val sensorToPreviewBuffer = Matrix().apply {
    setRectToRect(RectF(400f, 600f, 3600f, 2400f), RectF(0f, 0f, 1920f, 1080f), Matrix.ScaleToFit.FILL)
  }
  val previewToView = Matrix().apply {
    setValues(floatArrayOf(0f, -0.25f, 300f, 0.25f, 0f, 30f, 0f, 0f, 1f))
    if (mirror) postScale(-1f, 1f, 180f, 270f)
  }
  val sensorToView = Matrix(sensorToPreviewBuffer).apply { postConcat(previewToView) }
  val geometry = PoseImageGeometry(crop, rotation, sensorToBuffer)
  val swapsAxes = rotation == 90 || rotation == 270
  check(geometry.imageWidth == if (swapsAxes) crop.height() else crop.width())
  check(geometry.imageHeight == if (swapsAxes) crop.width() else crop.height())
  val transform = geometry.imageToView(sensorToView)
  var count = 0
  for (nx in listOf(0f, 0.17f, 0.5f, 0.83f, 1f)) {
    for (ny in listOf(0f, 0.23f, 0.5f, 0.77f, 1f)) {
      val rawX = crop.left + nx * crop.width()
      val rawY = crop.top + ny * crop.height()
      val upright = rotated(rawX - crop.left, rawY - crop.top, crop.width(), crop.height(), rotation)
      val fromBuffer = floatArrayOf(rawX, rawY)
      geometry.bufferToImage.mapPoints(fromBuffer)
      close(fromBuffer[0], upright[0])
      close(fromBuffer[1], upright[1])
      val actual = upright.copyOf()
      transform.mapPoints(actual)
      // 独立按已知两路传感器裁切计算参考值。
      val sensorX = rawX / 640f * 3600f + 200f
      val sensorY = rawY / 480f * 2400f + 300f
      val previewX = (sensorX - 400f) / 3200f * 1920f
      val previewY = (sensorY - 600f) / 1800f * 1080f
      val expectedX = 300f - previewY * 0.25f
      close(actual[0], if (mirror) 360f - expectedX else expectedX)
      close(actual[1], 30f + previewX * 0.25f)
      ++count
    }
  }
  return count
}

private fun verifyBitmap(rotation: Int) {
  val raw = Bitmap.createBitmap(16, 12, Bitmap.Config.ARGB_8888)
  val crop = Rect(2, 3, 14, 11)
  try {
    raw.eraseColor(Color.BLACK)
    val marks = listOf(3 to 4, 9 to 6, 12 to 9)
    marks.forEachIndexed { index, point -> raw.setPixel(point.first, point.second, Color.RED + index) }
    val geometry = PoseImageGeometry(crop, rotation, Matrix())
    val upright = Bitmap.createBitmap(raw, crop.left, crop.top, crop.width(), crop.height(),
      Matrix().apply { postRotate(rotation.toFloat()) }, false)
    try {
      check(upright.width == geometry.imageWidth && upright.height == geometry.imageHeight)
      marks.forEachIndexed { index, point ->
        val position = floatArrayOf(point.first + 0.5f, point.second + 0.5f)
        geometry.bufferToImage.mapPoints(position)
        check(upright.getPixel(position[0].toInt(), position[1].toInt()) == Color.RED + index)
      }
    } finally { if (upright !== raw) upright.recycle() }
  } finally { raw.recycle() }
}

fun main() {
  var count = 0
  for (rotation in listOf(0, 90, 180, 270)) {
    verifyBitmap(rotation)
    for (crop in listOf(Rect(0, 0, 640, 480), Rect(80, 40, 560, 400))) {
      for (mirror in listOf(false, true)) count += verifyMapping(rotation, crop, mirror)
    }
  }
  check(runCatching { PoseImageGeometry(Rect(), 0, Matrix()) }.isFailure)
  check(runCatching { PoseImageGeometry(Rect(0, 0, 640, 480), 45, Matrix()) }.isFailure)
  check(runCatching { PoseImageGeometry(Rect(0, 0, 640, 480), 0,
    Matrix().apply { setScale(0f, 0f) }) }.isFailure)
  println("PASS: $count sensor/preview mappings, 4 real bitmap rotations, invalid geometry rejected")
}
