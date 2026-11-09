import { ControlField } from 'heroui-native/control-field';
import { Label } from 'heroui-native/label';

import { AppCard } from '@/shared/ui/AppCard';

interface CaptureAssistanceCardProps {
  readonly hasAssistance: boolean;
  readonly isDisabled: boolean;
  readonly onChange: (hasAssistance: boolean) => void;
}

export function CaptureAssistanceCard({
  hasAssistance,
  isDisabled,
  onChange,
}: CaptureAssistanceCardProps) {
  return (
    <AppCard className="p-0">
      <ControlField
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hasAssistance }}
        className="min-h-14 gap-3 rounded-[24px] p-4"
        isSelected={hasAssistance}
        isDisabled={isDisabled}
        onSelectedChange={onChange}
      >
        <ControlField.Indicator variant="checkbox" />
        <Label className="flex-1 text-base">本次存在人工或器具辅助</Label>
      </ControlField>
    </AppCard>
  );
}
