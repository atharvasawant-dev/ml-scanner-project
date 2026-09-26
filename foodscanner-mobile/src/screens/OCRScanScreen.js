import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { scanNutritionLabel } from '../services/api';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS, NEO_TYPOGRAPHY } from '../theme/neoTheme';
import { NeoCard, NeoButton, NeoBadge, NeoSectionHeader } from '../components/neo';

export default function OCRScanScreen({ navigation, route }) {
  const prefillName = route?.params?.productName;

  const [loading, setLoading] = useState(false);
  const [lastOcr, setLastOcr] = useState(null);

  const subtitle = useMemo(() => 'Point camera at the nutrition table on the food packaging', []);

  const goManual = (prefill) => {
    navigation.replace('ManualEntry', {
      productName: prefill?.product_name || prefillName || '',
      calories: prefill?.calories ?? null,
      nutrition: {
        calories: prefill?.calories ?? null,
        fat: prefill?.fat ?? null,
        sugar: prefill?.sugar ?? null,
        salt: prefill?.salt ?? null,
        protein: prefill?.protein ?? null,
        fiber: prefill?.fiber ?? null,
        carbs: prefill?.carbs ?? null,
      },
      ocr: prefill || null,
    });
  };

  const processAsset = async (asset) => {
    if (!asset?.base64) {
      Alert.alert('Image Error', 'Could not read image data. Please try again.');
      goManual(null);
      return;
    }

    setLoading(true);
    try {
      const res = await scanNutritionLabel(asset.base64);
      setLastOcr(res);

      const hasValues = res && (
        res.calories != null ||
        res.fat != null ||
        res.sugar != null ||
        res.protein != null ||
        res.salt != null ||
        res.fiber != null ||
        res.carbs != null
      );

      if (!hasValues) {
        Alert.alert(
          'Low Confidence Read',
          'Could not detect all nutrition values automatically. Please review and fill in the missing fields.'
        );
      }
      goManual(res);
    } catch (e) {
      let msg = 'Could not read label. Please enter manually.';
      if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout')) {
        msg = 'OCR request timed out. Please enter details manually.';
      } else if (e?.response?.data?.detail) {
        msg = String(e.response.data.detail);
      } else if (!e?.response) {
        msg = 'Backend unreachable. Please verify network connection or enter manually.';
      }
      Alert.alert('Scan Note', msg);
      goManual(null);
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm?.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to capture packaging.');
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.8,
        allowsEditing: false,
      });

      if (res?.canceled) return;
      const asset = res?.assets?.[0];
      await processAsset(asset);
    } catch (e) {
      Alert.alert('Camera Error', 'Unable to capture photo. Please try again or choose from gallery.');
    }
  };

  const chooseFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm?.granted) {
        Alert.alert('Permission Required', 'Gallery permission is required to select photos.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: 0.8,
        allowsEditing: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (res?.canceled) return;
      const asset = res?.assets?.[0];
      await processAsset(asset);
    } catch (e) {
      Alert.alert('Gallery Error', 'Unable to pick photo. Please try again.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <NeoBadge text="OPTICAL OCR ENGINE" variant="purple" />
          <Text style={styles.headerTag}>⚡ VISION AI</Text>
        </View>
        <Text style={styles.title}>Scan Nutrition Label</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {/* Viewfinder Preview Box */}
      <NeoCard variant="white" elevation="lg" style={styles.viewfinderCard}>
        <View style={styles.frameContainer}>
          {/* Corner brackets */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />

          <View style={styles.frameInner}>
            <Text style={styles.frameIcon}>📋</Text>
            <Text style={styles.frameTitle}>ALIGN NUTRITION TABLE</Text>
            <Text style={styles.frameHint}>
              Ensure energy, fats, sugars, and protein are clearly visible
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color={NEO_COLORS.ink} />
            <Text style={styles.loadingText}>EXTRACTING NUTRITION VIA OCR...</Text>
          </View>
        ) : null}

        {Platform.OS === 'web' ? (
          <View style={styles.webNote}>
            <Text style={styles.webNoteText}>
              💡 On web, camera stream may not work reliably. Gallery upload is recommended.
            </Text>
          </View>
        ) : null}

        {/* Action Controls */}
        <View style={styles.actionsWrap}>
          <NeoButton
            title="📷 TAKE PHOTO WITH CAMERA"
            variant="yellow"
            size="lg"
            onPress={takePhoto}
            disabled={loading}
          />

          <NeoButton
            title="🖼️ CHOOSE FROM GALLERY"
            variant="cyan"
            size="md"
            onPress={chooseFromGallery}
            disabled={loading}
          />

          <NeoButton
            title="ENTER MANUALLY INSTEAD"
            variant="white"
            size="md"
            onPress={() => goManual(null)}
            disabled={loading}
          />
        </View>
      </NeoCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEO_COLORS.bg,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  headerTag: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: NEO_COLORS.muted,
    marginTop: 4,
    lineHeight: 18,
  },
  viewfinderCard: {
    padding: 16,
  },
  frameContainer: {
    height: 220,
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginBottom: 16,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: NEO_COLORS.ink,
  },
  cornerTL: {
    top: 10,
    left: 10,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 10,
    right: 10,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  frameInner: {
    alignItems: 'center',
  },
  frameIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  frameTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  frameHint: {
    fontSize: 12,
    fontWeight: '600',
    color: NEO_COLORS.muted,
    textAlign: 'center',
    maxWidth: 240,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEO_COLORS.purpleLight,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    padding: 12,
    gap: 10,
    marginBottom: 14,
    ...NEO_SHADOWS.sm,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  webNote: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    padding: 10,
    marginBottom: 14,
  },
  webNoteText: {
    fontSize: 11,
    fontWeight: '700',
    color: NEO_COLORS.ink,
  },
  actionsWrap: {
    gap: 10,
  },
});
