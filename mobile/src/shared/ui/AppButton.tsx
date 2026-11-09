import { Button } from 'heroui-native/button';
import type { ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

export function AppButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button {...props} className={twMerge('min-h-[52px] rounded-full', className)} />;
}
