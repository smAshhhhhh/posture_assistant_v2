import { AppCard } from './AppCard';
import { AppText } from './AppText';

interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <AppCard className="gap-2">
      <AppText className="font-medium">{title}</AppText>
      <AppText className="text-muted" variant="caption">
        {description}
      </AppText>
    </AppCard>
  );
}
