import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { rehabTasks } from '@/domain/tasks/taskCatalog';
import { CapturePreparationScreen } from '@/features/capture/screens/CapturePreparationScreen';
import { CaptureTaskScreen } from '@/features/capture/screens/CaptureTaskScreen';
import { TaskPickerScreen } from '@/features/tasks/screens/TaskPickerScreen';
import { cameraPermissionGateway } from '@/native/capture/cameraPermissionGateway';
import { useAppTheme } from '@/shared/theme/useAppTheme';

import { useWorkspace } from '../state/useWorkspace';

import { FeatureInfoScreen } from './FeatureInfoScreen';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const workspace = useWorkspace();
  const theme = useAppTheme();

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
              onSelectTask={() => navigation.navigate('TaskPicker')}
              workspace={workspace}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="TaskPicker">
          {({ navigation }) => (
            <TaskPickerScreen
              onBack={navigation.goBack}
              onSelectTask={(task) => {
                workspace.selectTask(task);
                navigation.replace('CaptureTask', { taskId: task.id });
              }}
              selectedTask={workspace.task}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="CaptureTask">
          {({ navigation, route }) => {
            const task = rehabTasks.find((item) => item.id === route.params.taskId);
            if (!task) return null;

            return (
              <CaptureTaskScreen
                key={`${task.id}:${workspace.patient?.id ?? 'no-patient'}`}
                onBack={navigation.goBack}
                onContinue={() => {
                  if (workspace.patient) {
                    navigation.navigate('CapturePreparation', {
                      taskId: task.id,
                      patientId: workspace.patient.id,
                    });
                  }
                }}
                onSelectPatient={() => navigation.navigate('Main', { screen: 'Patients' })}
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
            if (!task || !patient) return null;

            return (
              <CapturePreparationScreen
                key={`${task.id}:${patient.id}`}
                onBack={navigation.goBack}
                patient={patient}
                permissionGateway={cameraPermissionGateway}
                task={task}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen component={FeatureInfoScreen} name="FeatureInfo" />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
