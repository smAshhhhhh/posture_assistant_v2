import { Chip } from 'heroui-native/chip';
import type { ChipColor } from 'heroui-native/chip';

import { captureQualityLabels } from '@/domain/observations/types';
import type { CaptureQuality } from '@/domain/observations/types';

const qualityColors: Record<CaptureQuality, ChipColor> = {
  valid: 'success',
  degraded: 'warning',
  invalid_capture: 'danger',
};

export function CaptureQualityChip({ quality }: { readonly quality: CaptureQuality }) {
  return (
    <Chip
      className="max-w-[45%] shrink"
      pointerEvents="none"
      accessibilityRole="text"
      color={qualityColors[quality]}
      size="sm"
      variant="soft"
    >
      <Chip.Label className="shrink">{captureQualityLabels[quality]}</Chip.Label>
    </Chip>
  );
}
