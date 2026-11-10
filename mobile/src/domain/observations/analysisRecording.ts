import type { PoseRecording, PoseLandmark } from './poseRecording';
import type { PoseRecording as LegacyPoseRecording } from './legacyPoseRecording';

export type AnalysisLandmark = Omit<PoseLandmark, 'z'>;

// 分析视图不写回原始采集；旧帧的入镜标记只用于兼容旧数据。
export interface AnalysisFrame {
  readonly timestampMs: number;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly isInPreview: boolean;
  readonly segmentIndex?: number;
  readonly landmarks: readonly AnalysisLandmark[];
}

export type AnalyzableRecording = PoseRecording | LegacyPoseRecording;

export function getAnalysisFrames(recording: AnalyzableRecording): readonly AnalysisFrame[] {
  if ('frames' in recording) return recording.frames;
  let activeOffsetMs = 0;
  return recording.segments.flatMap((segment) => {
    const offset = activeOffsetMs;
    activeOffsetMs += segment.durationMs;
    return segment.frames.map((frame): AnalysisFrame => ({
      ...frame,
      timestampMs: offset + frame.timestampMs,
      imageWidth: segment.imageDimensions?.width ?? 1,
      imageHeight: segment.imageDimensions?.height ?? 1,
      isInPreview: true,
      segmentIndex: segment.segmentIndex,
    }));
  });
}

export function isSameCaptureSegment(
  first: AnalysisFrame | undefined,
  second: AnalysisFrame | undefined,
): boolean {
  return first !== undefined && second !== undefined && first.segmentIndex === second.segmentIndex;
}
