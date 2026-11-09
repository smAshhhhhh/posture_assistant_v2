import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { AppButton } from '@/shared/ui/AppButton';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppListGroup, AppListItem, AppListSeparator } from '@/shared/ui/AppListGroup';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';
import { appVersion } from '@/shared/lib/appVersion';

import type { FeatureInfoTopic, RootStackParamList } from './types';

const topicContent: Record<
  FeatureInfoTopic,
  { title: string; description: string; detail: string }
> = {
  about: {
    title: '关于康复观察',
    description: '为患者记录康复动作，帮助治疗师观察运动表现。',
    detail:
      '本应用帮助记录动作观察，不替代治疗师的专业评估。患者资料、专业评估和已保存的关节观察保存在本机，已支持任务的无声原始视频随记录保存在本机并可回放。二维角度与工程阈值尚未经临床标定。',
  },
};

type FeatureInfoScreenProps = NativeStackScreenProps<RootStackParamList, 'FeatureInfo'>;

export function FeatureInfoScreen({ navigation, route }: FeatureInfoScreenProps) {
  const content = topicContent[route.params.topic];

  return (
    <ScreenLayout
      hasTabBar={false}
      header={<AppHeader onBack={navigation.goBack} title={content.title} />}
    >
      <View className="gap-2">
        <AppText accessibilityRole="header" variant="title">
          {content.title}
        </AppText>
        <AppText className="text-muted">{content.description}</AppText>
      </View>
      <AppListGroup>
        <AppListItem title="用途说明" description={content.detail} />
        <AppListSeparator />
        <AppListItem title="应用版本" description={`PostureAssist V2 · ${appVersion}`} />
        <AppListSeparator />
        <AppListItem
          title="隐私与数据"
          description="核心功能可离线使用，不自动上传患者资料。导出包含健康相关数据，文件未加密，请妥善保管；当前不支持导入或云同步。卸载应用或清除应用数据会移除本机资料，系统保存位置中的导出文件需自行删除。"
        />
      </AppListGroup>
      <AppButton onPress={navigation.goBack} variant="secondary">
        返回
      </AppButton>
    </ScreenLayout>
  );
}
