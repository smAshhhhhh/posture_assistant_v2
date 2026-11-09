import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import type { AngleSample } from '@/domain/observations/angleAnalysis';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppText } from '@/shared/ui/AppText';

interface AngleChartProps {
  readonly series: readonly AngleSample[];
  readonly durationMs: number;
  readonly angleLabel: string;
}

export function AngleChart({ series, durationMs, angleLabel }: AngleChartProps) {
  const theme = useAppTheme();
  let previousMs = -Infinity;
  let hasPrevious = false;
  let path = '';
  // 缺失点及超过 250 ms 的采样间隔断线，不补齐测量值。
  for (const sample of series) {
    if (sample.angle === null) {
      hasPrevious = false;
      continue;
    }
    const x = 8 + (sample.timestampMs / Math.max(1, durationMs)) * 284;
    const y = 154 - (sample.angle / 180) * 146;
    const command = hasPrevious && sample.timestampMs - previousMs <= 250 ? 'L' : 'M';
    path += `${command}${x.toFixed(2)},${y.toFixed(2)} `;
    previousMs = sample.timestampMs;
    hasPrevious = true;
  }
  return (
    <View className="gap-2">
      <AppText variant="caption" className="text-muted">
        {angleLabel}（°） · 0–180°
      </AppText>
      <View className="flex-row gap-2">
        <View className="justify-between py-2" style={{ height: 164 }}>
          {[180, 90, 0].map((angle) => (
            <AppText key={angle} variant="meta" className="text-right text-muted">
              {angle}
            </AppText>
          ))}
        </View>
        <View className="flex-1">
          <Svg
            width="100%"
            height={164}
            viewBox="0 0 300 164"
            preserveAspectRatio="none"
            accessibilityLabel={`${angleLabel}随有效采集时间变化；缺失区间断线`}
          >
            {[8, 81, 154].map((y) => (
              <Line
                key={y}
                x1={8}
                x2={292}
                y1={y}
                y2={y}
                stroke={theme.secondary}
                strokeWidth={1}
              />
            ))}
            <Path
              d={path}
              stroke={theme.accent}
              strokeWidth={2.5}
              fill="none"
              strokeLinejoin="round"
            />
          </Svg>
          <View className="flex-row justify-between">
            <AppText variant="meta" className="text-muted">
              0 秒
            </AppText>
            <AppText variant="meta" className="text-muted">
              {(durationMs / 2_000).toFixed(1)} 秒
            </AppText>
            <AppText variant="meta" className="text-muted">
              {(durationMs / 1_000).toFixed(1)} 秒
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}
