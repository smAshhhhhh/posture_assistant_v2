import { Accordion } from 'heroui-native/accordion';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';

interface AppAccordionItem {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly content: ReactNode;
}

interface AppAccordionProps {
  readonly items: readonly AppAccordionItem[];
  readonly defaultExpandedIds?: readonly string[];
}

export function AppAccordion({ items, defaultExpandedIds = [] }: AppAccordionProps) {
  return (
    <Accordion
      selectionMode="multiple"
      defaultValue={[...defaultExpandedIds]}
      variant="surface"
      className="rounded-[24px] border-0 shadow-none"
      classNames={{ separator: 'mx-4' }}
    >
      {items.map((item) => (
        <Accordion.Item key={item.id} value={item.id}>
          <Accordion.Trigger className="min-h-[48px] gap-3 px-4 py-4">
            <View className="min-w-0 flex-1 gap-2">
              <AppText variant="section">{item.title}</AppText>
              {item.summary ? (
                <AppText variant="caption" className="text-muted">
                  {item.summary}
                </AppText>
              ) : null}
            </View>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content className="px-4 pb-4">{item.content}</Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
