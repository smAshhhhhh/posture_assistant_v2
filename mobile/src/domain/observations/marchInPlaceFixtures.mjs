export function marchFrame(timestampMs, lifts = {}, options = {}) {
  const { width = 640, height = 480, shiftX = 0, shiftY = 0, scale = 1 } = options;
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
  for (const [side, offset] of [
    ['left', 0],
    ['right', 1],
  ]) {
    const x = 200 + offset * 50;
    const lift = lifts[side] ?? 0;
    // 骨段保持各 100 像素，通过屈膝产生踝部竖直抬升。
    const halfHeight = 100 * (1 - lift);
    const kneeX = Math.sqrt(100 ** 2 - halfHeight ** 2);
    landmarks[11 + offset] = point(x, 120);
    landmarks[23 + offset] = point(x, 200);
    landmarks[25 + offset] = point(x + kneeX, 200 + halfHeight);
    landmarks[27 + offset] = point(x, 200 + 2 * halfHeight);
  }
  return { timestampMs, imageWidth: width, imageHeight: height, isInPreview: true, landmarks };
}

export function marchMotion(sides = ['left', 'right', 'left', 'right'], amplitude = 0.16) {
  return [
    ...Array.from({ length: 8 }, () => ({})),
    ...sides.flatMap((side) =>
      [0.04, 0.1, amplitude, amplitude, 0.1, 0.04, 0, 0].map((lift) => ({ [side]: lift })),
    ),
    ...Array.from({ length: 8 }, () => ({})),
  ];
}

export function marchRecording(motion = marchMotion(), options = {}) {
  return {
    schemaVersion: 1,
    id: '12345678-1234-4234-8234-123456789abc',
    observedAt: '2026-11-09T10:00:00.000Z',
    modelVersion: 'pose_landmarker_lite/float16/1',
    durationMs: motion.length * 100,
    isTruncated: false,
    frames: motion.map((lifts, index) => marchFrame(index * 100, lifts, options)),
  };
}
