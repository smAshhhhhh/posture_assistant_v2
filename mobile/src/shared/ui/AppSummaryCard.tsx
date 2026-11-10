import { Chip } from 'heroui-native/chip';
import type { ChipColor } from 'heroui-native/chip';
import { View } from 'react-native';

import { AppCard } from './AppCard';
import { AppPressable } from './AppPressable';
import { AppText } from './AppText';

interface AppSummaryCardProps {
  readonly title: string;
  readonly description: string;
  readonly summary: string;
  readonly tagLabel: string;
  readonly tagColor: ChipColor;
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string;
  readonly onPress: () => void;
}

export function AppSummaryCard({
  title,
  description,
  summary,
  tagLabel,
  tagColor,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: AppSummaryCardProps) {
  return (
    <AppPressable
      className="rounded-[24px]"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
    >
      <AppCard className="gap-1">
        <View className="flex-row items-start gap-3">
          <AppText className="min-w-0 flex-1 font-medium">{title}</AppText>
          <Chip
            className="max-w-[45%] shrink"
            pointerEvents="none"
            accessibilityRole="text"
            color={tagColor}
            size="sm"
            variant="soft"
          >
            <Chip.Label className="shrink">{tagLabel}</Chip.Label>
          </Chip>
        </View>
        <AppText className="text-muted" variant="caption">
          {description}
        </AppText>
        <AppText variant="caption">{summary}</AppText>
      </AppCard>
    </AppPressable>
  );
}
