package com.postureassist.patients

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors
import java.io.File

class PatientStoreModule : Module() {
  private val worker = Executors.newSingleThreadExecutor()
  private val photoPicker = PatientPhotoPicker(worker)
  private val queueLock = Any()
  private var isClosing = false
  private var database: PatientDatabase? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  private var pendingExport: Pair<File, Promise>? = null
  private var exportBusy = false
  private val exportRequestCode = 21843
  private val videoViews = mutableSetOf<ObservationVideoView>()

  private fun run(promise: Promise, action: (PatientDatabase) -> String) {
    enqueue(promise) { promise.resolve(action(it)) }
  }

  private fun enqueue(
    promise: Promise,
    onFailure: () -> Unit = {},
    action: (PatientDatabase) -> Unit
  ) {
    // 所有读写、迁移与关闭按序执行，不占用 UI 线程。
    synchronized(queueLock) {
      if (isClosing) {
        onFailure()
        promise.reject("STORE_UNAVAILABLE", "患者存储模块正在关闭", null)
        return
      }
      worker.execute {
        try {
          val store = database ?: PatientDatabase(
            appContext.reactContext?.applicationContext ?: throw StoreException("STORE_UNAVAILABLE")
          ).also { database = it }
          action(store)
        } catch (error: StoreException) {
          onFailure()
          promise.reject(error.code, "本机患者资料操作失败", null)
        } catch (_: Exception) {
          onFailure()
          promise.reject("STORE_FAILED", "本机患者资料操作失败", null)
        }
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("PatientStore")
    OnCreate {
      appContext.reactContext?.applicationContext?.let { context ->
        worker.execute { PatientPhotos(context).clearDrafts() }
      }
    }
    View(ObservationVideoView::class) {
      Events("onPlaybackStatus")
      Prop("source") { view: ObservationVideoView, source: String ->
        videoViews.add(view)
        view.setSource(source)
      }
      Prop("active") { view: ObservationVideoView, active: Boolean -> view.setActive(active) }
      Prop("playing") { view: ObservationVideoView, playing: Boolean -> view.setPlaying(playing) }
      Prop("seekPositionMs") { view: ObservationVideoView, position: Int ->
        view.setSeekPosition(position)
      }
      Prop("seekRequestId") { view: ObservationVideoView, id: Int -> view.setSeekRequest(id) }
      OnViewDidUpdateProps { view: ObservationVideoView -> view.synchronize() }
      OnViewDestroys { view: ObservationVideoView ->
        view.stop()
        videoViews.remove(view)
      }
    }
    OnActivityEntersBackground {
      mainHandler.post { videoViews.forEach { it.suspendPlayback() } }
    }
    Function("observationVersion") { 1 }
    Function("observationContractVersion") { 2 }
    Function("jointObservationVersion") { 1 }
    Function("trunkObservationVersion") { 1 }
    Function("sitToStandObservationVersion") { 1 }
    Function("marchObservationVersion") { 1 }
    Function("shortWalkObservationVersion") { 1 }
    Function("observationVideoVersion") { 1 }
    Function("observationPlaybackVersion") { 1 }
    Function("dataManagementVersion") { 1 }
    Function("metricExportVersion") { 1 }
    Function("modelPreferencesVersion") { 1 }
    Function("assessmentManagementVersion") { 1 }
    Function("patientPhotoVersion") { 1 }
    AsyncFunction("choosePatientPhoto") { promise: Promise ->
      photoPicker.choose(appContext.currentActivity, promise)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("discardPatientPhoto") { uri: String, promise: Promise ->
      run(promise) {
        PatientPhotos(checkNotNull(appContext.reactContext)).discard(uri)
        "discarded"
      }
    }
    AsyncFunction("getPreferences") { promise: Promise ->
      run(promise) { AppPreferences(checkNotNull(appContext.reactContext)).load() }
    }
    AsyncFunction("savePreferences") { payload: String, promise: Promise ->
      run(promise) { AppPreferences(checkNotNull(appContext.reactContext)).save(payload) }
    }
    AsyncFunction("getDataStats") { promise: Promise ->
      run(promise) { LocalDataRecords(it, checkNotNull(appContext.reactContext)).stats() }
    }
    AsyncFunction("previewDeletion") { scope: String, promise: Promise ->
      run(promise) {
        LocalDataRecords(it, checkNotNull(appContext.reactContext)).preview(DataScope.parse(scope))
      }
    }
    AsyncFunction("deleteLocalData") { scope: String, token: String, promise: Promise ->
      run(promise) {
        LocalDataRecords(it, checkNotNull(appContext.reactContext))
          .delete(DataScope.parse(scope), token)
      }
    }
    AsyncFunction("cleanOrphans") { promise: Promise ->
      run(promise) { LocalDataRecords(it, checkNotNull(appContext.reactContext)).cleanOrphans() }
    }
    AsyncFunction("getExportReports") { scope: String, promise: Promise ->
      run(promise) { store ->
        val snapshot = LocalDataRecords(store, checkNotNull(appContext.reactContext))
          .snapshot(DataScope.parse(scope)).getJSONArray("observations")
        val reports = org.json.JSONArray()
        for (index in 0 until snapshot.length()) {
          val id = snapshot.getJSONObject(index).getString("id")
          reports.put(org.json.JSONObject(readObservationReport(store.readableDatabase, id)))
        }
        reports.toString()
      }
    }
    AsyncFunction("exportLocalData") {
      scope: String, includePose: Boolean, metrics: String, promise: Promise ->
      if (exportBusy) {
        promise.reject("BUSY", "已有导出正在进行", null)
      } else {
        exportBusy = true
        enqueue(promise, onFailure = { mainHandler.post { exportBusy = false } }) { store ->
          try {
            val file = LocalDataExport(store, checkNotNull(appContext.reactContext))
              .prepare(DataScope.parse(scope), includePose, metrics)
            mainHandler.post {
              try {
                synchronized(queueLock) { check(!isClosing) }
                val activity = appContext.currentActivity ?: throw StoreException("STORE_UNAVAILABLE")
                pendingExport = file to promise
                activity.startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                  addCategory(Intent.CATEGORY_OPENABLE)
                  type = "application/zip"
                  putExtra(Intent.EXTRA_TITLE, "PostureAssistant-${System.currentTimeMillis()}.zip")
                }, exportRequestCode)
              } catch (_: Exception) {
                pendingExport = null
                exportBusy = false
                file.delete()
                promise.reject("STORE_FAILED", "无法打开文件保存窗口", null)
              }
            }
          } catch (error: Exception) {
            mainHandler.post { exportBusy = false }
            throw error
          }
        }
      }
    }.runOnQueue(Queues.MAIN)
    OnActivityResult { _, result ->
      if (result.requestCode == PatientPhotoPicker.REQUEST_CODE) {
        appContext.reactContext?.applicationContext?.let {
          photoPicker.onResult(it, result.resultCode, result.data)
        }
      }
      if (result.requestCode == exportRequestCode) {
        val pending = pendingExport
        pendingExport = null
        if (pending != null) {
          val (file, promise) = pending
          if (result.resultCode != Activity.RESULT_OK || result.data?.data == null) {
            file.delete()
            exportBusy = false
            promise.resolve("cancelled")
          } else {
            val uri = checkNotNull(result.data?.data)
            enqueue(promise, onFailure = {
              file.delete()
              mainHandler.post { exportBusy = false }
            }) {
              val resolver = checkNotNull(appContext.reactContext).contentResolver
              try {
                checkNotNull(resolver.openOutputStream(uri, "w")).use { output ->
                  file.inputStream().use { it.copyTo(output) }
                }
                promise.resolve("saved")
              } catch (error: Exception) {
                // 写出失败尽量移除未完成文件，不能把半包当作成功回执。
                runCatching { android.provider.DocumentsContract.deleteDocument(resolver, uri) }
                throw error
              } finally {
                file.delete()
                mainHandler.post { exportBusy = false }
              }
            }
          }
        }
      }
    }
    AsyncFunction("listObservations") { promise: Promise ->
      run(promise) { ObservationRecords(it, checkNotNull(appContext.reactContext)).list() }
    }
    AsyncFunction("getObservation") { id: String, promise: Promise ->
      run(promise) { ObservationRecords(it, checkNotNull(appContext.reactContext)).get(id) }
    }
    AsyncFunction("getObservationVideo") { id: String, promise: Promise ->
      run(promise) { ObservationVideos(checkNotNull(appContext.reactContext)).get(it, id) }
    }
    AsyncFunction("saveObservation") { report: String, pose: String, promise: Promise ->
      run(promise) { ObservationRecords(it, checkNotNull(appContext.reactContext)).save(report, pose) }
    }
    AsyncFunction("list") { promise: Promise ->
      run(promise) { PatientRecords(it, checkNotNull(appContext.reactContext)).list() }
    }
    AsyncFunction("save") { payload: String, promise: Promise ->
      run(promise) { PatientRecords(it, checkNotNull(appContext.reactContext)).save(payload) }
    }
    AsyncFunction("listAssessments") { patientId: String, promise: Promise ->
      run(promise) { AssessmentRecords(it).list(patientId) }
    }
    AsyncFunction("addAssessment") { payload: String, promise: Promise ->
      run(promise) { AssessmentRecords(it).add(payload) }
    }
    AsyncFunction("updateAssessment") { payload: String, promise: Promise ->
      run(promise) { AssessmentRecords(it).update(payload) }
    }
    AsyncFunction("deleteAssessment") { payload: String, promise: Promise ->
      run(promise) { AssessmentRecords(it).delete(payload) }
    }
    OnDestroy {
      mainHandler.post {
        photoPicker.close()
        videoViews.forEach { it.stop() }
        videoViews.clear()
        pendingExport?.let { (file, promise) ->
          file.delete()
          promise.reject("STORE_UNAVAILABLE", "应用已关闭，导出未完成", null)
        }
        pendingExport = null
        exportBusy = false
      }
      synchronized(queueLock) {
        if (!isClosing) {
          isClosing = true
          worker.execute {
            try {
              database?.close()
            } catch (_: Exception) {
              // 模块已关闭，不向日志输出患者资料。
            } finally {
              database = null
            }
          }
          worker.shutdown()
        }
      }
    }
  }
}
