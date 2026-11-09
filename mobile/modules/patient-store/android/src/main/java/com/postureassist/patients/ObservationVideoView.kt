package com.postureassist.patients

import android.content.Context
import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.Surface
import android.view.TextureView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File

class ObservationVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext),
  TextureView.SurfaceTextureListener {
  override val shouldUseAndroidLayout = true
  val onPlaybackStatus by EventDispatcher()
  private val texture = TextureView(context).apply {
    surfaceTextureListener = this@ObservationVideoView
  }
  private val handler = Handler(Looper.getMainLooper())
  private var surface: Surface? = null
  private var player: MediaPlayer? = null
  private var source = ""
  private var loadedSource = ""
  private var isActive = false
  private var wantsPlaying = false
  private var isPrepared = false
  private var hasFailed = false
  private var isCompleted = false
  private var positionMs = 0
  private var durationMs = 0
  private var seekPositionMs = 0
  private var seekRequestId = 0
  private var appliedSeekId = 0
  private var issuedSeekId = 0
  private var isSeeking = false
  private var lastStatus: Map<String, Any>? = null
  private val progress = object : Runnable {
    override fun run() {
      if (isPrepared && isActive) {
        try {
          emit()
          if (player?.isPlaying == true) handler.postDelayed(this, 250L)
        } catch (_: Exception) { fail() }
      }
    }
  }

  init {
    setBackgroundColor(android.graphics.Color.BLACK)
    addView(texture, LayoutParams(-1, -1))
  }

  fun setSource(value: String) {
    if (source == value) return
    stop()
    source = value
    positionMs = 0
    durationMs = 0
    hasFailed = false
    isCompleted = false
    appliedSeekId = 0
    lastStatus = null
  }

  fun setActive(value: Boolean) { isActive = value }
  fun setPlaying(value: Boolean) { wantsPlaying = value }
  fun setSeekPosition(value: Int) { seekPositionMs = value.coerceAtLeast(0) }
  fun setSeekRequest(value: Int) { seekRequestId = value }

  fun synchronize() {
    if (!isActive || !isAttachedToWindow) {
      stop()
      return
    }
    if (surface == null || hasFailed || source.isEmpty()) return
    if (player == null || loadedSource != source) {
      open()
      return
    }
    if (!isPrepared) return
    try {
      val media = checkNotNull(player)
      if (isSeeking) return
      if (seekRequestId != appliedSeekId) {
        seek(media, seekPositionMs)
        return
      }
      var didChange = false
      if (wantsPlaying && !media.isPlaying) {
        if (isCompleted) {
          seek(media, 0)
          return
        }
        media.start()
        didChange = true
      } else if (!wantsPlaying && media.isPlaying) {
        media.pause()
        didChange = true
      }
      if (didChange) {
        emit()
        handler.removeCallbacks(progress)
        if (media.isPlaying) handler.postDelayed(progress, 250L)
      }
    } catch (_: Exception) { fail() }
  }

  private fun open() {
    try {
      val uri = Uri.parse(source)
      val file = uri.path?.let { File(it).canonicalFile }
      val directory = File(context.filesDir, "observation-videos").canonicalFile
      require(
        uri.scheme == "file" && file?.parentFile == directory &&
          file.name.matches(Regex("[a-f0-9-]{36}-[0-9]+\\.mp4"))
      )
      val media = MediaPlayer()
      player = media
      loadedSource = source
      dispatchStatus("loading")
      media.setSurface(surface)
      media.setVolume(0f, 0f)
      media.setOnPreparedListener {
        if (player !== media) return@setOnPreparedListener
        try {
          isPrepared = true
          durationMs = media.duration.coerceAtLeast(0)
          require(durationMs > 0)
          fitVideo()
          val target = if (seekRequestId != appliedSeekId) seekPositionMs else positionMs
          // 定位后再显示首帧或继续播放，避免返回页面时跳到片段开头。
          seek(media, target.coerceAtLeast(1))
        } catch (_: Exception) { fail() }
      }
      media.setOnVideoSizeChangedListener { _, _, _ ->
        if (player === media) {
          try { fitVideo() } catch (_: Exception) { fail() }
        }
      }
      media.setOnSeekCompleteListener {
        if (player !== media) return@setOnSeekCompleteListener
        // 只确认真正完成的请求，JS 才能丢弃拖动前的迟到进度。
        appliedSeekId = issuedSeekId
        isSeeking = false
        synchronize()
        if (!isSeeking) {
          try { emit() } catch (_: Exception) { fail() }
        }
      }
      media.setOnCompletionListener {
        if (player !== media) return@setOnCompletionListener
        handler.removeCallbacks(progress)
        isCompleted = true
        wantsPlaying = false
        try { emit() } catch (_: Exception) { fail() }
      }
      media.setOnErrorListener { _, _, _ ->
        if (player === media) fail()
        true
      }
      media.setDataSource(context, uri)
      media.prepareAsync()
    } catch (_: Exception) { fail() }
  }

  private fun seek(media: MediaPlayer, targetMs: Int) {
    handler.removeCallbacks(progress)
    if (media.isPlaying) media.pause()
    isSeeking = true
    issuedSeekId = seekRequestId
    isCompleted = false
    media.seekTo(
      targetMs.coerceIn(0, (durationMs - 1).coerceAtLeast(0)).toLong(),
      MediaPlayer.SEEK_CLOSEST
    )
  }

  private fun emit() {
    val media = player ?: return
    if (!isPrepared) return
    positionMs = if (isCompleted) durationMs else media.currentPosition.coerceAtLeast(0)
    dispatchStatus(if (isCompleted) "ended" else if (media.isPlaying) "playing" else "paused")
  }

  private fun dispatchStatus(status: String) {
    val snapshot = mapOf(
      "status" to status,
      "positionMs" to positionMs,
      "durationMs" to durationMs,
      "seekRequestId" to appliedSeekId
    )
    // 属性同步不会反复触发相同事件，避免 JS 与原生互相更新。
    if (snapshot == lastStatus) return
    lastStatus = snapshot
    onPlaybackStatus(snapshot)
  }

  private fun fitVideo() {
    val media = player ?: return
    if (!isPrepared || texture.width == 0 || texture.height == 0) return
    if (media.videoWidth == 0 || media.videoHeight == 0) return
    val width = texture.width
    val height = texture.height
    val scale = minOf(width.toFloat() / media.videoWidth, height.toFloat() / media.videoHeight)
    texture.setTransform(Matrix().apply {
      setScale(media.videoWidth * scale / width, media.videoHeight * scale / height,
        width / 2f, height / 2f)
    })
  }

  private fun fail() {
    hasFailed = true
    wantsPlaying = false
    stop()
    dispatchStatus("error")
  }

  fun stop() {
    handler.removeCallbacks(progress)
    val media = player
    player = null
    if (media != null) {
      if (isPrepared && !isCompleted) runCatching { positionMs = media.currentPosition }
      runCatching { media.release() }
    }
    isPrepared = false
    isSeeking = false
    loadedSource = ""
  }

  fun suspendPlayback() {
    isActive = false
    wantsPlaying = false
    stop()
  }

  override fun onSurfaceTextureAvailable(value: SurfaceTexture, width: Int, height: Int) {
    surface = Surface(value)
    synchronize()
  }
  override fun onSurfaceTextureSizeChanged(value: SurfaceTexture, width: Int, height: Int) {
    try { fitVideo() } catch (_: Exception) { fail() }
  }
  override fun onSurfaceTextureUpdated(value: SurfaceTexture) = Unit
  override fun onSurfaceTextureDestroyed(value: SurfaceTexture): Boolean {
    stop()
    surface?.release()
    surface = null
    return true
  }
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    post { synchronize() }
  }
  override fun onDetachedFromWindow() {
    stop()
    super.onDetachedFromWindow()
  }
}
