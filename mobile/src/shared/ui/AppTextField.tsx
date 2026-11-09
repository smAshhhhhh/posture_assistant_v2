import { Input } from 'heroui-native/input';
import type { ComponentProps, ComponentRef } from 'react';
import { useRef } from 'react';
import { twMerge } from 'tailwind-merge';

import { AppField } from './AppField';
import type { AppFieldProps } from './AppField';

interface AppTextFieldProps
  extends
    Omit<ComponentProps<typeof Input>, 'children' | 'isInvalid' | 'isDisabled'>,
    AppFieldProps {}

export function AppTextField({
  label,
  description,
  error,
  isRequired = false,
  isDisabled = false,
  editable = true,
  multiline = false,
  className,
  ...inputProps
}: AppTextFieldProps) {
  const input = useRef<ComponentRef<typeof Input>>(null);
  const isFieldDisabled = isDisabled || !editable;

  return (
    <AppField
      label={label}
      description={description}
      error={error}
      isRequired={isRequired}
      isDisabled={isFieldDisabled}
      onLabelPress={() => input.current?.focus()}
    >
      {(accessibilityProps) => (
        <Input
          {...inputProps}
          {...accessibilityProps}
          ref={input}
          editable={!isFieldDisabled}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          className={twMerge(
            'min-h-[52px] rounded-xl px-4',
            multiline ? 'min-h-28 py-3' : undefined,
            className,
          )}
        />
      )}
    </AppField>
  );
}
