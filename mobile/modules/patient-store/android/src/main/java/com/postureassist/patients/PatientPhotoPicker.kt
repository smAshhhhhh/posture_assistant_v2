package com.postureassist.patients

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import java.util.concurrent.ExecutorService

internal class PatientPhotoPicker(private val worker: ExecutorService) {
  private val handler = Handler(Looper.getMainLooper())
  private var pending: Promise? = null

  fun choose(activity: Activity?, promise: Promise) {
    if (pending != null) {
      promise.reject("BUSY", "正在选择照片", null)
      return
    }
    pending = promise
    try {
      checkNotNull(activity).startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "image/*"
      }, REQUEST_CODE)
    } catch (_: Exception) {
      pending = null
      promise.reject("PHOTO_UNAVAILABLE", "无法打开系统图片选择器", null)
    }
  }

  fun onResult(context: Context, resultCode: Int, data: Intent?) {
    val promise = pending ?: return
    val uri = data?.data
    if (resultCode != Activity.RESULT_OK || uri == null) {
      pending = null
      promise.resolve(null)
      return
    }
    worker.execute {
      val photos = PatientPhotos(context)
      val result = runCatching { photos.importImage(uri) }
      handler.post {
        if (pending !== promise) {
          result.getOrNull()?.let { photos.discard(it) }
        } else {
          pending = null
          result.fold(
            onSuccess = { promise.resolve(it) },
            onFailure = { promise.reject("INVALID_IMAGE", "无法读取所选图片", null) }
          )
        }
      }
    }
  }

  fun close() {
    pending?.reject("PHOTO_UNAVAILABLE", "照片选择已结束", null)
    pending = null
  }

  companion object {
    const val REQUEST_CODE = 21844
  }
}
