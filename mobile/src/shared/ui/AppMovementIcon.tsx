import { SvgXml } from 'react-native-svg';

import { movementIcons } from '../icons/movementIcons';
import type { MovementIconName } from '../icons/movementIcons';

interface AppMovementIconProps {
  readonly name: MovementIconName;
  readonly size: number;
}

export function AppMovementIcon({ name, size }: AppMovementIconProps) {
  return (
    <SvgXml
      xml={movementIcons[name]}
      width={size}
      height={size}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
