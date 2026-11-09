export function formatCalendarDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  // 日期没有时区；使用本地中午，避免 UTC 解析造成前后一天偏移。
  const date = new Date(year, month - 1, day, 12);
  return Number.isFinite(date.getTime()) && formatCalendarDate(date) === value ? date : null;
}

export function isCalendarDateInRange(value: string, minimum: string, maximum: string): boolean {
  return parseCalendarDate(value) !== null && value >= minimum && value <= maximum;
}

export function getCalendarInitialDate(value: string, minimum: string, maximum: string): string {
  const candidate = parseCalendarDate(value) ? value : formatCalendarDate(new Date());
  return candidate < minimum ? minimum : candidate > maximum ? maximum : candidate;
}

export function readCalendarSelection(value: unknown): string | null {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return null;
  return formatCalendarDate(value);
}
