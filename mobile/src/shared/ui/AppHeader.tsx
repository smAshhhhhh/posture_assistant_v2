import { Activity, ArrowLeft, CircleHelp } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';

import { AppText } from './AppText';

interface AppHeaderProps {
  readonly title?: string;
  readonly onBack?: () => void;
  readonly onHelp?: () => void;
}

export function AppHeader({ title = 'PostureAssist', onBack, onHelp }: AppHeaderProps) {
  const theme = useAppTheme();

  return (
    <View className="min-h-14 flex-row items-center gap-3 px-6">
      {onBack ? (
        <Pressable
          accessibilityLabel="返回"
          accessibilityRole="button"
          className="min-h-12 min-w-12 items-center justify-center"
          onPress={onBack}
        >
          <ArrowLeft color={theme.foreground} size={22} />
        </Pressable>
      ) : (
        <Activity color={theme.foreground} size={24} />
      )}
      <AppText className="flex-1 text-[19px] font-medium">{title}</AppText>
      {onHelp ? (
        <Pressable
          accessibilityLabel="了解康复观察"
          accessibilityRole="button"
          className="min-h-12 min-w-12 items-center justify-center"
          onPress={onHelp}
        >
          <CircleHelp color={theme.muted} size={21} />
        </Pressable>
      ) : null}
    </View>
  );
}
