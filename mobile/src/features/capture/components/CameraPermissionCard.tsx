import type { CameraPermission } from '@/domain/capture/cameraPermission';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppText } from '@/shared/ui/AppText';

interface CameraPermissionCardProps {
  readonly permission: CameraPermission;
  readonly isBusy: boolean;
  readonly error: string | null;
  readonly onRequest: () => void;
  readonly onOpenSettings: () => void;
}

const permissionLabels: Record<CameraPermission, string> = {
  unknown: '允许使用相机后开始',
  granted: '相机已授权',
  denied: '尚未允许使用相机',
  blocked: '请在系统设置中允许相机权限',
  unavailable: '当前平台尚未接入相机',
};

export function CameraPermissionCard({
  permission,
  isBusy,
  error,
  onRequest,
  onOpenSettings,
}: CameraPermissionCardProps) {
  const shouldOpenSettings = permission === 'blocked';

  return (
    <AppCard className="gap-3">
      <AppText className="font-medium" accessibilityLiveRegion="polite">
        {isBusy ? '正在检查相机权限…' : permissionLabels[permission]}
      </AppText>
      <AppText className="text-muted" variant="caption">
        相机用于在本机提取动作关键点，原始视频默认不留存。
      </AppText>
      {permission !== 'granted' && permission !== 'unavailable' ? (
        <AppButton
          className="rounded-xl"
          isDisabled={isBusy}
          onPress={shouldOpenSettings ? onOpenSettings : onRequest}
          variant="secondary"
        >
          {shouldOpenSettings ? '前往系统设置授权' : '允许使用相机'}
        </AppButton>
      ) : null}
      {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
    </AppCard>
  );
}
