export function sitToStandFrame(timestampMs, angle = 90, options = {}) {
  const { side = 'left', width = 640, height = 640, shiftX = 0, shiftY = 0 } = options;
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.2,
    visibility: 1,
    presence: 1,
  }));
  const radians = (angle * Math.PI) / 180;
  for (const offset of [0, 1]) {
    const ownAngle = (side === 'left' ? 0 : 1) === offset ? radians : Math.PI / 2;
    const mirror = side === 'left' ? 1 : -1;
    const point = (x, y) => ({
      x: (x + shiftX) / width,
      y: (y + shiftY) / height,
      visibility: 1,
      presence: 1,
    });
    landmarks[23 + offset] = point(
      240 + mirror * 100 * Math.sin(ownAngle),
      300 + 100 * Math.cos(ownAngle),
    );
    landmarks[25 + offset] = point(240, 300);
    landmarks[27 + offset] = point(240, 400);
    landmarks[11 + offset] = point(
      240 + mirror * 100 * Math.sin(ownAngle),
      180 + 100 * Math.cos(ownAngle),
    );
  }
  return { timestampMs, imageWidth: width, imageHeight: height, isInPreview: true, landmarks };
}

export function sitToStandMotion() {
  return [
    ...Array(10).fill(90),
    ...[100, 115, 130, 145, 160, 170],
    ...Array(10).fill(170),
    ...[160, 145, 130, 115, 100, 90],
    ...Array(10).fill(90),
  ];
}

export function sitToStandRecording(angles = sitToStandMotion(), options = {}) {
  return {
    schemaVersion: 1,
    id: '12345678-1234-4234-8234-123456789abc',
    observedAt: '2026-11-09T10:00:00.000Z',
    modelVersion: 'pose_landmarker_lite/float16/1',
    durationMs: angles.length * 100,
    isTruncated: false,
    frames: angles.map((angle, index) => sitToStandFrame(index * 100, angle, options)),
  };
}
