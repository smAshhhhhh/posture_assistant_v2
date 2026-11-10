import { Chip } from 'heroui-native/chip';
import { StyleSheet, View } from 'react-native';

import type { CameraPermission } from '@/domain/capture/cameraPermission';
import { layoutTokens } from '@/shared/theme/tokens';

interface CapturePreviewLabelsProps {
  readonly title: string;
  readonly permission: CameraPermission;
}

const labelClassName = 'shrink text-xs font-normal leading-[18px] text-white';

export function CapturePreviewLabels({ title, permission }: CapturePreviewLabelsProps) {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Chip
        accessible
        accessibilityLabel={title}
        accessibilityRole="text"
        background={null}
        className="min-w-0 bg-black/60 px-3 py-1"
        size="sm"
        style={styles.title}
        variant="secondary"
      >
        <Chip.Label className={labelClassName}>{title}</Chip.Label>
      </Chip>
      {permission === 'granted' ? (
        <Chip
          accessible
          accessibilityLabel="相机已授权"
          accessibilityRole="text"
          background={null}
          className="shrink-0 gap-1.5 bg-black/60 px-3 py-1"
          color="success"
          size="sm"
          variant="secondary"
        >
          <View className="size-1.5 shrink-0 rounded-full bg-success" accessible={false} />
          <Chip.Label className={labelClassName}>相机已授权</Chip.Label>
        </Chip>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 以标签外框计算距卡片边缘的间距，长标题收缩换行以避让授权标签。
  overlay: {
    position: 'absolute',
    top: layoutTokens.pagePadding,
    right: layoutTokens.pagePadding,
    left: layoutTokens.pagePadding,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flexShrink: 1,
    maxWidth: '100%',
  },
});
