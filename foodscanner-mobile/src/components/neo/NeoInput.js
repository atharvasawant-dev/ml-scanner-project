import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { PREMIUM_COLORS, PREMIUM_SHADOWS, PREMIUM_RADIUS } from '../../theme/premiumTheme';

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
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputBox,
          isFocused ? styles.inputBoxFocused : null,
          style,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={PREMIUM_COLORS.muted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
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
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: PREMIUM_COLORS.ink,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PREMIUM_COLORS.card,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.border,
    borderRadius: PREMIUM_RADIUS.md, // 16px
    paddingHorizontal: 16,
    ...PREMIUM_SHADOWS.sm,
  },
  inputBoxFocused: {
    borderColor: PREMIUM_COLORS.primaryDark,
    backgroundColor: PREMIUM_COLORS.card,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    color: PREMIUM_COLORS.ink,
  },
  rightBox: {
    marginLeft: 8,
  },
  errorText: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '600',
    color: PREMIUM_COLORS.status.avoid,
  },
});
