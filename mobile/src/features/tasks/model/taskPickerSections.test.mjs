import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadTypeScript } from '../../../../scripts/loadTypeScript.mjs';

const { rehabTasks } = await loadTypeScript('src/domain/tasks/taskCatalog.ts');
const { getTaskSections } = await loadTypeScript('src/features/tasks/model/taskPickerSections.ts');
test('全部任务按上肢、下肢、躯干、全身排序分组，每个任务只出现一次', () => {
  const sections = getTaskSections(rehabTasks);
  assert.deepEqual(
    sections.map((section) => section.title),
    ['上肢', '下肢', '躯干', '全身'],
  );
  assert.deepEqual(
    sections.map((section) => section.tasks.map((task) => task.id)),
    [
      ['shoulder_flexion', 'elbow_flexion_extension'],
      ['seated_knee_extension', 'march_in_place'],
      ['seated_trunk_lean'],
      ['sit_to_stand', 'short_walk'],
    ],
  );
  const taskIds = sections.flatMap((section) => section.tasks.map((task) => task.id));
  assert.deepEqual(taskIds.toSorted(), rehabTasks.map((task) => task.id).toSorted());
});

test('仅有部分身体分类时省略空组，分类顺序不受输入顺序影响', () => {
  const tasks = rehabTasks
    .filter((task) => task.bodyRegion === '下肢' || task.bodyRegion === '全身')
    .toReversed();
  const sections = getTaskSections(tasks);
  assert.deepEqual(
    sections.map((section) => section.title),
    ['下肢', '全身'],
  );
  assert.ok(sections.every((section) => section.tasks.length > 0));
  for (const section of sections) {
    assert.deepEqual(
      section.tasks,
      tasks.filter((task) => task.bodyRegion === section.title),
    );
  }
});

test('空任务目录不生成空分组', () => {
  assert.deepEqual(getTaskSections([]), []);
});
