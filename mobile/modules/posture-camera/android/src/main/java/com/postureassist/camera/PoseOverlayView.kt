package com.postureassist.camera

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.View
import androidx.camera.view.PreviewView

class PoseOverlayView(context: Context) : View(context) {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.rgb(4, 133, 247)
    strokeWidth = 3f * resources.displayMetrics.density
    strokeCap = Paint.Cap.ROUND
  }
  private var points = FloatArray(0)
  private var visible = BooleanArray(0)
  private val connections = listOf(
    11 to 12, 11 to 13, 13 to 15, 12 to 14, 14 to 16,
    11 to 23, 12 to 24, 23 to 24, 23 to 25, 25 to 27,
    24 to 26, 26 to 28, 27 to 29, 29 to 31, 28 to 30, 30 to 32
  )

  fun show(result: PoseOutput, preview: PreviewView) {
    val target = preview.sensorToViewTransform
    if (target == null || result.landmarks.size != 33) {
      clear()
      return
    }
    val transformed = FloatArray(result.landmarks.size * 2)
    result.landmarks.forEachIndexed { index, point ->
      transformed[index * 2] = point.x() * result.imageWidth
      transformed[index * 2 + 1] = point.y() * result.imageHeight
    }
    // 通过传感器对齐不同尺寸的流，保留厂商相机的裁切与缩放信息。
    result.geometry.imageToView(target).mapPoints(transformed)
    points = transformed
    visible = BooleanArray(33) { index ->
      val point = result.landmarks[index]
      point.visibility().orElse(0f) >= 0.5f && point.presence().orElse(0f) >= 0.5f &&
        transformed[index * 2].isFinite() && transformed[index * 2 + 1].isFinite()
    }
    invalidate()
  }

  fun clear() {
    points = FloatArray(0)
    visible = BooleanArray(0)
    invalidate()
  }

  fun containsLandmark(index: Int): Boolean {
    return index in visible.indices && visible[index] &&
      points[index * 2] in 0f..width.toFloat() &&
      points[index * 2 + 1] in 0f..height.toFloat()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (points.size != 66) return
    connections.forEach { (from, to) ->
      if (visible[from] && visible[to]) {
        canvas.drawLine(
          points[from * 2], points[from * 2 + 1],
          points[to * 2], points[to * 2 + 1], paint
        )
      }
    }
    visible.forEachIndexed { index, isVisible ->
      if (isVisible && index >= 11) {
        canvas.drawCircle(points[index * 2], points[index * 2 + 1], paint.strokeWidth, paint)
      }
    }
  }
}
