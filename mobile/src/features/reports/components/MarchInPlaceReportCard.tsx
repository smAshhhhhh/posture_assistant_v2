import type { MarchInPlaceMetrics } from '@/domain/observations/marchInPlaceProtocol';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

export function MarchInPlaceReportCard({ metrics }: { readonly metrics: MarchInPlaceMetrics }) {
  return (
    <AppCard className="gap-3">
      <AppText variant="section">原地踏步</AppText>
      <AppText>
        左脚 / 右脚：{metrics.leftSteps ?? '—'} / {metrics.rightSteps ?? '—'} 步
      </AppText>
      <AppText>连续同侧：{metrics.alternationErrors ?? '—'} 次</AppText>
      <AppText>
        平均单步耗时：
        {metrics.meanStepDurationMs === null
          ? '—'
          : `${(metrics.meanStepDurationMs / 1_000).toFixed(2)} 秒`}
      </AppText>
      <AppText>
        全程平均步频：
        {metrics.cadencePerMinute === null ? '—' : `${metrics.cadencePerMinute.toFixed(1)} 步/分`}
      </AppText>
      <AppText variant="caption" className="text-muted">
        每次抬脚并回到初始高度计一步；连续同侧仍计步，并单独记录次数。暂停、遮挡或机位变化会断开交替判断。
        单步耗时从明显抬脚到放回，步频按总步数除以不含暂停的采集时长计算，包含站立准备和停顿。
        未识别到完整步时不展示耗时和步频，计数为 0 不代表患者无法完成。
      </AppText>
    </AppCard>
  );
}
