import { readInteger, readNumber, readObject, readString } from './recordValues';
import { parseRecordingMetadata, parseImageSpace } from './recordingMetadata';
import type { RecordingMetadata, ImageSpace } from './recordingMetadata';

export { readNumber, readObject, readString } from './recordValues';

export interface PoseLandmark {
  readonly x: number;
  readonly y: number;
  // MediaPipe 相对深度，不能解释为物理距离。
  readonly z: number;
  readonly visibility: number;
  readonly presence: number;
}

export interface PoseFrame {
  // 片段内的单调时间，区间为 [0, durationMs)。
  readonly timestampMs: number;
  readonly landmarks: readonly PoseLandmark[];
}

export interface PoseSegment extends ImageSpace {
  readonly segmentIndex: number;
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly videoSegmentId: string | null;
  readonly videoOffsetMs: number;
  readonly frames: readonly PoseFrame[];
}

export interface PoseRecording {
  readonly id: string;
  readonly observedAt: string;
  readonly metadata: RecordingMetadata;
  readonly durationMs: number;
  readonly isTruncated: boolean;
  readonly segments: readonly PoseSegment[];
  readonly video?: CaptureVideo;
}

export interface CaptureVideo {
  readonly segments: readonly { readonly fileName: string; readonly durationMs: number }[];
  readonly error: string | null;
}

function parseCaptureVideo(value: unknown, id: string): CaptureVideo {
  const video = readObject(value);
  if (!Array.isArray(video.segments) || video.segments.length > 900) {
    throw new Error('录像片段格式不正确');
  }
  if (video.error !== null && video.error !== 'recording_failed') {
    throw new Error('录像状态不正确');
  }
  return {
    error: video.error,
    segments: video.segments.map((value: unknown, index: number) => {
      const segment = readObject(value);
      const fileName = readString(segment.fileName);
      if (fileName !== `${id}-${index}.mp4`) throw new Error('录像片段路径不正确');
      return { fileName, durationMs: readInteger(segment.durationMs, 1, 86_400_000) };
    }),
  };
}

function parseFrame(value: unknown, durationMs: number): PoseFrame {
  const frame = readObject(value);
  const timestampMs = readInteger(frame.timestampMs, 0, durationMs);
  if (
    timestampMs >= durationMs ||
    !Array.isArray(frame.landmarks) ||
    (frame.landmarks.length !== 0 && frame.landmarks.length !== 33) ||
    Object.keys(frame).some((key) => key !== 'timestampMs' && key !== 'landmarks')
  ) {
    throw new Error('原始关键点帧不正确');
  }
  return {
    timestampMs,
    landmarks: frame.landmarks.map((value: unknown) => {
      const point = readObject(value);
      if (
        Object.keys(point).some((key) => !['x', 'y', 'z', 'visibility', 'presence'].includes(key))
      ) {
        throw new Error('原始关键点包含非采集字段');
      }
      return {
        x: readNumber(point.x, -10, 10),
        y: readNumber(point.y, -10, 10),
        z: readNumber(point.z, -10, 10),
        visibility: readNumber(point.visibility, 0, 1),
        presence: readNumber(point.presence, 0, 1),
      };
    }),
  };
}

export function parsePoseRecording(value: unknown): PoseRecording {
  const record = readObject(value);
  const id = readString(record.id);
  const observedAt = readString(record.observedAt);
  const durationMs = readInteger(record.durationMs, 0, 86_400_000);
  const metadata = parseRecordingMetadata(record.metadata);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id) ||
    !Number.isFinite(Date.parse(observedAt)) ||
    typeof record.isTruncated !== 'boolean' ||
    !Array.isArray(record.segments) ||
    record.segments.length > 9_000
  ) {
    throw new Error('关键点记录不兼容');
  }
  let previousEnd = 0;
  let totalDuration = 0;
  let totalFrames = 0;
  const segments = record.segments.map((value: unknown, index: number): PoseSegment => {
    const segment = readObject(value);
    const startedAtMs = readInteger(segment.startedAtMs, previousEnd, 86_400_000);
    const segmentDuration = readInteger(segment.durationMs, 0, 86_400_000 - startedAtMs);
    if (segment.segmentIndex !== index || !Array.isArray(segment.frames)) {
      throw new Error('采集片段不正确');
    }
    const imageSpace = parseImageSpace(segment);
    if (
      metadata.imageDimensions &&
      imageSpace.imageDimensions &&
      (JSON.stringify(metadata.imageDimensions) !== JSON.stringify(imageSpace.imageDimensions) ||
        JSON.stringify(metadata.preprocessing) !== JSON.stringify(imageSpace.preprocessing))
    ) {
      throw new Error('公共图像元信息与片段不一致');
    }
    if (segment.frames.length > 0 && !imageSpace.imageDimensions) {
      throw new Error('关键点缺少模型输入尺寸');
    }
    let previousTimestamp = -1;
    const frames = segment.frames.map((value: unknown) => {
      const frame = parseFrame(value, segmentDuration);
      if (frame.timestampMs <= previousTimestamp) throw new Error('片段内时间戳未递增');
      previousTimestamp = frame.timestampMs;
      return frame;
    });
    const videoSegmentId = segment.videoSegmentId;
    if (
      videoSegmentId !== null &&
      (typeof videoSegmentId !== 'string' ||
        !new RegExp(`^${id}-[0-9]+\\.mp4$`).test(videoSegmentId))
    ) {
      throw new Error('关键点与视频关联不正确');
    }
    previousEnd = startedAtMs + segmentDuration;
    totalDuration += segmentDuration;
    totalFrames += frames.length;
    return {
      ...imageSpace,
      segmentIndex: index,
      startedAtMs,
      durationMs: segmentDuration,
      videoSegmentId,
      videoOffsetMs: readInteger(segment.videoOffsetMs, 0, 86_400_000),
      frames,
    };
  });
  if (totalFrames > 9_000 || totalDuration !== durationMs) {
    throw new Error('采集时长或容量不一致');
  }
  const video = record.video === undefined ? undefined : parseCaptureVideo(record.video, id);
  for (const segment of segments) {
    if (segment.videoSegmentId === null) continue;
    if (!video) throw new Error('采集片段缺少录像信息');
    const linked = video.segments.find((item) => item.fileName === segment.videoSegmentId);
    if (!linked && video.error === null) throw new Error('采集片段缺少对应录像');
  }
  return {
    id,
    observedAt,
    metadata,
    durationMs,
    isTruncated: record.isTruncated,
    segments,
    ...(video ? { video } : {}),
  };
}
