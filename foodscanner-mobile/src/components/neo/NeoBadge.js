import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS } from '../../theme/neoTheme';

export default function NeoBadge({
  label,
  text,
  children,
  color,
  variant = 'lime', // lime, blue/cyan, violet/purple, green/safe, amber/yellow, coral/red, white, gray
  icon = null,
  size = 'md',      // sm, md
  style,
  textStyle,
}) {
  const badgeText = label !== undefined ? label : text;
  const badgeColor = color || variant;

  const getColorBg = () => {
    switch (badgeColor) {
      case 'lime':
      case 'primary':
        return NEO_COLORS.lime;
      case 'coral':
      case 'red':
      case 'avoid':
      case 'danger':
        return NEO_COLORS.coral;
      case 'green':
      case 'safe':
      case 'success':
        return NEO_COLORS.green;
      case 'electricBlue':
      case 'blue':
      case 'cyan':
        return NEO_COLORS.electricBlue;
      case 'violet':
      case 'purple':
      case 'ai':
        return NEO_COLORS.purpleLight;
      case 'amber':
      case 'warning':
      case 'moderate':
        return NEO_COLORS.amber;
      case 'white':
        return NEO_COLORS.white;
      case 'gray':
      case 'muted':
        return NEO_COLORS.bgAlt;
      case 'yellow':
        return NEO_COLORS.yellow;
      default:
        return NEO_COLORS.lime;
    }
  };

  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: getColorBg(),
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? 6 : 9,
          borderRadius: isSm ? NEO_RADIUS.xs : NEO_RADIUS.sm,
        },
        style,
      ]}
    >
      {icon ? <View style={styles.iconBox}>{icon}</View> : null}
      {badgeText ? (
        <Text
          style={[
            styles.text,
            { fontSize: isSm ? 10 : 11 },
            textStyle,
          ]}
        >
          {badgeText}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  iconBox: {
    marginRight: 1,
  },
  text: {
    fontWeight: '900',
    color: NEO_COLORS.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
