import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { parseDeletionPreview, parseLocalDataStats } from '@/domain/storage/localData';
import type { LocalDataRepository } from '@/domain/storage/localData';

interface NativeLocalData {
  dataManagementVersion?: () => number;
  getDataStats(): Promise<string>;
  previewDeletion(scope: string): Promise<string>;
  deleteLocalData(scope: string, token: string): Promise<string>;
  exportLocalData(scope: string, includePose: boolean): Promise<string>;
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
    const result = await getStore().exportLocalData(JSON.stringify(scope), includePose);
    if (result !== 'saved' && result !== 'cancelled') throw new Error('导出回执不正确');
    return result;
  },
  async cleanOrphans() {
    return parseLocalDataStats(JSON.parse(await getStore().cleanOrphans()));
  },
};
