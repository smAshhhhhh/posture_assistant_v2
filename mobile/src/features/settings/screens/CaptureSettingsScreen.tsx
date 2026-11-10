import { Label } from 'heroui-native/label';
import { Radio } from 'heroui-native/radio';
import { RadioGroup } from 'heroui-native/radio-group';
import { Fragment } from 'react';
import { View } from 'react-native';

import type { AppPreferences } from '@/domain/settings/appPreferences';
import { isPoseModelId, poseModels } from '@/domain/capture/poseModel';
import { AppDescription } from '@/shared/ui/AppDescription';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppNotice } from '@/shared/ui/AppNotice';
import { AppListGroup, AppListSeparator, AppListSwitchItem } from '@/shared/ui/AppListGroup';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

interface CaptureSettingsScreenProps {
  readonly value: AppPreferences;
  readonly canSelectPoseModel: boolean;
  readonly isSaving: boolean;
  readonly error: string | null;
  readonly onChange: (value: AppPreferences) => Promise<boolean>;
  readonly onBack: () => void;
}

export function CaptureSettingsScreen({
  value,
  canSelectPoseModel,
  isSaving,
  error,
  onChange,
  onBack,
}: CaptureSettingsScreenProps) {
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
  return (
    <ScreenLayout hasTabBar={false} header={<AppHeader title="采集与模型" onBack={onBack} />}>
      <AppText variant="title">采集偏好</AppText>
      <AppListGroup>
        {fields.map((field, index) => (
          <Fragment key={field.key}>
            {index > 0 ? <AppListSeparator /> : null}
            <AppListSwitchItem
              title={field.label}
              description={field.description}
              isSelected={value[field.key]}
              isDisabled={isSaving}
              onChange={(next) => void onChange({ ...value, [field.key]: next })}
            />
          </Fragment>
        ))}
      </AppListGroup>
      <AppText variant="section">识别模型</AppText>
      <View className="gap-2">
        <RadioGroup
          accessibilityLabel="识别模型"
          className="gap-0"
          value={value.poseModel}
          isDisabled={isSaving || !canSelectPoseModel}
          onValueChange={(next) => {
            if (!isPoseModelId(next) || next === value.poseModel) return;
            void onChange({ ...value, poseModel: next });
          }}
        >
          <AppListGroup>
            {poseModels.map((model, index) => (
              <Fragment key={model.value}>
                {index > 0 ? <AppListSeparator /> : null}
                <RadioGroup.Item
                  value={model.value}
                  accessibilityLabel={model.label}
                  className="min-h-[52px] p-4"
                >
                  <Label className="min-w-0 flex-1 font-medium">{model.label}</Label>
                  <Radio />
                </RadioGroup.Item>
              </Fragment>
            ))}
          </AppListGroup>
        </RadioGroup>
        <AppDescription>
          Lite 速度优先，Full 兼顾精度与速度，Heavy 计算量更大，可能增加延迟和耗电。
        </AppDescription>
        {!canSelectPoseModel ? (
          <AppDescription>当前安装包仅支持 Lite，更新安装包后可选择全部模型。</AppDescription>
        ) : null}
      </View>
      {error ? <AppNotice>{error}</AppNotice> : null}
    </ScreenLayout>
  );
}
