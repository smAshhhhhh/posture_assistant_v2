import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { parseAppPreferences } from '@/domain/settings/appPreferences';
import type { PreferencesRepository } from '@/domain/settings/appPreferences';

interface NativePreferences {
  dataManagementVersion?: () => number;
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
  async load() {
    return parseAppPreferences(JSON.parse(await getStore().getPreferences()));
  },
  async save(value) {
    const payload = JSON.stringify(parseAppPreferences(value));
    return parseAppPreferences(JSON.parse(await getStore().savePreferences(payload)));
  },
};
