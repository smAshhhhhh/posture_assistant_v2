import { readInteger, readNumber, readObject, readString } from './recordValues';

export const mediaPipeLandmarkOrder = [
  'nose',
  'left_eye_inner',
  'left_eye',
  'left_eye_outer',
  'right_eye_inner',
  'right_eye',
  'right_eye_outer',
  'left_ear',
  'right_ear',
  'mouth_left',
  'mouth_right',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_pinky',
  'right_pinky',
  'left_index',
  'right_index',
  'left_thumb',
  'right_thumb',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
  'left_heel',
  'right_heel',
  'left_foot_index',
  'right_foot_index',
] as const;

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

export interface ImagePreprocessing {
  readonly imageSpace: 'cropped_upright_model_input';
  readonly sourceImageDimensions: ImageDimensions;
  readonly cropRect: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
  readonly rotationDegrees: 0 | 90 | 180 | 270;
  readonly mirrored: false;
  readonly bufferToModelMatrix: readonly number[];
}

export interface ImageSpace {
  readonly imageDimensions: ImageDimensions | null;
  readonly preprocessing: ImagePreprocessing | null;
}

export interface RecordingMetadata extends ImageSpace {
  readonly schemaVersion: 2;
  readonly modelVersion: string;
  readonly coordinateSystem: {
    readonly space: 'normalized_image';
    readonly origin: 'top_left';
    readonly xDirection: 'right';
    readonly yDirection: 'down';
    readonly depth: 'mediapipe_relative_non_metric';
    readonly depthOrigin: 'hip_midpoint';
    readonly zDirection: 'toward_camera_negative';
  };
  readonly landmarkOrder: readonly string[];
  readonly timeBasis: 'segment_relative_monotonic_ms';
  readonly samplingIntervalMs: 100;
}

function dimensions(value: unknown): ImageDimensions {
  const size = readObject(value);
  return { width: readInteger(size.width, 1, 16_384), height: readInteger(size.height, 1, 16_384) };
}

export function parseImageSpace(value: unknown): ImageSpace {
  const record = readObject(value);
  if (record.imageDimensions === null && record.preprocessing === null) {
    return { imageDimensions: null, preprocessing: null };
  }
  const imageDimensions = dimensions(record.imageDimensions);
  const input = readObject(record.preprocessing);
  const source = dimensions(input.sourceImageDimensions);
  const crop = readObject(input.cropRect);
  const left = readInteger(crop.left, 0, source.width - 1);
  const top = readInteger(crop.top, 0, source.height - 1);
  const width = readInteger(crop.width, 1, source.width - left);
  const height = readInteger(crop.height, 1, source.height - top);
  const rotation = input.rotationDegrees;
  if (
    input.imageSpace !== 'cropped_upright_model_input' ||
    input.mirrored !== false ||
    (rotation !== 0 && rotation !== 90 && rotation !== 180 && rotation !== 270) ||
    !Array.isArray(input.bufferToModelMatrix) ||
    input.bufferToModelMatrix.length !== 9
  )
    throw new Error('图像预处理信息不正确');
  const swaps = rotation === 90 || rotation === 270;
  if (
    imageDimensions.width !== (swaps ? height : width) ||
    imageDimensions.height !== (swaps ? width : height)
  ) {
    throw new Error('模型输入尺寸与裁切旋转不一致');
  }
  const matrix = input.bufferToModelMatrix.map((entry: unknown) =>
    readNumber(entry, -1_000_000, 1_000_000),
  );
  const expected =
    rotation === 0
      ? [1, 0, -left, 0, 1, -top, 0, 0, 1]
      : rotation === 90
        ? [0, -1, top + height, 1, 0, -left, 0, 0, 1]
        : rotation === 180
          ? [-1, 0, left + width, 0, -1, top + height, 0, 0, 1]
          : [0, 1, -top, -1, 0, left + width, 0, 0, 1];
  if (matrix.some((entry, index) => Math.abs(entry - (expected[index] ?? 0)) > 0.01)) {
    throw new Error('图像变换矩阵与裁切旋转不一致');
  }
  return {
    imageDimensions,
    preprocessing: {
      imageSpace: 'cropped_upright_model_input',
      sourceImageDimensions: source,
      cropRect: { left, top, width, height },
      rotationDegrees: rotation,
      mirrored: false,
      bufferToModelMatrix: matrix,
    },
  };
}

export function parseRecordingMetadata(value: unknown): RecordingMetadata {
  const record = readObject(value);
  const coordinates = readObject(record.coordinateSystem);
  const order = record.landmarkOrder;
  if (
    record.schemaVersion !== 2 ||
    record.timeBasis !== 'segment_relative_monotonic_ms' ||
    record.samplingIntervalMs !== 100 ||
    coordinates.space !== 'normalized_image' ||
    coordinates.origin !== 'top_left' ||
    coordinates.xDirection !== 'right' ||
    coordinates.yDirection !== 'down' ||
    coordinates.depth !== 'mediapipe_relative_non_metric' ||
    coordinates.depthOrigin !== 'hip_midpoint' ||
    coordinates.zDirection !== 'toward_camera_negative' ||
    !Array.isArray(order) ||
    order.length !== mediaPipeLandmarkOrder.length ||
    !mediaPipeLandmarkOrder.every((name, index) => order[index] === name)
  )
    throw new Error('采集元信息不兼容');
  return {
    ...parseImageSpace(record),
    schemaVersion: 2,
    modelVersion: readString(record.modelVersion),
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
    timeBasis: 'segment_relative_monotonic_ms',
    samplingIntervalMs: 100,
  };
}
