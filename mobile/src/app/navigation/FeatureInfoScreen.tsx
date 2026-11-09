import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

import type { FeatureInfoTopic, RootStackParamList } from './types';

const topicContent: Record<
  FeatureInfoTopic,
  { title: string; description: string; detail: string }
> = {
  about: {
    title: '关于康复观察',
    description: '为患者记录康复动作，帮助治疗师观察运动表现。',
    detail:
      '本应用不用于疾病诊断，不替代治疗师的专业评估。核心功能按纯本地方式建设，视频默认不留存，专业量表由人工录入。当前版本为工程基础阶段，相机、分析和持久化将分阶段接入。',
  },
  newPatient: {
    title: '建立患者档案',
    description: '患者档案功能将在本地数据阶段开放。',
    detail:
      '档案将包含患者编号、年龄、患侧和专业评定信息，并保存在本机。当前版本尚未接入数据库，因此不会显示虚假的保存成功。',
  },
  captureSettings: {
    title: '采集与模型',
    description: '相机与离线姿态模型将在下一阶段接入。',
    detail:
      '接入后可核对模型版本、相机方向和采集参数。采集质量与动作完成情况独立记录，遮挡或漏检不等于患者无法完成。',
  },
  storage: {
    title: '本地数据',
    description: '当前版本尚未启用患者数据持久化。',
    detail:
      '后续在这里管理真实的数据库、关键点文件和经授权留存的视频。存储占用由本机文件计算，导出和删除会明确显示对象及影响。',
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
      <AppCard>
        <AppText>{content.detail}</AppText>
      </AppCard>
      <AppButton onPress={navigation.goBack} variant="secondary">
        返回
      </AppButton>
    </ScreenLayout>
  );
}
