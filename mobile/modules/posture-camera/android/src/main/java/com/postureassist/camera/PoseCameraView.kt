package com.postureassist.camera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import android.os.Handler
import android.os.Looper
import android.view.Surface
import android.widget.FrameLayout
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.UseCaseGroup
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.VideoCapture
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

class PoseCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  val onStatus by EventDispatcher()
  var requiredLandmarks: Set<Int> = emptySet()
  var recorder: PoseRecorder? = null
  private val preview = PreviewView(context).apply {
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    scaleType = PreviewView.ScaleType.FIT_CENTER
  }
  private val overlay = PoseOverlayView(context)

  override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
    super.onSizeChanged(width, height, oldWidth, oldHeight)
    // 布局变化后不沿用上一尺寸的骨架。
    overlay.clear()
  }

  fun setShowSkeleton(enabled: Boolean) {
    // 隐藏绘制仍更新坐标，避免影响入镜判断和记录质量。
    overlay.visibility = if (enabled) android.view.View.VISIBLE else android.view.View.INVISIBLE
  }
  private val worker = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val generation = AtomicInteger(0)
  private var provider: ProcessCameraProvider? = null
  private var previewUseCase: Preview? = null
  private var analysisUseCase: ImageAnalysis? = null
  private var videoUseCase: VideoCapture<Recorder>? = null
  private var videoSession: VideoCaptureSession? = null
  fun hasPendingVideo(): Boolean = isReleasing || videoSession?.isPending() == true

  fun beginVideo(onStarted: (Boolean) -> Unit) {
    check(isRunning && !isReleasing && isRequestedActive)
    val capture = checkNotNull(videoUseCase)
    val session = videoSession ?: VideoCaptureSession(context, checkNotNull(recorder)) {
      fail("video_recording_failed")
    }.also { videoSession = it }
    session.begin(capture, onStarted)
  }
  private var engine: PoseEngine? = null
  private var isRequestedActive = false
  private var isRunning = false
  var isDestroyed = false
    private set
  private var isWorkerClosed = false
  private var needsRearm = false
  private var lastEmissionMs = 0L
  private var isReleasing = false
  private val releaseCallbacks = mutableListOf<(Boolean) -> Unit>()

  init {
    orientation = VERTICAL
    val container = FrameLayout(context)
    container.addView(preview, FrameLayout.LayoutParams(-1, -1))
    container.addView(overlay, FrameLayout.LayoutParams(-1, -1))
    addView(container, LayoutParams(-1, -1))
  }

  fun setActive(value: Boolean) {
    if (!isRequestedActive && value) needsRearm = false
    isRequestedActive = value
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    post { synchronize() }
  }

  override fun onDetachedFromWindow() {
    stop("interrupted")
    super.onDetachedFromWindow()
  }

  fun synchronize() {
    if (isDestroyed || !isAttachedToWindow) return
    if (!isRequestedActive) {
      if (isRunning) stop("stopped")
      return
    }
    if (isRunning || isReleasing || needsRearm) return
    if (width == 0 || height == 0) {
      post { synchronize() }
      return
    }
    val owner = appContext.currentActivity as? LifecycleOwner
    if (owner == null || !owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
      emit("error", "activity_unavailable")
      return
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) !=
      PackageManager.PERMISSION_GRANTED) {
      emit("error", "permission_missing")
      return
    }
    isRunning = true
    val token = generation.incrementAndGet()
    emit("starting")
    worker.execute {
      try {
        val nextEngine = PoseEngine(context)
        engine = nextEngine
        nextEngine.initialize()
        if (generation.get() != token) {
          // 已排队的停止操作负责释放，保留关闭失败的重试机会。
          return@execute
        }
        mainHandler.post { if (generation.get() == token) bindCamera(owner, token) }
      } catch (_: Exception) {
        mainHandler.post { if (generation.get() == token) fail("model_unavailable") }
      } catch (_: LinkageError) {
        mainHandler.post { if (generation.get() == token) fail("native_library_unavailable") }
      }
    }
  }

  private fun bindCamera(owner: LifecycleOwner, token: Int) {
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      if (generation.get() != token) return@addListener
      try {
        val cameraProvider = future.get()
        provider = cameraProvider
        val rotation = display?.rotation ?: Surface.ROTATION_0
        val cameraPreview = Preview.Builder().setTargetRotation(rotation).build()
        val analyzer = ImageAnalysis.Builder()
          .setTargetRotation(rotation)
          .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
          .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
          .setResolutionSelector(
            ResolutionSelector.Builder().setResolutionStrategy(
              ResolutionStrategy(
                android.util.Size(640, 480),
                ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER
              )
            ).build()
          ).build()
        val viewPort = preview.viewPort ?: error("预览区域未就绪")
        val video = VideoCapture.withOutput(Recorder.Builder()
          .setQualitySelector(QualitySelector.from(
            Quality.HD, FallbackStrategy.lowerQualityOrHigherThan(Quality.HD)
          )).build()).apply { targetRotation = rotation }
        val group = UseCaseGroup.Builder()
          .setViewPort(viewPort)
          .addUseCase(cameraPreview)
          .addUseCase(analyzer)
          .addUseCase(video)
          .build()
        cameraPreview.setSurfaceProvider(preview.surfaceProvider)
        previewUseCase = cameraPreview
        analysisUseCase = analyzer
        videoUseCase = video
        analyzer.setAnalyzer(worker) { image ->
          try {
            if (generation.get() == token) {
              val startedAt = SystemClock.uptimeMillis()
              val result = engine?.analyze(image)
              val inferenceMs = SystemClock.uptimeMillis() - startedAt
              if (result != null) {
                mainHandler.post {
                  if (generation.get() == token) publish(result, inferenceMs, startedAt)
                }
              }
            }
          } catch (_: Exception) {
            mainHandler.post { if (generation.get() == token) fail("inference_failed") }
          } catch (_: LinkageError) {
            mainHandler.post { if (generation.get() == token) fail("native_library_unavailable") }
          } finally {
            image.close()
          }
        }
        cameraProvider.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, group)
      } catch (_: SecurityException) {
        fail("permission_missing")
      } catch (_: Exception) {
        fail("camera_unavailable")
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun publish(result: PoseOutput, inferenceMs: Long, sampledAtMs: Long) {
    try {
      overlay.show(result, preview)
    } catch (_: Exception) {
      fail("coordinate_transform_failed")
      return
    }
    val now = SystemClock.uptimeMillis()
    val isClear = result.landmarks.size == 33 && requiredLandmarks.isNotEmpty() &&
      requiredLandmarks.all { index ->
        val point = result.landmarks[index]
        point.visibility().orElse(0f) >= 0.5f && point.presence().orElse(0f) >= 0.5f &&
          point.x() in 0f..1f && point.y() in 0f..1f && overlay.containsLandmark(index)
      }
    recorder?.append(result, isClear, sampledAtMs)
    if (now - lastEmissionMs < 250L) return
    lastEmissionMs = now
    onStatus(mapOf(
      "status" to "ready",
      "code" to "none",
      "hasRequiredLandmarks" to isClear,
      "landmarkCount" to result.landmarks.size,
      "inferenceMs" to inferenceMs,
      "frameTimestampMs" to result.frameTimestampMs
    ))
  }

  private fun emit(status: String, code: String = "none") {
    onStatus(mapOf("status" to status, "code" to code))
  }

  private fun fail(code: String) {
    stop("error")
    emit("error", code)
  }

  fun stop(reason: String, onReleased: (Boolean) -> Unit = {}) {
    recorder?.pause()
    if (isReleasing) {
      releaseCallbacks.add(onReleased)
      return
    }
    if (isWorkerClosed) {
      onReleased(true)
      return
    }
    isReleasing = true
    releaseCallbacks.add(onReleased)
    // 先停止分析和新回调，MP4 完成封装后再解绑编码用例。
    generation.incrementAndGet()
    needsRearm = true
    isRunning = false
    runCatching { analysisUseCase?.clearAnalyzer() }
    overlay.clear()
    if (reason != "error") emit(reason)
    val session = videoSession
    if (session == null) releaseResources(true)
    else session.stop { finalized -> releaseResources(finalized) }
  }

  private fun releaseResources(videoFinalized: Boolean) {
    var isUnbound = true
    try {
      val cases = listOfNotNull(previewUseCase, analysisUseCase, videoUseCase).toTypedArray()
      if (cases.isNotEmpty()) checkNotNull(provider).unbind(*cases)
    } catch (_: Exception) {
      isUnbound = false
    }
    if (isUnbound) {
      previewUseCase = null
      analysisUseCase = null
      videoUseCase = null
      provider = null
    }
    worker.execute {
      var isClosed = true
      try {
        engine?.close()
        engine = null
      } catch (_: Exception) {
        isClosed = false
      } catch (_: LinkageError) {
        isClosed = false
      } finally {
        val released = isUnbound && isClosed && videoFinalized
        mainHandler.post {
          isReleasing = false
          if (isDestroyed && released) {
            isWorkerClosed = true
            worker.shutdown()
          }
          val callbacks = releaseCallbacks.toList()
          releaseCallbacks.clear()
          callbacks.forEach { it(released) }
        }
      }
    }
  }

  fun destroy(onReleased: (Boolean) -> Unit = {}) {
    isDestroyed = true
    stop("stopped", onReleased)
  }
}
