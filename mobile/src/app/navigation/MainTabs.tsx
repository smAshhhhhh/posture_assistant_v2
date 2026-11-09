import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Camera, History, Settings, UsersRound } from 'lucide-react-native';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { useWorkspace } from '@/app/state/useWorkspace';
import { CaptureHomeScreen } from '@/features/capture/screens/CaptureHomeScreen';
import { HistoryScreen } from '@/features/history/screens/HistoryScreen';
import { PatientsScreen } from '@/features/patients/screens/PatientsScreen';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { layoutTokens } from '@/shared/theme/tokens';
import { useAppTheme } from '@/shared/theme/useAppTheme';

import { TabBarButton } from './TabBarButton';
import type { FeatureInfoTopic, MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const tabIcons = { Capture: Camera, Patients: UsersRound, History, Settings };

interface MainTabsProps {
  readonly workspace: ReturnType<typeof useWorkspace>;
  readonly onSelectTask: () => void;
  readonly onStartObservation: () => void;
  readonly onOpenInfo: (topic: FeatureInfoTopic) => void;
  readonly onCreatePatient: () => void;
  readonly onOpenPatient: (patientId: string) => void;
  readonly onOpenObservation: (observationId: string) => void;
  readonly onOpenCaptureSettings: () => void;
  readonly onOpenStorage: () => void;
}

export function MainTabs({
  workspace,
  onSelectTask,
  onStartObservation,
  onOpenInfo,
  onCreatePatient,
  onOpenPatient,
  onOpenObservation,
  onOpenCaptureSettings,
  onOpenStorage,
}: MainTabsProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  // 字体放大时增加标签空间，默认保持紧凑高度。
  const contentHeight = layoutTokens.tabBarHeight + Math.max(0, fontScale - 1) * 18;

  return (
    <Tab.Navigator
      initialRouteName="Capture"
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'none',
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarLabelPosition: 'below-icon',
        tabBarButton: (props) => <TabBarButton {...props} />,
        tabBarStyle: {
          height: contentHeight + insets.bottom,
          backgroundColor: theme.surface,
          borderTopWidth: 0,
          elevation: 0,
          paddingTop: 0,
        },
        tabBarItemStyle: { minHeight: layoutTokens.minimumTouchSize },
        tabBarLabelStyle: { fontSize: 12, lineHeight: 18, marginTop: 2 },
        tabBarIconStyle: { width: 24, height: 24 },
        tabBarIcon: ({ color }) => {
          const Icon = tabIcons[route.name];

          return <Icon color={color} size={22} strokeWidth={1.8} />;
        },
      })}
    >
      <Tab.Screen name="Capture" options={{ title: '采集' }}>
        {({ navigation }) => (
          <CaptureHomeScreen
            latestObservation={workspace.latestObservation}
            onCreatePatient={onCreatePatient}
            onHelp={() => onOpenInfo('about')}
            onOpenHistory={() => navigation.navigate('History')}
            onSelectPatient={workspace.selectPatient}
            onSelectTask={onSelectTask}
            onStartObservation={onStartObservation}
            patient={workspace.patient}
            patients={workspace.patients}
            task={workspace.task}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Patients" options={{ title: '患者' }}>
        {() => (
          <PatientsScreen
            onCreatePatient={onCreatePatient}
            onOpenPatient={onOpenPatient}
            status={workspace.records.status}
            error={workspace.records.error}
            onRefresh={() => void workspace.records.refresh()}
            patients={workspace.patients}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="History" options={{ title: '记录' }}>
        {({ navigation }) => (
          <HistoryScreen
            observations={workspace.history.observations}
            patient={workspace.patient}
            patients={workspace.patients}
            onManagePatients={() => navigation.navigate('Patients')}
            status={workspace.history.status}
            error={workspace.history.error}
            onRefresh={() => void workspace.history.refresh()}
            onOpenObservation={onOpenObservation}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Settings" options={{ title: '设置' }}>
        {() => (
          <SettingsScreen
            onOpenAbout={() => onOpenInfo('about')}
            onOpenCaptureSettings={onOpenCaptureSettings}
            onOpenStorage={onOpenStorage}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
