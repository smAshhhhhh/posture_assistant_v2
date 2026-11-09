import { useCallback, useEffect, useRef, useState } from 'react';

import type { AssessmentValues, ClinicalAssessment } from '@/domain/patients/clinicalAssessment';
import { getPatientErrorMessage } from '@/domain/patients/patientRepository';
import type { PatientRepository } from '@/domain/patients/patientRepository';

export function useClinicalAssessments(repository: PatientRepository, patientId: string) {
  const [records, setRecords] = useState<readonly ClinicalAssessment[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const mounted = useRef(false);
  const mutating = useRef(false);
  const generation = useRef(0);

  const invalidatePending = useCallback(() => {
    ++generation.current;
  }, []);
  const load = useCallback(() => {
    const token = ++generation.current;
    return repository
      .listAssessments(patientId)
      .then((next) => {
        if (mounted.current && generation.current === token) {
          setRecords(next);
          setStatus('ready');
        }
      })
      .catch((failure: unknown) => {
        if (mounted.current && generation.current === token) {
          setError(getPatientErrorMessage(failure));
          setStatus('error');
        }
      });
  }, [patientId, repository]);

  const refresh = useCallback(() => {
    if (mutating.current) return Promise.resolve();
    setStatus('loading');
    setError(null);
    setMessage(null);
    return load();
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      invalidatePending();
    };
  }, [invalidatePending, load]);

  const mutate = useCallback(
    async <T>(
      operation: () => Promise<T>,
      update: (value: T, previous: readonly ClinicalAssessment[]) => readonly ClinicalAssessment[],
      successMessage: string,
    ) => {
      if (mutating.current) throw Object.assign(new Error('评估操作进行中'), { code: 'BUSY' });
      mutating.current = true;
      ++generation.current;
      setIsBusy(true);
      setError(null);
      setMessage(null);
      try {
        const result = await operation();
        if (mounted.current) {
          // 使用已提交回执更新列表，不让先前的读取覆盖修改。
          setRecords((previous) => update(result, previous));
          setStatus('ready');
          setMessage(successMessage);
        }
        return result;
      } finally {
        mutating.current = false;
        if (mounted.current) setIsBusy(false);
      }
    },
    [],
  );

  const save = useCallback(
    (values: AssessmentValues, current: ClinicalAssessment | null) =>
      mutate(
        () =>
          current
            ? repository.updateAssessment(current, values)
            : repository.addAssessment(patientId, values),
        (saved, previous) =>
          [saved, ...previous.filter((record) => record.id !== saved.id)].sort(
            (left, right) =>
              right.assessedOn.localeCompare(left.assessedOn) ||
              right.createdAt.localeCompare(left.createdAt) ||
              left.id.localeCompare(right.id),
          ),
        current ? '评估修改已保存。' : '评估记录已保存。',
      ),
    [mutate, patientId, repository],
  );

  const remove = useCallback(
    async (current: ClinicalAssessment) => {
      try {
        await mutate(
          () => repository.deleteAssessment(current),
          (_, previous) => previous.filter((record) => record.id !== current.id),
          '该条评估已删除。',
        );
      } catch (failure) {
        if (mounted.current) setError(getPatientErrorMessage(failure));
      }
    },
    [mutate, repository],
  );

  return { records, status, error, message, isBusy, refresh, save, remove };
}
