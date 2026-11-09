import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState } from 'react';

import { rehabTasks } from '@/domain/tasks/taskCatalog';
import { isAngleObservationTask } from '@/domain/observations/angleProtocols';
import { CapturePreparationScreen } from '@/features/capture/screens/CapturePreparationScreen';
import { CaptureTaskScreen } from '@/features/capture/screens/CaptureTaskScreen';
import { PatientFormScreen } from '@/features/patients/screens/PatientFormScreen';
import { PatientProfileScreen } from '@/features/patients/screens/PatientProfileScreen';
import { ClinicalAssessmentsScreen } from '@/features/patients/screens/ClinicalAssessmentsScreen';
import { TaskPickerScreen } from '@/features/tasks/screens/TaskPickerScreen';
import { ObservationReviewScreen } from '@/features/reports/screens/ObservationReviewScreen';
import type { PendingObservation } from '@/features/reports/screens/ObservationReviewScreen';
import { ObservationReportScreen } from '@/features/reports/screens/ObservationReportScreen';
import { ObservationCompareScreen } from '@/features/history/screens/ObservationCompareScreen';
import { CaptureSettingsScreen } from '@/features/settings/screens/CaptureSettingsScreen';
import { LocalDataScreen } from '@/features/settings/screens/LocalDataScreen';
import { AppButton } from '@/shared/ui/AppButton';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppNotice } from '@/shared/ui/AppNotice';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';
import { cameraPermissionGateway } from '@/native/capture/cameraPermissionGateway';
import { patientPhotoGateway } from '@/native/patients/patientPhotoGateway';
import { PoseCameraPreview, poseCameraGateway } from '@/native/capture/poseCamera';
import { ObservationVideoPlayer } from '@/native/capture/ObservationVideoPlayer';
import { useAppTheme } from '@/shared/theme/useAppTheme';

import { useWorkspace } from '../state/useWorkspace';

import { FeatureInfoScreen } from './FeatureInfoScreen';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';
import { UnavailableScreen } from './UnavailableScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const workspace = useWorkspace();
  const theme = useAppTheme();
  const [pending, setPending] = useState<PendingObservation | null>(null);
  const patientUnavailable = (onReturn: () => void) => (
    <UnavailableScreen
      title={workspace.records.status === 'loading' ? '正在读取患者资料' : '患者资料暂不可用'}
      description={
        workspace.records.error ??
        (workspace.records.status === 'loading'
          ? '资料载入后将显示当前页面。'
          : '患者可能已被移除，请返回列表选择患者。')
      }
      returnLabel="返回患者列表"
      isLoading={workspace.records.status === 'loading'}
      onReturn={onReturn}
      onRetry={
        workspace.records.status === 'error' ? () => void workspace.records.refresh() : undefined
      }
    />
  );
  const captureUnavailable = (onReturn: () => void) => (
    <UnavailableScreen
      title="当前流程已失效"
      description="任务或尚未保存的采集已不可用，请重新选择患者和观察任务。"
      returnLabel="返回观察首页"
      onReturn={onReturn}
    />
  );

  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.background,
          card: theme.surface,
          text: theme.foreground,
          primary: theme.accent,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="Main">
          {({ navigation }) => (
            <MainTabs
              onOpenInfo={(topic) => navigation.navigate('FeatureInfo', { topic })}
              onOpenCaptureSettings={() => navigation.navigate('CaptureSettings')}
              onOpenStorage={() =>
                navigation.navigate('LocalData', { scope: { kind: 'all' }, label: '全部本机资料' })
              }
              onSelectTask={() => navigation.navigate('TaskPicker')}
              onStartObservation={() => {
                if (!workspace.patient) return;
                navigation.navigate('CapturePreparation', {
                  taskId: workspace.task.id,
                  patientId: workspace.patient.id,
                });
              }}
              workspace={workspace}
              onCreatePatient={() => navigation.navigate('PatientForm', {})}
              onOpenPatient={(patientId) => navigation.navigate('PatientProfile', { patientId })}
              onOpenObservation={(observationId) =>
                navigation.navigate('ObservationReport', { observationId })
              }
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="ObservationReview">
          {({ navigation, route }) =>
            pending && pending.recording.id === route.params.recordingId ? (
              <ObservationReviewScreen
                pending={pending}
                repository={workspace.observationRepository}
                onDiscardVideo={() =>
                  poseCameraGateway.discardVideo?.(pending.recording.id) ?? Promise.resolve()
                }
                onBack={navigation.goBack}
                onDiscard={() => {
                  navigation.goBack();
                  setPending(null);
                }}
                onSaved={(observationId) => {
                  void workspace.history.refresh();
                  navigation.replace('ObservationReport', { observationId });
                  setPending(null);
                }}
              />
            ) : (
              captureUnavailable(() => navigation.popTo('Main', { screen: 'Capture' }))
            )
          }
        </Stack.Screen>
        <Stack.Screen name="ObservationReport">
          {({ navigation, route }) => (
            <ObservationReportScreen
              VideoPlayer={ObservationVideoPlayer}
              key={route.params.observationId}
              id={route.params.observationId}
              repository={workspace.observationRepository}
              onBack={navigation.goBack}
              onCompare={() =>
                navigation.navigate('ObservationCompare', {
                  observationId: route.params.observationId,
                })
              }
              onManageData={() =>
                navigation.navigate('LocalData', {
                  scope: { kind: 'observation', id: route.params.observationId },
                  label: '此条观察记录',
                })
              }
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="ObservationCompare">
          {({ navigation, route }) => (
            <ObservationCompareScreen
              key={route.params.observationId}
              id={route.params.observationId}
              observations={workspace.history.observations}
              repository={workspace.observationRepository}
              onBack={navigation.goBack}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="CaptureSettings">
          {({ navigation }) =>
            workspace.preferences.status === 'ready' ? (
              <CaptureSettingsScreen
                value={workspace.preferences.value}
                error={workspace.preferences.error}
                onSave={workspace.preferences.save}
                onBack={navigation.goBack}
              />
            ) : (
              <ScreenLayout
                hasTabBar={false}
                header={<AppHeader title="采集与模型" onBack={navigation.goBack} />}
              >
                {workspace.preferences.error ? (
                  <AppNotice>{workspace.preferences.error}</AppNotice>
                ) : (
                  <AppLoading>正在读取设置…</AppLoading>
                )}
                {workspace.preferences.status === 'error' ? (
                  <AppButton onPress={() => void workspace.preferences.refresh()}>
                    重新读取
                  </AppButton>
                ) : null}
              </ScreenLayout>
            )
          }
        </Stack.Screen>
        <Stack.Screen name="LocalData">
          {({ navigation, route }) => (
            <LocalDataScreen
              key={route.params.scope.kind === 'all' ? 'all' : route.params.scope.id}
              initialScope={route.params.scope}
              scopeLabel={route.params.label}
              patients={workspace.patients}
              repository={workspace.localDataRepository}
              onBack={navigation.goBack}
              onDeleted={workspace.refreshAll}
              onFinishedDelete={() => navigation.popTo('Main', { screen: 'History' })}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="PatientForm">
          {({ navigation, route }) => {
            const patient = workspace.patients.find((item) => item.id === route.params.patientId);
            if (route.params.patientId && !patient)
              return patientUnavailable(() => navigation.popTo('Main', { screen: 'Patients' }));
            return (
              <PatientFormScreen
                key={route.params.patientId ?? 'new-patient'}
                patient={patient}
                canSave={
                  workspace.patientRepository.isAvailable && workspace.records.status === 'ready'
                }
                onSave={workspace.records.savePatient}
                photoGateway={patientPhotoGateway}
                onBack={navigation.goBack}
                onSaved={(saved) => {
                  if (route.params.patientId) navigation.goBack();
                  else navigation.replace('PatientProfile', { patientId: saved.id });
                }}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="PatientProfile">
          {({ navigation, route }) => {
            const patient = workspace.patients.find((item) => item.id === route.params.patientId);
            if (!patient)
              return patientUnavailable(() => navigation.popTo('Main', { screen: 'Patients' }));
            return (
              <PatientProfileScreen
                patient={patient}
                observations={workspace.history.observations.filter(
                  (item) => item.patientId === patient.id,
                )}
                historyStatus={workspace.history.status}
                onRetryHistory={() => void workspace.history.refresh()}
                onOpenObservation={(observationId) =>
                  navigation.navigate('ObservationReport', { observationId })
                }
                onBack={navigation.goBack}
                onManageData={() =>
                  navigation.navigate('LocalData', {
                    scope: { kind: 'patient', id: patient.id },
                    label: `患者 ${patient.patientCode}`,
                  })
                }
                onEdit={() => navigation.navigate('PatientForm', { patientId: patient.id })}
                onAssessments={() =>
                  navigation.navigate('ClinicalAssessments', { patientId: patient.id })
                }
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="ClinicalAssessments">
          {({ navigation, route }) => {
            const patient = workspace.patients.find((item) => item.id === route.params.patientId);
            if (!patient)
              return patientUnavailable(() => navigation.popTo('Main', { screen: 'Patients' }));
            return (
              <ClinicalAssessmentsScreen
                key={patient.id}
                patient={patient}
                repository={workspace.patientRepository}
                onBack={navigation.goBack}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="TaskPicker">
          {({ navigation }) => (
            <TaskPickerScreen
              onBack={navigation.goBack}
              onSelectTask={(task) => {
                workspace.selectTask(task);
                navigation.goBack();
              }}
              onOpenTask={(task) => navigation.navigate('CaptureTask', { taskId: task.id })}
              selectedTask={workspace.task}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="CaptureTask">
          {({ navigation, route }) => {
            const task = rehabTasks.find((item) => item.id === route.params.taskId);
            if (!task)
              return captureUnavailable(() => navigation.popTo('Main', { screen: 'Capture' }));

            return (
              <CaptureTaskScreen
                key={`${task.id}:${workspace.patient?.id ?? 'no-patient'}`}
                onBack={navigation.goBack}
                patient={workspace.patient}
                task={task}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="CapturePreparation">
          {({ navigation, route }) => {
            const task = rehabTasks.find((item) => item.id === route.params.taskId);
            const patient = workspace.patients.find((item) => item.id === route.params.patientId);
            if (!task || !patient)
              return captureUnavailable(() => navigation.popTo('Main', { screen: 'Capture' }));

            return (
              <CapturePreparationScreen
                canSaveObservation={
                  isAngleObservationTask(task.id) &&
                  workspace.observationRepository.canStoreVideo &&
                  workspace.observationRepository.supportsTask(task.id)
                }
                CameraPreview={PoseCameraPreview}
                key={`${task.id}:${patient.id}`}
                onBack={navigation.goBack}
                patient={patient}
                permissionGateway={cameraPermissionGateway}
                poseGateway={poseCameraGateway}
                preferences={workspace.preferences.value}
                task={task}
                onReview={(session, recording, hasAssistance) => {
                  setPending({ patient, session, recording, hasAssistance });
                  navigation.replace('ObservationReview', { recordingId: recording.id });
                }}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen component={FeatureInfoScreen} name="FeatureInfo" />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
