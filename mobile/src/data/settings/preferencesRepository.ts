import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { parseAppPreferences } from '@/domain/settings/appPreferences';
import type { PreferencesRepository } from '@/domain/settings/appPreferences';

interface NativePreferences {
  dataManagementVersion?: () => number;
  modelPreferencesVersion?: () => number;
  getPreferences(): Promise<string>;
  savePreferences(payload: string): Promise<string>;
}

const store =
  Platform.OS === 'android' ? requireOptionalNativeModule<NativePreferences>('PatientStore') : null;

function getStore() {
  if (store?.dataManagementVersion?.() !== 1) {
    throw Object.assign(new Error('请更新安装包'), { code: 'STORE_UNAVAILABLE' });
  }
  return store;
}

export const preferencesRepository: PreferencesRepository = {
  isAvailable: store?.dataManagementVersion?.() === 1,
  canSelectPoseModel: store?.modelPreferencesVersion?.() === 1,
  async load() {
    return parseAppPreferences(JSON.parse(await getStore().getPreferences()));
  },
  async save(value) {
    if (value.poseModel !== 'lite' && store?.modelPreferencesVersion?.() !== 1) {
      throw new Error('请更新安装包后再选择 Full 或 Heavy 模型。');
    }
    const payload = JSON.stringify(parseAppPreferences(value));
    const saved = parseAppPreferences(JSON.parse(await getStore().savePreferences(payload)));
    if (saved.poseModel !== value.poseModel) throw new Error('模型偏好未能保存，请更新安装包。');
    return saved;
  },
};
