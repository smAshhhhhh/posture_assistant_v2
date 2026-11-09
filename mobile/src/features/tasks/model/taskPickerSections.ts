import type { RehabTask } from '@/domain/tasks/taskCatalog';

interface TaskSection {
  readonly id: string;
  readonly title: string;
  readonly tasks: readonly RehabTask[];
}

export function getTaskSections(tasks: readonly RehabTask[]): readonly TaskSection[] {
  return [
    {
      id: 'seated',
      title: '坐姿任务',
      tasks: tasks.filter((task) => task.posture === '坐姿'),
    },
    {
      id: 'standing_and_walking',
      title: '站立与步行任务',
      tasks: tasks.filter((task) => task.posture !== '坐姿'),
    },
  ].filter((section) => section.tasks.length > 0);
}
