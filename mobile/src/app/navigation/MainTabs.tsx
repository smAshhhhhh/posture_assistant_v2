import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Camera, History, Settings, UsersRound } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { useWorkspace } from '@/app/state/useWorkspace';
import { CaptureHomeScreen } from '@/features/capture/screens/CaptureHomeScreen';
import { HistoryScreen } from '@/features/history/screens/HistoryScreen';
import { PatientsScreen } from '@/features/patients/screens/PatientsScreen';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { useAppTheme } from '@/shared/theme/useAppTheme';

import type { FeatureInfoTopic, MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const tabIcons = { Capture: Camera, Patients: UsersRound, History, Settings };

interface MainTabsProps {
  readonly workspace: ReturnType<typeof useWorkspace>;
  readonly onSelectTask: () => void;
  readonly onOpenInfo: (topic: FeatureInfoTopic) => void;
}

export function MainTabs({ workspace, onSelectTask, onOpenInfo }: MainTabsProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'none',
        tabBarActiveTintColor: theme.foreground,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          height: 72 + insets.bottom,
          backgroundColor: theme.surface,
          borderTopWidth: 0,
          elevation: 0,
          paddingTop: 8,
        },
        tabBarItemStyle: { minHeight: 56 },
        tabBarLabelStyle: { fontSize: 12, lineHeight: 18, marginTop: 4 },
        tabBarIcon: ({ focused, color }) => {
          const Icon = tabIcons[route.name];

          return (
            <View
              className="h-[30px] w-14 items-center justify-center rounded-md"
              style={{ backgroundColor: focused ? theme.secondary : 'transparent' }}
            >
              <Icon color={color} size={22} strokeWidth={1.8} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Capture" options={{ title: '采集' }}>
        {({ navigation }) => (
          <CaptureHomeScreen
            isDesignPreview={workspace.isDesignPreview}
            latestObservation={workspace.latestObservation}
            onHelp={() => onOpenInfo('about')}
            onOpenHistory={() => navigation.navigate('History')}
            onSelectPatient={() => navigation.navigate('Patients')}
            onSelectTask={onSelectTask}
            patient={workspace.patient}
            task={workspace.task}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Patients" options={{ title: '患者' }}>
        {({ navigation }) => (
          <PatientsScreen
            onCreatePatient={() => onOpenInfo('newPatient')}
            onSelectPatient={(patientId) => {
              workspace.selectPatient(patientId);
              navigation.navigate('Capture');
            }}
            patients={workspace.patients}
            selectedPatientId={workspace.patient?.id ?? null}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="History" options={{ title: '记录' }}>
        {() => (
          <HistoryScreen observations={workspace.patientObservations} patient={workspace.patient} />
        )}
      </Tab.Screen>
      <Tab.Screen name="Settings" options={{ title: '设置' }}>
        {() => (
          <SettingsScreen
            isDesignPreview={workspace.isDesignPreview}
            onOpenAbout={() => onOpenInfo('about')}
            onOpenCaptureSettings={() => onOpenInfo('captureSettings')}
            onOpenStorage={() => onOpenInfo('storage')}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
