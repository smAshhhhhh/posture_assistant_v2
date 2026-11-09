import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { CameraPermission, CameraPermissionGateway } from '@/domain/capture/cameraPermission';

export function useCameraPermission(gateway: CameraPermissionGateway) {
  const [permission, setPermission] = useState<CameraPermission>('unknown');
  const [isBusy, setIsBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(false);
  const operationId = useRef(0);
  const isRequesting = useRef(false);
  const invalidatePending = useCallback(() => {
    ++operationId.current;
  }, []);

  const run = useCallback(async (operation: () => Promise<CameraPermission>) => {
    const currentId = ++operationId.current;
    setIsBusy(true);
    setError(null);

    try {
      const status = await operation();
      if (isMounted.current && currentId === operationId.current) setPermission(status);
    } catch {
      if (isMounted.current && currentId === operationId.current) {
        setPermission('unknown');
        setError('无法读取相机权限，请重试。');
      }
    } finally {
      if (isMounted.current && currentId === operationId.current) setIsBusy(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    // 系统权限弹窗会触发前后台切换，不能让读状态覆盖正在等待的授权结果。
    if (!isRequesting.current) await run(() => gateway.getStatus());
  }, [gateway, run]);
  const request = useCallback(async () => {
    if (isRequesting.current) return;
    isRequesting.current = true;
    try {
      await run(() => gateway.request());
    } finally {
      isRequesting.current = false;
    }
  }, [gateway, run]);
  const openSettings = useCallback(async () => {
    try {
      await gateway.openSettings();
    } catch {
      if (isMounted.current) setError('无法打开系统设置，请在系统应用设置中允许相机权限。');
    }
  }, [gateway]);

  useEffect(() => {
    isMounted.current = true;
    void refresh();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void refresh();
    });

    return () => {
      isMounted.current = false;
      invalidatePending();
      subscription.remove();
    };
  }, [invalidatePending, refresh]);

  return { permission, isBusy, error, refresh, request, openSettings };
}
