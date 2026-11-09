export interface PoseLandmark {
  readonly x: number;
  readonly y: number;
  readonly visibility: number;
  readonly presence: number;
}

export interface PoseFrame {
  readonly timestampMs: number;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly isInPreview: boolean;
  readonly landmarks: readonly PoseLandmark[];
}

export interface PoseRecording {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly observedAt: string;
  readonly modelVersion: string;
  readonly durationMs: number;
  readonly isTruncated: boolean;
  readonly frames: readonly PoseFrame[];
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
  const segments = video.segments.map((item: unknown, index: number) => {
    const segment = readObject(item);
    const fileName = readString(segment.fileName);
    if (fileName !== `${id}-${index}.mp4`) throw new Error('录像片段路径不正确');
    return { fileName, durationMs: readNumber(segment.durationMs, 1, 86_400_000) };
  });
  return { segments, error: video.error };
}

export function readObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('观察数据格式不正确');
  }
  return Object.fromEntries(Object.entries(value));
}

export function readNumber(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error('观察数值不正确');
  }
  return value;
}

export function readString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('观察字段不正确');
  return value;
}

export function parsePoseRecording(value: unknown): PoseRecording {
  const record = readObject(value);
  const durationMs = readNumber(record.durationMs, 0, 86_400_000);
  const id = readString(record.id);
  const observedAt = readString(record.observedAt);
  if (
    record.schemaVersion !== 1 ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id) ||
    !Number.isFinite(Date.parse(observedAt)) ||
    typeof record.isTruncated !== 'boolean' ||
    !Array.isArray(record.frames) ||
    record.frames.length > 9_000
  ) {
    throw new Error('关键点记录不兼容');
  }
  let previousMs = -1;
  const frames = record.frames.map((item: unknown): PoseFrame => {
    const frame = readObject(item);
    const timestampMs = readNumber(frame.timestampMs, 0, durationMs);
    if (
      timestampMs <= previousMs ||
      typeof frame.isInPreview !== 'boolean' ||
      !Array.isArray(frame.landmarks) ||
      (frame.landmarks.length !== 0 && frame.landmarks.length !== 33)
    ) {
      throw new Error('关键点时序不正确');
    }
    previousMs = timestampMs;
    const imageWidth = readNumber(frame.imageWidth, 1, 16_384);
    const imageHeight = readNumber(frame.imageHeight, 1, 16_384);
    if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight)) {
      throw new Error('关键点图像尺寸不正确');
    }
    return {
      timestampMs,
      imageWidth,
      imageHeight,
      isInPreview: frame.isInPreview,
      landmarks: frame.landmarks.map((entry: unknown): PoseLandmark => {
        const point = readObject(entry);
        return {
          x: readNumber(point.x, -10, 10),
          y: readNumber(point.y, -10, 10),
          visibility: readNumber(point.visibility, 0, 1),
          presence: readNumber(point.presence, 0, 1),
        };
      }),
    };
  });
  return {
    schemaVersion: 1,
    id,
    observedAt,
    modelVersion: readString(record.modelVersion),
    durationMs,
    isTruncated: record.isTruncated,
    frames,
    ...(record.video === undefined ? {} : { video: parseCaptureVideo(record.video, id) }),
  };
}
