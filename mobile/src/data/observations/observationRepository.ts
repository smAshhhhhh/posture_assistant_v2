import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { ObservationRepository } from '@/domain/observations/observationReport';
import type { AngleObservationTaskId } from '@/domain/observations/angleProtocols';
import { parseObservationVideo } from '@/domain/observations/observationVideo';
import {
  parseObservationReport,
  parseObservationSummary,
} from '@/domain/observations/observationParser';

interface NativeObservationStore {
  observationVersion?: () => number;
  observationContractVersion?: () => number;
  jointObservationVersion?: () => number;
  trunkObservationVersion?: () => number;
  sitToStandObservationVersion?: () => number;
  marchObservationVersion?: () => number;
  shortWalkObservationVersion?: () => number;
  observationVideoVersion?: () => number;
  getObservationVideo(id: string): Promise<string>;
  listObservations(): Promise<string>;
  getObservation(id: string): Promise<string>;
  saveObservation(report: string, recording: string): Promise<string>;
}

const nativeStore =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<NativeObservationStore>('PatientStore')
    : null;

function getStore(): NativeObservationStore {
  if (nativeStore?.observationVersion?.() !== 1) {
    throw Object.assign(new Error('缺少观察存储模块'), { code: 'STORE_UNAVAILABLE' });
  }
  return nativeStore;
}

function supportsTask(taskId: AngleObservationTaskId): boolean {
  if (nativeStore?.observationVersion?.() !== 1 || nativeStore.observationContractVersion?.() !== 2)
    return false;
  if (taskId === 'elbow_flexion_extension') return true;
  if (taskId === 'seated_trunk_lean') return nativeStore.trunkObservationVersion?.() === 1;
  if (taskId === 'sit_to_stand') return nativeStore.sitToStandObservationVersion?.() === 1;
  if (taskId === 'march_in_place') return nativeStore.marchObservationVersion?.() === 1;
  if (taskId === 'short_walk') return nativeStore.shortWalkObservationVersion?.() === 1;
  return nativeStore.jointObservationVersion?.() === 1;
}

export const observationRepository: ObservationRepository = {
  isAvailable: nativeStore?.observationVersion?.() === 1,
  canStoreVideo: nativeStore?.observationVideoVersion?.() === 1,
  supportsTask,
  async list() {
    const value: unknown = JSON.parse(await getStore().listObservations());
    if (!Array.isArray(value)) throw new Error('观察列表格式不正确');
    return value.map((item: unknown) => parseObservationSummary(item));
  },
  async get(id) {
    const value: unknown = JSON.parse(await getStore().getObservation(id));
    return parseObservationReport(value);
  },
  async save(report, recording) {
    const store = getStore();
    if (
      !supportsTask(report.taskId) ||
      store.observationContractVersion?.() !== 2 ||
      report.sourceSchemaVersion === 1 ||
      (recording.video && store.observationVideoVersion?.() !== 1)
    ) {
      throw Object.assign(new Error('请更新动作观察存储模块'), { code: 'STORE_UNAVAILABLE' });
    }
    const value: unknown = JSON.parse(
      await store.saveObservation(JSON.stringify(report), JSON.stringify(recording)),
    );
    return parseObservationReport(value);
  },
  async getVideo(id) {
    const store = getStore();
    if (store.observationVideoVersion?.() !== 1) {
      throw new Error('请重新构建安装包，加载视频回放能力。');
    }
    return parseObservationVideo(JSON.parse(await store.getObservationVideo(id)));
  },
};
