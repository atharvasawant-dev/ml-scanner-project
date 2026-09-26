import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS } from '../../theme/neoTheme';

export default function NeoProgressBar({
  progress = 0, // 0 to 1 or 0 to 100
  color = NEO_COLORS.cyan,
  height = 12,
  label,
  valueText,
  style,
}) {
  const norm = progress > 1 ? Math.min(100, Math.max(0, progress)) : Math.min(100, Math.max(0, progress * 100));

  return (
    <View style={[styles.container, style]}>
      {label || valueText ? (
        <View style={styles.labelRow}>
          {label ? <Text style={styles.labelText}>{label}</Text> : <View />}
          {valueText ? <Text style={styles.valueText}>{valueText}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${norm}%`,
              backgroundColor: color,
              borderRadius: Math.max(0, height / 2 - 2),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  valueText: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.muted,
  },
  track: {
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    height: '100%',
    borderRightWidth: 1.5,
    borderRightColor: NEO_COLORS.border,
  },
});
