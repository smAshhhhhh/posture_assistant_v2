import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../../scripts/loadTypeScript.mjs';

const { rehabTasks } = await loadTypeScript('src/domain/tasks/taskCatalog.ts');
const { getTaskSections } = await loadTypeScript('src/features/tasks/model/taskPickerSections.ts');
test('全部任务按坐姿、站立与步行分组，每个任务只出现一次', () => {
  const sections = getTaskSections(rehabTasks);
  assert.deepEqual(
    sections.map((section) => section.id),
    ['seated', 'standing_and_walking'],
  );
  assert.ok(sections[0].tasks.every((task) => task.posture === '坐姿'));
  assert.ok(sections[1].tasks.every((task) => task.posture !== '坐姿'));
  const taskIds = sections.flatMap((section) => section.tasks.map((task) => task.id));
  assert.deepEqual(taskIds.toSorted(), rehabTasks.map((task) => task.id).toSorted());
});

test('只有坐姿或站立任务时不生成另一个空分组', () => {
  const seatedTasks = rehabTasks.filter((task) => task.posture === '坐姿');
  const standingTasks = rehabTasks.filter((task) => task.posture !== '坐姿');
  assert.equal(getTaskSections(seatedTasks).length, 1);
  assert.equal(getTaskSections(standingTasks).length, 1);
});

test('空任务目录不生成空分组', () => {
  assert.deepEqual(getTaskSections([]), []);
});
