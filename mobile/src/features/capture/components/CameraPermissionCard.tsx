import type { CameraPermission } from '@/domain/capture/cameraPermission';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppNotice } from '@/shared/ui/AppNotice';
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

  // 已授权状态显示在预览上方，异常仍在正文中提示。
  if (permission === 'granted') {
    return error ? <AppNotice>{error}</AppNotice> : null;
  }

  return (
    <AppCard className="gap-3">
      {isBusy ? (
        <AppLoading>正在检查相机权限…</AppLoading>
      ) : (
        <AppText className="font-medium">{permissionLabels[permission]}</AppText>
      )}
      <AppText className="text-muted" variant="caption">
        相机用于提取动作关键点并录制无声视频；确认保存后可在本机记录中回放。
      </AppText>
      {permission !== 'unavailable' ? (
        <AppButton
          isDisabled={isBusy}
          onPress={shouldOpenSettings ? onOpenSettings : onRequest}
          variant="secondary"
        >
          {shouldOpenSettings ? '前往系统设置授权' : '允许使用相机'}
        </AppButton>
      ) : null}
      {error ? <AppNotice isInline>{error}</AppNotice> : null}
    </AppCard>
  );
}
