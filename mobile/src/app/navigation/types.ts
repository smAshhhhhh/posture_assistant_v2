import type { NavigatorScreenParams } from '@react-navigation/native';

import type { RehabTaskId } from '@/domain/tasks/taskCatalog';

export type MainTabParamList = {
  Capture: undefined;
  Patients: undefined;
  History: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  TaskPicker: undefined;
  CaptureTask: { readonly taskId: RehabTaskId };
  CapturePreparation: { readonly taskId: RehabTaskId; readonly patientId: string };
  FeatureInfo: { readonly topic: FeatureInfoTopic };
};

export type FeatureInfoTopic = 'about' | 'newPatient' | 'captureSettings' | 'storage';
