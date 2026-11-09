import type { ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layoutTokens } from '../theme/tokens';

interface ScreenLayoutProps {
  readonly children: ReactNode;
  readonly header?: ReactNode;
  readonly hasTabBar?: boolean;
}

export function ScreenLayout({ children, header, hasTabBar = true }: ScreenLayoutProps) {
  const { width } = useWindowDimensions();
  const horizontalPadding = width > 390 ? layoutTokens.widePagePadding : layoutTokens.pagePadding;

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={hasTabBar ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      {header}
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          className="w-full self-center gap-6 pb-8 pt-3"
          style={{
            maxWidth: layoutTokens.maxContentWidth,
            paddingHorizontal: horizontalPadding,
          }}
        >
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
