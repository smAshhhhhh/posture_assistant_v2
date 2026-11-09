import type { RehabTaskId } from '../tasks/taskCatalog';

export type AngleObservationTaskId =
  | 'shoulder_flexion'
  | 'elbow_flexion_extension'
  | 'seated_trunk_lean'
  | 'seated_knee_extension'
  | 'sit_to_stand'
  | 'march_in_place'
  | 'short_walk';

export interface AngleObservationProtocol {
  readonly taskId: AngleObservationTaskId;
  readonly version: string;
  readonly analysisVersion: string;
  readonly angleLabel: string;
  readonly measurement: 'joint' | 'image_vertical';
  readonly interpretation: string;
  readonly cycleDescription: string;
  readonly leftIndices: readonly [number, number, number];
  readonly cycleStart: 'low' | 'high';
  readonly startAngle: number;
  readonly targetAngle: number;
}

// 阈值用于工程周期识别，尚未经临床标定，不决定任务是否完成。
export const angleAnalysisSettings = {
  confidence: 0.5,
  maxGapMs: 250,
  smoothingTimeMs: 100,
  minimumDurationMs: 2_000,
  minimumSamples: 15,
} as const;

const protocols: Record<AngleObservationTaskId, AngleObservationProtocol> = {
  shoulder_flexion: {
    taskId: 'shoulder_flexion',
    version: 'shoulder-side-v1',
    analysisVersion: 'shoulder-2d-v1',
    angleLabel: '肩部投影夹角',
    measurement: 'joint',
    interpretation:
      '角度为图像平面髋—肩—肘夹角，手臂自然下垂时接近 0°。它描述上臂相对躯干的投影，不能区分前举与后伸，也不自动判断代偿。',
    cycleDescription: '下垂→抬臂→放回',
    leftIndices: [23, 11, 13],
    cycleStart: 'low',
    startAngle: 30,
    targetAngle: 70,
  },
  elbow_flexion_extension: {
    taskId: 'elbow_flexion_extension',
    version: 'elbow-side-v1',
    analysisVersion: 'elbow-2d-v1',
    angleLabel: '肘关节夹角',
    measurement: 'joint',
    interpretation: '角度为图像平面投影的肩—肘—腕夹角，伸直时接近 180°。',
    cycleDescription: '伸展→屈曲→伸展',
    leftIndices: [11, 13, 15],
    cycleStart: 'high',
    startAngle: 140,
    targetAngle: 100,
  },
  seated_trunk_lean: {
    taskId: 'seated_trunk_lean',
    version: 'trunk-seated-side-v1',
    analysisVersion: 'trunk-inclination-2d-v1',
    angleLabel: '躯干投影倾角',
    measurement: 'image_vertical',
    interpretation:
      '角度为图像平面髋→肩连线与画面向上竖直方向的夹角，坐直时接近 0°。需保持手机竖直、镜头水平；未校正镜头倾斜，不能区分前倾与后仰，也不自动判断坐姿稳定性。',
    cycleDescription: '坐直→倾斜→回正',
    leftIndices: [11, 23, 25],
    cycleStart: 'low',
    startAngle: 10,
    targetAngle: 25,
  },
  seated_knee_extension: {
    taskId: 'seated_knee_extension',
    version: 'knee-seated-side-v1',
    analysisVersion: 'knee-2d-v1',
    angleLabel: '膝关节夹角',
    measurement: 'joint',
    interpretation: '角度为图像平面投影的髋—膝—踝夹角，伸直时接近 180°。',
    cycleDescription: '屈膝→伸膝→放回',
    leftIndices: [23, 25, 27],
    cycleStart: 'low',
    startAngle: 110,
    targetAngle: 150,
  },
  sit_to_stand: {
    taskId: 'sit_to_stand',
    version: 'sit-stand-side-v1',
    analysisVersion: 'sit-stand-2d-v1',
    angleLabel: '患侧膝关节投影夹角',
    measurement: 'joint',
    interpretation:
      '结合患侧膝夹角和髋部相对踝部的抬升识别坐站往返。须固定侧面机位，从稳定坐姿开始，双脚留在原位；不能判断是否真正接触椅面、承重能力或独立站稳，完成情况由现场确认。',
    cycleDescription: '坐姿→起身→站立→坐回',
    leftIndices: [23, 25, 27],
    cycleStart: 'low',
    startAngle: 110,
    targetAngle: 155,
  },
  march_in_place: {
    taskId: 'march_in_place',
    version: 'march-standing-side-v1',
    analysisVersion: 'march-alternation-2d-v1',
    angleLabel: '患侧膝关节投影夹角',
    measurement: 'joint',
    interpretation:
      '结合双侧踝部相对初始站立位置的抬升识别每一步，并记录交替情况。先稳定站立至少半秒，全身和双腿清晰入镜，侧面机位水平固定；结果不能判断真实着地、步幅、承重或步态安全，也不替代治疗师观察。',
    cycleDescription: '单脚抬起→回到初始高度',
    leftIndices: [23, 25, 27],
    cycleStart: 'low',
    startAngle: 110,
    targetAngle: 155,
  },
  short_walk: {
    taskId: 'short_walk',
    version: 'walk-straight-side-v1',
    analysisVersion: 'walk-knee-cycle-2d-v1',
    angleLabel: '患侧膝关节投影夹角',
    measurement: 'joint',
    interpretation:
      '以连续两次同侧明显屈膝峰值及中间伸膝识别投影周期，周期内须有连续前进位移。侧面机位水平固定，沿平行画面的直线路线行走，全程双腿清晰入镜，不跟拍、不转弯。结果不能证明足部触地、承重或步态安全，未标定距离，不提供米制步长和步速。',
    cycleDescription: '同侧屈膝峰值→伸膝→下一次屈膝峰值（后续伸膝确认）',
    leftIndices: [23, 25, 27],
    cycleStart: 'high',
    startAngle: 155,
    targetAngle: 135,
  },
};

export function isAngleObservationTask(taskId: RehabTaskId): taskId is AngleObservationTaskId {
  return (
    taskId === 'shoulder_flexion' ||
    taskId === 'elbow_flexion_extension' ||
    taskId === 'seated_trunk_lean' ||
    taskId === 'seated_knee_extension' ||
    taskId === 'sit_to_stand' ||
    taskId === 'march_in_place' ||
    taskId === 'short_walk'
  );
}

export function getAngleObservationProtocol(taskId: AngleObservationTaskId) {
  return protocols[taskId];
}
