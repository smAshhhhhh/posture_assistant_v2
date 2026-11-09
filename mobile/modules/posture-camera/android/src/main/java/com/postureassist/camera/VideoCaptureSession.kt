package com.postureassist.camera

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.core.content.ContextCompat
import java.io.File

internal class VideoCaptureSession(
  private val context: Context,
  private val recorder: PoseRecorder,
  private val onFailure: () -> Unit
) {
  private var recording: Recording? = null
  private var isFinalizing = false
  private val callbacks = mutableListOf<(Boolean) -> Unit>()
  private val handler = Handler(Looper.getMainLooper())
  fun isPending(): Boolean = recording != null || isFinalizing
  private val finalizeTimeout = Runnable {
    val pending = callbacks.toList()
    callbacks.clear()
    pending.forEach { it(false) }
  }

  fun begin(capture: VideoCapture<Recorder>, onStarted: (Boolean) -> Unit) {
    check(recording == null && !isFinalizing)
    val directory = File(context.cacheDir, "capture-videos")
    check(directory.isDirectory || directory.mkdirs())
    val file = File(directory, recorder.videoFileName())
    check(!file.exists())
    var hasStarted = false
    var hasAnswered = false
    val startTimeout = Runnable {
      if (!hasAnswered) {
        hasAnswered = true
        onStarted(false)
      }
    }
    handler.postDelayed(startTimeout, 10_000L)
    try {
      recording = capture.output.prepareRecording(
        context, FileOutputOptions.Builder(file).build()
      ).start(ContextCompat.getMainExecutor(context)) { event ->
        when (event) {
          is VideoRecordEvent.Start -> {
            handler.removeCallbacks(startTimeout)
            hasStarted = true
            if (!hasAnswered) {
              hasAnswered = true
              onStarted(!isFinalizing && recorder.startVideoClock())
            }
          }
          is VideoRecordEvent.Finalize -> {
            handler.removeCallbacks(startTimeout)
            recording = null
            handler.removeCallbacks(finalizeTimeout)
            val wasStopping = isFinalizing
            isFinalizing = false
            val duration = event.recordingStats.recordedDurationNanos / 1_000_000
            // 后台关闭相机或空间耗尽时，CameraX 仍可能已封装前半段视频。
            val hasUsableOutput = event.error in setOf(
              VideoRecordEvent.Finalize.ERROR_NONE,
              VideoRecordEvent.Finalize.ERROR_SOURCE_INACTIVE,
              VideoRecordEvent.Finalize.ERROR_INSUFFICIENT_STORAGE,
              VideoRecordEvent.Finalize.ERROR_FILE_SIZE_LIMIT_REACHED,
              VideoRecordEvent.Finalize.ERROR_DURATION_LIMIT_REACHED
            )
            if (hasUsableOutput && hasStarted && file.isFile && file.length() > 0 && duration > 0) {
              recorder.addVideo(file.name, duration)
            } else {
              file.delete()
              recorder.failVideo()
            }
            if (event.hasError()) recorder.failVideo()
            if (!hasAnswered) {
              hasAnswered = true
              onStarted(false)
            }
            val pending = callbacks.toList()
            callbacks.clear()
            pending.forEach { it(true) }
            if (!wasStopping) onFailure()
          }
        }
      }
    } catch (error: Exception) {
      handler.removeCallbacks(startTimeout)
      file.delete()
      throw error
    }
  }

  fun stop(onFinalized: (Boolean) -> Unit) {
    val active = recording
    if (active == null && !isFinalizing) {
      onFinalized(true)
      return
    }
    callbacks.add(onFinalized)
    handler.removeCallbacks(finalizeTimeout)
    handler.postDelayed(finalizeTimeout, 12_000L)
    if (!isFinalizing) {
      isFinalizing = true
      active?.stop()
    }
  }
}
