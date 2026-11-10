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

export function readInteger(
  value: unknown,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const number = readNumber(value, minimum, maximum);
  if (!Number.isInteger(number)) throw new Error('观察整数不正确');
  return number;
}

export function readString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('观察字段不正确');
  return value;
}
