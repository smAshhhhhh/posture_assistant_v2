package com.postureassist.patients

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import java.io.File
import java.util.UUID

internal class PatientPhotos(private val context: Context) {
  private val directory = File(context.filesDir, "patient-photos")
  private val drafts = File(context.cacheDir, "patient-photo-drafts")

  fun file(name: String): File {
    requireRecord(name.endsWith(".jpg"))
    val id = name.removeSuffix(".jpg")
    requireRecord(UUID.fromString(id).toString() == id)
    return File(directory, name)
  }

  fun uri(name: String): String = Uri.fromFile(file(name)).toString()

  fun persist(uri: String?, previous: String?): String? {
    if (uri == null) return null
    if (previous != null && uri == uri(previous)) return previous
    val source = draftFile(uri)
    if (!source.isFile || source.length() !in 1..MAX_PHOTO_BYTES) {
      throw StoreException("INVALID_IMAGE")
    }
    check(directory.isDirectory || directory.mkdirs())
    val target = file("${UUID.randomUUID()}.jpg")
    try {
      target.outputStream().use { output ->
        source.inputStream().use { it.copyTo(output) }
        output.fd.sync()
      }
      return target.name
    } catch (error: Exception) {
      target.delete()
      throw error
    }
  }

  fun discard(uri: String) {
    draftFile(uri).delete()
  }

  fun clearDrafts() {
    drafts.listFiles()?.filter { it.isFile }?.forEach { it.delete() }
  }

  private fun draftFile(value: String): File {
    val uri = Uri.parse(value)
    requireRecord(uri.scheme == "file")
    val source = File(checkNotNull(uri.path)).canonicalFile
    requireRecord(source.parentFile == drafts.canonicalFile)
    requireRecord(source.name.endsWith(".jpg"))
    val expectedName = UUID.fromString(source.name.removeSuffix(".jpg")).toString() + ".jpg"
    requireRecord(expectedName == source.name)
    return source
  }

  fun importImage(uri: Uri): String {
    check(drafts.isDirectory || drafts.mkdirs())
    val raw = File(drafts, "${UUID.randomUUID()}.source")
    val target = File(drafts, "${UUID.randomUUID()}.jpg")
    try {
      val resolver = context.contentResolver
      val input = resolver.openInputStream(uri) ?: throw StoreException("INVALID_IMAGE")
      input.use { stream ->
        raw.outputStream().use { output ->
          val buffer = ByteArray(65536)
          var total = 0L
          var count = stream.read(buffer)
          while (count != -1) {
            total += count
            if (total > MAX_PHOTO_BYTES) throw StoreException("INVALID_IMAGE")
            output.write(buffer, 0, count)
            count = stream.read(buffer)
          }
        }
      }
      createAvatar(raw, target)
      return Uri.fromFile(target).toString()
    } catch (_: Exception) {
      target.delete()
      throw StoreException("INVALID_IMAGE")
    } finally {
      raw.delete()
    }
  }

  private fun createAvatar(raw: File, target: File) {
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(raw.path, options)
    if (options.outWidth <= 0 || options.outHeight <= 0) throw StoreException("INVALID_IMAGE")
    options.inJustDecodeBounds = false
    options.inSampleSize = 1
    // 解码前降采样，避免高分辨率原图占用过多内存。
    while (maxOf(options.outWidth, options.outHeight) / options.inSampleSize > 2048) {
      options.inSampleSize *= 2
    }
    val decoded = BitmapFactory.decodeFile(raw.path, options)
      ?: throw StoreException("INVALID_IMAGE")
    val bitmaps = mutableSetOf(decoded)
    try {
      val orientation = runCatching {
        ExifInterface(raw.path).getAttributeInt(
          ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL
        )
      }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
      val matrix = Matrix().apply {
        when (orientation) {
          ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> setScale(-1f, 1f)
          ExifInterface.ORIENTATION_ROTATE_180 -> setRotate(180f)
          ExifInterface.ORIENTATION_FLIP_VERTICAL -> setScale(1f, -1f)
          ExifInterface.ORIENTATION_TRANSPOSE -> { setRotate(90f); postScale(-1f, 1f) }
          ExifInterface.ORIENTATION_ROTATE_90 -> setRotate(90f)
          ExifInterface.ORIENTATION_TRANSVERSE -> { setRotate(270f); postScale(-1f, 1f) }
          ExifInterface.ORIENTATION_ROTATE_270 -> setRotate(270f)
        }
      }
      val upright = Bitmap.createBitmap(
        decoded, 0, 0, decoded.width, decoded.height, matrix, true
      ).also { bitmaps.add(it) }
      val edge = minOf(upright.width, upright.height)
      val cropped = Bitmap.createBitmap(
        upright, (upright.width - edge) / 2, (upright.height - edge) / 2, edge, edge
      ).also { bitmaps.add(it) }
      val avatar = Bitmap.createScaledBitmap(cropped, 512, 512, true).also { bitmaps.add(it) }
      target.outputStream().use {
        check(avatar.compress(Bitmap.CompressFormat.JPEG, 88, it))
        it.fd.sync()
      }
    } finally {
      bitmaps.forEach { it.recycle() }
    }
  }

  companion object {
    private const val MAX_PHOTO_BYTES = 20L * 1024 * 1024
  }
}
