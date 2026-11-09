import { useThemeColor } from 'heroui-native/hooks';

export function useAppTheme() {
  const [background, surface, secondary, foreground, muted, accent, danger, defaultColor] =
    useThemeColor([
      'background',
      'surface',
      'surface-secondary',
      'foreground',
      'muted',
      'accent',
      'danger',
      'default',
    ]);

  return { background, surface, secondary, foreground, muted, accent, danger, defaultColor };
}
