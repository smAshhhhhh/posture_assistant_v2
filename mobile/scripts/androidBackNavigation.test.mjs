import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';

import { CommonActions, StackRouter, TabRouter } from '@react-navigation/routers';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { getConfig } = require('expo/config');
const { AndroidConfig } = require('expo/config-plugins');

const tabSource = ts.createSourceFile(
  'MainTabs.tsx',
  await readFile('src/app/navigation/MainTabs.tsx', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function readTabOption(name) {
  let value;
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(tabSource) === 'Tab.Navigator') {
      const attribute = node.attributes.properties.find(
        (item) => ts.isJsxAttribute(item) && item.name.getText(tabSource) === name,
      );
      if (attribute && ts.isStringLiteral(attribute.initializer)) {
        value = attribute.initializer.text;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tabSource);
  assert.ok(value, `缺少导航选项 ${name}`);
  return value;
}

test('底部栏目按实际访问顺序返回，历史耗尽后交给系统', () => {
  const options = {
    routeNames: ['Capture', 'Patients', 'History', 'Settings'],
    routeParamList: {},
    routeGetIdList: {},
  };
  const router = TabRouter({
    initialRouteName: readTabOption('initialRouteName'),
    backBehavior: readTabOption('backBehavior'),
  });
  let state = router.getInitialState(options);
  for (const name of ['Patients', 'History', 'Settings']) {
    state = router.getStateForAction(state, CommonActions.navigate(name), options);
    assert.ok(state);
  }
  for (const name of ['History', 'Patients', 'Capture']) {
    state = router.getStateForAction(state, CommonActions.goBack(), options);
    assert.ok(state);
    assert.equal(state.routes[state.index].name, name);
  }
  assert.equal(router.getStateForAction(state, CommonActions.goBack(), options), null);
});

test('患者详情和编辑页逐层返回，到根页面后才交给系统', () => {
  const router = StackRouter({ initialRouteName: 'Main' });
  const options = {
    routeNames: ['Main', 'PatientProfile', 'PatientForm'],
    routeParamList: {},
    routeGetIdList: {},
  };
  let state = router.getInitialState(options);
  for (const name of ['PatientProfile', 'PatientForm']) {
    state = router.getStateForAction(state, CommonActions.navigate(name), options);
    assert.ok(state);
  }
  for (const name of ['PatientProfile', 'Main']) {
    state = router.getStateForAction(state, CommonActions.goBack(), options);
    assert.ok(state);
    assert.equal(state.routes[state.index].name, name);
  }
  assert.equal(router.getStateForAction(state, CommonActions.goBack(), options), null);
});

test('Prebuild 将旧预测返回配置迁移为导航兼容模式，保留权限与应用属性', () => {
  const { exp } = getConfig(process.cwd());
  const manifest = {
    manifest: {
      'uses-permission': [{ $: { 'android:name': 'android.permission.CAMERA' } }],
      application: [
        {
          $: {
            'android:name': '.MainApplication',
            'android:allowBackup': 'false',
            'android:enableOnBackInvokedCallback': 'true',
          },
        },
      ],
    },
  };
  const migrated = AndroidConfig.PredictiveBackGesture.setPredictiveBackGesture(exp, manifest);
  assert.equal(
    AndroidConfig.Manifest.getMainApplicationOrThrow(migrated).$[
      'android:enableOnBackInvokedCallback'
    ],
    'false',
  );
  assert.equal(migrated.manifest.application[0].$['android:allowBackup'], 'false');
  assert.equal(
    migrated.manifest['uses-permission'][0].$['android:name'],
    'android.permission.CAMERA',
  );
  const snapshot = structuredClone(migrated);
  assert.deepEqual(
    AndroidConfig.PredictiveBackGesture.setPredictiveBackGesture(exp, migrated),
    snapshot,
  );
});
