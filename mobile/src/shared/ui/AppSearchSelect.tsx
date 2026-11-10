import { SearchField } from 'heroui-native/search-field';
import { Select } from 'heroui-native/select';
import type { ComponentRef, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppCard } from './AppCard';
import { AppField } from './AppField';
import { AppText } from './AppText';

export interface SearchSelectOption {
  readonly value: string;
  readonly label: string;
  readonly description: string;
  readonly triggerDescription?: string;
  readonly triggerDescriptionContent?: ReactNode;
  readonly startContent: ReactNode;
}

interface AppSearchSelectProps {
  readonly label: string;
  readonly searchLabel: string;
  readonly value: string | null;
  readonly options: readonly SearchSelectOption[];
  readonly fixedOptions?: readonly SearchSelectOption[];
  readonly placeholder: Omit<SearchSelectOption, 'value'>;
  readonly emptyContent: ReactNode;
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly onChange: (value: string) => void;
}

export function AppSearchSelect({
  label,
  searchLabel,
  value,
  options,
  fixedOptions = [],
  placeholder,
  emptyContent,
  isOpen,
  onOpenChange,
  onChange,
}: AppSearchSelectProps) {
  const selected = [...fixedOptions, ...options].find((option) => option.value === value);
  const displayed = selected ?? placeholder;
  const changeOpen = (next: boolean) => {
    if (!next) Keyboard.dismiss();
    onOpenChange(next);
  };

  return (
    <Select
      presentation="dialog"
      isOpen={isOpen}
      onOpenChange={changeOpen}
      value={selected ? { value: selected.value, label: selected.label } : undefined}
      onValueChange={(option) => {
        if (option) onChange(option.value);
      }}
    >
      <Select.Trigger
        variant="unstyled"
        className="rounded-[24px]"
        accessibilityLabel={
          selected
            ? `${label}，当前 ${selected.label}，${selected.triggerDescription ?? selected.description}`
            : label
        }
        accessibilityState={{ expanded: isOpen }}
      >
        <AppCard className="min-h-[82px] flex-row items-center gap-3">
          <View className="size-10 items-center justify-center">{displayed.startContent}</View>
          <View className="min-w-0 flex-1 gap-1">
            <AppText className="font-medium">{displayed.label}</AppText>
            {displayed.triggerDescriptionContent ?? (
              <AppText className="text-muted" variant="meta">
                {displayed.triggerDescription ?? displayed.description}
              </AppText>
            )}
          </View>
        </AppCard>
      </Select.Trigger>
      <Select.Portal>
        <Select.Overlay />
        <SearchSelectDialog
          label={label}
          searchLabel={searchLabel}
          options={options}
          fixedOptions={fixedOptions}
          emptyContent={emptyContent}
        />
      </Select.Portal>
    </Select>
  );
}

interface SearchSelectDialogProps {
  readonly label: string;
  readonly searchLabel: string;
  readonly options: readonly SearchSelectOption[];
  readonly fixedOptions: readonly SearchSelectOption[];
  readonly emptyContent: ReactNode;
}

function SearchSelectDialog({
  label,
  searchLabel,
  options,
  fixedOptions,
  emptyContent,
}: SearchSelectDialogProps) {
  const searchInput = useRef<ComponentRef<typeof SearchField.Input>>(null);
  const [search, setSearch] = useState('');
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const visibleBottom = Math.min(height, keyboardTop ?? height);
  const bottomPadding = Math.max(insets.bottom, height - visibleBottom) + 16;
  const dialogHeight = Math.min(480, height - insets.top - bottomPadding - 16);
  const query = search.normalize('NFKC').trim().toLowerCase();
  const filteredOptions = options.filter((option) =>
    option.label.normalize('NFKC').toLowerCase().includes(query),
  );

  useEffect(() => {
    // Portal 弹窗按键盘实际位置避让，保持结果列表可滚动。
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
      (event) => setKeyboardTop(event.endCoordinates.screenY),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardTop(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <Select.Content
      presentation="dialog"
      isSwipeable={false}
      accessibilityLabel={label}
      classNames={{ wrapper: 'px-4', content: 'gap-3 rounded-[24px] bg-surface p-4' }}
      styles={{
        wrapper: { paddingTop: insets.top + 16, paddingBottom: bottomPadding },
        content: { height: dialogHeight },
      }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Select.ListLabel className="flex-1 px-0 text-base">{label}</Select.ListLabel>
        <Select.Close
          variant="ghost"
          accessibilityLabel={`关闭${label}`}
          className="min-h-12 min-w-12"
        />
      </View>
      <AppField label={searchLabel} onLabelPress={() => searchInput.current?.focus()}>
        {(accessibilityProps) => (
          <SearchField value={search} onChange={setSearch}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                {...accessibilityProps}
                ref={searchInput}
                placeholder={searchLabel}
                className="min-h-[52px] rounded-xl bg-surface-secondary"
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
              />
            </SearchField.Group>
          </SearchField>
        )}
      </AppField>
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {[...fixedOptions, ...filteredOptions].map((option) => (
          <Select.Item
            key={option.value}
            value={option.value}
            label={option.label}
            className="min-h-12 px-0"
          >
            <View className="size-10 items-center justify-center">{option.startContent}</View>
            <View className="flex-1 gap-1">
              <Select.ItemLabel />
              <Select.ItemDescription>{option.description}</Select.ItemDescription>
            </View>
            <Select.ItemIndicator />
          </Select.Item>
        ))}
        {options.length === 0 ? (
          emptyContent
        ) : filteredOptions.length === 0 ? (
          <AppText className="py-6 text-center text-muted" accessibilityLiveRegion="polite">
            没有找到匹配的选项
          </AppText>
        ) : null}
      </ScrollView>
    </Select.Content>
  );
}
