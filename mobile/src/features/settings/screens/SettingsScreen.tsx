import { Fragment } from 'react';
import { View } from 'react-native';

import { AppHeader } from '@/shared/ui/AppHeader';
import { AppCardStack } from '@/shared/ui/AppCardStack';
import { AppListGroup, AppListItem, AppListSeparator } from '@/shared/ui/AppListGroup';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

interface SettingsScreenProps {
  readonly onOpenCaptureSettings: () => void;
  readonly onOpenStorage: () => void;
  readonly onOpenAbout: () => void;
}

export function SettingsScreen({
  onOpenCaptureSettings,
  onOpenStorage,
  onOpenAbout,
}: SettingsScreenProps) {
  const actions = [
    {
      title: '采集与模型',
      description: '采集偏好、模型与协议说明',
      onPress: onOpenCaptureSettings,
    },
    { title: '本地数据', description: '患者档案、观察记录与文件管理', onPress: onOpenStorage },
    { title: '关于康复观察', description: '使用范围与隐私说明', onPress: onOpenAbout },
  ];

  return (
    <ScreenLayout header={<AppHeader title="设置" />}>
      <View className="gap-2">
        <AppText accessibilityRole="header" variant="title">
          设备与数据
        </AppText>
        <AppText className="text-muted" variant="caption">
          PostureAssist V2 · 本地康复观察
        </AppText>
      </View>
      <AppCardStack>
        <AppListGroup>
          {actions.map((action, index) => (
            <Fragment key={action.title}>
              {index > 0 ? <AppListSeparator /> : null}
              <AppListItem
                title={action.title}
                description={action.description}
                onPress={action.onPress}
              />
            </Fragment>
          ))}
        </AppListGroup>
        <AppListGroup>
          <AppListItem
            title="原始视频保存在本机"
            description="已支持任务会录制无声视频，随报告和关键点保存，可在记录详情中回放。"
          />
          <AppListSeparator />
          <AppListItem
            title="数据保存在这台手机"
            description="可从本地数据页导出或删除资料。卸载应用或清除应用数据会移除本机资料。"
          />
        </AppListGroup>
      </AppCardStack>
    </ScreenLayout>
  );
}
