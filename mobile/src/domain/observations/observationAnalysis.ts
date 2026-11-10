import { createTaskAnalysis } from './taskAnalysis';
import type { TaskStatus } from './types';
import type { AffectedSide } from '../patients/types';

import { analyzeJoint } from './angleAnalysis';
import type { AngleObservationTaskId } from './angleProtocols';
import type { AnalyzableRecording } from './analysisRecording';
import { analyzeSitToStand } from './sitToStandAnalysis';
import { analyzeMarchInPlace } from './marchInPlaceAnalysis';
import { analyzeShortWalk } from './shortWalkAnalysis';

export function analyzeObservation(
  recording: AnalyzableRecording,
  side: AffectedSide,
  taskId: AngleObservationTaskId,
) {
  if (taskId === 'sit_to_stand') return analyzeSitToStand(recording, side);
  if (taskId === 'march_in_place') return analyzeMarchInPlace(recording, side);
  if (taskId === 'short_walk') return analyzeShortWalk(recording, side);
  return analyzeJoint(recording, side, taskId);
}

export function analyzeTask(
  recording: AnalyzableRecording,
  side: AffectedSide,
  taskId: AngleObservationTaskId,
  taskStatus: TaskStatus | null = null,
) {
  return createTaskAnalysis(
    recording.id,
    recording.durationMs,
    taskId,
    taskStatus,
    analyzeObservation(recording, side, taskId),
  );
}
