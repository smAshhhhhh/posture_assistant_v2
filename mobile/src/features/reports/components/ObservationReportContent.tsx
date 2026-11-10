import { Chip } from 'heroui-native/chip';
import type { ChipColor } from 'heroui-native/chip';
import { View } from 'react-native';

import type { AngleAnalysis } from '@/domain/observations/angleAnalysis';
import { getObservationFeedback } from '@/domain/observations/observationFeedback';
import { getAngleObservationProtocol } from '@/domain/observations/angleProtocols';
import type { AngleObservationTaskId } from '@/domain/observations/angleProtocols';
import { captureQualityLabels, taskStatusLabels } from '@/domain/observations/types';
import type { CaptureQuality, HistoricalTaskStatus } from '@/domain/observations/types';
import type { TaskAnalysis } from '@/domain/observations/taskAnalysis';
import type { MeasurementContext } from '@/domain/observations/measurementContext';
import { AppCard } from '@/shared/ui/AppCard';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppText } from '@/shared/ui/AppText';

import { AngleChart } from './AngleChart';
import { SitToStandReportCard } from './SitToStandReportCard';
import { MarchInPlaceReportCard } from './MarchInPlaceReportCard';
import { ShortWalkReportCard } from './ShortWalkReportCard';
import { ObservationFeedbackDescriptions } from './ObservationFeedbackDescriptions';
import { MeasurementDetailsCard } from './MeasurementDetailsCard';

const qualityColors: Record<CaptureQuality, ChipColor> = {
  valid: 'success',
  degraded: 'warning',
  invalid_capture: 'danger',
};

interface ReportStatusRowProps {
  readonly title: string;
  readonly label: string;
  readonly color?: ChipColor;
}

function ReportStatusRow({ title, label, color = 'default' }: ReportStatusRowProps) {
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-2">
      <AppText className="shrink font-medium">{title}</AppText>
      <Chip
        className="max-w-full shrink"
        pointerEvents="none"
        accessibilityRole="text"
        accessibilityLabel={`${title}：${label}`}
        color={color}
        size="sm"
        variant="soft"
      >
        <Chip.Label className="shrink">{label}</Chip.Label>
      </Chip>
    </View>
  );
}

interface ObservationReportContentProps {
  readonly taskId: AngleObservationTaskId;
  readonly analysis: AngleAnalysis;
  readonly durationMs: number;
  readonly taskStatus: HistoricalTaskStatus | null;
  readonly hasAssistance: boolean;
  readonly taskAnalysis: TaskAnalysis;
  readonly measurementContext?: MeasurementContext | undefined;
}

export function ObservationReportContent({
  taskId,
  analysis,
  durationMs,
  taskStatus,
  hasAssistance,
  taskAnalysis,
  measurementContext,
}: ObservationReportContentProps) {
  const protocol = getAngleObservationProtocol(taskId);
  const feedback = getObservationFeedback(taskId, analysis, taskStatus);
  const angle = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}°`);
  return (
    <View className="gap-6">
      <AppCardStack>
        <View className="gap-2">
          <AppCard className="gap-3">
            <ReportStatusRow
              title="任务完成情况"
              label={taskStatus ? taskStatusLabels[taskStatus] : '待现场确认'}
            />
            <ReportStatusRow title="辅助情况" label={hasAssistance ? '人工或器具辅助' : '无辅助'} />
          </AppCard>
          <ObservationFeedbackDescriptions feedback={feedback} category="completion" />
        </View>
        <View className="gap-2">
          <AppCard className="gap-3">
            <ReportStatusRow
              title="采集质量"
              label={captureQualityLabels[analysis.captureQuality]}
              color={qualityColors[analysis.captureQuality]}
            />
            <AppText>可用时间占比：{(analysis.coverage * 100).toFixed(0)}%</AppText>
            <AppText>有效样本：{analysis.validSampleCount} 帧</AppText>
            <AppText>最长数据间断：{(analysis.longestGapMs / 1_000).toFixed(2)} 秒</AppText>
          </AppCard>
          <ObservationFeedbackDescriptions feedback={feedback} category="capture" />
        </View>
        <View className="gap-2">
          <AppCard className="gap-4">
            <AppText variant="section">动作表现 · 二维运动学</AppText>
            <AppText variant="section">
              {taskId === 'sit_to_stand' || taskId === 'march_in_place' || taskId === 'short_walk'
                ? '患侧膝夹角变化范围'
                : protocol.measurement === 'image_vertical'
                  ? '躯干投影倾角变化范围'
                  : '二维投影角度变化范围'}
            </AppText>
            <AppText className="text-[40px] leading-[48px]">
              {angle(analysis.rangeOfMotion)}
            </AppText>
            <View className="gap-2">
              <AppText>
                最小 / 最大{protocol.measurement === 'image_vertical' ? '倾角' : '夹角'}：
                {angle(analysis.minAngle)} / {angle(analysis.maxAngle)}
              </AppText>
              <AppText>
                {taskId === 'sit_to_stand'
                  ? '完整坐站往返'
                  : taskId === 'march_in_place'
                    ? '完整踏步'
                    : taskId === 'short_walk'
                      ? '患侧膝角重复周期'
                      : '识别周期'}
                ：{analysis.repetitions ?? '—'} {taskId === 'march_in_place' ? '步' : '次'}
              </AppText>
              <AppText>采集时长（不含暂停）：{(durationMs / 1_000).toFixed(1)} 秒</AppText>
            </View>
            <AngleChart
              angleLabel={protocol.angleLabel}
              series={analysis.series}
              durationMs={durationMs}
            />
          </AppCard>
          <ObservationFeedbackDescriptions feedback={feedback} category="movement" />
        </View>
        {taskId === 'sit_to_stand' && analysis.sitToStand ? (
          <SitToStandReportCard metrics={analysis.sitToStand} />
        ) : null}
        {taskId === 'march_in_place' && analysis.marchInPlace ? (
          <View className="gap-2">
            <MarchInPlaceReportCard metrics={analysis.marchInPlace} />
            <ObservationFeedbackDescriptions feedback={feedback} category="stepping" />
          </View>
        ) : null}
        {taskId === 'short_walk' && analysis.shortWalk ? (
          <View className="gap-2">
            <ShortWalkReportCard metrics={analysis.shortWalk} />
            <ObservationFeedbackDescriptions feedback={feedback} category="walking" />
          </View>
        ) : null}
        <MeasurementDetailsCard analysis={taskAnalysis} context={measurementContext} />
      </AppCardStack>
    </View>
  );
}
