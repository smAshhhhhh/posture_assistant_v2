import type { NavigatorScreenParams } from '@react-navigation/native';

import type { RehabTaskId } from '@/domain/tasks/taskCatalog';
import type { LocalDataScope } from '@/domain/storage/localData';

export type MainTabParamList = {
  Capture: undefined;
  Patients: undefined;
  History: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  TaskPicker: undefined;
  PatientProfile: { readonly patientId: string };
  PatientForm: { readonly patientId?: string };
  ClinicalAssessments: { readonly patientId: string };
  ObservationReview: { readonly recordingId: string };
  ObservationReport: { readonly observationId: string };
  ObservationCompare: { readonly observationId: string };
  CaptureSettings: undefined;
  LocalData: { readonly scope: LocalDataScope; readonly label: string };
  CaptureTask: { readonly taskId: RehabTaskId };
  CapturePreparation: {
    readonly taskId: RehabTaskId;
    readonly patientId: string;
  };
  FeatureInfo: { readonly topic: FeatureInfoTopic };
};

export type FeatureInfoTopic = 'about';
