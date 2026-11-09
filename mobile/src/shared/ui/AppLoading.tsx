import { Spinner } from 'heroui-native/spinner';
import { View } from 'react-native';
import { twMerge } from 'tailwind-merge';

import { AppText } from './AppText';

interface AppLoadingProps {
  readonly children: string;
  readonly className?: string;
  readonly isInverse?: boolean;
}

export function AppLoading({ children, className, isInverse = false }: AppLoadingProps) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      accessibilityLabel={children}
      accessible
      className={twMerge('flex-row items-center gap-3', className)}
    >
      <Spinner size="sm" color={isInverse ? 'white' : 'default'} accessible={false} />
      <AppText className={isInverse ? 'shrink text-white' : 'shrink text-muted'}>
        {children}
      </AppText>
    </View>
  );
}
