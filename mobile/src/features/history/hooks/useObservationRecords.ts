import { useCallback, useEffect, useRef, useState } from 'react';

import { getObservationErrorMessage } from '@/domain/observations/observationReport';
import type { ObservationRepository } from '@/domain/observations/observationReport';
import type { ObservationSummary } from '@/domain/observations/types';

export function useObservationRecords(repository: ObservationRepository) {
  const [observations, setObservations] = useState<readonly ObservationSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    ++generation.current;
  }, []);
  const load = useCallback(() => {
    const token = ++generation.current;
    return Promise.resolve()
      .then(() => repository.list())
      .then((rows) => {
        if (token !== generation.current) return;
        setObservations(rows);
        setStatus('ready');
      })
      .catch((failure: unknown) => {
        if (token !== generation.current) return;
        setError(getObservationErrorMessage(failure));
        setStatus('error');
      });
  }, [repository]);
  const refresh = useCallback(() => {
    setStatus('loading');
    setError(null);
    return load();
  }, [load]);
  useEffect(() => {
    void load();
    return invalidate;
  }, [invalidate, load]);
  return { observations, status, error, refresh };
}
