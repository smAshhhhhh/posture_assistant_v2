import { readNumber, readObject, readString } from './poseRecording';

export interface ObservationVideo {
  readonly segments: readonly { readonly uri: string; readonly durationMs: number }[];
  readonly bytes: number;
  readonly isPartial: boolean;
}

export interface ObservationVideoPlayerProps {
  readonly video: ObservationVideo;
  readonly isActive: boolean;
}

export function parseObservationVideo(value: unknown): ObservationVideo | null {
  if (value === null) return null;
  const video = readObject(value);
  if (
    !Array.isArray(video.segments) ||
    video.segments.length === 0 ||
    video.segments.length > 900 ||
    typeof video.isPartial !== 'boolean'
  ) {
    throw new Error('本机视频信息不正确');
  }
  return {
    bytes: readNumber(video.bytes, 1),
    isPartial: video.isPartial,
    segments: video.segments.map((item: unknown) => {
      const segment = readObject(item);
      const uri = readString(segment.uri);
      if (!/^file:\/{1,3}[^/]/.test(uri)) throw new Error('本机视频地址不正确');
      return { uri, durationMs: readNumber(segment.durationMs, 1, 86_400_000) };
    }),
  };
}
