import type { AffectedSide } from '../patients/types';
import { readObject, readString } from '../observations/recordValues';

import type { RehabTaskId } from './taskCatalog';
import { getTaskInstructions } from './taskInstructions';

export interface TaskProtocol {
  readonly protocolId: string;
  readonly protocolVersion: string;
  readonly taskType: RehabTaskId;
  readonly category: 'free_observation';
  readonly startPosition: string;
  readonly movementInstructions: readonly string[];
  readonly cameraRequirements: readonly string[];
  readonly assistanceRules: readonly string[];
  readonly compensationRules: readonly string[];
  readonly interpretation: string;
}

const positions: Record<RehabTaskId, string> = {
  shoulder_flexion: '坐稳，双脚着地，观察侧手臂自然放在体侧。',
  elbow_flexion_extension: '坐稳，双脚着地，观察侧上臂靠近体侧，从舒适的伸肘位置开始。',
  seated_trunk_lean: '坐稳，双脚着地，躯干回正后开始。',
  seated_knee_extension: '坐稳，躯干保持稳定，从舒适的屈膝位置开始。',
  sit_to_stand: '坐在稳固椅面上，双脚固定，先保持稳定坐姿。',
  march_in_place: '在所需保护和辅助下稳定站立至少半秒。',
  short_walk: '在已确认的直线路线起点准备，以所需辅助方式站稳。',
};

const compensations: Record<RehabTaskId, readonly string[]> = {
  shoulder_flexion: ['现场观察是否耸肩、躯干后仰或侧倾；算法尚未检测这些代偿。'],
  elbow_flexion_extension: ['现场观察上臂移动和躯干摆动；算法尚未判断动作规范性。'],
  seated_trunk_lean: ['现场观察是否按要求前倾、是否侧倾或失去坐姿稳定；倾角不能区分方向。'],
  seated_knee_extension: ['现场观察躯干后仰、抬髋和大腿移动；算法尚未检测这些代偿。'],
  sit_to_stand: ['现场记录手臂支撑、扶持和脚位变化；算法不能判断独立承重或椅面接触。'],
  march_in_place: ['现场观察躯干摆动与扶持情况；连续同侧计数不直接表示代偿或异常。'],
  short_walk: ['现场观察躯干侧倾、抬髋等表现；左右二维差异不能直接判断代偿。'],
};

export function getTaskProtocol(taskId: RehabTaskId, side: AffectedSide): TaskProtocol {
  const instructions = getTaskInstructions(taskId, side);
  return {
    protocolId: `${taskId}/free-observation`,
    protocolVersion: '1',
    taskType: taskId,
    category: 'free_observation',
    startPosition: positions[taskId],
    movementInstructions: [instructions.movement],
    cameraRequirements: [
      instructions.framing,
      '固定手机、镜头保持水平；暂停恢复后重新保持起始姿势，再继续动作。',
    ],
    assistanceRules: [
      instructions.support,
      '按实际情况单独记录人工或器具辅助；部分完成也可以有辅助。',
    ],
    compensationRules: compensations[taskId],
    interpretation:
      '自由动作观察，幅度和节奏按个体能力及现场指导确定；不要求达到算法计数阈值。' +
      '本协议不是 FMA、五次坐站或 10 米步行标准测试，不生成临床评分。',
  };
}

function readInstructions(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new Error('动作协议说明不正确');
  }
  return value.map((item: unknown) => readString(item));
}

// 回读当次快照，不用当前指导覆盖历史协议内容。
export function parseTaskProtocol(value: unknown, taskId: RehabTaskId): TaskProtocol {
  const record = readObject(value);
  if (record.taskType !== taskId || record.category !== 'free_observation') {
    throw new Error('动作协议与任务不一致');
  }
  return {
    protocolId: readString(record.protocolId),
    protocolVersion: readString(record.protocolVersion),
    taskType: taskId,
    category: 'free_observation',
    startPosition: readString(record.startPosition),
    movementInstructions: readInstructions(record.movementInstructions),
    cameraRequirements: readInstructions(record.cameraRequirements),
    assistanceRules: readInstructions(record.assistanceRules),
    compensationRules: readInstructions(record.compensationRules),
    interpretation: readString(record.interpretation),
  };
}
