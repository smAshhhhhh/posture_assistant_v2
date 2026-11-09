import { Label } from 'heroui-native/label';
import { Radio } from 'heroui-native/radio';
import { RadioGroup } from 'heroui-native/radio-group';

import { AppField } from './AppField';
import type { AppFieldProps } from './AppField';

interface AppRadioGroupProps<T extends string> extends AppFieldProps {
  readonly value: T | null;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}

export function AppRadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  description,
  error,
  isRequired = false,
  isDisabled = false,
}: AppRadioGroupProps<T>) {
  return (
    <AppField
      label={label}
      description={description}
      error={error}
      isRequired={isRequired}
      isDisabled={isDisabled}
    >
      {(accessibilityProps) => (
        <RadioGroup
          {...accessibilityProps}
          className="gap-2"
          value={value ?? undefined}
          isDisabled={isDisabled}
          isInvalid={Boolean(error)}
          onValueChange={(next) => {
            const option = options.find((item) => item.value === next);
            if (option) onChange(option.value);
          }}
        >
          {options.map((option) => (
            <RadioGroup.Item
              key={option.value}
              value={option.value}
              accessibilityLabel={option.label}
              className="min-h-[52px] rounded-xl bg-field p-4"
            >
              <Label className="min-w-0 flex-1">{option.label}</Label>
              <Radio />
            </RadioGroup.Item>
          ))}
        </RadioGroup>
      )}
    </AppField>
  );
}
