import { useCallback, useEffect, useRef, useState } from 'react';

import type { PatientProfile, PatientValues } from '@/domain/patients/patientRecord';
import { getPatientErrorMessage } from '@/domain/patients/patientRepository';
import type { PatientRepository } from '@/domain/patients/patientRepository';

export function usePatientRecords(repository: PatientRepository) {
  const [patients, setPatients] = useState<readonly PatientProfile[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const operationId = useRef(0);
  const invalidatePending = useCallback(() => {
    ++operationId.current;
  }, []);
  const load = useCallback(() => {
    const token = ++operationId.current;
    return repository
      .list()
      .then((next) => {
        if (!mounted.current || token !== operationId.current) return;
        setPatients(next);
        setStatus('ready');
      })
      .catch((failure: unknown) => {
        if (!mounted.current || token !== operationId.current) return;
        setError(getPatientErrorMessage(failure));
        setStatus('error');
      });
  }, [repository]);

  const refresh = useCallback(() => {
    setStatus('loading');
    setError(null);
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

  const savePatient = useCallback(
    async (values: PatientValues, current: PatientProfile | null) => {
      const saved = await repository.save(values, current);
      if (mounted.current) {
        // 保存回执来自已提交事务，失效旧查询，避免其覆盖新档案。
        ++operationId.current;
        setPatients((previous) => [
          saved,
          ...previous.filter((patient) => patient.id !== saved.id),
        ]);
        setStatus('ready');
        setError(null);
      }
      return saved;
    },
    [repository],
  );

  return { patients, status, error, refresh, savePatient };
}
