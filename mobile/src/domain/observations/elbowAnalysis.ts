import type { AffectedSide } from '../patients/types';

import { analyzeJoint, getJointAngle } from './angleAnalysis';
import type { AnalysisFrame, AnalyzableRecording } from './analysisRecording';

export function getElbowAngle(frame: AnalysisFrame, side: AffectedSide) {
  return getJointAngle(frame, side, 'elbow_flexion_extension');
}

export function analyzeElbow(recording: AnalyzableRecording, side: AffectedSide) {
  return analyzeJoint(recording, side, 'elbow_flexion_extension');
}
