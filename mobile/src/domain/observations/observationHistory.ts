import { extractMotionMetrics, metricDisplayUnits } from './motionMetrics';
import type { AffectedSide } from '../patients/types';
import { isValidPastDate } from '../patients/patientRecord';
import type { RehabTaskId } from '../tasks/taskCatalog';

import type { ObservationReport } from './observationReport';
import type { CaptureQuality, ObservationSummary, HistoricalTaskStatus } from './types';

export interface HistoryFilter {
  readonly patientId: string | null;
  readonly taskId: RehabTaskId | null;
  readonly quality: CaptureQuality | null;
  readonly status: HistoricalTaskStatus | null;
  readonly side: AffectedSide | null;
  readonly from: string;
  readonly through: string;
}

export function validateHistoryDates(from: string, through: string): string | null {
  if ([from, through].some((value) => value && !isValidPastDate(value, '9999-12-31'))) {
    return '请填写有效日期，格式为 YYYY-MM-DD。';
  }
  return from && through && from > through ? '开始日期不能晚于结束日期。' : null;
}

export function filterObservationHistory(
  observations: readonly ObservationSummary[],
  filter: HistoryFilter,
): readonly ObservationSummary[] {
  if (validateHistoryDates(filter.from, filter.through)) return [];
  return (
    observations
      .filter((item) => {
        // 日期筛选按手机本地日历，结束日期包含当天全部时间。
        const date = new Date(item.observedAt);
        const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
          date.getDate(),
        ).padStart(2, '0')}`;
        return (
          (!filter.patientId || item.patientId === filter.patientId) &&
          (!filter.taskId || item.taskId === filter.taskId) &&
          (!filter.quality || item.captureQuality === filter.quality) &&
          (!filter.status || item.taskStatus === filter.status) &&
          (!filter.side || item.affectedSide === filter.side) &&
          (!filter.from || day >= filter.from) &&
          (!filter.through || day <= filter.through)
        );
      })
      // filter 已生成新数组；sort 兼容手机引擎且不改变仓储中的记录顺序。
      .sort(
        (a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) || a.id.localeCompare(b.id),
      )
  );
}

export function getComparisonIssues(
  first: ObservationReport,
  second: ObservationReport,
): readonly string[] {
  const issues: string[] = [];
  if (first.id === second.id) issues.push('请选择两条不同的记录。');
  if (first.patientId !== second.patientId) issues.push('患者不同。');
  if (first.taskId !== second.taskId) issues.push('观察任务不同。');
  if (first.affectedSide !== second.affectedSide) issues.push('患侧不同。');
  if (first.cameraView !== second.cameraView) issues.push('拍摄机位不同。');
  if (first.assistance !== second.assistance) issues.push('辅助方式不同。');
  if (first.protocolVersion !== second.protocolVersion) issues.push('采集协议版本不同。');
  if (first.analysisVersion !== second.analysisVersion) issues.push('分析算法版本不同。');
  if (first.modelVersion !== second.modelVersion) issues.push('姿态模型版本不同。');
  const firstContext = first.measurementContext;
  const secondContext = second.measurementContext;
  if (Boolean(firstContext) !== Boolean(secondContext)) {
    issues.push('旧记录缺少动作协议和指标定义快照，不能确认测量条件一致。');
  } else if (firstContext && secondContext) {
    const firstProtocol = firstContext.taskProtocol;
    const secondProtocol = secondContext.taskProtocol;
    if (
      firstProtocol.protocolId !== secondProtocol.protocolId ||
      firstProtocol.protocolVersion !== secondProtocol.protocolVersion
    ) {
      issues.push('动作指导协议版本不同。');
    } else if (JSON.stringify(firstProtocol) !== JSON.stringify(secondProtocol)) {
      issues.push('动作指导内容不同。');
    }
    if (
      firstContext.metricDefinitionVersion !== secondContext.metricDefinitionVersion ||
      JSON.stringify(firstContext.metricDefinitions) !==
        JSON.stringify(secondContext.metricDefinitions)
    ) {
      issues.push('指标定义版本或内容不同。');
    }
  }
  if (first.captureQuality !== 'valid' || second.captureQuality !== 'valid') {
    issues.push('仅采集有效的记录参与直接对比。');
  }
  if (first.taskStatus === 'stopped_safety' || second.taskStatus === 'stopped_safety') {
    issues.push('安全停止的记录仅供回看，不参与直接对比。');
  }
  return issues;
}

export function getObservationChanges(first: ObservationReport, second: ObservationReport) {
  const issues = getComparisonIssues(first, second);
  if (issues.length > 0) return { issues, metrics: [] };
  const [earlier, later] =
    Date.parse(first.observedAt) <= Date.parse(second.observedAt)
      ? [first, second]
      : [second, first];
  const earlierMetrics = extractMotionMetrics(earlier.taskAnalysis);
  const laterMetrics = extractMotionMetrics(later.taskAnalysis);
  return {
    issues,
    earlier,
    later,
    metrics: earlierMetrics.map(({ definition, metric }) => {
      const laterMetric = laterMetrics.find((item) => item.definition.id === definition.id)?.metric;
      const divisor = definition.unit === 'millisecond' ? 1_000 : 1;
      const before = metric.value === null ? null : metric.value / divisor;
      const after = laterMetric?.value == null ? null : laterMetric.value / divisor;
      return {
        label: definition.label,
        unit: metricDisplayUnits[definition.unit],
        before,
        after,
        change: before === null || after === null ? null : after - before,
      };
    }),
  };
}
