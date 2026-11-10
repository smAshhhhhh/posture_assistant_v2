import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { parseDeletionPreview, parseLocalDataStats } from '@/domain/storage/localData';
import type { LocalDataRepository } from '@/domain/storage/localData';
import { extractMotionMetrics } from '@/domain/observations/motionMetrics';
import { parseObservationReport } from '@/domain/observations/observationParser';

interface NativeLocalData {
  dataManagementVersion?: () => number;
  metricExportVersion?: () => number;
  getExportReports(scope: string): Promise<string>;
  getDataStats(): Promise<string>;
  previewDeletion(scope: string): Promise<string>;
  deleteLocalData(scope: string, token: string): Promise<string>;
  exportLocalData(scope: string, includePose: boolean, metrics: string): Promise<string>;
  cleanOrphans(): Promise<string>;
}

const store =
  Platform.OS === 'android' ? requireOptionalNativeModule<NativeLocalData>('PatientStore') : null;

function getStore() {
  if (store?.dataManagementVersion?.() !== 1) {
    throw Object.assign(new Error('请更新安装包'), { code: 'STORE_UNAVAILABLE' });
  }
  return store;
}

export const localDataRepository: LocalDataRepository = {
  isAvailable: store?.dataManagementVersion?.() === 1,
  async stats() {
    return parseLocalDataStats(JSON.parse(await getStore().getDataStats()));
  },
  async previewDeletion(scope) {
    return parseDeletionPreview(
      JSON.parse(await getStore().previewDeletion(JSON.stringify(scope))),
    );
  },
  async delete(scope, token) {
    return parseLocalDataStats(
      JSON.parse(await getStore().deleteLocalData(JSON.stringify(scope), token)),
    );
  },
  async export(scope, includePose) {
    const nativeStore = getStore();
    if (nativeStore.metricExportVersion?.() !== 1) {
      throw Object.assign(new Error('请更新指标导出模块'), { code: 'STORE_UNAVAILABLE' });
    }
    const reports: unknown = JSON.parse(await nativeStore.getExportReports(JSON.stringify(scope)));
    if (!Array.isArray(reports)) throw new Error('导出报告格式不正确');
    const metrics = [];
    for (const value of reports) {
      const report = parseObservationReport(value);
      metrics.push({
        recordingId: report.id,
        taskId: report.taskId,
        protocolVersion: report.protocolVersion,
        analysisVersion: report.analysisVersion,
        ...(report.measurementContext ? { measurementContext: report.measurementContext } : {}),
        metrics: extractMotionMetrics(report.taskAnalysis),
      });
    }
    const result = await nativeStore.exportLocalData(
      JSON.stringify(scope),
      includePose,
      JSON.stringify(metrics),
    );
    if (result !== 'saved' && result !== 'cancelled') throw new Error('导出回执不正确');
    return result;
  },
  async cleanOrphans() {
    return parseLocalDataStats(JSON.parse(await getStore().cleanOrphans()));
  },
};
