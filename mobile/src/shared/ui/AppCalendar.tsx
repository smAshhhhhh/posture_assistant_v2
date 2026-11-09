import { useThemeColor } from 'heroui-native/hooks';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import DateTimePicker, { useDefaultStyles } from 'react-native-ui-datepicker';

import {
  getCalendarInitialDate,
  isCalendarDateInRange,
  parseCalendarDate,
  readCalendarSelection,
} from '@/shared/lib/calendarDate';
import { useAppTheme } from '@/shared/theme/useAppTheme';

interface AppCalendarProps {
  readonly value: string;
  readonly minimumDate: string;
  readonly maximumDate: string;
  readonly onChange: (value: string) => void;
}

export function AppCalendar({ value, minimumDate, maximumDate, onChange }: AppCalendarProps) {
  const theme = useAppTheme();
  const accentForeground = useThemeColor('accent-foreground');
  const defaultStyles = useDefaultStyles('light');
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(48, Math.ceil(30 * fontScale));
  const weekdaysHeight = Math.max(32, Math.ceil(22 * fontScale));
  const calendarHeight = weekdaysHeight + rowHeight * 6;
  const [initialDate] = useState(() => getCalendarInitialDate(value, minimumDate, maximumDate));
  const year = Number(initialDate.slice(0, 4));
  const month = Number(initialDate.slice(5, 7)) - 1;
  // 日历内部始终保留有效锚点，空表单只隐藏选中样式，不传入空日期。
  const selected = useMemo(() => parseCalendarDate(value || initialDate), [initialDate, value]);
  const minimum = useMemo(() => parseCalendarDate(minimumDate), [minimumDate]);
  const maximum = useMemo(() => parseCalendarDate(maximumDate), [maximumDate]);

  return (
    <DateTimePicker
      mode="single"
      calendar="gregory"
      locale="zh"
      firstDayOfWeek={1}
      date={selected}
      minDate={minimum}
      maxDate={maximum}
      year={year}
      month={month}
      containerHeight={calendarHeight}
      weekdaysHeight={weekdaysHeight}
      style={{ width: '100%', flexShrink: 0 }}
      onChange={({ date }) => {
        const next = readCalendarSelection(date);
        if (next && isCalendarDateInRange(next, minimumDate, maximumDate)) onChange(next);
      }}
      components={{
        IconPrev: <ChevronLeft color={theme.foreground} size={20} />,
        IconNext: <ChevronRight color={theme.foreground} size={20} />,
      }}
      styles={{
        ...defaultStyles,
        day_cell: { padding: 0 },
        day: { borderRadius: 12 },
        day_label: { color: theme.foreground, fontSize: 16 },
        today: { borderColor: theme.accent, borderWidth: 1 },
        today_label: { color: theme.accent },
        selected: value ? { backgroundColor: theme.accent, borderWidth: 0 } : {},
        selected_label: value ? { color: accentForeground } : {},
        month: { borderRadius: 12 },
        month_label: { color: theme.foreground, fontSize: 16 },
        year: { borderRadius: 12 },
        year_label: { color: theme.foreground, fontSize: 16 },
        selected_month: value ? { backgroundColor: theme.accent, borderColor: theme.accent } : {},
        selected_month_label: value ? { color: accentForeground } : {},
        selected_year: value ? { backgroundColor: theme.accent, borderColor: theme.accent } : {},
        selected_year_label: value ? { color: accentForeground } : {},
        active_year: { backgroundColor: theme.secondary, borderColor: theme.secondary },
        active_year_label: { color: theme.foreground },
        header: { marginBottom: 8 },
        month_selector: { minHeight: 48, minWidth: 48, justifyContent: 'center' },
        month_selector_label: { color: theme.foreground, fontSize: 16 },
        year_selector: { minHeight: 48, minWidth: 48 },
        year_selector_label: { color: theme.foreground, fontSize: 16 },
        weekday_label: { color: theme.muted, fontSize: 14 },
        disabled: { opacity: 0.35 },
        disabled_label: { color: theme.muted },
        button_prev: {
          minHeight: 48,
          minWidth: 48,
          alignItems: 'center',
          justifyContent: 'center',
        },
        button_next: {
          minHeight: 48,
          minWidth: 48,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}
    />
  );
}
