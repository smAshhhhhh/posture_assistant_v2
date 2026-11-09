import { Text } from 'react-native';
import type { TextProps } from 'react-native';
import { twMerge } from 'tailwind-merge';

type TextVariant = 'title' | 'section' | 'body' | 'caption' | 'meta';

interface AppTextProps extends TextProps {
  readonly variant?: TextVariant;
}

const variantClasses: Record<TextVariant, string> = {
  title: 'text-[26px] leading-[38px] font-semibold',
  section: 'text-lg leading-7 font-semibold',
  body: 'text-base leading-6',
  caption: 'text-sm leading-[22px]',
  meta: 'text-xs leading-[18px]',
};

export function AppText({ variant = 'body', className, style, ...props }: AppTextProps) {
  return (
    <Text
      {...props}
      className={twMerge('text-foreground', variantClasses[variant], className)}
      style={[{ fontVariant: ['tabular-nums'] }, style]}
    />
  );
}
