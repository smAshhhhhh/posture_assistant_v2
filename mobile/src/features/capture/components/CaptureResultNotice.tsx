import type { CaptureSession } from '@/domain/capture/captureSession';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppText } from '@/shared/ui/AppText';

interface CaptureResultNoticeProps {
  readonly session: CaptureSession;
  readonly isReleasing: boolean;
  readonly releaseError: string | null;
  readonly onBack: () => void;
  readonly onRetryRelease: () => void;
  readonly isReading: boolean;
  readonly onReview: () => void;
}

export function CaptureResultNotice({
  session,
  isReleasing,
  releaseError,
  onBack,
  onRetryRelease,
  isReading,
  onReview,
}: CaptureResultNoticeProps) {
  return (
    <>
      <AppCard className="gap-3">
        <AppText accessibilityRole="header" variant="title">
          本次观察已结束
        </AppText>
        {isReleasing ? (
          <AppLoading>正在结束录像并释放相机…</AppLoading>
        ) : releaseError ? (
          <AppNotice isInline>{releaseError}</AppNotice>
        ) : (
          <AppText>录像、相机与姿态识别已停止。</AppText>
        )}
        <AppText>采集时长 {Math.floor(session.elapsedActiveMs / 1_000)} 秒</AppText>
        <AppText className="text-muted" variant="caption">
          采集数据仅保留在当前会话中，关闭应用会丢失。确认任务结果并保存后可在历史记录查看。
        </AppText>
      </AppCard>
      {releaseError ? (
        <AppButton isDisabled={isReleasing} onPress={onRetryRelease} variant="secondary">
          重试释放相机
        </AppButton>
      ) : null}
      <AppButton isDisabled={isReading || isReleasing || releaseError !== null} onPress={onReview}>
        {isReading ? '正在读取…' : '查看分析并保存'}
      </AppButton>
      <AppButton isDisabled={isReading || isReleasing} onPress={onBack} variant="secondary">
        返回观察首页
      </AppButton>
    </>
  );
}
