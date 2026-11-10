import type { RehabTask } from '@/domain/tasks/taskCatalog';

interface TaskSection {
  readonly id: string;
  readonly title: string;
  readonly tasks: readonly RehabTask[];
}

export function getTaskSections(tasks: readonly RehabTask[]): readonly TaskSection[] {
  return [
    { id: 'upper_limbs', title: '上肢' },
    { id: 'lower_limbs', title: '下肢' },
    { id: 'trunk', title: '躯干' },
    { id: 'whole_body', title: '全身' },
  ]
    .map((section) => ({
      ...section,
      tasks: tasks.filter((task) => task.bodyRegion === section.title),
    }))
    .filter((section) => section.tasks.length > 0);
}
