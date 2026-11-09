import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { layoutTokens } from '@/shared/theme/tokens';

interface AppErrorBoundaryProps {
  readonly children: ReactNode;
}

interface AppErrorBoundaryState {
  readonly hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // 不记录可能包含患者资料的错误上下文。
    console.error('应用界面发生错误，请重新打开当前流程。');
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text accessibilityRole="header" style={styles.title}>
          界面暂时无法打开
        </Text>
        <Text style={styles.description}>请重新打开应用界面后继续。</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ hasError: false })}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>重新打开</Text>
        </Pressable>
      </View>
    );
  }
}

// 主题 Provider 失败时仍需显示恢复入口。
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: layoutTokens.pagePadding,
    gap: 16,
    backgroundColor: '#F5F5F5',
  },
  title: { fontSize: 24, color: '#18181B', fontWeight: '600' },
  description: { fontSize: 16, lineHeight: 24, color: '#71717A' },
  button: {
    minHeight: 52,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181B',
  },
  buttonLabel: { fontSize: 16, color: '#FFFFFF' },
});
