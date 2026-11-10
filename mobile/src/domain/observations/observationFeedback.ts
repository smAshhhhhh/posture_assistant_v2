import type { AngleAnalysis } from './angleAnalysis';
import type { AngleObservationTaskId } from './angleProtocols';
import type { HistoricalTaskStatus } from './types';

export interface ObservationFeedback {
  readonly code: string;
  readonly category: 'completion' | 'capture' | 'movement' | 'stepping' | 'walking';
  readonly severity: 'info' | 'warning' | 'danger';
  readonly message: string;
}

export function getObservationFeedback(
  taskId: AngleObservationTaskId,
  analysis: AngleAnalysis,
  taskStatus: HistoricalTaskStatus | null,
): readonly ObservationFeedback[] {
  const feedback: ObservationFeedback[] = [];
  if (taskStatus === 'stopped_safety') {
    feedback.push({
      code: 'stopped_safety',
      category: 'completion',
      severity: 'danger',
      message: '请结合现场情况和停止原因复核，不为补齐计数继续动作。',
    });
  }
  if (analysis.captureQuality === 'invalid_capture') {
    feedback.push({
      code: 'invalid_capture',
      category: 'capture',
      severity: 'danger',
      message: '请核对原始视频、机位和开始姿势；缺失指标不能解释为零，也不代表患者无法完成。',
    });
    return feedback;
  }
  if (analysis.captureQuality === 'degraded') {
    feedback.push({
      code: 'degraded',
      category: 'capture',
      severity: 'warning',
      message: '部分时间未获得连续可用数据；周期不会跨越暂停或缺失区间，请结合视频复核是否漏计。',
    });
  }
  if (analysis.repetitions === 0) {
    feedback.push({
      code: 'no_complete_cycle',
      category: 'movement',
      severity: 'warning',
      message:
        (taskId === 'short_walk' ? '未识别到患侧完整膝部周期。' : '未识别到完整动作周期。') +
        '请回看起止姿势与连续入镜情况；' +
        '零次不代表患者无法完成，不应为了增加计数勉强动作。',
    });
  }
  const march = analysis.marchInPlace;
  if (
    taskId === 'march_in_place' &&
    march?.alternationErrors != null &&
    march.alternationErrors > 0
  ) {
    feedback.push({
      code: 'same_side_steps',
      category: 'stepping',
      severity: 'warning',
      message: '请结合回放核对抬脚、放回和遮挡情况；连续同侧的识别结果不直接判定动作异常。',
    });
  }
  const walk = analysis.shortWalk;
  if (
    taskId === 'short_walk' &&
    walk &&
    ((walk.leftCycles === 0 && walk.rightCycles !== null && walk.rightCycles > 0) ||
      (walk.rightCycles === 0 && walk.leftCycles !== null && walk.leftCycles > 0))
  ) {
    feedback.push({
      code: 'one_side_cycles',
      category: 'walking',
      severity: 'warning',
      message: '请回看双腿是否全程清晰入镜、路线是否平行画面，排查另一侧是否漏检。',
    });
  }
  if (feedback.length === 0) {
    feedback.push({
      code: 'review_video',
      category: 'movement',
      severity: 'info',
      message:
        '请结合原始视频与现场观察复核；测量结果不能用于判断动作是否正确、安全或临床完成情况。',
    });
  }
  return feedback;
}
