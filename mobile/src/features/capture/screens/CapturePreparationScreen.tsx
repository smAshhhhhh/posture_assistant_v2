import { Camera, Circle } from 'lucide-react-native';
import { View } from 'react-native';

import type { CameraPermissionGateway } from '@/domain/capture/cameraPermission';
import { affectedSideLabels } from '@/domain/patients/types';
import type { PatientSummary } from '@/domain/patients/types';
import type { RehabTask } from '@/domain/tasks/taskCatalog';
import { getTaskInstructions } from '@/domain/tasks/taskInstructions';
import { useAppTheme } from '@/shared/theme/useAppTheme';
import { AppButton } from '@/shared/ui/AppButton';
import { AppCard } from '@/shared/ui/AppCard';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppText } from '@/shared/ui/AppText';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

import { CameraPermissionCard } from '../components/CameraPermissionCard';
import { useCameraPermission } from '../hooks/useCameraPermission';

interface CapturePreparationScreenProps {
  readonly patient: PatientSummary;
  readonly task: RehabTask;
  readonly permissionGateway: CameraPermissionGateway;
  readonly onBack: () => void;
}

export function CapturePreparationScreen({
  patient,
  task,
  permissionGateway,
  onBack,
}: CapturePreparationScreenProps) {
  const theme = useAppTheme();
  const camera = useCameraPermission(permissionGateway);
  const instructions = getTaskInstructions(task.id, patient.affectedSide);

  return (
    <ScreenLayout hasTabBar={false} header={<AppHeader onBack={onBack} title="采集准备" />}>
      <AppText className="text-muted">
        {task.name} · {patient.patientCode} · {affectedSideLabels[patient.affectedSide]}
      </AppText>
      <AppCard className="min-h-[200px] items-center justify-center gap-3">
        <Camera color={theme.muted} size={32} />
        <AppText className="font-medium">相机画面尚未接入</AppText>
        <AppText className="text-muted text-center" variant="caption">
          完成相机与姿态模型接入后，在这里检查真实画面和关键关节。
        </AppText>
      </AppCard>
      <AppText>{instructions.framing}</AppText>
      <CameraPermissionCard
        error={camera.error}
        isBusy={camera.isBusy}
        onOpenSettings={() => void camera.openSettings()}
        onRequest={() => void camera.request()}
        permission={camera.permission}
      />
      <View className="gap-4">
        <AppText variant="section">开始条件</AppText>
        {['关键关节 · 等待真实识别', '机位 · 等待画面检查'].map((label) => (
          <View className="flex-row items-center gap-3" key={label}>
            <Circle color={theme.muted} size={18} />
            <AppText className="flex-1">{label}</AppText>
          </View>
        ))}
      </View>
      <AppCard className="gap-2">
        <AppText className="font-medium">保留原始视频 · 关闭</AppText>
        <AppText className="text-muted" variant="caption">
          当前不会录制或保存原始视频。辅助方式将在实际采集前确认。
        </AppText>
      </AppCard>
      <View className="gap-3">
        <AppButton className="rounded-xl" isDisabled>
          开始采集
        </AppButton>
        <AppText className="text-muted" variant="caption">
          相机与离线姿态模型尚未就绪，暂不能开始采集。
        </AppText>
      </View>
    </ScreenLayout>
  );
}
