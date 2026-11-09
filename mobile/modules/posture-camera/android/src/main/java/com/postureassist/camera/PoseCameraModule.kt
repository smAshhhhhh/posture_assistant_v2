package com.postureassist.camera

import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID

class PoseCameraModule : Module() {
  // 销毁中的视图保留到释放完成，避免 stop 过早报告成功。
  private val views = mutableSetOf<PoseCameraView>()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val recorder = PoseRecorder()

  private fun discardVideo(id: String) {
    require(UUID.fromString(id).toString() == id)
    val context = checkNotNull(appContext.reactContext)
    File(context.cacheDir, "capture-videos").listFiles()?.filter {
      it.isFile && it.name.matches(Regex("$id-[0-9]+\\.mp4"))
    }?.forEach { check(it.delete()) }
  }

  override fun definition() = ModuleDefinition {
    Name("PostureCamera")
    OnCreate {
      // 未保存会话不能跨进程恢复，启动时清理上次中断遗留的采集缓存。
      appContext.reactContext?.let { context ->
        File(context.cacheDir, "capture-videos").listFiles()?.filter {
          it.isFile && it.name.matches(Regex("[a-f0-9-]{36}-[0-9]+\\.mp4"))
        }?.forEach { it.delete() }
      }
    }

    Function("recordingVersion") { 1 }
    Function("videoRecordingVersion") { 2 }
    AsyncFunction("beginRecording") { resume: Boolean, promise: Promise ->
      try {
        check(views.none { it.hasPendingVideo() }) { "上一段录像尚未停止" }
        if (!resume) recorder.recordingId()?.let { discardVideo(it) }
        recorder.begin(resume)
        checkNotNull(views.lastOrNull { !it.isDestroyed }).beginVideo { started ->
          if (started) promise.resolve()
          else {
            recorder.pause()
            promise.reject("VIDEO_FAILED", "录像未能开始，请重新检查相机", null)
          }
        }
      } catch (_: Exception) {
        recorder.pause()
        promise.reject("VIDEO_FAILED", "录像未能开始，请重新检查相机", null)
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("finishRecording") {
      check(views.none { it.hasPendingVideo() }) { "录像尚未结束写入" }
      recorder.finish()
    }.runOnQueue(Queues.MAIN)
    Function("clearRecording") { recorder.clear() }
    AsyncFunction("discardVideo") { id: String ->
      discardVideo(id)
    }
    AsyncFunction("discardRecording") {
      check(views.none { it.hasPendingVideo() }) { "录像尚未停止" }
      recorder.recordingId()?.let { discardVideo(it) }
      recorder.clear()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") { promise: Promise ->
      recorder.pause()
      val activeViews = views.toList()
      var remaining = activeViews.size
      var hasFailure = false
      if (remaining == 0) {
        promise.resolve()
      } else {
        activeViews.forEach { view ->
          view.stop("stopped") { released ->
            if (released && view.isDestroyed) views.remove(view)
            if (!released) hasFailure = true
            remaining -= 1
            if (remaining == 0) {
              if (hasFailure) promise.reject("RELEASE_FAILED", "无法确认相机已释放", null)
              else promise.resolve()
            }
          }
        }
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersBackground {
      recorder.pause()
      mainHandler.post { views.toList().forEach { it.stop("background") } }
    }
    OnDestroy {
      mainHandler.post {
        views.toList().forEach { view ->
          view.destroy { released -> if (released) views.remove(view) }
        }
      }
    }

    View(PoseCameraView::class) {
      Events("onStatus")
      Prop("active") { view: PoseCameraView, active: Boolean ->
        view.recorder = recorder
        views.add(view)
        view.setActive(active)
      }
      Prop("requiredLandmarks") { view: PoseCameraView, indices: List<Int> ->
        view.requiredLandmarks = indices.filter { it in 0..32 }.toSet()
      }
      Prop("showSkeleton") { view: PoseCameraView, enabled: Boolean ->
        view.setShowSkeleton(enabled)
      }
      OnViewDidUpdateProps { view: PoseCameraView -> view.synchronize() }
      OnViewDestroys { view: PoseCameraView ->
        view.destroy { released -> if (released) views.remove(view) }
      }
    }
  }
}
