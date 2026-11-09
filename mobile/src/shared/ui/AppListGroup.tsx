import { ListGroup } from 'heroui-native/list-group';
import { Separator } from 'heroui-native/separator';
import { Switch } from 'heroui-native/switch';
import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';
import { twMerge } from 'tailwind-merge';

export function AppListGroup({ className, ...props }: ComponentProps<typeof ListGroup>) {
  return (
    <ListGroup
      {...props}
      className={twMerge('overflow-hidden rounded-[24px] p-0 shadow-none', className)}
    />
  );
}

interface AppListItemProps extends Omit<ComponentProps<typeof ListGroup.Item>, 'children'> {
  readonly title: string;
  readonly description?: string;
  readonly prefix?: ReactNode;
  readonly suffix?: ReactNode;
  readonly children?: ReactNode;
}

export function AppListItem({
  title,
  description,
  prefix,
  suffix,
  children,
  className,
  onPress,
  disabled,
  ...props
}: AppListItemProps) {
  return (
    <ListGroup.Item
      accessible={children ? false : true}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ disabled: Boolean(disabled) }}
      {...props}
      onPress={onPress}
      disabled={disabled}
      className={twMerge('min-h-[52px] gap-3 p-4', disabled ? 'opacity-disabled' : '', className)}
    >
      {prefix ? <ListGroup.ItemPrefix>{prefix}</ListGroup.ItemPrefix> : null}
      <ListGroup.ItemContent className="min-w-0 gap-1">
        <ListGroup.ItemTitle>{title}</ListGroup.ItemTitle>
        {description ? (
          <ListGroup.ItemDescription className="leading-[22px]">
            {description}
          </ListGroup.ItemDescription>
        ) : null}
        {children}
      </ListGroup.ItemContent>
      {suffix !== undefined || onPress ? (
        <ListGroup.ItemSuffix>{suffix}</ListGroup.ItemSuffix>
      ) : null}
    </ListGroup.Item>
  );
}

interface AppListSwitchItemProps {
  readonly title: string;
  readonly description: string;
  readonly isSelected: boolean;
  readonly isDisabled?: boolean;
  readonly onChange: (isSelected: boolean) => void;
}

export function AppListSwitchItem({
  title,
  description,
  isSelected,
  isDisabled = false,
  onChange,
}: AppListSwitchItemProps) {
  return (
    <AppListItem
      title={title}
      description={description}
      accessibilityRole="switch"
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => onChange(!isSelected)}
      suffix={
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* 整行统一处理切换，避免嵌套开关重复响应。 */}
          <Switch isSelected={isSelected} isDisabled={isDisabled} accessible={false} />
        </View>
      }
    />
  );
}

export function AppListSeparator() {
  return <Separator className="mx-4" />;
}
