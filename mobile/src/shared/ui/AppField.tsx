import { Description } from 'heroui-native/description';
import { FieldError } from 'heroui-native/field-error';
import { Label } from 'heroui-native/label';
import { TextField } from 'heroui-native/text-field';
import type { ReactNode } from 'react';
import { useId } from 'react';

export interface AppFieldProps {
  readonly label: string;
  readonly description?: string | undefined;
  readonly error?: string | undefined;
  readonly isRequired?: boolean;
  readonly isDisabled?: boolean;
}

interface FieldAccessibilityProps {
  readonly accessibilityLabel: string;
  readonly accessibilityLabelledBy: string;
  readonly accessibilityHint: string | undefined;
}

interface AppFieldLayoutProps extends AppFieldProps {
  readonly children: (props: FieldAccessibilityProps) => ReactNode;
  readonly onLabelPress?: () => void;
}

export function AppField({
  label,
  description,
  error,
  isRequired = false,
  isDisabled = false,
  children,
  onLabelPress,
}: AppFieldLayoutProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const accessibilityLabel = isRequired ? `${label}，必填` : label;

  return (
    <TextField
      className="gap-2"
      isRequired={isRequired}
      isInvalid={Boolean(error)}
      isDisabled={isDisabled}
    >
      <Label onPress={onLabelPress}>
        <Label.Text
          nativeID={labelId}
          accessibilityLabel={accessibilityLabel}
          classNames={{ asterisk: 'text-danger' }}
        >
          {label}
        </Label.Text>
      </Label>
      {children({
        accessibilityLabel,
        accessibilityLabelledBy: labelId,
        accessibilityHint: error || description,
      })}
      {description ? (
        <Description hideOnInvalid className="text-sm leading-[22px]">
          {description}
        </Description>
      ) : null}
      <FieldError
        textProps={{ accessibilityRole: 'alert', accessibilityLiveRegion: 'polite' }}
        classNames={{ text: 'text-sm leading-[22px]' }}
      >
        {error}
      </FieldError>
    </TextField>
  );
}
