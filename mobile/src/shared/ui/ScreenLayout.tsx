import type { ComponentRef, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

import { layoutTokens } from '../theme/tokens';

// 第三方组件需转换 className，才能应用页面高度和背景样式。
const StyledSafeAreaView = withUniwind(SafeAreaView);

interface ScreenLayoutProps {
  readonly children: ReactNode;
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly hasTabBar?: boolean;
  readonly scrollResetKey?: string | number;
}

export function ScreenLayout({
  children,
  header,
  footer,
  hasTabBar = true,
  scrollResetKey,
}: ScreenLayoutProps) {
  const scrollView = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (scrollResetKey === undefined) return;
    // 等待新阶段布局完成，只复位滚动，不重新挂载相机和表单。
    const frame = requestAnimationFrame(() => {
      scrollView.current?.scrollTo({ y: 0, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollResetKey]);

  return (
    <StyledSafeAreaView
      className="flex-1 bg-background"
      edges={hasTabBar ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      {header}
      <ScrollView
        ref={scrollView}
        // 约束正文占用剩余高度，避免长表单把底部操作挤出屏幕。
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          className="w-full self-center gap-6 pb-8 pt-3"
          style={{
            maxWidth: layoutTokens.maxContentWidth,
            paddingHorizontal: layoutTokens.pagePadding,
          }}
        >
          {children}
        </View>
      </ScrollView>
      {footer ? (
        <View className="bg-surface py-3" style={{ flexShrink: 0 }}>
          <View
            className="w-full self-center gap-3"
            style={{
              maxWidth: layoutTokens.maxContentWidth,
              paddingHorizontal: layoutTokens.pagePadding,
            }}
          >
            {footer}
          </View>
        </View>
      ) : null}
    </StyledSafeAreaView>
  );
}
