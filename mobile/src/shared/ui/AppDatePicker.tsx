import { Button } from 'heroui-native/button';
import { Dialog } from 'heroui-native/dialog';
import { CalendarDays } from 'lucide-react-native';
import { useState } from 'react';
import { Keyboard, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isCalendarDateInRange, parseCalendarDate } from '@/shared/lib/calendarDate';
import { useAppTheme } from '@/shared/theme/useAppTheme';

import { AppCalendar } from './AppCalendar';
import { AppField } from './AppField';
import type { AppFieldProps } from './AppField';
import { AppText } from './AppText';

interface AppDatePickerProps extends AppFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly minimumDate?: string;
  readonly maximumDate?: string;
  readonly placeholder?: string;
}

export function AppDatePicker({
  label,
  description,
  isRequired = false,
  value,
  onChange,
  minimumDate = '1900-01-01',
  maximumDate = '9999-12-31',
  isDisabled = false,
  placeholder = '请选择日期',
  error,
}: AppDatePickerProps) {
  const theme = useAppTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const hasSelection = parseCalendarDate(value) !== null;

  const changeOpen = (next: boolean) => {
    if (next && isDisabled) return;
    if (next) Keyboard.dismiss();
    setIsOpen(next);
  };

  const selectDate = (next: string) => {
    if (isDisabled || !isCalendarDateInRange(next, minimumDate, maximumDate)) return;
    onChange(next);
    setIsOpen(false);
  };

  return (
    <AppField
      label={label}
      description={description}
      error={error}
      isRequired={isRequired}
      isDisabled={isDisabled}
      onLabelPress={() => changeOpen(true)}
    >
      {(accessibilityProps) => (
        <>
          <Button
            {...accessibilityProps}
            className="min-h-[52px] justify-start rounded-xl bg-field px-4"
            style={error ? { borderWidth: 1, borderColor: theme.danger } : undefined}
            variant="secondary"
            isDisabled={isDisabled}
            accessibilityValue={{ text: hasSelection ? value : placeholder }}
            accessibilityHint={error || description || '打开日历选择日期'}
            accessibilityState={{ disabled: isDisabled, expanded: isOpen }}
            onPress={() => changeOpen(true)}
          >
            <AppText className={hasSelection ? 'flex-1' : 'flex-1 text-muted'}>
              {hasSelection ? value : placeholder}
            </AppText>
            <CalendarDays color={theme.muted} size={20} accessible={false} />
          </Button>
          <Dialog isOpen={isOpen && !isDisabled} onOpenChange={changeOpen}>
            <Dialog.Portal
              className="px-4"
              style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
            >
              <Dialog.Overlay />
              <Dialog.Content
                accessibilityLabel={label}
                className="w-full max-w-[560px] self-center rounded-[24px] bg-surface p-4"
                isSwipeable={false}
              >
                <ScrollView
                  style={{ maxHeight: Math.max(96, height - insets.top - insets.bottom - 64) }}
                  contentContainerStyle={{ flexGrow: 1 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <AppCalendar
                    value={value}
                    minimumDate={minimumDate}
                    maximumDate={maximumDate}
                    onChange={selectDate}
                  />
                </ScrollView>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog>
        </>
      )}
    </AppField>
  );
}
