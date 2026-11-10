package com.postureassist.camera

import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.RectF

class PoseImageGeometry(
  cropRect: Rect,
  val rotationDegrees: Int,
  sensorToBuffer: Matrix,
  val sourceWidth: Int = cropRect.right,
  val sourceHeight: Int = cropRect.bottom
) {
  val crop = Rect(cropRect)
  val imageWidth: Int
  val imageHeight: Int
  val bufferToImage: Matrix
  val imageToSensor: Matrix

  init {
    require(crop.width() > 0 && crop.height() > 0)
    require(rotationDegrees in listOf(0, 90, 180, 270))
    val swapsAxes = rotationDegrees == 90 || rotationDegrees == 270
    imageWidth = if (swapsAxes) crop.height() else crop.width()
    imageHeight = if (swapsAxes) crop.width() else crop.height()
    bufferToImage = Matrix().apply {
      setTranslate(-crop.left.toFloat(), -crop.top.toFloat())
      postRotate(rotationDegrees.toFloat())
      val rotated = RectF(0f, 0f, crop.width().toFloat(), crop.height().toFloat())
      Matrix().apply { setRotate(rotationDegrees.toFloat()) }.mapRect(rotated)
      postTranslate(-rotated.left, -rotated.top)
    }
    // 模型图像 → 原始缓冲区 → 传感器；裁切偏移与旋转只还原一次。
    imageToSensor = Matrix()
    check(bufferToImage.invert(imageToSensor))
    val bufferToSensor = Matrix()
    check(sensorToBuffer.invert(bufferToSensor))
    imageToSensor.postConcat(bufferToSensor)
  }

  fun imageToView(sensorToView: Matrix): Matrix = Matrix(imageToSensor).apply {
    postConcat(sensorToView)
  }
}
