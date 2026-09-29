import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { analyzeManualProduct } from '../services/api';
import {
  PREMIUM_COLORS,
  PREMIUM_SHADOWS,
  PREMIUM_RADIUS,
} from '../theme/premiumTheme';
import { NeoButton, NeoInput } from '../components/neo';

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

      navigation.navigate('Result', { result, timestamp: Date.now() });
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Analysis failed';
      Alert.alert('Analysis Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation Top */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={[styles.backBtn, PREMIUM_SHADOWS.sm]}
            onPress={() => {
              if (navigation?.canGoBack && navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Main', { screen: 'Scan' });
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={16} color={PREMIUM_COLORS.ink} style={{ marginRight: 4 }} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.categoryBadge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>CUSTOM DATA</Text>
          </View>
          <Text style={styles.screenTitle}>Manual Nutrition Entry</Text>
          <Text style={styles.screenSub}>
            Type declared nutrition metrics per 100g to run ML NutriScore and FSSAI analysis.
          </Text>
        </View>

        {/* Form Card */}
        <View style={[styles.card, PREMIUM_SHADOWS.sm]}>
          <NeoInput
            label="Product Name *"
            placeholder="e.g. Handmade Granola"
            value={productName}
            onChangeText={setProductName}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <NeoInput
                label="Calories (kcal)"
                placeholder="450"
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <NeoInput
                label="Protein (g)"
                placeholder="12.5"
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <NeoInput
                label="Carbohydrates (g)"
                placeholder="60.0"
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <NeoInput
                label="Total Sugar (g)"
                placeholder="15.0"
                value={sugar}
                onChangeText={setSugar}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <NeoInput
                label="Total Fat (g)"
                placeholder="18.0"
                value={fat}
                onChangeText={setFat}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <NeoInput
                label="Fiber (g)"
                placeholder="6.0"
                value={fiber}
                onChangeText={setFiber}
                keyboardType="numeric"
              />
            </View>
          </View>

          <NeoInput
            label="Salt / Sodium Equivalent (g)"
            placeholder="0.4"
            value={salt}
            onChangeText={setSalt}
            keyboardType="numeric"
          />

          <NeoButton
            title="Analyze Nutrition Facts →"
            onPress={onSubmit}
            loading={loading}
            variant="black"
            size="lg"
            style={{ marginTop: 8 }}
          />
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
    paddingTop: 48,
    paddingBottom: 40,
  },
  navBar: {
    marginBottom: 12,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PREMIUM_COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: PREMIUM_RADIUS.pill,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.border,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: PREMIUM_COLORS.ink,
  },
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
    fontSize: 26,
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
  card: {
    backgroundColor: PREMIUM_COLORS.card,
    borderRadius: PREMIUM_RADIUS.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.border,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});
