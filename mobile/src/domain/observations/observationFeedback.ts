import type { AngleAnalysis } from './angleAnalysis';
import { getAngleObservationProtocol } from './angleProtocols';
import type { AngleObservationTaskId } from './angleProtocols';
import type { HistoricalTaskStatus } from './types';

interface ObservationFeedback {
  readonly code: string;
  readonly title: string;
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
      title: '本次因安全原因停止',
      message: '请结合现场情况和停止原因复核，不为补齐计数继续动作。',
    });
  }
  if (analysis.captureQuality === 'invalid_capture') {
    feedback.push({
      code: 'invalid_capture',
      title: '本次数据不足以生成运动指标',
      message:
        '本次采集未满足本任务的数据要求，请核对原始视频、机位和开始姿势。缺失指标不能解释为零，也不代表患者无法完成。',
    });
    return feedback;
  }
  if (analysis.captureQuality === 'degraded') {
    feedback.push({
      code: 'degraded',
      title: '部分时间未获得连续可用数据',
      message:
        `可用时间占比 ${(analysis.coverage * 100).toFixed(0)}%，` +
        `最长数据间断 ${(analysis.longestGapMs / 1_000).toFixed(2)} 秒。` +
        '周期不会跨越暂停或缺失区间，建议结合视频复核漏计情况。',
    });
  }
  if (analysis.repetitions === 0) {
    const protocol = getAngleObservationProtocol(taskId);
    feedback.push({
      code: 'no_complete_cycle',
      title: taskId === 'short_walk' ? '未识别到患侧完整膝部周期' : '未识别到完整动作周期',
      message:
        `当前按“${protocol.cycleDescription}”计数。请回看起止姿势与连续入镜情况，` +
        '零次不代表患者无法完成，也不应为了增加计数勉强动作。',
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
      title: '识别序列中有连续同侧踏步',
      message:
        `在连续可用区间内记录到 ${march.alternationErrors} 次连续同侧。` +
        '请结合回放核对抬脚、放回和遮挡情况，此计数不直接判定动作异常。',
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
      title: '仅一侧识别到完整膝部周期',
      message:
        '请回看双腿是否全程清晰入镜、路线是否平行画面。缺少周期的一侧不提供平均耗时，不能据此判断该侧功能或左右对称性。',
    });
  }
  if (feedback.length === 0) {
    feedback.push({
      code: 'review_video',
      title: '结合原始视频与现场观察复核',
      message:
        '关键关节在大部分采集时间内可用。角度与周期只描述二维投影，不能据此判断动作正确、安全或临床完成情况。',
    });
  }
  return feedback;
}
