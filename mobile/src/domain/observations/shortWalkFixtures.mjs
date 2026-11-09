export function walkMotion(rounds = 4) {
  const swing = [170, 150, 120, 110, 120, 150, 170, 170];
  return [
    ...Array.from({ length: 6 }, () => ({ left: 170, right: 170 })),
    ...Array.from({ length: rounds }, () => [
      ...swing.map((left) => ({ left, right: 170 })),
      ...swing.map((right) => ({ left: 170, right })),
    ]).flat(),
    ...Array.from({ length: 6 }, () => ({ left: 170, right: 170 })),
  ];
}

export function walkFrame(timestampMs, angles, options = {}) {
  const { width = 640, height = 480, speed = 40, scale = 1, shiftX = 0, shiftY = 0 } = options;
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.2,
    visibility: 1,
    presence: 1,
  }));
  const point = (x, y) => ({
    x: (x * scale + shiftX) / width,
    y: (y * scale + shiftY) / height,
    visibility: 1,
    presence: 1,
  });
  const directionOffset = speed < 0 ? 350 : 0;
  const hipX = 85 + directionOffset + (speed * timestampMs) / 1000;
  for (const [side, offset] of [
    ['left', 0],
    ['right', 1],
  ]) {
    const halfAngle = ((180 - angles[side]) * Math.PI) / 360;
    const x = hipX + offset * 25;
    landmarks[11 + offset] = point(x, 110);
    landmarks[23 + offset] = point(x, 200);
    landmarks[25 + offset] = point(x + 100 * Math.sin(halfAngle), 200 + 100 * Math.cos(halfAngle));
    landmarks[27 + offset] = point(x, 200 + 200 * Math.cos(halfAngle));
  }
  return { timestampMs, imageWidth: width, imageHeight: height, isInPreview: true, landmarks };
}

export function walkRecording(motion = walkMotion(), options = {}) {
  return {
    schemaVersion: 1,
    id: '12345678-1234-4234-8234-123456789abc',
    observedAt: '2026-11-09T10:00:00.000Z',
    modelVersion: 'pose_landmarker_lite/float16/1',
    durationMs: motion.length * 100,
    isTruncated: false,
    frames: motion.map((angles, index) => walkFrame(index * 100, angles, options)),
  };
}
