import { Chip } from 'heroui-native/chip';
import { View } from 'react-native';

import type { CameraPermission } from '@/domain/capture/cameraPermission';

interface CameraPermissionBadgeProps {
  readonly permission: CameraPermission;
}

export function CameraPermissionBadge({ permission }: CameraPermissionBadgeProps) {
  if (permission !== 'granted') return null;

  return (
    <View pointerEvents="none">
      <Chip
        accessible
        accessibilityLabel="相机已授权"
        accessibilityRole="text"
        className="max-w-full gap-1.5 px-0 py-0"
        color="success"
        size="sm"
        variant="tertiary"
      >
        <View className="size-1.5 shrink-0 rounded-full bg-success" accessible={false} />
        <Chip.Label className="shrink text-xs leading-[18px] text-muted">相机已授权</Chip.Label>
      </Chip>
    </View>
  );
}
