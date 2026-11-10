import { useCallback, useEffect, useRef, useState } from 'react';

import { defaultAppPreferences } from '@/domain/settings/appPreferences';
import type { AppPreferences, PreferencesRepository } from '@/domain/settings/appPreferences';
import { getLocalDataError } from '@/domain/storage/localData';

export function useAppPreferences(repository: PreferencesRepository) {
  const [value, setValue] = useState(defaultAppPreferences);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const mounted = useRef(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    ++generation.current;
  }, []);
  const load = useCallback(() => {
    const token = ++generation.current;
    return Promise.resolve()
      .then(() => repository.load())
      .then((next) => {
        if (!mounted.current || token !== generation.current) return;
        setValue(next);
        setStatus('ready');
      })
      .catch((failure: unknown) => {
        if (!mounted.current || token !== generation.current) return;
        setError(getLocalDataError(failure));
        setStatus('error');
      });
  }, [repository]);
  const refresh = useCallback(() => {
    if (busy.current) return Promise.resolve();
    setStatus('loading');
    setError(null);
    return load();
  }, [load]);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      invalidate();
    };
  }, [invalidate, load]);
  const save = async (next: AppPreferences) => {
    if (busy.current) return false;
    busy.current = true;
    setIsSaving(true);
    ++generation.current;
    setError(null);
    try {
      const saved = await repository.save(next);
      if (mounted.current) {
        setValue(saved);
        setStatus('ready');
      }
      return true;
    } catch (failure) {
      if (mounted.current) setError(getLocalDataError(failure));
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setIsSaving(false);
    }
  };
  return {
    value,
    status,
    error,
    isSaving,
    save,
    refresh,
    canSelectPoseModel: repository.canSelectPoseModel === true,
  };
}
