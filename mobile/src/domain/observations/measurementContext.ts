import type { TaskProtocol } from '../tasks/taskProtocol';
import { getTaskProtocol, parseTaskProtocol } from '../tasks/taskProtocol';
import type { AffectedSide } from '../patients/types';

import { extractMotionMetrics } from './motionMetrics';
import type { MetricDefinition } from './motionMetrics';
import { readObject } from './recordValues';
import type { TaskAnalysis } from './taskAnalysis';

export interface MeasurementContext {
  readonly taskProtocol: TaskProtocol;
  readonly metricDefinitions: readonly MetricDefinition[];
  readonly metricDefinitionVersion: 1;
  readonly validationStatus: 'engineering_unvalidated';
}

export function createMeasurementContext(
  analysis: TaskAnalysis,
  side: AffectedSide,
  taskProtocol = getTaskProtocol(analysis.taskId, side),
): MeasurementContext {
  return {
    taskProtocol: {
      ...taskProtocol,
      movementInstructions: [...taskProtocol.movementInstructions],
      cameraRequirements: [...taskProtocol.cameraRequirements],
      assistanceRules: [...taskProtocol.assistanceRules],
      compensationRules: [...taskProtocol.compensationRules],
    },
    metricDefinitions: extractMotionMetrics(analysis).map((item) => item.definition),
    metricDefinitionVersion: 1,
    validationStatus: 'engineering_unvalidated',
  };
}

export function parseMeasurementContext(
  value: unknown,
  analysis: TaskAnalysis,
): MeasurementContext {
  const record = readObject(value);
  const expected = extractMotionMetrics(analysis).map((item) => item.definition);
  if (
    record.metricDefinitionVersion !== 1 ||
    record.validationStatus !== 'engineering_unvalidated' ||
    !Array.isArray(record.metricDefinitions) ||
    record.metricDefinitions.length !== expected.length
  ) {
    throw new Error('测量定义版本不兼容');
  }
  const savedDefinitions = record.metricDefinitions;
  const metricDefinitions = expected.map((definition, index) => {
    const saved = readObject(savedDefinitions[index]);
    // 同一指标版本固定定义，禁止悄悄改变历史指标的含义。
    if (Object.entries(definition).some(([key, value]) => saved[key] !== value)) {
      throw new Error('指标定义与版本不一致');
    }
    return definition;
  });
  return {
    taskProtocol: parseTaskProtocol(record.taskProtocol, analysis.taskId),
    metricDefinitions,
    metricDefinitionVersion: 1,
    validationStatus: 'engineering_unvalidated',
  };
}
