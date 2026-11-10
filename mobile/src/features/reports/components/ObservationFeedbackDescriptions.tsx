import { View } from 'react-native';

import type { ObservationFeedback } from '@/domain/observations/observationFeedback';
import { AppStatusDescription } from '@/shared/ui/AppStatusDescription';

interface ObservationFeedbackDescriptionsProps {
  readonly feedback: readonly ObservationFeedback[];
  readonly category: ObservationFeedback['category'];
}

export function ObservationFeedbackDescriptions({
  feedback,
  category,
}: ObservationFeedbackDescriptionsProps) {
  const descriptions = feedback.filter((item) => item.category === category);
  if (descriptions.length === 0) return null;

  return (
    <View className="gap-2">
      {descriptions.map((item) => (
        <AppStatusDescription key={item.code} severity={item.severity}>
          {item.message}
        </AppStatusDescription>
      ))}
    </View>
  );
}
