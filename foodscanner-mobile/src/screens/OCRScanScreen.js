import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { scanNutritionLabel } from '../services/api';

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

export default function OCRScanScreen({ navigation, route }) {
  const prefillName = route?.params?.productName;

  const [loading, setLoading] = useState(false);
  const [lastOcr, setLastOcr] = useState(null);

  const subtitle = useMemo(() => 'Point camera at the nutrition label on the product', []);

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
      Alert.alert('Error', 'Could not read image data. Please try again.');
      goManual(null);
      return;
    }

    setLoading(true);
    try {
      const res = await scanNutritionLabel(asset.base64);
      setLastOcr(res);

      if (res?.raw_text) {
        Alert.alert('OCR Raw Text', String(res.raw_text).slice(0, 1200));
      }
      goManual(res);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Could not read label.';
      Alert.alert('Could not read label', 'Could not read label. Please enter manually.');
      goManual(null);
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm?.granted) {
      Alert.alert('Permission required', 'Camera permission is required to take a photo.');
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
  };

  const chooseFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm?.granted) {
      Alert.alert('Permission required', 'Gallery permission is required to pick a photo.');
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
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <Text style={styles.title}>Scan Nutrition Label 📋</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.card}>
        <TouchableOpacity style={styles.btn} onPress={takePhoto} disabled={loading}>
          <Text style={styles.btnText}>📷 Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnOutline} onPress={chooseFromGallery} disabled={loading}>
          <Text style={styles.btnOutlineText}>🖼️ Choose from Gallery</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={C.sage} />
            <Text style={styles.loadingText}>Reading nutrition label...</Text>
          </View>
        ) : null}

        {!loading && lastOcr?.raw_text ? (
          <View style={styles.rawBox}>
            <Text style={styles.rawTitle}>Raw OCR text (debug)</Text>
            <Text style={styles.rawText} numberOfLines={10}>
              {String(lastOcr.raw_text)}
            </Text>
          </View>
        ) : null}

        {Platform.OS === 'web' ? (
          <Text style={styles.webNote}>On web, camera may not work reliably. Gallery upload is recommended.</Text>
        ) : null}

        <TouchableOpacity style={styles.ghostBtn} onPress={() => goManual(null)} disabled={loading}>
          <Text style={styles.ghostText}>Enter Manually Instead</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  title: { fontSize: 28, fontWeight: '900', color: C.ink },
  subtitle: { marginTop: 6, color: C.muted, fontWeight: '600', marginBottom: 16 },

  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },

  btn: { backgroundColor: C.sage, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: C.white, fontWeight: '900', fontSize: 16 },

  btnOutline: { marginTop: 12, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnOutlineText: { color: C.ink, fontWeight: '900', fontSize: 16 },

  loadingBox: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { color: C.muted, fontWeight: '800' },

  rawBox: { marginTop: 14, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12 },
  rawTitle: { color: C.ink, fontWeight: '900' },
  rawText: { marginTop: 8, color: C.muted, fontWeight: '600' },

  ghostBtn: { marginTop: 16, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  ghostText: { color: C.ink, fontWeight: '900' },

  webNote: { marginTop: 12, color: C.muted, fontWeight: '600' },
});
