import { Alert } from 'heroui-native/alert';
import type { ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

interface AppNoticeProps {
  readonly children: string;
  readonly status?: ComponentProps<typeof Alert>['status'];
  readonly className?: string;
  readonly isInline?: boolean;
}

export function AppNotice({
  children,
  status = 'danger',
  className,
  isInline = false,
}: AppNoticeProps) {
  return (
    <Alert
      status={status}
      accessibilityLiveRegion={status === 'danger' ? 'assertive' : 'polite'}
      background={isInline ? null : undefined}
      className={twMerge(
        'items-start rounded-[24px] p-4 shadow-none',
        isInline && 'rounded-none bg-transparent p-0',
        className,
      )}
    >
      <Alert.Indicator />
      <Alert.Content className="min-w-0">
        <Alert.Title className="text-base font-normal leading-6">{children}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}
