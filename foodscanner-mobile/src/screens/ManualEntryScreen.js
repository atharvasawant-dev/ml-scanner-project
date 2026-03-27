import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';

import { analyzeManualProduct } from '../services/api';
import { getToken } from '../utils/storage';

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

function NumInput({ label, value, onChangeText }) {
  return (
    <View style={styles.gridItem}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={C.muted}
      />
    </View>
  );
}

function _toNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function ManualEntryScreen({ navigation, route }) {
  const prefillName = route?.params?.productName;
  const prefillNutrition = route?.params?.nutrition;
  const prefillCalories = route?.params?.calories;

  const [productName, setProductName] = useState(String(prefillName || ''));
  const [loading, setLoading] = useState(false);

  const [calories, setCalories] = useState(
    prefillNutrition?.calories != null
      ? String(prefillNutrition.calories)
      : prefillCalories != null
        ? String(prefillCalories)
        : ''
  );
  const [fat, setFat] = useState(prefillNutrition?.fat != null ? String(prefillNutrition.fat) : '');
  const [sugar, setSugar] = useState(prefillNutrition?.sugar != null ? String(prefillNutrition.sugar) : '');
  const [salt, setSalt] = useState(prefillNutrition?.salt != null ? String(prefillNutrition.salt) : '');
  const [protein, setProtein] = useState(prefillNutrition?.protein != null ? String(prefillNutrition.protein) : '');
  const [fiber, setFiber] = useState(prefillNutrition?.fiber != null ? String(prefillNutrition.fiber) : '');
  const [carbs, setCarbs] = useState(prefillNutrition?.carbs != null ? String(prefillNutrition.carbs) : '');

  const payload = useMemo(
    () => ({
      product_name: String(productName || '').trim(),
      calories: _toNum(calories),
      fat: _toNum(fat),
      sugar: _toNum(sugar),
      salt: _toNum(salt),
      protein: _toNum(protein),
      fiber: _toNum(fiber),
      carbs: _toNum(carbs),
    }),
    [productName, calories, fat, sugar, salt, protein, fiber, carbs]
  );

  const onSubmit = async () => {
    if (!payload.product_name) {
      Alert.alert('Missing product name', 'Product name is required.');
      return;
    }

    setLoading(true);
    try {
      const analyzed = await analyzeManualProduct(payload);

      // Ensure ResultScreen can render it like a /scan response
      const result = {
        product: {
          name: analyzed?.product?.name || payload.product_name,
          nutrition: analyzed?.product?.nutrition || analyzed?.nutrition || {
            calories: payload.calories,
            fat: payload.fat,
            sugar: payload.sugar,
            salt: payload.salt,
            protein: payload.protein,
            fiber: payload.fiber,
            carbs: payload.carbs,
          },
          barcode: '00000000',
        },
        analysis: analyzed?.analysis || {
          ingredient_analysis: null,
          additive_analysis: null,
          health_score: analyzed?.health_score,
        },
        decision: analyzed?.decision || {
          final_decision: analyzed?.final_decision,
          reasons: analyzed?.reasons,
        },
        diet_note: analyzed?.diet_note,
        recommendations: analyzed?.recommendations || [],
        final_decision: analyzed?.final_decision,
        health_score: analyzed?.health_score,
        reasons: analyzed?.reasons,
      };

      try {
        const token = await getToken();
        await fetch(`http://192.168.29.149:8000/food-log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            product_name: productName || 'Manual Entry',
            calories: parseFloat(result?.product?.nutrition?.calories || calories) || 0,
          }),
        }).catch(() => {});
      } catch (e) {
        // ignore
      }

      navigation.replace('Result', { result, timestamp: Date.now() });
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Analysis failed';
      Alert.alert('Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <Text style={styles.title}>Enter Nutrition Details</Text>
      <Text style={styles.subtitle}>Product not found? Enter the values from the nutrition label</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Product name</Text>
        <TextInput
          style={styles.input}
          value={productName}
          onChangeText={setProductName}
          placeholder="e.g. Sprite"
          placeholderTextColor={C.muted}
        />

        <View style={styles.grid}>
          <NumInput label="Calories (kcal)" value={calories} onChangeText={setCalories} />
          <NumInput label="Fat (g)" value={fat} onChangeText={setFat} />
          <NumInput label="Sugar (g)" value={sugar} onChangeText={setSugar} />
          <NumInput label="Salt (g)" value={salt} onChangeText={setSalt} />
          <NumInput label="Protein (g)" value={protein} onChangeText={setProtein} />
          <NumInput label="Fiber (g)" value={fiber} onChangeText={setFiber} />
          <NumInput label="Carbs (g)" value={carbs} onChangeText={setCarbs} />
        </View>

        <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={C.white} />
              <Text style={styles.btnText}>Analysing…</Text>
            </View>
          ) : (
            <Text style={styles.btnText}>ANALYSE</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.ghostBtnText}>Cancel</Text>
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

  label: { color: C.ink, fontWeight: '900', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: C.white, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingVertical: 11, paddingHorizontal: 14, color: C.ink, fontWeight: '700' },

  grid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '48%' },

  btn: { marginTop: 16, backgroundColor: C.sage, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: C.white, fontWeight: '900', fontSize: 16, letterSpacing: 0.6 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  ghostBtn: { marginTop: 10, backgroundColor: C.white, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingVertical: 12, alignItems: 'center' },
  ghostBtnText: { color: C.ink, fontWeight: '900' },
});
