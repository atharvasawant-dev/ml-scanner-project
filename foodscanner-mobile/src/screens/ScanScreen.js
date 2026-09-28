import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import { scanProduct } from '../services/api';
import {
  PREMIUM_COLORS,
  PREMIUM_SHADOWS,
  PREMIUM_RADIUS,
} from '../theme/premiumTheme';

const QUICK = ['Maggi', 'Parle-G', 'Kurkure', "Lay's", 'Amul Butter'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_BOX_SIZE = Math.min(260, SCREEN_WIDTH * 0.72);

export default function ScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const productNameRef = useRef(null);

  // Animated vertical scan line
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: SCAN_BOX_SIZE - 20,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [laserAnim]);

  useEffect(() => {
    if (!permission) return;
    if (permission.granted) return;
    if (!showCamera) return;
    if (!permission.canAskAgain) return;
    requestPermission();
  }, [permission, showCamera, requestPermission]);

  const analyze = async (code) => {
    const raw = String(code ?? barcode).trim();
    const hint = String(productName || '').trim();

    const hasLetters = /[A-Za-z]/.test(raw);
    if (hasLetters) {
      Alert.alert(
        'Barcode only',
        'Please enter digits only for the barcode. Use the product name field below for text search.'
      );
      return;
    }

    if (!raw && !hint) {
      return;
    }

    const isDigits = /^\d+$/.test(raw);
    if (raw && !isDigits) {
      Alert.alert('Invalid barcode', 'Enter numeric barcode digits or tap a benchmark product below');
      return;
    }

    const scanPayload = raw
      ? { barcode: raw, product_name: hint || null }
      : { barcode: '00000000', product_name: hint };

    setLoading(true);
    try {
      setNotFound(false);
      const result = await scanProduct(scanPayload.barcode, scanPayload.product_name);
      navigation.replace('Result', { result, timestamp: Date.now() });
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404) {
        setNotFound(true);
        setShowCamera(false);
        setTimeout(() => {
          productNameRef?.current?.focus?.();
        }, 60);
      } else {
        const msg = e?.response?.data?.detail || e?.message || 'Scan failed';
        Alert.alert('Scan Result', String(msg));
      }
    } finally {
      setLoading(false);
    }
  };

  const onBarcodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setBarcode(String(data));
    setShowCamera(false);
    analyze(String(data));
    setTimeout(() => setScanned(false), 1500);
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PREMIUM_COLORS.primaryDark} size="small" />
        <Text style={styles.permissionPrompt}>Checking camera permissions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.categoryBadge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>SCANNER</Text>
          </View>
          <Text style={styles.screenTitle}>Check Product</Text>
          <Text style={styles.screenSub}>
            Scan food packaging barcode or lookup by product name
          </Text>
        </View>

        {/* Live Camera View or Trigger Card */}
        {showCamera && permission?.granted ? (
          <View style={[styles.cameraContainer, PREMIUM_SHADOWS.md]}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
              }}
              onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
            />
            {/* Viewfinder Reticle Overlay */}
            <View style={styles.reticleOverlay}>
              <View style={[styles.reticleBox, { width: SCAN_BOX_SIZE, height: SCAN_BOX_SIZE }]}>
                {/* Glowing Corner Accents */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {/* Animated Laser Sweep */}
                <Animated.View
                  style={[
                    styles.laserLine,
                    { transform: [{ translateY: laserAnim }] },
                  ]}
                />
              </View>

              <Text style={styles.cameraHint}>Align barcode within the green frame</Text>

              <TouchableOpacity
                style={[styles.closeCameraBtn, PREMIUM_SHADOWS.sm]}
                activeOpacity={0.85}
                onPress={() => {
                  setShowCamera(false);
                  setScanned(false);
                }}
              >
                <Text style={styles.closeCameraText}>✕ Close Camera</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.cameraHeroCard, PREMIUM_SHADOWS.sm]}
            activeOpacity={0.9}
            onPress={async () => {
              if (permission?.granted) {
                setScanned(false);
                setShowCamera(true);
                return;
              }
              if (permission?.canAskAgain) {
                const p = await requestPermission();
                if (p?.granted) {
                  setScanned(false);
                  setShowCamera(true);
                }
                return;
              }
              Alert.alert('Camera Permission Required', 'Please enable camera access in system settings to scan barcodes.');
            }}
          >
            <View style={styles.cameraHeroIconWrap}>
              <Ionicons name="barcode-outline" size={30} color={PREMIUM_COLORS.primaryDark} />
            </View>
            <Text style={styles.cameraHeroTitle}>Open Live Barcode Scanner</Text>
            <Text style={styles.cameraHeroSub}>
              Point at any packaged food label for instant scientific breakdown
            </Text>
          </TouchableOpacity>
        )}

        {/* Input Details Bottom Sheet Card */}
        <View style={[styles.inputCard, PREMIUM_SHADOWS.sm]}>
          <Text style={styles.inputSectionTitle}>Manual Barcode Digits</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 8901058000256"
              placeholderTextColor={PREMIUM_COLORS.muted}
              value={barcode}
              onChangeText={setBarcode}
              keyboardType="numeric"
            />
            {barcode ? (
              <TouchableOpacity
                style={styles.searchInsideBtn}
                onPress={() => analyze(barcode)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={PREMIUM_COLORS.primaryDark} />
                ) : (
                  <Text style={styles.searchInsideBtnText}>Check →</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {notFound ? (
            <View style={styles.notFoundCard}>
              <View style={styles.notFoundHeader}>
                <Ionicons name="alert-circle-outline" size={16} color={PREMIUM_COLORS.status.avoid} />
                <Text style={styles.notFoundTitle}>Barcode not found</Text>
              </View>
              <Text style={styles.notFoundSub}>
                Try typing the product brand/name below or enter nutrition facts manually.
              </Text>
              <TouchableOpacity
                style={styles.manualEntryBtn}
                onPress={() => navigation.navigate('ManualEntry', { productName: productName.trim() || '' })}
              >
                <Text style={styles.manualEntryBtnText}>Enter Nutrition Manually →</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={[styles.inputSectionTitle, { marginTop: 18 }]}>Or Search By Product Name</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={productNameRef}
              style={styles.textInput}
              placeholder="e.g. Dairy Milk, Maggi Noodles, Oat Milk"
              placeholderTextColor={PREMIUM_COLORS.muted}
              value={productName}
              onChangeText={(t) => {
                setProductName(t);
                if (notFound) setNotFound(false);
              }}
            />
            {productName ? (
              <TouchableOpacity
                style={styles.searchInsideBtn}
                onPress={() => analyze(null)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={PREMIUM_COLORS.primaryDark} />
                ) : (
                  <Text style={styles.searchInsideBtnText}>Search →</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Quick Benchmark Chips */}
          <Text style={[styles.inputSectionTitle, { marginTop: 20 }]}>Popular Packaged Foods</Text>
          <View style={styles.chipsRow}>
            {QUICK.map((item) => (
              <TouchableOpacity
                key={item}
                activeOpacity={0.8}
                style={styles.chip}
                onPress={() => {
                  setProductName(item);
                  setBarcode('');
                  analyze(null);
                }}
              >
                <Text style={styles.chipText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.bg,
  },
  scrollContent: {
    padding: 18,
    paddingTop: 52,
    paddingBottom: 110,
  },
  center: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  permissionPrompt: {
    fontSize: 14,
    color: PREMIUM_COLORS.secondary,
    fontWeight: '500',
  },

  // Header
  header: {
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PREMIUM_COLORS.primaryDark,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: PREMIUM_COLORS.primaryDark,
    letterSpacing: 0.6,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: PREMIUM_COLORS.ink,
    letterSpacing: -0.4,
  },
  screenSub: {
    fontSize: 14,
    fontWeight: '400',
    color: PREMIUM_COLORS.secondary,
    marginTop: 4,
    lineHeight: 20,
  },

  // Live Camera
  cameraContainer: {
    height: 380,
    borderRadius: PREMIUM_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: 18,
    position: 'relative',
    backgroundColor: '#000000',
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    position: 'relative',
    borderRadius: 18,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: PREMIUM_COLORS.primary,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  laserLine: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    height: 3,
    backgroundColor: PREMIUM_COLORS.primary,
    borderRadius: 2,
    shadowColor: PREMIUM_COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  cameraHint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 18,
    letterSpacing: 0.3,
  },
  closeCameraBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: PREMIUM_RADIUS.pill,
    marginTop: 14,
  },
  closeCameraText: {
    fontSize: 13,
    fontWeight: '700',
    color: PREMIUM_COLORS.ink,
  },

  // Camera Hero Card
  cameraHeroCard: {
    backgroundColor: PREMIUM_COLORS.primaryLight,
    borderRadius: PREMIUM_RADIUS.xl,
    padding: 24,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(85, 122, 62, 0.12)',
  },
  cameraHeroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...PREMIUM_SHADOWS.sm,
  },
  cameraHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PREMIUM_COLORS.ink,
  },
  cameraHeroSub: {
    fontSize: 13,
    fontWeight: '500',
    color: PREMIUM_COLORS.primaryDark,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 270,
    lineHeight: 18,
  },

  // Input Card
  inputCard: {
    backgroundColor: PREMIUM_COLORS.card,
    borderRadius: PREMIUM_RADIUS.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.border,
  },
  inputSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: PREMIUM_COLORS.ink,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PREMIUM_COLORS.bgAlt,
    borderRadius: PREMIUM_RADIUS.md,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    color: PREMIUM_COLORS.ink,
  },
  searchInsideBtn: {
    backgroundColor: PREMIUM_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: PREMIUM_RADIUS.pill,
  },
  searchInsideBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: PREMIUM_COLORS.ink,
  },

  // Not Found
  notFoundCard: {
    backgroundColor: PREMIUM_COLORS.status.avoidBg,
    borderRadius: PREMIUM_RADIUS.md,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.status.avoidBorder,
  },
  notFoundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  notFoundTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: PREMIUM_COLORS.status.avoid,
  },
  notFoundSub: {
    fontSize: 11,
    fontWeight: '500',
    color: PREMIUM_COLORS.secondary,
    marginTop: 2,
    marginBottom: 8,
  },
  manualEntryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: PREMIUM_RADIUS.pill,
  },
  manualEntryBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: PREMIUM_COLORS.ink,
  },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: PREMIUM_COLORS.bgAlt,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: PREMIUM_RADIUS.pill,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.border,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: PREMIUM_COLORS.ink,
  },
});
