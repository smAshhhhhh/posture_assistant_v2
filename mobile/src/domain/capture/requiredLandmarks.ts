import type { AffectedSide } from '../patients/types';
import type { RehabTaskId } from '../tasks/taskCatalog';

// 索引采用 MediaPipe Pose 的 33 点顺序，患侧始终以患者自身为准。
export function getRequiredLandmarks(taskId: RehabTaskId, side: AffectedSide): readonly number[] {
  const shoulder = side === 'left' ? 11 : 12;
  const elbow = side === 'left' ? 13 : 14;
  const wrist = side === 'left' ? 15 : 16;
  const hip = side === 'left' ? 23 : 24;
  const knee = side === 'left' ? 25 : 26;
  const ankle = side === 'left' ? 27 : 28;

  switch (taskId) {
    case 'shoulder_flexion':
      return [hip, shoulder, elbow, wrist];
    case 'elbow_flexion_extension':
      return [shoulder, elbow, wrist];
    case 'seated_trunk_lean':
      return [shoulder, hip, knee];
    case 'seated_knee_extension':
      return [hip, knee, ankle];
    case 'sit_to_stand':
    case 'march_in_place':
    case 'short_walk':
      return [11, 12, 23, 24, 25, 26, 27, 28];
  }
}
