import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { Fragment, useEffect, useRef, useState } from 'react';

import { defaultAppPreferences } from '@/domain/settings/appPreferences';
import type { AppPreferences } from '@/domain/settings/appPreferences';
import { AppButton } from '@/shared/ui/AppButton';
import { useConfirmAction } from '@/shared/ui/AppConfirmationProvider';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppNotice } from '@/shared/ui/AppNotice';
import {
  AppListGroup,
  AppListItem,
  AppListSeparator,
  AppListSwitchItem,
} from '@/shared/ui/AppListGroup';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

interface CaptureSettingsScreenProps {
  readonly value: AppPreferences;
  readonly error: string | null;
  readonly onSave: (value: AppPreferences) => Promise<boolean>;
  readonly onBack: () => void;
}

export function CaptureSettingsScreen({
  value,
  error,
  onSave,
  onBack,
}: CaptureSettingsScreenProps) {
  const confirmAction = useConfirmAction();
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigation = useNavigation();
  const saving = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  usePreventRemove(isSaving || dirty, ({ data }) => {
    if (isSaving) return;
    confirmAction({
      title: '放弃未保存的设置？',
      description: '已保存的偏好继续生效。',
      cancelLabel: '继续编辑',
      confirmLabel: '放弃更改',
      isDestructive: true,
      onConfirm: () => navigation.dispatch(data.action),
    });
  });
  const fields = [
    {
      key: 'showSkeleton',
      label: '显示骨架叠加',
      description: '只改变预览显示，关键点识别仍照常运行。',
    },
    {
      key: 'showCaptureHints',
      label: '显示动作和机位提示',
      description: '安全确认和异常提示始终显示。',
    },
    {
      key: 'defaultAssistance',
      label: '默认存在人工或器具辅助',
      description: '开始采集前仍可按本次实际情况调整。',
    },
  ] as const;
  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    setIsSaving(true);
    const success = await onSave(draft);
    saving.current = false;
    if (mounted.current) {
      setIsSaving(false);
      setSaved(success);
    }
  };
  return (
    <ScreenLayout
      hasTabBar={false}
      header={<AppHeader title="采集与模型" onBack={onBack} />}
      footer={
        <AppButton isDisabled={isSaving || !dirty} onPress={() => void save()}>
          {isSaving ? '正在保存…' : '保存设置'}
        </AppButton>
      }
    >
      <AppText variant="title">采集偏好</AppText>
      <AppListGroup>
        {fields.map((field, index) => (
          <Fragment key={field.key}>
            {index > 0 ? <AppListSeparator /> : null}
            <AppListSwitchItem
              title={field.label}
              description={field.description}
              isSelected={draft[field.key]}
              isDisabled={isSaving}
              onChange={(next) => {
                setSaved(false);
                setDraft((current) => ({ ...current, [field.key]: next }));
              }}
            />
          </Fragment>
        ))}
      </AppListGroup>
      <AppButton
        variant="secondary"
        isDisabled={isSaving}
        onPress={() => {
          setDraft(defaultAppPreferences);
          setSaved(false);
        }}
      >
        恢复默认设置
      </AppButton>
      {saved ? <AppNotice status="success">设置已保存，下次进入采集页生效。</AppNotice> : null}
      {error ? <AppNotice>{error}</AppNotice> : null}
      <AppText variant="section">当前模型与协议</AppText>
      <AppListGroup>
        <AppListItem title="采集相机" description="后置相机" />
        <AppListSeparator />
        <AppListItem title="姿态模型" description="Pose Landmarker Lite · float16 / 1" />
        <AppListSeparator />
        <AppListItem
          title="识别与记录参数"
          description="关键点置信度 0.5 · 时间平滑 100 ms · 记录最高 10 Hz"
        />
        <AppListSeparator />
        <AppListItem
          title="协议与保存说明"
          description="参数随协议固定，修改会影响历史可比性。已支持任务的无声原始视频随观察记录保存在本机；恢复默认只重置以上使用偏好。"
        />
      </AppListGroup>
    </ScreenLayout>
  );
}
