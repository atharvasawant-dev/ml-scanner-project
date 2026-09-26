import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../../theme/neoTheme';

export default function NeoCard({
  children,
  style,
  headerTitle,
  headerRight,
  accentColor,
  contentStyle,
  onPress,
  disabled = false,
  shadow = 'md',
  ...rest
}) {
  const CardContainer = onPress ? TouchableOpacity : View;
  const shadowStyle = shadow === 'none' ? NEO_SHADOWS.none : NEO_SHADOWS[shadow] || NEO_SHADOWS.md;

  return (
    <CardContainer
      style={[styles.card, shadowStyle, style]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.85}
      {...rest}
    >
      {headerTitle ? (
        <View style={[styles.headerBanner, accentColor ? { backgroundColor: accentColor } : styles.defaultHeader]}>
          <Text style={styles.headerTitleText} numberOfLines={1}>{headerTitle}</Text>
          {headerRight ? <View>{headerRight}</View> : null}
        </View>
      ) : null}
      <View style={[styles.body, contentStyle]}>
        {children}
      </View>
    </CardContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NEO_COLORS.card,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    overflow: 'hidden',
    marginBottom: 14,
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: NEO_BORDERS.thick,
    borderBottomColor: NEO_COLORS.border,
  },
  defaultHeader: {
    backgroundColor: NEO_COLORS.yellow,
  },
  headerTitleText: {
    fontSize: 14,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  body: {
    padding: 14,
  },
});
