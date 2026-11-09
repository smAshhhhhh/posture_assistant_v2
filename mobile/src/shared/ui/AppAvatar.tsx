import { Avatar } from 'heroui-native/avatar';

interface AppAvatarProps {
  readonly label: string;
  readonly imageUri?: string | null;
  readonly size?: 'sm' | 'md' | 'lg';
}

export function AppAvatar({ label, imageUri, size = 'sm' }: AppAvatarProps) {
  const initial = Array.from(label.normalize('NFKC').trim())[0]?.toLocaleUpperCase() ?? '?';

  return (
    <Avatar
      key={imageUri ?? 'initial'}
      alt={`${label || '患者'}的头像`}
      size={size}
      variant="soft"
      className="shrink-0"
    >
      {imageUri ? <Avatar.Image source={{ uri: imageUri }} /> : null}
      <Avatar.Fallback>{initial}</Avatar.Fallback>
    </Avatar>
  );
}
