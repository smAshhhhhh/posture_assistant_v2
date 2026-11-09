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
      // 裁去原稿的空白画布，保留图形和文字的原有比例。
      viewBox="20 12 260 96"
      width={144}
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
