import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import ts from 'typescript';

const source = await readFile('src/features/capture/screens/CapturePreparationScreen.tsx', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;

function deferred() {
  let resolve;
  const promise = new Promise((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function createScreen(phase = 'capturing') {
  const calls = [];
  const slots = [];
  let cursor = 0;
  let effects = [];
  let confirmation;
  let backHandler;
  const gateway = {
    isAvailable: true,
    canRecord: true,
    canRecordVideo: true,
    finishRecording: async () => calls.push('read_report'),
    discardRecording: async () => calls.push('discard'),
  };
  const flow = {
    session: { phase },
    camera: {},
    isPreviewActive: false,
    isStarting: false,
    isReleasing: false,
    stop: async (action) => {
      calls.push(action);
      flow.session = { phase: action === 'finish' ? 'finished' : 'paused' };
      return true;
    },
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[index],
        (value) => {
          slots[index] = value;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo: (compute) => compute(),
    useEffect: (effect) => effects.push(effect),
  };
  const jsx = (type, props) => ({ type, props });
  const imports = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@react-navigation/native': {
      useIsFocused: () => true,
      usePreventRemove(enabled, handler) {
        backHandler = enabled ? handler : null;
      },
    },
    '@/domain/capture/captureFeedback': { getCaptureFeedback: () => ({}) },
    '@/domain/capture/requiredLandmarks': { getRequiredLandmarks: () => [] },
    '@/domain/patients/types': { affectedSideLabels: { left: '左侧' } },
    '@/domain/tasks/taskInstructions': { getTaskInstructions: () => ({}) },
    '@/shared/theme/tokens': { layoutTokens: { videoAspectRatio: 3 / 4 } },
    '@/shared/theme/useAppTheme': { useAppTheme: () => ({}) },
    '@/shared/ui/AppConfirmationProvider': {
      useConfirmAction: () => (options) => {
        confirmation = options;
      },
    },
    '../hooks/useCameraPermission': {
      useCameraPermission: () => ({ permission: 'granted' }),
    },
    '../hooks/useCaptureFlow': { useCaptureFlow: () => flow },
  };
  const components = new Proxy({}, { get: (_target, name) => name });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(
    (name) => imports[name] ?? components,
    module,
    module.exports,
  );

  return {
    calls,
    flow,
    gateway,
    render() {
      cursor = 0;
      effects = [];
      module.exports.CapturePreparationScreen({
        patient: { id: 'patient', patientCode: 'P001', affectedSide: 'left' },
        task: { id: 'elbow_flexion_extension', name: '肘关节屈伸' },
        preferences: { poseModel: 'lite' },
        poseGateway: gateway,
        onBack: () => calls.push('back'),
        onReview: () => calls.push('review'),
      });
      for (const effect of effects) effect();
    },
    requestBack() {
      assert.equal(typeof backHandler, 'function');
      backHandler();
      return confirmation;
    },
  };
}

test('采集中和暂停时返回，确认退出后清理数据并仅返回上一页', async () => {
  for (const phase of ['capturing', 'paused']) {
    const screen = createScreen(phase);
    screen.render();
    const confirmation = screen.requestBack();
    assert.equal(confirmation.confirmLabel, '退出观察');
    assert.deepEqual(screen.calls, []);
    confirmation.onConfirm();
    await new Promise(setImmediate);
    screen.render();
    screen.render();
    assert.deepEqual(screen.calls, ['pause', 'discard', 'back']);
  }
});

test('等录像停止后才清理，重复确认不能重复退出', async () => {
  const screen = createScreen();
  const stopped = deferred();
  const discarded = deferred();
  screen.flow.stop = () => {
    screen.calls.push('pause');
    return stopped.promise;
  };
  screen.gateway.discardRecording = () => {
    screen.calls.push('discard');
    return discarded.promise;
  };
  screen.render();
  const confirmation = screen.requestBack();
  confirmation.onConfirm();
  confirmation.onConfirm();
  assert.deepEqual(screen.calls, ['pause']);
  stopped.resolve(true);
  await new Promise(setImmediate);
  screen.render();
  assert.deepEqual(screen.calls, ['pause', 'discard']);
  discarded.resolve();
  await new Promise(setImmediate);
  screen.render();
  assert.deepEqual(screen.calls, ['pause', 'discard', 'back']);
});

test('相机释放失败不清理或跳转，重试成功后才退出', async () => {
  const screen = createScreen('paused');
  screen.flow.stop = async () => {
    screen.calls.push('release_failed');
    return false;
  };
  screen.render();
  screen.requestBack().onConfirm();
  await new Promise(setImmediate);
  screen.render();
  assert.deepEqual(screen.calls, ['release_failed']);
  screen.flow.stop = async () => true;
  screen.requestBack().onConfirm();
  await new Promise(setImmediate);
  screen.render();
  assert.deepEqual(screen.calls, ['release_failed', 'discard', 'back']);
});

test('清理失败保留当前页面，允许再次确认退出', async () => {
  const screen = createScreen();
  screen.gateway.discardRecording = async () => {
    screen.calls.push('discard_failed');
    throw new Error('清理失败');
  };
  screen.render();
  screen.requestBack().onConfirm();
  await new Promise(setImmediate);
  screen.render();
  assert.deepEqual(screen.calls, ['pause', 'discard_failed']);
  screen.gateway.discardRecording = async () => screen.calls.push('discard');
  screen.requestBack().onConfirm();
  await new Promise(setImmediate);
  screen.render();
  assert.deepEqual(screen.calls, ['pause', 'discard_failed', 'pause', 'discard', 'back']);
});
