import { View } from 'react-native';
import type { ViewProps } from 'react-native';

import { layoutTokens } from '../theme/tokens';

export function AppCardStack({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ gap: layoutTokens.cardGap }, style]} />;
}
