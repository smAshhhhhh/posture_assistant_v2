export type PoseModelId = 'lite' | 'full' | 'heavy';

export const poseModels = [
  {
    value: 'lite',
    label: 'Lite · 轻量',
    version: 'pose_landmarker_lite/float16/1',
  },
  {
    value: 'full',
    label: 'Full · 标准',
    version: 'pose_landmarker_full/float16/1',
  },
  {
    value: 'heavy',
    label: 'Heavy · 大型',
    version: 'pose_landmarker_heavy/float16/1',
  },
] as const;

export function isPoseModelId(value: unknown): value is PoseModelId {
  return value === 'lite' || value === 'full' || value === 'heavy';
}
