import type { SitToStandMetrics } from '@/domain/observations/sitToStandProtocol';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

interface SitToStandReportCardProps {
  readonly metrics: SitToStandMetrics;
}

export function SitToStandReportCard({ metrics }: SitToStandReportCardProps) {
  const seconds = (value: number | null) =>
    value === null ? '—' : `${(value / 1_000).toFixed(1)} 秒`;
  return (
    <AppCard className="gap-3">
      <AppText variant="section">坐站过程</AppText>
      <AppText>平均起身耗时：{seconds(metrics.meanRiseDurationMs)}</AppText>
      <AppText>平均坐回耗时：{seconds(metrics.meanDescentDurationMs)}</AppText>
      <AppText className="text-muted" variant="caption">
        仅统计连续识别到的坐姿→起身→站立→坐回完整往返。耗时从明显运动开始到目标姿态出现，
        不含站立停留和稳定确认时间；未识别到完整往返时不展示耗时，不代表患者无法完成。
      </AppText>
    </AppCard>
  );
}
