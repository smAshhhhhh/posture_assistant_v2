import { getAngleObservationProtocol } from './angleProtocols';
import { getAngleAnalysis } from './taskAnalysis';
import type { TaskAnalysis } from './taskAnalysis';

export type MetricUnit = 'degree' | 'millisecond' | 'count' | 'step' | 'step_per_minute';

export interface MetricDefinition {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly unit: MetricUnit;
  readonly measurementPlane: '2d_image' | 'temporal' | 'count';
  readonly definition: string;
  readonly version: 1;
}

export interface MetricValue {
  readonly definitionId: string;
  readonly value: number | null;
  readonly availability: 'available' | 'unavailable';
  readonly unavailableReason: 'invalid_capture' | 'no_complete_cycle' | 'not_measured' | null;
}

interface DefinedMetric {
  readonly definition: MetricDefinition;
  readonly metric: MetricValue;
}

export function extractMotionMetrics(analysis: TaskAnalysis): readonly DefinedMetric[] {
  const taskId = analysis.taskId;
  const angle = getAngleAnalysis(analysis);
  const protocol = getAngleObservationProtocol(taskId);
  const output: DefinedMetric[] = [];
  const add = (
    key: string,
    label: string,
    unit: MetricUnit,
    value: number | null,
    definition: string,
    isCaptureMetric = false,
  ) => {
    const id = `${taskId}/${key}/v1`;
    output.push({
      definition: {
        id,
        key,
        label,
        unit,
        definition,
        version: 1,
        measurementPlane:
          unit === 'degree'
            ? '2d_image'
            : unit === 'count' || unit === 'step'
              ? 'count'
              : 'temporal',
      },
      metric: {
        definitionId: id,
        value,
        availability: value === null ? 'unavailable' : 'available',
        unavailableReason:
          value !== null
            ? null
            : !isCaptureMetric && angle.captureQuality === 'invalid_capture'
              ? 'invalid_capture'
              : angle.repetitions === 0
                ? 'no_complete_cycle'
                : 'not_measured',
      },
    });
  };
  const isTrunk = taskId === 'seated_trunk_lean';
  const isLegTask =
    taskId === 'sit_to_stand' || taskId === 'march_in_place' || taskId === 'short_walk';
  add(
    'angle_range',
    isTrunk ? '躯干倾角变化范围' : isLegTask ? '患侧膝夹角变化范围' : '活动范围',
    'degree',
    angle.rangeOfMotion,
    `有效投影角度最大值减最小值。${protocol.interpretation}`,
  );
  add(
    'minimum_angle',
    isTrunk ? '最小倾角' : '最小夹角',
    'degree',
    angle.minAngle,
    protocol.interpretation,
  );
  add(
    'maximum_angle',
    isTrunk ? '最大倾角' : '最大夹角',
    'degree',
    angle.maxAngle,
    protocol.interpretation,
  );
  add(
    'repetitions',
    taskId === 'sit_to_stand'
      ? '完整坐站往返'
      : taskId === 'march_in_place'
        ? '完整踏步'
        : taskId === 'short_walk'
          ? '患侧膝部完整周期'
          : '识别周期',
    taskId === 'march_in_place' ? 'step' : 'count',
    analysis.commonMetrics.repetitions,
    `仅统计完整周期：${protocol.cycleDescription}。`,
  );
  add(
    'active_duration',
    '采集时长（不含暂停）',
    'millisecond',
    analysis.commonMetrics.durationMs,
    '各采集片段有效时长之和，不包含暂停间隔。',
    true,
  );
  if (analysis.taskId === 'sit_to_stand') {
    const metrics = analysis.taskResult.metrics;
    add(
      'mean_rise_duration',
      '平均起身耗时',
      'millisecond',
      metrics.meanRiseDurationMs,
      '完整坐站往返中，从起身开始到进入站立稳定窗口的平均耗时。',
    );
    add(
      'mean_descent_duration',
      '平均坐回耗时',
      'millisecond',
      metrics.meanDescentDurationMs,
      '完整坐站往返中，从坐回开始到进入坐姿稳定窗口的平均耗时。',
    );
  }
  if (analysis.taskId === 'march_in_place') {
    const metrics = analysis.taskResult.metrics;
    add('left_steps', '左脚', 'step', metrics.leftSteps, '左脚抬起并放回初始高度的完整次数。');
    add('right_steps', '右脚', 'step', metrics.rightSteps, '右脚抬起并放回初始高度的完整次数。');
    add(
      'alternation_errors',
      '连续同侧',
      'count',
      metrics.alternationErrors,
      '连续可用区间内，相邻两次完整踏步来自同一侧的次数。',
    );
    add(
      'mean_step_duration',
      '平均单步耗时',
      'millisecond',
      metrics.meanStepDurationMs,
      '全部完整踏步从抬起到放回的平均耗时。',
    );
    add(
      'cadence',
      '全程平均步频',
      'step_per_minute',
      metrics.cadencePerMinute,
      '完整踏步总数除以有效采集时长，包含片段内准备与停顿。',
    );
  }
  if (analysis.taskId === 'short_walk') {
    const metrics = analysis.taskResult.metrics;
    add(
      'left_cycles',
      '左侧完整周期',
      'count',
      metrics.leftCycles,
      '左侧满足前进位移条件的完整膝部投影周期数。',
    );
    add(
      'right_cycles',
      '右侧完整周期',
      'count',
      metrics.rightCycles,
      '右侧满足前进位移条件的完整膝部投影周期数。',
    );
    add(
      'mean_left_cycle_duration',
      '左侧平均周期耗时',
      'millisecond',
      metrics.meanLeftCycleDurationMs,
      '左侧完整膝部投影周期的平均耗时。',
    );
    add(
      'mean_right_cycle_duration',
      '右侧平均周期耗时',
      'millisecond',
      metrics.meanRightCycleDurationMs,
      '右侧完整膝部投影周期的平均耗时。',
    );
    add(
      'left_knee_range',
      '左膝夹角变化范围',
      'degree',
      metrics.leftKneeRange,
      '左膝二维投影夹角最大值减最小值。',
    );
    add(
      'right_knee_range',
      '右膝夹角变化范围',
      'degree',
      metrics.rightKneeRange,
      '右膝二维投影夹角最大值减最小值。',
    );
    add(
      'knee_range_difference',
      '夹角范围差（左减右）',
      'degree',
      metrics.kneeRangeDifference,
      '左膝投影夹角范围减右膝投影夹角范围，保留方向。',
    );
    add(
      'cycle_duration_difference',
      '周期耗时差（左减右）',
      'millisecond',
      metrics.cycleDurationDifferenceMs,
      '左侧平均周期耗时减右侧平均周期耗时；任一侧没有完整周期时不可用。',
    );
  }
  return output;
}

export const metricDisplayUnits: Record<MetricUnit, string> = {
  degree: '°',
  millisecond: '秒',
  count: '次',
  step: '步',
  step_per_minute: '步/分',
};
