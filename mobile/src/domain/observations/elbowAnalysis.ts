import type { AffectedSide } from '../patients/types';

import { analyzeJoint, getJointAngle } from './angleAnalysis';
import type { PoseFrame, PoseRecording } from './poseRecording';

export function getElbowAngle(frame: PoseFrame, side: AffectedSide) {
  return getJointAngle(frame, side, 'elbow_flexion_extension');
}

export function analyzeElbow(recording: PoseRecording, side: AffectedSide) {
  return analyzeJoint(recording, side, 'elbow_flexion_extension');
}
