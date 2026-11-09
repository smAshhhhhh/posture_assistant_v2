import { useIsFocused } from '@react-navigation/native';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';

import type { ObservationRepository } from '@/domain/observations/observationReport';
import type {
  ObservationVideo,
  ObservationVideoPlayerProps,
} from '@/domain/observations/observationVideo';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppText } from '@/shared/ui/AppText';

interface ObservationVideoCardProps {
  readonly id: string;
  readonly repository: ObservationRepository;
  readonly Player: ComponentType<ObservationVideoPlayerProps>;
}

export function ObservationVideoCard({ id, repository, Player }: ObservationVideoCardProps) {
  const [video, setVideo] = useState<ObservationVideo | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');
  const isFocused = useIsFocused();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (status !== 'loading') return;
    let active = true;
    void repository.getVideo(id).then(
      (saved) => {
        if (!active) return;
        setVideo(saved);
        setStatus(saved ? 'ready' : 'empty');
      },
      () => {
        if (active) setStatus('error');
      },
    );
    return () => {
      active = false;
    };
  }, [id, repository, status]);
  return (
    <View className="gap-3">
      {status === 'ready' && video ? (
        <>
          <Player video={video} isActive={isFocused && isActive} />
          <AppText variant="caption" className="text-muted">
            原始视频 · 无声录像 · 暂停区间不录像
          </AppText>
          {video.isPartial ? <AppText>本次录像曾中断，仅保留成功录制的片段。</AppText> : null}
        </>
      ) : status === 'empty' ? (
        <AppCard className="gap-2">
          <AppText variant="section">原始视频</AppText>
          <AppText className="text-muted">此记录未留存视频。</AppText>
        </AppCard>
      ) : status === 'loading' ? (
        <AppCard className="min-h-[200px] items-center justify-center">
          <AppLoading>正在读取原始视频…</AppLoading>
        </AppCard>
      ) : (
        <AppCard className="gap-3">
          <AppText variant="section">原始视频</AppText>
          <AppNotice isInline>视频暂时无法读取，请重试。报告仍可查看。</AppNotice>
          <AppButton variant="secondary" onPress={() => setStatus('loading')}>
            重试读取视频
          </AppButton>
        </AppCard>
      )}
    </View>
  );
}
