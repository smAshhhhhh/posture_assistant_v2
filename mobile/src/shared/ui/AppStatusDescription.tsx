import { useThemeColor } from 'heroui-native/hooks';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { AppDescription } from './AppDescription';

interface AppStatusDescriptionProps {
  readonly children: string;
  readonly severity: 'info' | 'warning' | 'danger';
}

export function AppStatusDescription({ children, severity }: AppStatusDescriptionProps) {
  const [info, warning, danger] = useThemeColor([
    'accent-soft-foreground',
    'warning-soft-foreground',
    'danger-soft-foreground',
  ]);
  const color = { info, warning, danger }[severity];
  const Icon = { info: Info, warning: TriangleAlert, danger: CircleAlert }[severity];

  return (
    <View className="flex-row items-start gap-2 px-4">
      <View className="pt-0.5" accessible={false} importantForAccessibility="no-hide-descendants">
        <Icon size={16} color={color} />
      </View>
      <AppDescription className="min-w-0 flex-1 px-0" style={{ color }}>
        {children}
      </AppDescription>
    </View>
  );
}
