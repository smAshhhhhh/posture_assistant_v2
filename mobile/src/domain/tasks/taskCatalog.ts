export type RehabTaskId =
  | 'shoulder_flexion'
  | 'elbow_flexion_extension'
  | 'seated_trunk_lean'
  | 'seated_knee_extension'
  | 'sit_to_stand'
  | 'march_in_place'
  | 'short_walk';

export interface RehabTask {
  readonly id: RehabTaskId;
  readonly name: string;
  readonly bodyRegion: string;
  readonly posture: string;
  readonly cameraView: string;
  readonly estimatedDuration: string;
  readonly requiresSafetyConfirmation: boolean;
}

export const defaultRehabTask: RehabTask = {
  id: 'elbow_flexion_extension',
  name: '肘关节屈伸',
  bodyRegion: '上肢',
  posture: '坐姿',
  cameraView: '侧面机位',
  estimatedDuration: '约 1 分钟',
  requiresSafetyConfirmation: false,
};

export const rehabTasks: readonly RehabTask[] = [
  {
    id: 'shoulder_flexion',
    name: '肩关节前举',
    bodyRegion: '上肢',
    posture: '坐姿',
    cameraView: '侧面机位',
    estimatedDuration: '按任务说明',
    requiresSafetyConfirmation: false,
  },
  defaultRehabTask,
  {
    id: 'seated_trunk_lean',
    name: '坐姿前倾与回正',
    bodyRegion: '躯干',
    posture: '坐姿',
    cameraView: '侧面机位',
    estimatedDuration: '按任务说明',
    requiresSafetyConfirmation: false,
  },
  {
    id: 'seated_knee_extension',
    name: '坐姿膝关节伸展',
    bodyRegion: '下肢',
    posture: '坐姿',
    cameraView: '侧面机位',
    estimatedDuration: '按任务说明',
    requiresSafetyConfirmation: false,
  },
  {
    id: 'sit_to_stand',
    name: '坐站转换',
    bodyRegion: '全身',
    posture: '坐姿 / 站立',
    cameraView: '按任务说明',
    estimatedDuration: '按任务说明',
    requiresSafetyConfirmation: true,
  },
  {
    id: 'march_in_place',
    name: '原地踏步',
    bodyRegion: '下肢',
    posture: '站立',
    cameraView: '按任务说明',
    estimatedDuration: '按任务说明',
    requiresSafetyConfirmation: true,
  },
  {
    id: 'short_walk',
    name: '短距离步行观察',
    bodyRegion: '全身',
    posture: '步行',
    cameraView: '按任务说明',
    estimatedDuration: '按任务说明',
    requiresSafetyConfirmation: true,
  },
];
