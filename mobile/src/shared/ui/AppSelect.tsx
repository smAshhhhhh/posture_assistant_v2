import { Select } from 'heroui-native/select';
import { useRef } from 'react';
import type { ComponentRef, ReactNode } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../theme/useAppTheme';

import { AppField } from './AppField';
import type { AppFieldProps } from './AppField';

interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly endContent?: ReactNode;
  readonly accessibilityLabel?: string;
}

interface AppSelectProps extends AppFieldProps {
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
}

export function AppSelect({
  label,
  description,
  error,
  isRequired = false,
  value,
  options,
  onChange,
  isDisabled = false,
}: AppSelectProps) {
  const theme = useAppTheme();
  const trigger = useRef<ComponentRef<typeof Select.Trigger>>(null);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = Math.max(96, Math.min(360, height - insets.top - insets.bottom - 180));
  return (
    <AppField
      label={label}
      description={description}
      error={error}
      isRequired={isRequired}
      isDisabled={isDisabled}
      onLabelPress={() => trigger.current?.focus()}
    >
      {(accessibilityProps) => (
        <Select
          value={options.find((option) => option.value === value)}
          onValueChange={(option) => {
            if (option) onChange(option.value);
          }}
          isDisabled={isDisabled}
          presentation="popover"
        >
          <Select.Trigger
            {...accessibilityProps}
            ref={trigger}
            className="min-h-[52px] rounded-xl bg-field px-4"
            style={error ? { borderWidth: 1, borderColor: theme.danger } : undefined}
          >
            <Select.Value placeholder="请选择" />
            <Select.TriggerIndicator />
          </Select.Trigger>
          <Select.Portal>
            <Select.Overlay />
            <Select.Content
              presentation="popover"
              width="trigger"
              placement="bottom"
              align="start"
              offset={8}
              insets={{
                top: insets.top + 16,
                bottom: insets.bottom + 16,
                left: insets.left + 16,
                right: insets.right + 16,
              }}
              className="rounded-[24px] bg-surface p-4"
              accessibilityLabel={label}
            >
              <ScrollView
                style={{ maxHeight }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {options.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    accessibilityLabel={option.accessibilityLabel ?? option.label}
                    className="min-h-12 gap-3 px-0"
                  >
                    <Select.ItemLabel className="min-w-0 flex-1 shrink" />
                    <Select.ItemIndicator />
                    {option.endContent}
                  </Select.Item>
                ))}
              </ScrollView>
            </Select.Content>
          </Select.Portal>
        </Select>
      )}
    </AppField>
  );
}
