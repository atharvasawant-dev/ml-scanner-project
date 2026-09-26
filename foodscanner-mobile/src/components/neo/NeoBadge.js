import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS } from '../../theme/neoTheme';

export default function NeoBadge({
  label,
  children,
  color = 'yellow', // yellow, coral, cyan, purple, green, pink, white
  icon = null,
  size = 'md',      // sm, md
  style,
  textStyle,
}) {
  const getColorBg = () => {
    switch (color) {
      case 'coral':
      case 'red':
        return NEO_COLORS.coral;
      case 'green':
      case 'safe':
        return NEO_COLORS.green;
      case 'cyan':
        return NEO_COLORS.cyan;
      case 'purple':
        return NEO_COLORS.purpleLight;
      case 'pink':
        return NEO_COLORS.pink;
      case 'white':
        return NEO_COLORS.white;
      case 'gray':
      case 'muted':
        return NEO_COLORS.bgAlt;
      case 'yellow':
      default:
        return NEO_COLORS.yellow;
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
      {label ? (
        <Text
          style={[
            styles.text,
            { fontSize: isSm ? 10 : 11 },
            textStyle,
          ]}
        >
          {label}
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
