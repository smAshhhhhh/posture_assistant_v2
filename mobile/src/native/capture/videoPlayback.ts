export type PlaybackStatus = 'loading' | 'playing' | 'paused' | 'ended' | 'error';

interface PlaybackEvent {
  readonly status: PlaybackStatus;
  readonly positionMs: number;
  readonly durationMs: number;
  readonly seekRequestId: number;
}

export interface VideoPlaybackState extends PlaybackEvent {
  readonly segmentIndex: number;
  readonly generation: number;
  readonly isPlaying: boolean;
  readonly scrub: { readonly positionMs: number; readonly shouldResume: boolean } | null;
  readonly seekPositionMs: number;
  readonly isSeeking: boolean;
  readonly durations: readonly number[];
}

type PlaybackAction =
  | { readonly type: 'status'; readonly generation: number; readonly value: unknown }
  | { readonly type: 'toggle' }
  | { readonly type: 'scrub'; readonly positionMs: number }
  | { readonly type: 'seek'; readonly positionMs: number }
  | { readonly type: 'select'; readonly index: number }
  | { readonly type: 'inactive' }
  | { readonly type: 'retry' };

export function createVideoPlayback(durations: readonly number[]): VideoPlaybackState {
  return {
    durations,
    segmentIndex: 0,
    generation: 0,
    status: 'loading',
    positionMs: 0,
    durationMs: durations[0] ?? 0,
    isPlaying: false,
    scrub: null,
    seekPositionMs: 0,
    seekRequestId: 0,
    isSeeking: false,
  };
}

function parsePlaybackEvent(value: unknown): PlaybackEvent | null {
  if (typeof value !== 'object' || value === null) return null;
  if (!('status' in value) || !('positionMs' in value) || !('durationMs' in value)) return null;
  if (!('seekRequestId' in value)) return null;
  const { status, positionMs, durationMs, seekRequestId } = value;
  if (
    status !== 'loading' &&
    status !== 'playing' &&
    status !== 'paused' &&
    status !== 'ended' &&
    status !== 'error'
  ) {
    return null;
  }
  if (
    typeof positionMs !== 'number' ||
    !Number.isSafeInteger(positionMs) ||
    positionMs < 0 ||
    typeof durationMs !== 'number' ||
    !Number.isSafeInteger(durationMs) ||
    durationMs < 0 ||
    typeof seekRequestId !== 'number' ||
    !Number.isSafeInteger(seekRequestId) ||
    seekRequestId < 0
  ) {
    return null;
  }
  return { status, positionMs: Math.min(positionMs, durationMs), durationMs, seekRequestId };
}

function selectSegment(state: VideoPlaybackState, index: number): VideoPlaybackState {
  if (!Number.isInteger(index) || index < 0 || index >= state.durations.length) return state;
  return {
    ...createVideoPlayback(state.durations),
    segmentIndex: index,
    durationMs: state.durations[index] ?? 0,
    generation: state.generation + 1,
    isPlaying: state.isPlaying,
  };
}

function seek(state: VideoPlaybackState, positionMs: number): VideoPlaybackState {
  if (!Number.isFinite(positionMs)) return state;
  const target = Math.round(Math.max(0, Math.min(positionMs, state.durationMs - 1)));
  return {
    ...state,
    status: 'paused',
    positionMs: target,
    seekPositionMs: target,
    seekRequestId: state.seekRequestId + 1,
    isSeeking: true,
    isPlaying: state.scrub?.shouldResume ?? state.isPlaying,
    scrub: null,
  };
}

export function reduceVideoPlayback(
  state: VideoPlaybackState,
  action: PlaybackAction,
): VideoPlaybackState {
  switch (action.type) {
    case 'inactive':
      return { ...state, isPlaying: false, scrub: null };
    case 'retry':
      return { ...selectSegment(state, state.segmentIndex), isPlaying: false };
    case 'select':
      return action.index === state.segmentIndex ? state : selectSegment(state, action.index);
    case 'toggle':
      if (state.status === 'loading' || state.status === 'error' || state.isSeeking) return state;
      if (state.status === 'ended') return { ...seek(state, 0), isPlaying: true };
      return { ...state, isPlaying: !state.isPlaying };
    case 'scrub':
      if (state.status === 'loading' || state.status === 'error' || state.isSeeking) return state;
      if (!Number.isFinite(action.positionMs)) return state;
      return {
        ...state,
        isPlaying: false,
        scrub: {
          positionMs: Math.max(0, Math.min(action.positionMs, state.durationMs)),
          shouldResume: state.scrub?.shouldResume ?? state.isPlaying,
        },
      };
    case 'seek':
      if (state.status === 'loading' || state.status === 'error' || state.isSeeking) return state;
      return seek(state, action.positionMs);
    case 'status': {
      if (action.generation !== state.generation) return state;
      const event = parsePlaybackEvent(action.value);
      if (!event) return state;
      if (event.status === 'error') {
        return { ...state, status: 'error', isPlaying: false, scrub: null, isSeeking: false };
      }
      // 拖动和定位期间忽略旧进度，避免滑块回跳或误接播。
      if (state.scrub || event.seekRequestId < state.seekRequestId) return state;
      if (event.status === 'ended' && state.isPlaying) {
        if (state.segmentIndex + 1 < state.durations.length) {
          return selectSegment(state, state.segmentIndex + 1);
        }
      }
      return {
        ...state,
        ...event,
        isSeeking: false,
        isPlaying: event.status === 'ended' ? false : state.isPlaying,
      };
    }
  }
}

export function formatVideoTime(timeMs: number): string {
  const seconds = Math.floor(Math.max(0, timeMs) / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
