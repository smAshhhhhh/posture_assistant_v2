import type { StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { iconSvg, logoSvg } from '../branding/brandAssets';

interface AppLogoProps {
  readonly style?: StyleProp<ViewStyle>;
}

export function AppLogo({ style }: AppLogoProps) {
  return (
    <SvgXml
      xml={logoSvg}
      // 为放大的文字预留宽度，保持图形的显示比例。
      viewBox="20 12 280 96"
      width={155}
      height={54}
      style={style}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Posture Assistant"
    />
  );
}

export function AppIcon({ size = 32 }: { readonly size?: number }) {
  return <SvgXml xml={iconSvg} width={size} height={size} accessible={false} />;
}
