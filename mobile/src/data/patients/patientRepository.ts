import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { PatientRepository } from '@/domain/patients/patientRepository';
import {
  parseClinicalAssessment,
  parsePatientProfile,
  parseRecordList,
} from '@/domain/patients/recordParser';

interface NativePatientStore {
  patientPhotoVersion?: () => number;
  assessmentManagementVersion?: () => number;
  list(): Promise<string>;
  save(payload: string): Promise<string>;
  listAssessments(patientId: string): Promise<string>;
  addAssessment(payload: string): Promise<string>;
  updateAssessment(payload: string): Promise<string>;
  deleteAssessment(payload: string): Promise<string>;
}

const nativeStore =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<NativePatientStore>('PatientStore')
    : null;

function getStore(): NativePatientStore {
  if (!nativeStore)
    throw Object.assign(new Error('缺少患者存储模块'), { code: 'STORE_UNAVAILABLE' });
  return nativeStore;
}

function parseJson(value: string): unknown {
  return JSON.parse(value);
}

function getAssessmentStore(): NativePatientStore {
  const store = getStore();
  if (store.assessmentManagementVersion?.() !== 1) {
    throw Object.assign(new Error('缺少评估管理能力'), { code: 'ASSESSMENT_UNAVAILABLE' });
  }
  return store;
}

export const patientRepository: PatientRepository = {
  isAvailable: nativeStore !== null,
  supportsAssessmentManagement: nativeStore?.assessmentManagementVersion?.() === 1,
  async list() {
    return parseRecordList(parseJson(await getStore().list()), parsePatientProfile);
  },
  async save(values, current) {
    if (current?.id.startsWith('design-')) {
      throw Object.assign(new Error('演示资料不能写入正式档案'), { code: 'INVALID_RECORD' });
    }
    if (values.photoUri && getStore().patientPhotoVersion?.() !== 1) {
      throw Object.assign(new Error('缺少照片能力'), { code: 'PHOTO_UNAVAILABLE' });
    }
    const payload = { ...values, id: current?.id ?? null, revision: current?.revision ?? null };
    return parsePatientProfile(parseJson(await getStore().save(JSON.stringify(payload))));
  },
  async listAssessments(patientId) {
    return parseRecordList(
      parseJson(await getStore().listAssessments(patientId)),
      parseClinicalAssessment,
    );
  },
  async addAssessment(patientId, values) {
    const payload = JSON.stringify({ ...values, patientId });
    return parseClinicalAssessment(parseJson(await getStore().addAssessment(payload)));
  },
  async updateAssessment(current, values) {
    const payload = JSON.stringify({ current, values });
    return parseClinicalAssessment(parseJson(await getAssessmentStore().updateAssessment(payload)));
  },
  async deleteAssessment(current) {
    const deletedId = await getAssessmentStore().deleteAssessment(JSON.stringify(current));
    if (deletedId !== current.id) throw new Error('评估删除回执不正确');
  },
};
