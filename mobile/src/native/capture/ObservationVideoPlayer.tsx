import { requireNativeView, requireOptionalNativeModule } from 'expo';
import { Chip } from 'heroui-native/chip';
import { useEffect, useReducer } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

import type { ObservationVideoPlayerProps } from '@/domain/observations/observationVideo';
import { layoutTokens } from '@/shared/theme/tokens';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppLoading } from '@/shared/ui/AppLoading';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppSelect } from '@/shared/ui/AppSelect';
import { AppText } from '@/shared/ui/AppText';

import { VideoPlaybackControls } from './VideoPlaybackControls';
import { createVideoPlayback, formatVideoTime, reduceVideoPlayback } from './videoPlayback';

interface NativeVideoProps extends ViewProps {
  readonly source: string;
  readonly active: boolean;
  readonly playing: boolean;
  readonly seekPositionMs: number;
  readonly seekRequestId: number;
  readonly onPlaybackStatus: (event: NativeSyntheticEvent<unknown>) => void;
}

const module =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<{ observationPlaybackVersion?: () => number }>('PatientStore')
    : null;
const NativePlayer =
  module?.observationPlaybackVersion?.() === 1
    ? requireNativeView<NativeVideoProps>('PatientStore')
    : null;

export function ObservationVideoPlayer(props: ObservationVideoPlayerProps) {
  // 切换记录时重置播放器，旧片段事件不能进入新记录。
  return <VideoPlayback key={props.video.segments[0]?.uri} {...props} />;
}

function VideoPlayback({ video, isActive }: ObservationVideoPlayerProps) {
  const [state, dispatch] = useReducer(
    reduceVideoPlayback,
    video.segments.map((segment) => segment.durationMs),
    createVideoPlayback,
  );
  useEffect(() => {
    if (!isActive) dispatch({ type: 'inactive' });
  }, [isActive]);

  if (!NativePlayer) {
    return (
      <AppCard>
        <AppNotice isInline status="warning">
          请重新构建并安装应用，加载新版视频播放器。
        </AppNotice>
      </AppCard>
    );
  }
  const segment = video.segments[state.segmentIndex];
  if (!segment) return <AppText>此记录没有可播放的视频片段。</AppText>;
  const positionMs = state.scrub?.positionMs ?? state.positionMs;
  const isLoading = state.status === 'loading';
  const hasError = state.status === 'error';
  return (
    <View className="gap-3">
      <View
        className="w-full overflow-hidden rounded-[24px] bg-black"
        style={{ aspectRatio: layoutTokens.videoAspectRatio }}
      >
        <NativePlayer
          key={state.generation}
          source={segment.uri}
          active={isActive}
          playing={isActive && state.isPlaying}
          seekPositionMs={state.seekPositionMs}
          seekRequestId={state.seekRequestId}
          onPlaybackStatus={(event) => {
            if (isActive) {
              dispatch({
                type: 'status',
                generation: state.generation,
                value: event.nativeEvent,
              });
            }
          }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessible={false}
        />
        <Chip
          pointerEvents="none"
          accessibilityRole="text"
          size="sm"
          variant="secondary"
          background={null}
          className="absolute left-4 top-4 max-w-full bg-black/50 px-3 py-1"
        >
          <Chip.Label className="text-xs font-normal leading-[18px] text-white">
            原始视频
          </Chip.Label>
        </Chip>
        <View className="absolute bottom-0 left-0 right-0">
          <VideoPlaybackControls
            positionMs={positionMs}
            durationMs={state.durationMs}
            isPlaying={state.isPlaying || (state.scrub?.shouldResume ?? false)}
            isEnded={state.status === 'ended'}
            isDisabled={!isActive || isLoading || hasError || state.isSeeking}
            onToggle={() => dispatch({ type: 'toggle' })}
            onScrub={(value) => dispatch({ type: 'scrub', positionMs: value })}
            onSeek={(value) => dispatch({ type: 'seek', positionMs: value })}
          />
        </View>
        {isLoading || hasError ? (
          <View className="absolute inset-0 items-center justify-center gap-3 bg-black/70 p-4">
            {hasError ? (
              <>
                <AppText accessibilityRole="alert" className="text-center text-white">
                  此片段暂时无法播放
                </AppText>
                <AppButton variant="secondary" onPress={() => dispatch({ type: 'retry' })}>
                  重试播放
                </AppButton>
              </>
            ) : (
              <AppLoading isInverse>正在加载视频…</AppLoading>
            )}
          </View>
        ) : null}
      </View>
      {video.segments.length > 1 ? (
        <AppSelect
          label="视频片段"
          description="按录制顺序自动接播。"
          value={state.segmentIndex.toString()}
          options={video.segments.map((item, index) => ({
            value: index.toString(),
            label: `第 ${index + 1} / ${video.segments.length} 段 · ${formatVideoTime(item.durationMs)}`,
          }))}
          onChange={(value) => dispatch({ type: 'select', index: Number(value) })}
          isDisabled={!isActive}
        />
      ) : null}
    </View>
  );
}
