import { ArrowLeft, CircleHelp } from 'lucide-react-native';
import { Button } from 'heroui-native/button';
import { View } from 'react-native';

import { layoutTokens } from '../theme/tokens';
import { useAppTheme } from '../theme/useAppTheme';

import { AppText } from './AppText';
import { AppLogo } from './AppBrand';

interface AppHeaderProps {
  readonly title?: string;
  readonly onBack?: () => void;
  readonly onHelp?: () => void;
}

export function AppHeader({ title, onBack, onHelp }: AppHeaderProps) {
  const theme = useAppTheme();
  const showsLogo = !title && !onBack;

  return (
    <View
      className="min-h-14 flex-row items-center"
      style={{ paddingHorizontal: layoutTokens.pagePadding }}
    >
      {onBack ? (
        <Button
          isIconOnly
          variant="ghost"
          accessibilityLabel="返回"
          accessibilityRole="button"
          hitSlop={{ left: 8, right: 8 }}
          className="mr-1 h-12 w-8 min-w-8 items-center justify-start rounded-full p-0"
          onPress={onBack}
        >
          <ArrowLeft color={theme.foreground} size={22} />
        </Button>
      ) : null}
      {showsLogo ? (
        <View className="flex-1">
          <AppLogo style={{ maxWidth: '100%' }} />
        </View>
      ) : (
        <AppText className="min-w-0 flex-1 text-[19px] font-medium">
          {title ?? 'PostureAssist'}
        </AppText>
      )}
      {onHelp ? (
        <Button
          isIconOnly
          variant="ghost"
          accessibilityLabel="了解康复观察"
          accessibilityRole="button"
          className="min-h-12 min-w-12 items-center justify-center rounded-full"
          onPress={onHelp}
        >
          <CircleHelp color={theme.muted} size={21} />
        </Button>
      ) : null}
    </View>
  );
}
