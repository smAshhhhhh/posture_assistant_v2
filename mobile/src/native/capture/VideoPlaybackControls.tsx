import { Button } from 'heroui-native/button';
import { Slider } from 'heroui-native/slider';
import { Pause, Play, RotateCcw } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';

import { formatVideoTime } from './videoPlayback';

interface VideoPlaybackControlsProps {
  readonly positionMs: number;
  readonly durationMs: number;
  readonly isPlaying: boolean;
  readonly isEnded: boolean;
  readonly isDisabled: boolean;
  readonly onToggle: () => void;
  readonly onScrub: (positionMs: number) => void;
  readonly onSeek: (positionMs: number) => void;
}

export function VideoPlaybackControls({
  positionMs,
  durationMs,
  isPlaying,
  isEnded,
  isDisabled,
  onToggle,
  onScrub,
  onSeek,
}: VideoPlaybackControlsProps) {
  const Icon = isPlaying ? Pause : isEnded ? RotateCcw : Play;
  const label = isPlaying ? '暂停视频' : isEnded ? '重播当前片段' : '播放视频';
  return (
    <View className="flex-row items-center gap-4 bg-black/60 p-4">
      <Button
        isIconOnly
        variant="secondary"
        className="min-h-12 min-w-12 rounded-full bg-white/15"
        accessibilityLabel={label}
        isDisabled={isDisabled}
        onPress={onToggle}
      >
        <Icon size={22} color="white" />
      </Button>
      <View className="min-w-0 flex-1">
        <Slider
          value={positionMs}
          minValue={0}
          maxValue={Math.max(1, durationMs)}
          step={1}
          isDisabled={isDisabled || durationMs === 0}
          onChange={(value) => onScrub(typeof value === 'number' ? value : (value[0] ?? 0))}
          onChangeEnd={(value) => onSeek(typeof value === 'number' ? value : (value[0] ?? 0))}
          aria-label="视频播放进度"
          className="min-h-12 justify-center"
        >
          <Slider.Track className="h-12 bg-transparent">
            <View
              pointerEvents="none"
              className="absolute left-0 right-0 h-1 rounded-full bg-white/25"
            />
            <Slider.Fill className="bg-white" style={{ top: 22, bottom: 22 }} />
            <Slider.Thumb
              classNames={{
                thumbContainer: 'h-4 w-4 rounded-full bg-white p-0',
                thumbKnob: 'rounded-full bg-white',
              }}
              hitSlop={16}
              accessibilityLabel="视频播放进度"
              accessibilityValue={{
                min: 0,
                max: Math.max(1, durationMs),
                now: positionMs,
                text: `${formatVideoTime(positionMs)}，共 ${formatVideoTime(durationMs)}`,
              }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(event) => {
                const delta = event.nativeEvent.actionName === 'increment' ? 5000 : -5000;
                if (!isDisabled) onSeek(positionMs + delta);
              }}
            />
          </Slider.Track>
        </Slider>
        <View className="flex-row flex-wrap justify-between gap-x-3">
          <AppText variant="meta" className="text-white/80">
            {formatVideoTime(positionMs)}
          </AppText>
          <AppText variant="meta" className="text-white/80">
            {formatVideoTime(durationMs)}
          </AppText>
        </View>
      </View>
    </View>
  );
}
