import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { PatientPhotoGateway } from '@/domain/patients/patientPhoto';

interface NativePatientPhotos {
  patientPhotoVersion?: () => number;
  choosePatientPhoto(): Promise<string | null>;
  discardPatientPhoto(uri: string): Promise<void>;
}

const nativePhotos =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<NativePatientPhotos>('PatientStore')
    : null;

function getPhotos(): NativePatientPhotos {
  if (nativePhotos?.patientPhotoVersion?.() !== 1) {
    throw Object.assign(new Error('缺少照片能力'), { code: 'PHOTO_UNAVAILABLE' });
  }
  return nativePhotos;
}

export const patientPhotoGateway: PatientPhotoGateway = {
  isAvailable: nativePhotos?.patientPhotoVersion?.() === 1,
  choose: () => getPhotos().choosePatientPhoto(),
  discard: async (uri) => getPhotos().discardPatientPhoto(uri),
};
