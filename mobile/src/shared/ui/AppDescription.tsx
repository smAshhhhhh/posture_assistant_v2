import { Description } from 'heroui-native/description';
import type { ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

export function AppDescription({ className, ...props }: ComponentProps<typeof Description>) {
  return <Description {...props} className={twMerge('px-4 text-[13px] leading-5', className)} />;
}
