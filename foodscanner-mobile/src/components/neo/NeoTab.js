import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../../theme/neoTheme';

export default function NeoTab({
  tabs = [],
  activeTab,
  onTabChange,
  activeColor = NEO_COLORS.yellow,
  style,
}) {
  return (
    <View style={[styles.container, style]}>
      {tabs.map((tab, idx) => {
        const key = typeof tab === 'string' ? tab : tab.key;
        const label = typeof tab === 'string' ? tab : tab.label;
        const isActive = activeTab === key;

        return (
          <TouchableOpacity
            key={key || idx}
            activeOpacity={0.85}
            onPress={() => onTabChange && onTabChange(key)}
            style={[
              styles.tab,
              isActive && [
                styles.tabActive,
                { backgroundColor: activeColor },
                NEO_SHADOWS.sm,
              ],
            ]}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    padding: 3,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: NEO_RADIUS.sm,
  },
  tabActive: {
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: NEO_COLORS.muted,
    textTransform: 'uppercase',
  },
  tabTextActive: {
    color: NEO_COLORS.ink,
    fontWeight: '900',
  },
});
