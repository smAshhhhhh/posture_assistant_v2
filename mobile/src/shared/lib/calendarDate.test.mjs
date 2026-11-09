import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTypeScript } from '../../../scripts/loadTypeScript.mjs';

const {
  formatCalendarDate,
  parseCalendarDate,
  isCalendarDateInRange,
  getCalendarInitialDate,
  readCalendarSelection,
} = await loadTypeScript('src/shared/lib/calendarDate.ts');

test('日历日期校验真实月份和闰年，拒绝无效日期及时间字符串', () => {
  for (const value of ['', '2026-02-29', '2024-02-30', '2026-13-01', '2026-00-01', '2026-01-00']) {
    assert.equal(parseCalendarDate(value), null);
  }
  assert.equal(parseCalendarDate('2026-11-09T00:00:00Z'), null);
  assert.equal(parseCalendarDate('2026-1-9'), null);
  for (const value of ['1900-01-01', '2000-02-29', '2024-02-29', '2026-11-09', '9999-12-31']) {
    const date = parseCalendarDate(value);
    assert.ok(date instanceof Date);
    assert.equal(formatCalendarDate(date), value);
    assert.equal(date.getHours(), 12);
  }
});

test('日期边界包含当天，单边历史筛选和患者今天上限可保留', () => {
  assert.equal(isCalendarDateInRange('1900-01-01', '1900-01-01', '2026-11-09'), true);
  assert.equal(isCalendarDateInRange('2026-11-09', '1900-01-01', '2026-11-09'), true);
  assert.equal(isCalendarDateInRange('2026-11-10', '1900-01-01', '2026-11-09'), false);
  assert.equal(isCalendarDateInRange('2026-11-09', '2026-11-10', '9999-12-31'), false);
  assert.equal(isCalendarDateInRange('', '1900-01-01', '9999-12-31'), false);
  assert.equal(isCalendarDateInRange('2026-11-10', '1900-01-01', '9999-12-31'), true);
});

test('打开日历只限制显示锚点，不改写原日期或把空值自动保存为今天', () => {
  const oldDate = '2020-05-10';
  assert.equal(getCalendarInitialDate(oldDate, '1900-01-01', '2026-11-09'), oldDate);
  assert.equal(getCalendarInitialDate(oldDate, '2021-01-01', '2026-11-09'), '2021-01-01');
  assert.equal(getCalendarInitialDate('2030-01-01', '1900-01-01', '2026-11-09'), '2026-11-09');
  assert.equal(getCalendarInitialDate('', '1900-01-01', '1900-01-01'), '1900-01-01');
  assert.equal(oldDate, '2020-05-10');
  assert.equal(readCalendarSelection(null), null);
  assert.equal(readCalendarSelection(undefined), null);
  assert.equal(readCalendarSelection('2026-11-09'), null);
  assert.equal(readCalendarSelection(new Date(Number.NaN)), null);
  assert.equal(readCalendarSelection(new Date(2026, 10, 9)), '2026-11-09');
});

test('正负时区与夏令时切换日按手机本地日历往返，不偏移前后一天', () => {
  const loaderUrl = new URL('../../../scripts/loadTypeScript.mjs', import.meta.url).href;
  const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
  const script = `
    import assert from 'node:assert/strict';
    import { loadTypeScript } from ${JSON.stringify(loaderUrl)};
    const { parseCalendarDate, formatCalendarDate, readCalendarSelection } =
      await loadTypeScript('src/shared/lib/calendarDate.ts');
    for (const value of ['2026-01-01', '2026-03-08', '2026-11-01', '2026-12-31']) {
      const date = parseCalendarDate(value);
      assert.equal(formatCalendarDate(date), value);
      assert.equal(readCalendarSelection(date), value);
      assert.equal(readCalendarSelection(new Date(date.getFullYear(), date.getMonth(), date.getDate())), value);
    }
  `;
  for (const timeZone of [
    'America/New_York',
    'Asia/Shanghai',
    'Pacific/Kiritimati',
    'Pacific/Honolulu',
  ]) {
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: projectRoot,
      env: { ...process.env, TZ: timeZone },
      stdio: 'pipe',
    });
  }
});
