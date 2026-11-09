import type { AffectedSide } from '../patients/types';
import { isValidPastDate } from '../patients/patientRecord';
import type { RehabTaskId } from '../tasks/taskCatalog';

import type { ObservationReport } from './observationReport';
import type { CaptureQuality, ObservationSummary, TaskStatus } from './types';

export interface HistoryFilter {
  readonly patientId: string | null;
  readonly taskId: RehabTaskId | null;
  readonly quality: CaptureQuality | null;
  readonly status: TaskStatus | null;
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
  const difference = (before: number | null, after: number | null) =>
    before === null || after === null ? null : after - before;
  const isTrunk = earlier.taskId === 'seated_trunk_lean';
  return {
    issues,
    earlier,
    later,
    metrics: [
      {
        label: isTrunk
          ? '躯干倾角变化范围'
          : ['sit_to_stand', 'march_in_place', 'short_walk'].includes(earlier.taskId)
            ? '患侧膝夹角变化范围'
            : '活动范围',
        unit: '°',
        before: earlier.analysis.rangeOfMotion,
        after: later.analysis.rangeOfMotion,
      },
      {
        label: isTrunk ? '最小倾角' : '最小夹角',
        unit: '°',
        before: earlier.analysis.minAngle,
        after: later.analysis.minAngle,
      },
      {
        label: isTrunk ? '最大倾角' : '最大夹角',
        unit: '°',
        before: earlier.analysis.maxAngle,
        after: later.analysis.maxAngle,
      },
      {
        label:
          earlier.taskId === 'sit_to_stand'
            ? '完整坐站往返'
            : earlier.taskId === 'march_in_place'
              ? '完整踏步'
              : earlier.taskId === 'short_walk'
                ? '患侧膝部完整周期'
                : '识别周期',
        unit: earlier.taskId === 'march_in_place' ? '步' : '次',
        before: earlier.repetitions,
        after: later.repetitions,
      },
      {
        label: '采集时长（不含暂停）',
        unit: '秒',
        before: earlier.durationMs / 1_000,
        after: later.durationMs / 1_000,
      },
      ...(earlier.taskId === 'sit_to_stand'
        ? (['meanRiseDurationMs', 'meanDescentDurationMs'] as const).map((key) => ({
            label: key === 'meanRiseDurationMs' ? '平均起身耗时' : '平均坐回耗时',
            unit: '秒',
            before:
              earlier.analysis.sitToStand?.[key] == null
                ? null
                : earlier.analysis.sitToStand[key] / 1_000,
            after:
              later.analysis.sitToStand?.[key] == null
                ? null
                : later.analysis.sitToStand[key] / 1_000,
          }))
        : []),
      ...(earlier.taskId === 'march_in_place'
        ? (
            [
              'leftSteps',
              'rightSteps',
              'alternationErrors',
              'meanStepDurationMs',
              'cadencePerMinute',
            ] as const
          ).map((key) => {
            const descriptions = {
              leftSteps: ['左脚', '步'],
              rightSteps: ['右脚', '步'],
              alternationErrors: ['连续同侧', '次'],
              meanStepDurationMs: ['平均单步耗时', '秒'],
              cadencePerMinute: ['全程平均步频', '步/分'],
            };
            const before = earlier.analysis.marchInPlace?.[key] ?? null;
            const after = later.analysis.marchInPlace?.[key] ?? null;
            const divisor = key === 'meanStepDurationMs' ? 1_000 : 1;
            return {
              label: descriptions[key][0],
              unit: descriptions[key][1],
              before: before === null ? null : before / divisor,
              after: after === null ? null : after / divisor,
            };
          })
        : []),
      ...(earlier.taskId === 'short_walk'
        ? (
            [
              'leftCycles',
              'rightCycles',
              'meanLeftCycleDurationMs',
              'meanRightCycleDurationMs',
              'leftKneeRange',
              'rightKneeRange',
              'kneeRangeDifference',
              'cycleDurationDifferenceMs',
            ] as const
          ).map((key) => {
            const descriptions = {
              leftCycles: ['左侧完整周期', '次'],
              rightCycles: ['右侧完整周期', '次'],
              meanLeftCycleDurationMs: ['左侧平均周期耗时', '秒'],
              meanRightCycleDurationMs: ['右侧平均周期耗时', '秒'],
              leftKneeRange: ['左膝夹角变化范围', '°'],
              rightKneeRange: ['右膝夹角变化范围', '°'],
              kneeRangeDifference: ['夹角范围差（左减右）', '°'],
              cycleDurationDifferenceMs: ['周期耗时差（左减右）', '秒'],
            };
            const divisor = key.endsWith('Ms') ? 1_000 : 1;
            const before = earlier.analysis.shortWalk?.[key] ?? null;
            const after = later.analysis.shortWalk?.[key] ?? null;
            return {
              label: descriptions[key][0],
              unit: descriptions[key][1],
              before: before === null ? null : before / divisor,
              after: after === null ? null : after / divisor,
            };
          })
        : []),
    ].map((metric) => ({ ...metric, change: difference(metric.before, metric.after) })),
  };
}
