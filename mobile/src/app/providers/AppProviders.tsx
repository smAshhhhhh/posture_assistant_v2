import { HeroUINativeProvider } from 'heroui-native/provider';
import type { ReactNode } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

import { AppErrorBoundary } from './AppErrorBoundary';

Uniwind.setTheme('light');

interface AppProvidersProps {
  readonly children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppErrorBoundary>
        <SafeAreaProvider>
          <HeroUINativeProvider config={{ devInfo: { stylingPrinciples: false } }}>
            <StatusBar barStyle="dark-content" />
            {children}
          </HeroUINativeProvider>
        </SafeAreaProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}
