import { Typography } from 'heroui-native/text';
import type { TypographyRootProps, TypographyType } from 'heroui-native/text';
import { twMerge } from 'tailwind-merge';

type TextVariant = 'title' | 'section' | 'body' | 'caption' | 'meta';

interface AppTextProps extends Omit<TypographyRootProps, 'type'> {
  readonly variant?: TextVariant;
}

const variantClasses: Record<TextVariant, string> = {
  title: 'text-[26px] leading-[38px] font-semibold tracking-normal',
  section: 'text-lg leading-7 font-semibold tracking-normal',
  body: 'text-base leading-6',
  caption: 'text-sm leading-[22px]',
  meta: 'text-xs leading-[18px]',
};

const variantTypes: Record<TextVariant, TypographyType> = {
  title: 'h3',
  section: 'h5',
  body: 'body',
  caption: 'body-sm',
  meta: 'body-xs',
};

export function AppText({ variant = 'body', className, style, ...props }: AppTextProps) {
  return (
    <Typography
      {...props}
      type={variantTypes[variant]}
      className={twMerge('text-foreground', variantClasses[variant], className)}
      style={[{ fontVariant: ['tabular-nums'] }, style]}
    />
  );
}
