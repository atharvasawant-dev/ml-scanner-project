import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../../theme/neoTheme';

export default function NeoButton({
  children,
  title,
  onPress,
  variant = 'primary', // primary (lime), blue/cyan, violet/purple, green/safe, amber/warning, coral/danger, black, white/outline
  size = 'md',         // sm, md, lg
  disabled = false,
  loading = false,
  icon = null,
  style,
  textStyle,
  ...rest
}) {
  const [pressed, setPressed] = useState(false);
  const buttonContent = children !== undefined ? children : title;

  const getVariantStyles = () => {
    switch (variant) {
      case 'lime':
      case 'primary':
        return { bg: NEO_COLORS.lime, text: NEO_COLORS.ink };
      case 'blue':
      case 'electricBlue':
      case 'cyan':
        return { bg: NEO_COLORS.electricBlue, text: NEO_COLORS.ink };
      case 'violet':
      case 'purple':
      case 'ai':
        return { bg: NEO_COLORS.violet, text: NEO_COLORS.white };
      case 'green':
      case 'safe':
      case 'success':
        return { bg: NEO_COLORS.green, text: NEO_COLORS.ink };
      case 'amber':
      case 'warning':
      case 'moderate':
      case 'yellow':
        return { bg: NEO_COLORS.amber, text: NEO_COLORS.ink };
      case 'coral':
      case 'danger':
      case 'red':
      case 'avoid':
        return { bg: NEO_COLORS.coral, text: NEO_COLORS.white };
      case 'black':
        return { bg: NEO_COLORS.ink, text: NEO_COLORS.white };
      case 'white':
      case 'outline':
        return { bg: NEO_COLORS.white, text: NEO_COLORS.ink };
      default:
        return { bg: NEO_COLORS.lime, text: NEO_COLORS.ink };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: 7,
          paddingHorizontal: 12,
          fontSize: 12,
          borderRadius: NEO_RADIUS.sm,
        };
      case 'lg':
        return {
          paddingVertical: 14,
          paddingHorizontal: 20,
          fontSize: 16,
          borderRadius: NEO_RADIUS.md,
        };
      case 'md':
      default:
        return {
          paddingVertical: 11,
          paddingHorizontal: 16,
          fontSize: 14,
          borderRadius: NEO_RADIUS.md,
        };
    }
  };

  const vConfig = getVariantStyles();
  const sConfig = getSizeStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? NEO_COLORS.mutedLight : vConfig.bg,
          paddingVertical: sConfig.paddingVertical,
          paddingHorizontal: sConfig.paddingHorizontal,
          borderRadius: sConfig.borderRadius,
        },
        pressed ? styles.buttonPressed : (size === 'sm' ? NEO_SHADOWS.sm : NEO_SHADOWS.md),
        disabled && styles.buttonDisabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vConfig.text} />
      ) : (
        <View style={styles.contentRow}>
          {icon ? <View style={styles.iconBox}>{icon}</View> : null}
          {typeof buttonContent === 'string' ? (
            <Text
              style={[
                styles.text,
                {
                  color: disabled ? NEO_COLORS.muted : vConfig.text,
                  fontSize: sConfig.fontSize,
                },
                textStyle,
              ]}
            >
              {buttonContent}
            </Text>
          ) : (
            buttonContent
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  buttonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconBox: {
    marginRight: 2,
  },
  text: {
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
