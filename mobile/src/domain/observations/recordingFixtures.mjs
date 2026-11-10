import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const { mediaPipeLandmarkOrder } = await loadTypeScript(
  'src/domain/observations/recordingMetadata.ts',
);
const { createObservationReport: createReport } = await loadTypeScript(
  'src/domain/observations/observationReport.ts',
);

// 旧算法样本保留原形，在报告测试边界转换为明确的合成图像空间。
export function toCurrentRecording(recording) {
  if (recording.metadata) return recording;
  const segments = [];
  for (const frame of recording.frames) {
    if (frame.timestampMs >= recording.durationMs) continue;
    let segment = segments.at(-1);
    if (
      !segment ||
      segment.imageDimensions.width !== frame.imageWidth ||
      segment.imageDimensions.height !== frame.imageHeight
    ) {
      const start = segment ? frame.timestampMs : 0;
      if (segment) segment.durationMs = start - segment.startedAtMs;
      const imageDimensions = { width: frame.imageWidth, height: frame.imageHeight };
      segment = {
        segmentIndex: segments.length,
        startedAtMs: start,
        durationMs: recording.durationMs - start,
        videoSegmentId: null,
        videoOffsetMs: 0,
        imageDimensions,
        preprocessing: {
          imageSpace: 'cropped_upright_model_input',
          sourceImageDimensions: imageDimensions,
          cropRect: { left: 0, top: 0, width: frame.imageWidth, height: frame.imageHeight },
          rotationDegrees: 0,
          mirrored: false,
          bufferToModelMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        },
        frames: [],
      };
      segments.push(segment);
    }
    segment.frames.push({
      timestampMs: frame.timestampMs - segment.startedAtMs,
      landmarks:
        frame.isInPreview === false
          ? []
          : frame.landmarks.map((point) => ({
              ...structuredClone(point),
              z: point.z ?? 0,
            })),
    });
  }
  if (segments.length === 0 && recording.durationMs > 0) {
    segments.push({
      segmentIndex: 0,
      startedAtMs: 0,
      durationMs: recording.durationMs,
      videoSegmentId: null,
      videoOffsetMs: 0,
      imageDimensions: null,
      preprocessing: null,
      frames: [],
    });
  }
  const common = segments.length === 1 ? segments[0] : null;
  return {
    id: recording.id,
    observedAt: recording.observedAt,
    durationMs: recording.durationMs,
    isTruncated: recording.isTruncated,
    metadata: {
      schemaVersion: 2,
      modelVersion: recording.modelVersion,
      coordinateSystem: {
        space: 'normalized_image',
        origin: 'top_left',
        xDirection: 'right',
        yDirection: 'down',
        depth: 'mediapipe_relative_non_metric',
        depthOrigin: 'hip_midpoint',
        zDirection: 'toward_camera_negative',
      },
      landmarkOrder: mediaPipeLandmarkOrder,
      imageDimensions: common?.imageDimensions ?? null,
      preprocessing: common?.preprocessing ?? null,
      timeBasis: 'segment_relative_monotonic_ms',
      samplingIntervalMs: 100,
    },
    segments,
    ...(recording.video ? { video: recording.video } : {}),
  };
}

export function createObservationReport(patient, session, recording, status, hasAssistance) {
  return createReport(patient, session, toCurrentRecording(recording), status, hasAssistance);
}
