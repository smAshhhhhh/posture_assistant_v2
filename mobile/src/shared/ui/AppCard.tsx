import { Card } from 'heroui-native/card';
import type { ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

export function AppCard({ className, ...props }: ComponentProps<typeof Card>) {
  return <Card {...props} className={twMerge('rounded-[24px] p-5 shadow-none', className)} />;
}
