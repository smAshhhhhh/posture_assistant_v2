import { View } from 'react-native';

import { AppAvatar } from '@/shared/ui/AppAvatar';
import { AppButton } from '@/shared/ui/AppButton';
import { AppField } from '@/shared/ui/AppField';

interface PatientPhotoFieldProps {
  readonly patientCode: string;
  readonly photoUri: string | null;
  readonly isDisabled: boolean;
  readonly isChoosing: boolean;
  readonly error: string | null | undefined;
  readonly onChoose: () => void;
  readonly onRemove: () => void;
}

export function PatientPhotoField({
  patientCode,
  photoUri,
  isDisabled,
  isChoosing,
  error,
  onChoose,
  onRemove,
}: PatientPhotoFieldProps) {
  return (
    <AppField
      label="患者头像"
      description="选填，仅保存在本机；未选择照片时显示患者编号首字母。"
      error={error ?? undefined}
      isDisabled={isDisabled}
    >
      {() => (
        <View className="flex-row flex-wrap items-center gap-4">
          <AppAvatar label={patientCode} imageUri={photoUri} size="lg" />
          <AppButton isDisabled={isDisabled} variant="secondary" onPress={onChoose}>
            {isChoosing ? '正在选择…' : photoUri ? '更换照片' : '选择照片'}
          </AppButton>
          {photoUri ? (
            <AppButton isDisabled={isDisabled} variant="ghost" onPress={onRemove}>
              移除照片
            </AppButton>
          ) : null}
        </View>
      )}
    </AppField>
  );
}
