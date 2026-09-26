import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS } from '../../theme/neoTheme';

export default function NeoPill({
  label,
  children,
  bg = NEO_COLORS.white,
  color = NEO_COLORS.ink,
  style,
  textStyle,
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {label ? (
        <Text style={[styles.text, { color }, textStyle]}>{label}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
