import { AppButton } from '@/shared/ui/AppButton';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppLoading } from '@/shared/ui/AppLoading';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ScreenLayout } from '@/shared/ui/ScreenLayout';

interface UnavailableScreenProps {
  readonly title: string;
  readonly description: string;
  readonly returnLabel: string;
  readonly onReturn: () => void;
  readonly onRetry?: (() => void) | undefined;
  readonly isLoading?: boolean;
}

export function UnavailableScreen({
  title,
  description,
  returnLabel,
  onReturn,
  onRetry,
  isLoading = false,
}: UnavailableScreenProps) {
  return (
    <ScreenLayout hasTabBar={false} header={<AppHeader title={title} onBack={onReturn} />}>
      {isLoading ? (
        <AppLoading>{title}</AppLoading>
      ) : (
        <EmptyState title={title} description={description} />
      )}
      {onRetry ? (
        <AppButton variant="secondary" onPress={onRetry}>
          重新读取
        </AppButton>
      ) : null}
      <AppButton onPress={onReturn}>{returnLabel}</AppButton>
    </ScreenLayout>
  );
}
