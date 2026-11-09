import { useCallback, useEffect, useRef, useState } from 'react';

import { getLocalDataError } from '@/domain/storage/localData';
import type {
  DeletionPreview,
  LocalDataRepository,
  LocalDataScope,
  LocalDataStats,
} from '@/domain/storage/localData';

export function useLocalData(repository: LocalDataRepository) {
  const [stats, setStats] = useState<LocalDataStats | null>(null);
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  const run = useCallback(async (label: string, action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    if (mounted.current) {
      setBusy(label);
      setError(null);
      setMessage(null);
    }
    try {
      await action();
    } catch (failure) {
      if (mounted.current) {
        setPreview(null);
        setError(getLocalDataError(failure));
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(null);
    }
  }, []);
  const refresh = useCallback(
    () =>
      run('正在读取统计…', async () => {
        const next = await repository.stats();
        if (mounted.current) setStats(next);
      }),
    [repository, run],
  );
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return {
    stats,
    preview,
    busy,
    error,
    message,
    refresh,
    cancelDeletion: () => setPreview(null),
    previewDeletion: (scope: LocalDataScope) =>
      run('正在核对删除范围…', async () => {
        const next = await repository.previewDeletion(scope);
        if (mounted.current) setPreview(next);
      }),
    deleteData: (scope: LocalDataScope, afterDelete: () => Promise<void>) =>
      run('正在删除资料…', async () => {
        if (!preview) return;
        const next = await repository.delete(scope, preview.token);
        if (mounted.current) {
          setStats(next);
          setPreview(null);
        }
        await afterDelete();
        if (mounted.current) setMessage('所选资料已删除。');
      }),
    exportData: (scope: LocalDataScope, includePose: boolean) =>
      run('正在导出，请在系统窗口选择保存位置…', async () => {
        const result = await repository.export(scope, includePose);
        if (mounted.current) setMessage(result === 'saved' ? '导出文件已保存。' : '已取消导出。');
      }),
    cleanOrphans: () =>
      run('正在清理孤立文件…', async () => {
        const next = await repository.cleanOrphans();
        if (mounted.current) {
          setStats(next);
          setMessage('孤立文件清理完成。');
        }
      }),
  };
}
