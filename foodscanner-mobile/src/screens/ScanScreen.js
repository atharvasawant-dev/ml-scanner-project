import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { scanProduct } from '../services/api';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../theme/neoTheme';

const QUICK = ['Maggi', 'Parle-G', 'Kurkure', "Lay's", 'Amul Butter'];

export default function ScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const productNameRef = useRef(null);
  const [_result, setResult] = useState(null);

  const mainValue = barcode;
  const setMainValue = setBarcode;

  const barcodePlaceholder = useMemo(() => 'Barcode number (e.g. 8901058000256)', []);
  const namePlaceholder = useMemo(() => 'Product name (e.g. Dairy Milk, Maggi)', []);

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
        'Please enter a barcode number only. Use the product name field below for name search.'
      );
      return;
    }

    if (!raw && !hint) {
      return;
    }

    const isDigits = /^\d+$/.test(raw);
    if (raw && !isDigits) {
      Alert.alert('Invalid barcode', 'Enter barcode number or use chips below');
      return;
    }

    const scanPayload = raw
      ? { barcode: raw, product_name: hint || null }
      : { barcode: '00000000', product_name: hint };

    setResult(null);
    setLoading(true);
    try {
      setNotFound(false);
      const result = await scanProduct(scanPayload.barcode, scanPayload.product_name);
      setResult(result);
      navigation.replace('Result', { result, timestamp: Date.now() });
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404) {
        setNotFound(true);
        setShowCamera(false);
        setTimeout(() => {
          productNameRef?.current?.focus?.();
        }, 50);
      } else {
        const msg = e?.response?.data?.detail || e?.message || 'Scan failed';
        Alert.alert('Error', String(msg));
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
        <ActivityIndicator color={NEO_COLORS.ink} size="small" />
        <Text style={styles.permissionPrompt}>Requesting camera permission...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Screen Header */}
      <View style={styles.headerRow}>
        <View>
          <View style={styles.headerTag}>
            <Text style={styles.headerTagText}>PRODUCT SCANNER</Text>
          </View>
          <Text style={styles.title}>CHECK A PRODUCT</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>Scan packaging barcode or query by brand / product name</Text>

      {/* Main Scanner Card */}
      <View style={[styles.mainCard, NEO_SHADOWS.md]}>
        <View style={styles.cardBanner}>
          <Text style={styles.cardBannerText}>CAMERA SCANNER</Text>
        </View>

        <View style={styles.cardInner}>
          <TouchableOpacity
            style={[styles.cameraToggle, NEO_SHADOWS.sm]}
            activeOpacity={0.85}
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

              Alert.alert('Camera permission required', 'Camera permission is needed to scan barcodes.');
            }}
            disabled={loading}
          >
            <Text style={styles.cameraToggleText}>📷 OPEN LIVE CAMERA SCANNER</Text>
          </TouchableOpacity>

          {!permission?.granted && showCamera ? (
            <Text style={styles.permissionText}>Camera permission required to scan</Text>
          ) : null}

          {showCamera && permission?.granted ? (
            <View style={styles.cameraWrap}>
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
                }}
                onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
              />
              <View style={styles.cameraOverlay}>
                <Text style={styles.cameraHint}>ALIGN BARCODE WITHIN FRAME</Text>
                <TouchableOpacity
                  style={[styles.cancelBtn, NEO_SHADOWS.sm]}
                  onPress={() => {
                    setShowCamera(false);
                    setScanned(false);
                  }}
                >
                  <Text style={styles.cancelBtnText}>✕ CANCEL CAMERA</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Barcode Input */}
          <Text style={styles.inputLabel}>OR ENTER BARCODE DIGITS:</Text>
          <TextInput
            style={[styles.input, NEO_SHADOWS.sm]}
            placeholder={barcodePlaceholder}
            placeholderTextColor={NEO_COLORS.muted}
            value={mainValue}
            onChangeText={setMainValue}
            keyboardType="numeric"
          />

          {notFound ? (
            <View style={styles.notFoundBox}>
              <Text style={styles.notFoundText}>⚠️ Product not found in database. Search by name below 👇</Text>
              <TouchableOpacity
                style={[styles.manualBtn, NEO_SHADOWS.sm]}
                onPress={() => navigation.navigate('ManualEntry', { productName: productName.trim() || '' })}
                disabled={loading}
              >
                <Text style={styles.manualBtnText}>ENTER NUTRITION MANUALLY →</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Product Name Search */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>SEARCH BY PRODUCT NAME:</Text>
          <TextInput
            ref={productNameRef}
            style={[styles.input, notFound ? styles.inputNotFound : null, NEO_SHADOWS.sm]}
            placeholder={namePlaceholder}
            placeholderTextColor={NEO_COLORS.muted}
            value={productName}
            onChangeText={(t) => {
              setProductName(t);
              if (notFound) setNotFound(false);
            }}
          />

          {/* Quick Benchmark Chips */}
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>COMMON BENCHMARKS:</Text>
          <View style={styles.chipsRow}>
            {QUICK.map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.chip, NEO_SHADOWS.sm]}
                activeOpacity={0.8}
                onPress={() => {
                  setBarcode('');
                  setProductName(q);
                }}
                disabled={loading}
              >
                <Text style={styles.chipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Analyze CTA */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled, NEO_SHADOWS.md]}
            activeOpacity={0.88}
            onPress={() => analyze()}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={NEO_COLORS.ink} />
                <Text style={styles.btnText}>ANALYSING...</Text>
              </View>
            ) : (
              <Text style={styles.btnText}>ANALYSE PRODUCT</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Alternative Input Cards */}
      <View style={styles.secondaryActions}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: NEO_COLORS.cyan }, NEO_SHADOWS.sm]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ManualEntry', { productName: productName.trim() || '' })}
          disabled={loading}
        >
          <Text style={styles.actionIcon}>📝</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>MANUAL NUTRITION ENTRY</Text>
            <Text style={styles.actionSub}>Directly score calories, sugar, fat, salt & protein</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: NEO_COLORS.pink }, NEO_SHADOWS.sm]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('OCRScan', { productName: productName.trim() || '' })}
          disabled={loading}
        >
          <Text style={styles.actionIcon}>📸</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>SCAN NUTRITION LABEL (OCR)</Text>
            <Text style={styles.actionSub}>Extract label table rows with automated OCR parser</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEO_COLORS.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: NEO_COLORS.bg,
  },
  permissionPrompt: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  headerRow: {
    marginBottom: 4,
  },
  headerTag: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  headerTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: NEO_COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 14,
  },
  mainCard: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    overflow: 'hidden',
    marginBottom: 14,
  },
  cardBanner: {
    backgroundColor: NEO_COLORS.cyan,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: NEO_BORDERS.thick,
    borderBottomColor: NEO_COLORS.border,
  },
  cardBannerText: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  cardInner: {
    padding: 14,
  },
  cameraToggle: {
    backgroundColor: NEO_COLORS.yellow,
    borderRadius: NEO_RADIUS.sm,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  cameraToggleText: {
    color: NEO_COLORS.ink,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.4,
  },
  permissionText: {
    marginBottom: 10,
    color: NEO_COLORS.coral,
    fontWeight: '800',
    fontSize: 12,
  },
  cameraWrap: {
    height: 240,
    borderRadius: NEO_RADIUS.sm,
    overflow: 'hidden',
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    marginBottom: 14,
    backgroundColor: NEO_COLORS.ink,
  },
  cameraOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
  },
  cameraHint: {
    color: NEO_COLORS.white,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    marginTop: 8,
    backgroundColor: NEO_COLORS.coral,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: NEO_RADIUS.xs,
  },
  cancelBtnText: {
    color: NEO_COLORS.ink,
    fontWeight: '900',
    fontSize: 11,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.muted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: NEO_COLORS.white,
    borderRadius: NEO_RADIUS.sm,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: NEO_COLORS.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  inputNotFound: {
    borderColor: NEO_COLORS.coral,
  },
  notFoundBox: {
    marginTop: 10,
    backgroundColor: NEO_COLORS.status.avoidBg,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    padding: 10,
  },
  notFoundText: {
    color: NEO_COLORS.ink,
    fontWeight: '800',
    fontSize: 11,
  },
  manualBtn: {
    marginTop: 8,
    backgroundColor: NEO_COLORS.white,
    borderRadius: NEO_RADIUS.xs,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  manualBtnText: {
    color: NEO_COLORS.ink,
    fontWeight: '900',
    fontSize: 11,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: NEO_RADIUS.xs,
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
  },
  chipText: {
    color: NEO_COLORS.ink,
    fontWeight: '800',
    fontSize: 11,
  },
  btn: {
    marginTop: 14,
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    paddingVertical: 14,
    borderRadius: NEO_RADIUS.sm,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: NEO_COLORS.ink,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryActions: {
    gap: 10,
  },
  actionCard: {
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIcon: {
    fontSize: 22,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.4,
  },
  actionSub: {
    fontSize: 10,
    fontWeight: '700',
    color: NEO_COLORS.ink,
    marginTop: 2,
    opacity: 0.85,
  },
  actionArrow: {
    fontSize: 18,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
});
