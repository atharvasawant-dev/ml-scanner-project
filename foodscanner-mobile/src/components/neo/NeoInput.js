import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../../theme/neoTheme';

export default function NeoInput({
  label,
  value,
  onChangeText,
  placeholder,
  rightElement,
  style,
  inputStyle,
  containerStyle,
  error,
  ...rest
}) {
  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputBox, NEO_SHADOWS.sm, style]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={NEO_COLORS.muted}
          style={[styles.input, inputStyle]}
          {...rest}
        />
        {rightElement ? <View style={styles.rightBox}>{rightElement}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: NEO_COLORS.ink,
  },
  rightBox: {
    marginLeft: 8,
  },
  errorText: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    color: NEO_COLORS.coral,
  },
});
