import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppCard } from '@/shared/ui/AppCard';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

interface SettingsScreenProps {
  readonly isDesignPreview: boolean;
  readonly onOpenCaptureSettings: () => void;
  readonly onOpenStorage: () => void;
  readonly onOpenAbout: () => void;
}

export function SettingsScreen({
  isDesignPreview,
  onOpenCaptureSettings,
  onOpenStorage,
  onOpenAbout,
}: SettingsScreenProps) {
  const theme = useAppTheme();
  const actions = [
    {
      title: '采集与模型',
      description: '模型、协议与采集质量说明',
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
      <View className="gap-3">
        {actions.map((action) => (
          <Pressable accessibilityRole="button" key={action.title} onPress={action.onPress}>
            <AppCard className="min-h-[80px] flex-row items-center gap-3 p-4">
              <View className="flex-1 gap-1">
                <AppText className="font-medium">{action.title}</AppText>
                <AppText className="text-muted" variant="caption">
                  {action.description}
                </AppText>
              </View>
              <ChevronRight color={theme.muted} size={20} />
            </AppCard>
          </Pressable>
        ))}
      </View>
      <AppCard className="gap-2">
        <AppText className="font-medium">原始视频默认不留存</AppText>
        <AppText className="text-muted" variant="caption">
          后续每次采集可单独选择是否保留视频。
        </AppText>
      </AppCard>
      <View className="gap-2 rounded-xl bg-surface-secondary p-4">
        <AppText variant="caption">数据保存在这台手机</AppText>
        <AppText className="text-muted" variant="caption">
          卸载应用可能移除本机资料。需要转移数据时，请主动导出并妥善保管。
        </AppText>
      </View>
      {isDesignPreview ? (
        <AppText className="text-muted" variant="caption">
          当前为设计预览，样例不会保存为真实患者资料。
        </AppText>
      ) : null}
    </ScreenLayout>
  );
}
