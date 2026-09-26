import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';

import { analyzeManualProduct } from '../services/api';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS, NEO_TYPOGRAPHY } from '../theme/neoTheme';
import { NeoCard, NeoButton, NeoInput, NeoBadge, NeoSectionHeader } from '../components/neo';

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
      Alert.alert('Missing Product Name', 'Product name is required to run analysis.');
      return;
    }

    setLoading(true);
    try {
      const analyzed = await analyzeManualProduct(payload);

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

      navigation.replace('Result', { result, timestamp: Date.now() });
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Analysis failed';
      Alert.alert('Analysis Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <NeoBadge text="MANUAL AUDIT MODE" variant="yellow" />
          <Text style={styles.headerTag}>⚡ FALLBACK INPUT</Text>
        </View>
        <Text style={styles.title}>Manual Nutrition Entry</Text>
        <Text style={styles.subtitle}>
          Enter values from the back-of-pack nutrition table for instant PRAMAAN verification.
        </Text>
      </View>

      {/* Form Card */}
      <NeoCard variant="white" elevation="lg" style={styles.card}>
        <NeoSectionHeader title="Product Details" count="Required" tagColor={NEO_COLORS.yellow} />
        <NeoInput
          label="Product / Food Name"
          value={productName}
          onChangeText={setProductName}
          placeholder="e.g. Sprite 330ml / Oats Biscuit"
          editable={!loading}
        />

        <NeoSectionHeader
          title="Nutritional Breakdown"
          count="per 100g"
          tagColor={NEO_COLORS.cyan}
          style={{ marginTop: 12 }}
        />

        {/* 2-Column Responsive Grid */}
        <View style={styles.grid}>
          <View style={styles.gridCol}>
            <NeoInput
              label="Energy (kcal)"
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              placeholder="0"
              editable={!loading}
              rightElement={<Text style={styles.unitText}>kcal</Text>}
            />
          </View>
          <View style={styles.gridCol}>
            <NeoInput
              label="Total Fat"
              value={fat}
              onChangeText={setFat}
              keyboardType="numeric"
              placeholder="0.0"
              editable={!loading}
              rightElement={<Text style={styles.unitText}>g</Text>}
            />
          </View>
          <View style={styles.gridCol}>
            <NeoInput
              label="Sugars"
              value={sugar}
              onChangeText={setSugar}
              keyboardType="numeric"
              placeholder="0.0"
              editable={!loading}
              rightElement={<Text style={styles.unitText}>g</Text>}
            />
          </View>
          <View style={styles.gridCol}>
            <NeoInput
              label="Salt / Sodium"
              value={salt}
              onChangeText={setSalt}
              keyboardType="numeric"
              placeholder="0.0"
              editable={!loading}
              rightElement={<Text style={styles.unitText}>g</Text>}
            />
          </View>
          <View style={styles.gridCol}>
            <NeoInput
              label="Protein"
              value={protein}
              onChangeText={setProtein}
              keyboardType="numeric"
              placeholder="0.0"
              editable={!loading}
              rightElement={<Text style={styles.unitText}>g</Text>}
            />
          </View>
          <View style={styles.gridCol}>
            <NeoInput
              label="Fiber"
              value={fiber}
              onChangeText={setFiber}
              keyboardType="numeric"
              placeholder="0.0"
              editable={!loading}
              rightElement={<Text style={styles.unitText}>g</Text>}
            />
          </View>
        </View>

        <NeoInput
          label="Total Carbohydrates (g)"
          value={carbs}
          onChangeText={setCarbs}
          keyboardType="numeric"
          placeholder="0.0"
          editable={!loading}
          rightElement={<Text style={styles.unitText}>g</Text>}
        />

        {/* Action Buttons */}
        <View style={styles.actionsWrap}>
          <NeoButton
            title={loading ? 'AUDITING NUTRITION...' : 'ANALYSE WITH PRAMAAN'}
            variant="coral"
            size="lg"
            onPress={onSubmit}
            disabled={loading}
          />

          <NeoButton
            title="CANCEL & RETURN"
            variant="white"
            size="md"
            onPress={() => navigation.goBack()}
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
  card: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCol: {
    width: '48%',
  },
  unitText: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.muted,
    paddingRight: 4,
  },
  actionsWrap: {
    marginTop: 12,
    gap: 10,
  },
});
