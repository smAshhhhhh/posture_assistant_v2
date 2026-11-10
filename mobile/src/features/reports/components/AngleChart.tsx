import { ScrollView, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

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
  const segmentStarts = new Map<number, number>();
  // 使用采集片段索引，缺失角度也保留分段；旧记录不推测暂停边界。
  for (const sample of series) {
    if (sample.segmentIndex !== undefined && !segmentStarts.has(sample.segmentIndex)) {
      segmentStarts.set(sample.segmentIndex, sample.timestampMs);
    }
  }
  const segments = Array.from(segmentStarts, ([index, timestampMs]) => ({
    index,
    timestampMs,
    x: 8 + (timestampMs / Math.max(1, durationMs)) * 284,
  }));
  const hasSegments = segments.length > 1;
  const labelHeight = hasSegments ? 24 : 0;
  // 密集标记只省略图内文字，图下仍可横向查看每段编号和数据起点。
  let previousLabelX = -Infinity;
  const labeledSegments = segments.filter((segment) => {
    const labelX = Math.max(32, Math.min(segment.x, 268));
    if (labelX - previousLabelX < 52) return false;
    previousLabelX = labelX;
    return true;
  });
  let previousMs = -Infinity;
  let hasPrevious = false;
  let previousSegment: number | undefined;
  let path = '';
  // 采集分段、缺失点及长间隔均断线，不补齐测量值。
  for (const sample of series) {
    if (sample.angle === null) {
      hasPrevious = false;
      continue;
    }
    const x = 8 + (sample.timestampMs / Math.max(1, durationMs)) * 284;
    const y = 154 - (sample.angle / 180) * 146;
    const command =
      hasPrevious &&
      previousSegment === sample.segmentIndex &&
      sample.timestampMs - previousMs <= 250
        ? 'L'
        : 'M';
    path += `${command}${x.toFixed(2)},${y.toFixed(2)} `;
    previousMs = sample.timestampMs;
    previousSegment = sample.segmentIndex;
    hasPrevious = true;
  }
  return (
    <View className="gap-2">
      <AppText variant="caption" className="text-muted">
        {angleLabel}（°） · 0–180°
      </AppText>
      {hasSegments ? (
        <AppText variant="meta" className="text-muted">
          共 {segments.length} 段 · 虚线标记各段数据起点 · 暂停时间不计入横轴
        </AppText>
      ) : null}
      <View className="flex-row gap-2">
        <View
          className="justify-between pb-2"
          style={{ height: 164 + labelHeight, paddingTop: 8 + labelHeight }}
        >
          {[180, 90, 0].map((angle) => (
            <AppText key={angle} variant="meta" className="text-right text-muted">
              {angle}
            </AppText>
          ))}
        </View>
        <View className="flex-1">
          <Svg
            width="100%"
            height={164 + labelHeight}
            viewBox={`0 ${-labelHeight} 300 ${164 + labelHeight}`}
            preserveAspectRatio="none"
            accessibilityLabel={`${angleLabel}随有效采集时间变化；缺失区间断线${
              hasSegments ? `；共${segments.length}个采集片段，虚线标记各段数据起点` : ''
            }`}
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
            {hasSegments
              ? segments.map((segment) => (
                  <Line
                    key={segment.index}
                    x1={segment.x}
                    x2={segment.x}
                    y1={0}
                    y2={154}
                    stroke={theme.muted}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                ))
              : null}
            {hasSegments
              ? labeledSegments.map((segment) => (
                  <SvgText
                    key={segment.index}
                    x={Math.max(32, Math.min(segment.x, 268))}
                    y={-8}
                    fill={theme.foreground}
                    fontSize={12}
                    textAnchor="middle"
                  >
                    {`第 ${segment.index + 1} 段`}
                  </SvgText>
                ))
              : null}
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
      {hasSegments ? (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View className="flex-row gap-4 pb-2">
            {segments.map((segment) => (
              <AppText key={segment.index} variant="meta" className="text-muted">
                第 {segment.index + 1} 段 · {(segment.timestampMs / 1_000).toFixed(1)} 秒起
              </AppText>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
