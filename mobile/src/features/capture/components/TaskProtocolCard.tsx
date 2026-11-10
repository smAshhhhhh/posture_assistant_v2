import { View } from 'react-native';

import type { TaskProtocol } from '@/domain/tasks/taskProtocol';
import { AppAccordion } from '@/shared/ui/AppAccordion';
import { AppText } from '@/shared/ui/AppText';

export function TaskProtocolCard({ protocol }: { readonly protocol: TaskProtocol }) {
  const sections = [
    { label: '动作步骤', lines: protocol.movementInstructions },
    { label: '拍摄要求', lines: protocol.cameraRequirements },
    { label: '辅助与支撑', lines: protocol.assistanceRules },
    { label: '现场观察', lines: protocol.compensationRules },
  ];
  return (
    <AppAccordion
      items={[
        {
          id: 'guidance',
          title: '动作指导',
          summary: `起始姿势：${protocol.startPosition}`,
          content: (
            <View className="gap-4">
              {sections.map((section) => (
                <View key={section.label} className="gap-2">
                  <AppText className="font-medium">{section.label}</AppText>
                  {section.lines.map((line) => (
                    <AppText key={line} className="text-muted">
                      {line}
                    </AppText>
                  ))}
                </View>
              ))}
              <AppText variant="caption" className="text-muted">
                {protocol.interpretation}
              </AppText>
            </View>
          ),
        },
      ]}
    />
  );
}
