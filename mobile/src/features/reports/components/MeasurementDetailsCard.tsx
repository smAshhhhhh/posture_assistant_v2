import { View } from 'react-native';

import type { MeasurementContext } from '@/domain/observations/measurementContext';
import { extractMotionMetrics } from '@/domain/observations/motionMetrics';
import type { TaskAnalysis } from '@/domain/observations/taskAnalysis';
import { AppAccordion } from '@/shared/ui/AppAccordion';
import { AppText } from '@/shared/ui/AppText';

interface MeasurementDetailsCardProps {
  readonly analysis: TaskAnalysis;
  readonly context?: MeasurementContext | undefined;
}

export function MeasurementDetailsCard({ analysis, context }: MeasurementDetailsCardProps) {
  const definitions =
    context?.metricDefinitions ?? extractMotionMetrics(analysis).map((item) => item.definition);
  return (
    <AppAccordion
      items={[
        {
          id: 'measurement',
          title: '测量说明',
          content: (
            <View className="gap-4">
              {definitions.map((definition) => (
                <View key={definition.id} className="gap-2">
                  <AppText className="font-medium">{definition.label}</AppText>
                  <AppText variant="caption" className="text-muted">
                    {definition.definition}
                  </AppText>
                </View>
              ))}
            </View>
          ),
        },
      ]}
    />
  );
}
