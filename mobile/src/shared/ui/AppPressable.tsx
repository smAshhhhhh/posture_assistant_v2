import { PressableFeedback } from 'heroui-native/pressable-feedback';
import type { ComponentProps } from 'react';

export function AppPressable(props: ComponentProps<typeof PressableFeedback>) {
  return <PressableFeedback {...props} />;
}
