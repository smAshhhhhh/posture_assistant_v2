import { getJointAngle } from './angleAnalysis';
import { marchInPlaceSettings as settings } from './marchInPlaceProtocol';
import type { MarchSide } from './marchInPlaceProtocol';
import type { AnalysisFrame } from './analysisRecording';

interface LegPosition {
  readonly ankleX: number;
  readonly ankleY: number;
  readonly hipX: number;
  readonly hipY: number;
  readonly legLength: number;
  readonly kneeAngle: number;
}

export interface MarchPosition {
  readonly timestampMs: number;
  readonly width: number;
  readonly height: number;
  readonly left: LegPosition;
  readonly right: LegPosition;
}

function legPosition(frame: AnalysisFrame, side: MarchSide): LegPosition | null {
  const kneeAngle = getJointAngle(frame, side, 'march_in_place');
  const offset = side === 'left' ? 0 : 1;
  const hip = frame.landmarks[23 + offset];
  const knee = frame.landmarks[25 + offset];
  const ankle = frame.landmarks[27 + offset];
  if (kneeAngle === null || !hip || !knee || !ankle) return null;
  const { imageWidth: width, imageHeight: height } = frame;
  const legLength =
    Math.hypot((hip.x - knee.x) * width, (hip.y - knee.y) * height) +
    Math.hypot((knee.x - ankle.x) * width, (knee.y - ankle.y) * height);
  if (legLength < settings.minimumLegLengthPx) return null;
  return {
    ankleX: ankle.x * width,
    ankleY: ankle.y * height,
    hipX: hip.x * width,
    hipY: hip.y * height,
    legLength,
    kneeAngle,
  };
}

export function marchPosition(frame: AnalysisFrame): MarchPosition | null {
  const left = legPosition(frame, 'left');
  const right = legPosition(frame, 'right');
  return left && right
    ? {
        timestampMs: frame.timestampMs,
        width: frame.imageWidth,
        height: frame.imageHeight,
        left,
        right,
      }
    : null;
}

export function isSameMarchView(current: MarchPosition, anchor: MarchPosition): boolean {
  return (
    current.width === anchor.width &&
    current.height === anchor.height &&
    (['left', 'right'] as const).every((side) => {
      const leg = current[side];
      const initial = anchor[side];
      return (
        Math.abs(leg.legLength / initial.legLength - 1) <= settings.maximumLegScaleChange &&
        Math.hypot(leg.hipX - initial.hipX, leg.hipY - initial.hipY) / initial.legLength <=
          settings.maximumHipDriftRatio &&
        // 踝部竖直位移是抬脚信号，仅限制横向漂移。
        Math.abs(leg.ankleX - initial.ankleX) / initial.legLength <=
          settings.maximumFootHorizontalDriftRatio
      );
    })
  );
}

export function isStableMarchPosition(current: MarchPosition, anchor: MarchPosition): boolean {
  return (
    current.width === anchor.width &&
    current.height === anchor.height &&
    (['left', 'right'] as const).every((side) => {
      const leg = current[side];
      const initial = anchor[side];
      return (
        leg.kneeAngle >= settings.standingKneeAngle &&
        Math.hypot(leg.ankleX - initial.ankleX, leg.ankleY - initial.ankleY) / initial.legLength <=
          settings.baselinePositionTolerance &&
        Math.hypot(leg.hipX - initial.hipX, leg.hipY - initial.hipY) / initial.legLength <=
          settings.baselinePositionTolerance
      );
    })
  );
}

export function marchLiftRatio(current: MarchPosition, anchor: MarchPosition, side: MarchSide) {
  return (anchor[side].ankleY - current[side].ankleY) / anchor[side].legLength;
}
