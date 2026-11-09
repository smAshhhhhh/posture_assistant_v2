import { Dialog } from 'heroui-native/dialog';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { Keyboard, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from './AppButton';

interface ConfirmationOptions {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly isDestructive?: boolean;
  readonly onConfirm: () => void;
}

interface ConfirmationRequest extends ConfirmationOptions {
  readonly owner: string;
}

type ConfirmationContent = Omit<ConfirmationOptions, 'onConfirm'>;

interface ConfirmationContextValue {
  readonly request: (options: ConfirmationRequest) => void;
  readonly cancel: (owner?: string) => void;
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

export function AppConfirmationProvider({ children }: { readonly children: ReactNode }) {
  const [content, setContent] = useState<ConfirmationContent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const active = useRef<ConfirmationRequest | null>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const request = useCallback((options: ConfirmationRequest) => {
    if (active.current) return;
    Keyboard.dismiss();
    active.current = options;
    const {
      title,
      description,
      confirmLabel,
      cancelLabel = '取消',
      isDestructive = false,
    } = options;
    setContent({ title, description, confirmLabel, cancelLabel, isDestructive });
    setIsOpen(true);
  }, []);
  const cancel = useCallback((owner?: string) => {
    if (owner && active.current?.owner !== owner) return;
    active.current = null;
    // 保留展示文字，交由组件完成默认关闭过渡。
    setIsOpen(false);
  }, []);
  const confirm = () => {
    const current = active.current;
    if (!current) return;
    // 先清除请求，防止重复点按执行两次或调用已卸载页面的回调。
    cancel();
    current.onConfirm();
  };

  return (
    <ConfirmationContext value={{ request, cancel }}>
      {children}
      <Dialog
        isOpen={isOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) cancel();
        }}
      >
        <Dialog.Portal
          className="px-4"
          style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
          unstable_accessibilityContainerViewIsModal
        >
          <Dialog.Overlay />
          <Dialog.Content
            className="w-full max-w-[560px] self-center rounded-[24px] bg-surface p-4"
            isSwipeable={false}
          >
            <ScrollView
              style={{ maxHeight: Math.max(96, height - insets.top - insets.bottom - 64) }}
              keyboardShouldPersistTaps="handled"
            >
              <View className="gap-4">
                <Dialog.Title>{content?.title}</Dialog.Title>
                <Dialog.Description className="text-base leading-6">
                  {content?.description}
                </Dialog.Description>
                <AppButton
                  variant={content?.isDestructive ? 'danger' : 'primary'}
                  onPress={confirm}
                >
                  {content?.confirmLabel}
                </AppButton>
                <AppButton variant="secondary" onPress={() => cancel()}>
                  {content?.cancelLabel ?? '取消'}
                </AppButton>
              </View>
            </ScrollView>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </ConfirmationContext>
  );
}

export function useConfirmAction() {
  const context = useContext(ConfirmationContext);
  const owner = useId();
  if (!context) throw new Error('确认操作需要在 AppConfirmationProvider 内使用。');
  const { request, cancel } = context;
  useEffect(() => () => cancel(owner), [cancel, owner]);
  return (options: ConfirmationOptions) => request({ ...options, owner });
}
