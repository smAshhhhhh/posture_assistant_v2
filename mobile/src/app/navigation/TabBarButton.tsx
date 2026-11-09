import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { Pressable } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const pressEasing = cubicBezier(0.23, 1, 0.32, 1);

export function TabBarButton(props: BottomTabBarButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const isReducedMotion = useReducedMotion();

  return (
    <AnimatedPressable
      role={props.role}
      aria-label={props['aria-label']}
      aria-selected={props['aria-selected']}
      accessibilityLargeContentTitle={props.accessibilityLargeContentTitle}
      accessibilityShowsLargeContentViewer={props.accessibilityShowsLargeContentViewer}
      disabled={props.disabled}
      testID={props.testID}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      onPressIn={(event) => {
        setIsPressed(true);
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setIsPressed(false);
        props.onPressOut?.(event);
      }}
      style={[
        props.style,
        {
          justifyContent: 'center',
          paddingVertical: 4,
          transform: [{ scale: isPressed && !isReducedMotion ? 0.97 : 1 }],
          transitionProperty: 'transform',
          transitionDuration: isReducedMotion ? 0 : 120,
          transitionTimingFunction: pressEasing,
        },
      ]}
    >
      {props.children}
    </AnimatedPressable>
  );
}
