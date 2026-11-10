import { Chip } from 'heroui-native/chip';
import type { ChipColor } from 'heroui-native/chip';

interface AppTagProps {
  readonly label: string;
  readonly color?: ChipColor;
  readonly accessibilityLabel?: string;
}

export function AppTag({ label, color = 'default', accessibilityLabel }: AppTagProps) {
  return (
    <Chip
      className="max-w-full shrink"
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
      color={color}
      size="sm"
      variant="soft"
    >
      <Chip.Label className="shrink">{label}</Chip.Label>
    </Chip>
  );
}
