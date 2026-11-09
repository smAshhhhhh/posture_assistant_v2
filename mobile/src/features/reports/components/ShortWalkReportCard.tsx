import type { ShortWalkMetrics } from '@/domain/observations/shortWalkProtocol';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

export function ShortWalkReportCard({ metrics }: { readonly metrics: ShortWalkMetrics }) {
  const seconds = (value: number | null) =>
    value === null ? '—' : `${(value / 1_000).toFixed(2)} 秒`;
  const degrees = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}°`);
  return (
    <AppCard className="gap-3">
      <AppText variant="section">短距离步行观察</AppText>
      <AppText>
        左 / 右完整周期：{metrics.leftCycles ?? '—'} / {metrics.rightCycles ?? '—'} 次
      </AppText>
      <AppText>左侧平均周期耗时：{seconds(metrics.meanLeftCycleDurationMs)}</AppText>
      <AppText>右侧平均周期耗时：{seconds(metrics.meanRightCycleDurationMs)}</AppText>
      <AppText>周期耗时差（左减右）：{seconds(metrics.cycleDurationDifferenceMs)}</AppText>
      <AppText>
        左 / 右膝夹角变化范围：{degrees(metrics.leftKneeRange)} / {degrees(metrics.rightKneeRange)}
      </AppText>
      <AppText>夹角范围差（左减右）：{degrees(metrics.kneeRangeDifference)}</AppText>
      <AppText variant="caption" className="text-muted">
        周期从同侧明显屈膝峰值到下一次屈膝峰值，需后续伸膝确认，并在周期内识别到持续前进。
        这描述膝部投影周期，不等同于触地次数；左右周期分别统计，不能相加当作总步数。
        夹角范围取双腿均可用区间，耗时仅取完整周期；缺少周期时耗时和耗时差保持缺失。
        左右差异不代表病情变化或临床对称性，未标定距离，不提供米制步长与步速。
      </AppText>
    </AppCard>
  );
}
