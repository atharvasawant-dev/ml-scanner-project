import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS } from '../../theme/neoTheme';

export default function NeoSectionHeader({
  title,
  subtitle,
  rightElement,
  tagText,
  tagColor = 'yellow',
  markerColor = NEO_COLORS.coral,
  style,
}) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <View style={[styles.marker, { backgroundColor: markerColor }]} />
          <Text style={styles.title}>{title}</Text>
          {tagText ? (
            <View style={[styles.tag, { backgroundColor: NEO_COLORS[tagColor] || NEO_COLORS.yellow }]}>
              <Text style={styles.tagText}>{tagText}</Text>
            </View>
          ) : null}
        </View>
        {rightElement ? <View>{rightElement}</View> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  marker: {
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  tag: {
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: NEO_COLORS.muted,
    marginTop: 3,
    paddingLeft: 18,
  },
});
