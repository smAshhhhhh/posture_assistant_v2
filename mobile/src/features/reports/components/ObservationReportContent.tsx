import { View } from 'react-native';

import type { AngleAnalysis } from '@/domain/observations/angleAnalysis';
import { getAngleObservationProtocol } from '@/domain/observations/angleProtocols';
import type { AngleObservationTaskId } from '@/domain/observations/angleProtocols';
import { captureQualityLabels, taskStatusLabels } from '@/domain/observations/types';
import type { HistoricalTaskStatus } from '@/domain/observations/types';
import { AppCard } from '@/shared/ui/AppCard';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppText } from '@/shared/ui/AppText';

import { AngleChart } from './AngleChart';
import { SitToStandReportCard } from './SitToStandReportCard';
import { MarchInPlaceReportCard } from './MarchInPlaceReportCard';
import { ShortWalkReportCard } from './ShortWalkReportCard';
import { ObservationFeedbackCard } from './ObservationFeedbackCard';

interface ObservationReportContentProps {
  readonly taskId: AngleObservationTaskId;
  readonly analysis: AngleAnalysis;
  readonly durationMs: number;
  readonly taskStatus: HistoricalTaskStatus | null;
  readonly hasAssistance: boolean;
}

export function ObservationReportContent({
  taskId,
  analysis,
  durationMs,
  taskStatus,
  hasAssistance,
}: ObservationReportContentProps) {
  const protocol = getAngleObservationProtocol(taskId);
  const angle = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}°`);
  return (
    <View className="gap-6">
      <AppCardStack>
        <AppCard className="gap-3">
          <AppText variant="section">{captureQualityLabels[analysis.captureQuality]}</AppText>
          <AppText>任务状态：{taskStatus ? taskStatusLabels[taskStatus] : '待确认'}</AppText>
          <AppText>辅助情况：{hasAssistance ? '人工或器具辅助' : '无辅助'}</AppText>
        </AppCard>
        <ObservationFeedbackCard taskId={taskId} analysis={analysis} taskStatus={taskStatus} />
        <AppCard className="gap-4">
          <AppText variant="section">
            {taskId === 'sit_to_stand' || taskId === 'march_in_place' || taskId === 'short_walk'
              ? '患侧膝夹角变化范围'
              : protocol.measurement === 'image_vertical'
                ? '躯干投影倾角变化范围'
                : '图像平面活动范围'}
          </AppText>
          <AppText className="text-[40px] leading-[48px]">{angle(analysis.rangeOfMotion)}</AppText>
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
                    ? '患侧膝部完整周期'
                    : '识别周期'}
              ：{analysis.repetitions ?? '—'} {taskId === 'march_in_place' ? '步' : '次'}
            </AppText>
            <AppText>采集时长（不含暂停）：{(durationMs / 1_000).toFixed(1)} 秒</AppText>
            <AppText>可用时间占比：{(analysis.coverage * 100).toFixed(0)}%</AppText>
          </View>
          <AngleChart
            angleLabel={protocol.angleLabel}
            series={analysis.series}
            durationMs={durationMs}
          />
        </AppCard>
        {taskId === 'sit_to_stand' && analysis.sitToStand ? (
          <SitToStandReportCard metrics={analysis.sitToStand} />
        ) : null}
        {taskId === 'march_in_place' && analysis.marchInPlace ? (
          <MarchInPlaceReportCard metrics={analysis.marchInPlace} />
        ) : null}
        {taskId === 'short_walk' && analysis.shortWalk ? (
          <ShortWalkReportCard metrics={analysis.shortWalk} />
        ) : null}
      </AppCardStack>
      <AppText className="text-muted" variant="caption">
        {protocol.interpretation}识别周期按{protocol.cycleDescription}计数，不跨暂停或缺失区间。
        工程阈值尚未经临床标定，周期为 0 不代表患者无法完成，结果不代替治疗师评定。
      </AppText>
    </View>
  );
}
