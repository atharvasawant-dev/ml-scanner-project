import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { scanProduct } from '../services/api';

const C = {
  cream: '#F5F2EC',
  ink: '#1A1A17',
  sage: '#4E8C52',
  sageLight: '#C3D9C5',
  amberLight: '#F0D9A8',
  redLight: '#F0C8C0',
  border: '#DDD8CE',
  muted: '#888179',
  white: '#FFFFFF',
  red: '#B83C28',
};

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
  const [result, setResult] = useState(null);

  const mainValue = barcode;
  const setMainValue = setBarcode;

  const barcodePlaceholder = useMemo(() => 'Barcode number (e.g. 8901058000256)', []);
  const namePlaceholder = useMemo(() => 'Product name for manual search (e.g. Dairy Milk)', []);

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
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.title}>Check a Product</Text>
      <Text style={styles.subtitle}>Enter barcode or product name</Text>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cameraToggle}
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

            Alert.alert('Camera permission required', 'Camera permission required');
          }}
          disabled={loading}
        >
          <Text style={styles.cameraToggleText}>📷 Scan Barcode</Text>
        </TouchableOpacity>

        {!permission?.granted && showCamera ? (
          <Text style={styles.permissionText}>Camera permission required</Text>
        ) : null}

        {showCamera && permission?.granted ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
            />
            <View style={styles.cameraOverlay}>
              <Text style={styles.cameraHint}>Point your camera at the barcode</Text>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowCamera(false);
                  setScanned(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder={barcodePlaceholder}
          placeholderTextColor={C.muted}
          value={mainValue}
          onChangeText={setMainValue}
          keyboardType="numeric"
        />

        {notFound ? (
          <Text style={styles.notFoundText}>Product not found. Try typing the product name below 👇</Text>
        ) : null}

        {notFound ? (
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => navigation.navigate('ManualEntry', { productName: productName.trim() || '' })}
            disabled={loading}
          >
            <Text style={styles.manualBtnText}>Enter Nutrition Manually</Text>
          </TouchableOpacity>
        ) : null}

        <TextInput
          ref={productNameRef}
          style={[styles.input, { marginTop: 12 }, notFound ? styles.inputNotFound : null]}
          placeholder={namePlaceholder}
          placeholderTextColor={C.muted}
          value={productName}
          onChangeText={(t) => {
            setProductName(t);
            if (notFound) setNotFound(false);
          }}
        />

        <View style={styles.chipsRow}>
          {QUICK.map((q) => (
            <TouchableOpacity
              key={q}
              style={styles.chip}
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

        <TouchableOpacity style={styles.btn} onPress={() => analyze()} disabled={loading}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={C.white} />
              <Text style={styles.btnText}>Analysing…</Text>
            </View>
          ) : (
            <Text style={styles.btnText}>ANALYSE</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.manualOption}
        onPress={() => navigation.navigate('ManualEntry', { productName: productName.trim() || '' })}
        disabled={loading}
      >
        <Text style={styles.manualOptionText}>Enter Manually</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.ocrOption}
        onPress={() => navigation.navigate('OCRScan', { productName: productName.trim() || '' })}
        disabled={loading}
      >
        <Text style={styles.ocrOptionText}>📋 Scan Nutrition Label (OCR)</Text>
      </TouchableOpacity>

      <View style={styles.cameraHintCard}>
        <Text style={styles.cameraHintTitle}>Tip</Text>
        <Text style={styles.cameraHintText}>Scanning via camera is supported on mobile. On web, manual entry works best.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: C.cream },
  title: { fontSize: 28, fontWeight: '900', color: C.ink },
  subtitle: { marginTop: 6, color: C.muted, fontWeight: '600', marginBottom: 16 },
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
  cameraToggle: { marginBottom: 12, backgroundColor: C.white, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  cameraToggleText: { color: C.ink, fontWeight: '900' },
  permissionText: { marginBottom: 10, color: C.muted, fontWeight: '700' },
  cameraWrap: { height: 260, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginBottom: 12, backgroundColor: '#000' },
  cameraOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.35)' },
  cameraHint: { color: C.white, fontWeight: '800' },
  cancelBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: C.white, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  cancelBtnText: { color: C.ink, fontWeight: '900' },
  input: { backgroundColor: C.white, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingVertical: 11, paddingHorizontal: 14, color: C.ink, fontWeight: '600' },
  inputNotFound: { borderColor: '#F59E0B' },
  notFoundText: { marginTop: 10, color: '#A9731B', fontWeight: '800' },
  manualBtn: { marginTop: 10, backgroundColor: C.white, borderRadius: 10, borderWidth: 1.5, borderColor: '#F59E0B', paddingVertical: 12, alignItems: 'center' },
  manualBtnText: { color: '#A9731B', fontWeight: '900' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  chipText: { color: C.ink, fontWeight: '800' },
  btn: { marginTop: 14, backgroundColor: C.sage, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: C.white, fontWeight: '900', fontSize: 16, letterSpacing: 0.6 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  manualOption: { marginTop: 12, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, alignItems: 'center' },
  manualOptionText: { color: C.ink, fontWeight: '900' },
  ocrOption: { marginTop: 10, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, alignItems: 'center' },
  ocrOptionText: { color: C.ink, fontWeight: '900' },
  cameraHintCard: { marginTop: 14, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  cameraHintTitle: { color: C.ink, fontWeight: '900' },
  cameraHintText: { marginTop: 6, color: C.muted, fontWeight: '600' },
});
