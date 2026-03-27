import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';

import { explainProduct } from '../services/api';

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

function _decisionMeta(decision) {
  const d = String(decision || '').toUpperCase();
  if (d === 'SAFE') return { text: 'SAFE', bg: C.sageLight, fg: '#1e5222', icon: '✅' };
  if (d === 'MODERATE') return { text: 'MODERATE', bg: C.amberLight, fg: '#7a4a0a', icon: '⚡' };
  return { text: d || 'AVOID', bg: C.redLight, fg: '#8c1a0a', icon: '⛔' };
}

function _riskBadge(level) {
  const l = String(level || '').toUpperCase();
  if (l.includes('LOW')) return { text: 'LOW', bg: C.sageLight, fg: '#1e5222', icon: '✅' };
  if (l.includes('MED')) return { text: 'MEDIUM', bg: C.amberLight, fg: '#7a4a0a', icon: '⚡' };
  if (l.includes('HIGH')) return { text: 'HIGH', bg: C.redLight, fg: '#8c1a0a', icon: '⛔' };
  return { text: l || 'N/A', bg: C.white, fg: C.muted, icon: '•' };
}

function NutrientRow({ label, value, max, color }) {
  const v = Number(value) || 0;
  const m = Number(max) || 100;
  const pct = Math.max(0, Math.min(1, m ? v / m : 0));
  return (
    <View style={styles.nRow}>
      <View style={styles.nRowTop}>
        <Text style={styles.nLabel}>{label}</Text>
        <Text style={styles.nValue}>{v}</Text>
      </View>
      <View style={styles.nBarBg}>
        <View style={[styles.nBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function _friendlyAdviceFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';

  const normalized = raw
    .replace(/\s*;\s*/g, '. ')
    .replace(/\s*\|\s*/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\.+/g, '.')
    .trim();

  if (!normalized) return '';

  const sentences = normalized
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/[!?]$/.test(s) ? s : `${s}.`));

  return sentences.join(' ');
}

function _friendlyDietNote(dietNote) {
  const raw = String(dietNote || '').trim();
  if (!raw) return '';

  if (/Sugar\s*>\s*5g/i.test(raw) && /diabetic/i.test(raw)) {
    return '⚠️ This product has high sugar — not recommended for diabetic diet.';
  }

  return _friendlyAdviceFromText(raw);
}

function _extractExplainSteps(explain) {
  const steps = explain?.steps;
  return Array.isArray(steps) ? steps : [];
}

function _extractFallbackReasons(result) {
  const a = Array.isArray(result?.reasons) ? result.reasons : [];
  const b = Array.isArray(result?.analysis?.reasons) ? result.analysis.reasons : [];
  const reasons = [...a, ...b].filter(Boolean);
  return reasons;
}

export default function ResultScreen({ route, navigation }) {
  const result = route?.params?.result;
  const barcode = result?.product?.barcode || result?.barcode;

  const decision = result?.decision?.final_decision || result?.final_decision;
  const healthScore = result?.analysis?.health_score ?? result?.health_score;
  const productName = result?.product?.name || result?.product_name;
  const nutrition = result?.product?.nutrition || result?.nutrition || {};

  const ingredientAnalysis = result?.analysis?.ingredient_analysis || result?.ingredient_analysis;
  const additiveAnalysis = result?.analysis?.additive_analysis || result?.additive_analysis;
  const dietNote = result?.diet_note;

  const [servingGrams, setServingGrams] = useState('100');

  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explain, setExplain] = useState(null);
  const [explainError, setExplainError] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    setServingGrams('100');
    setExplain(null);
    setExplainError(false);
    setShowBreakdown(false);
    setLoadingExplain(false);
  }, [route?.params?.timestamp]);

  useEffect(() => {
    setServingGrams('100');
  }, [barcode]);

  const decisionMeta = useMemo(() => _decisionMeta(decision), [decision]);
  const ingredientRisk = useMemo(() => _riskBadge(ingredientAnalysis?.risk_level), [ingredientAnalysis]);

  const loadExplain = async () => {
    if (!barcode) return;
    if (String(barcode) === '00000000') return;
    setLoadingExplain(true);
    setExplainError(false);
    try {
      const data = await explainProduct(barcode);
      setExplain(data);
    } catch (e) {
      setExplainError(true);
    } finally {
      setLoadingExplain(false);
    }
  };

  const additiveList = additiveAnalysis?.additives || [];
  const brand = result?.product?.brand || result?.brand || '';

  const verdictReason =
    (Array.isArray(result?.reasons) && result.reasons.length > 0 ? result.reasons[0] : null) ||
    (Array.isArray(result?.analysis?.reasons) && result.analysis.reasons.length > 0 ? result.analysis.reasons[0] : null) ||
    result?.diet_note ||
    '';

  const reasonsJoined = useMemo(() => _extractFallbackReasons(result).join('; '), [route?.params?.timestamp]);
  const friendlyDietNote = useMemo(() => _friendlyDietNote(dietNote), [dietNote]);
  const adviceText = useMemo(() => {
    const base = reasonsJoined || dietNote || 'Keep an eye on portion size and daily balance.';
    return _friendlyAdviceFromText(base);
  }, [reasonsJoined, dietNote]);

  const breakdownSteps = useMemo(() => {
    if (explainError || String(barcode) === '00000000') return [];
    return _extractExplainSteps(explain);
  }, [explain, explainError, barcode]);

  const servingSizeNum = useMemo(() => {
    const n = Number(String(servingGrams || '').trim());
    if (!Number.isFinite(n) || n <= 0) return 100;
    return n;
  }, [servingGrams]);

  const servingRatio = useMemo(() => servingSizeNum / 100, [servingSizeNum]);

  const perServing = useMemo(() => {
    const scale = (v) => {
      const num = Number(v);
      if (!Number.isFinite(num)) return 0;
      return Math.round(num * servingRatio * 100) / 100;
    };

    return {
      calories: scale(nutrition?.calories ?? 0),
      sugar: scale(nutrition?.sugar ?? 0),
      salt: scale(nutrition?.salt ?? 0),
      fat: scale(nutrition?.fat ?? 0),
      protein: scale(nutrition?.protein ?? 0),
      fiber: scale(nutrition?.fiber ?? 0),
      carbs: scale(nutrition?.carbs ?? 0),
    };
  }, [nutrition, servingRatio]);

  const dailyCalorieLimit = useMemo(() => {
    const consumed = result?.daily_intake?.consumed;
    const remaining = result?.daily_intake?.remaining;
    const c = Number(consumed);
    const r = Number(remaining);
    if (Number.isFinite(c) && Number.isFinite(r) && c >= 0 && r >= 0) return c + r;
    return 2000;
  }, [route?.params?.timestamp]);

  const servingPctOfDaily = useMemo(() => {
    const lim = Number(dailyCalorieLimit);
    if (!Number.isFinite(lim) || lim <= 0) return null;
    return Math.round((Number(perServing.calories || 0) / lim) * 100);
  }, [dailyCalorieLimit, perServing]);

  const fallbackReasons = useMemo(() => {
    if (!explainError && String(barcode) !== '00000000') return [];
    return _extractFallbackReasons(result);
  }, [route?.params?.timestamp, explainError, barcode]);

  if (!result) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 16 }]}>
        <Text style={{ color: C.muted, fontWeight: '700' }}>No result to show.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.headerBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Result</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Main', { screen: 'Home' })}>
          <Text style={styles.headerHomeText}>🏠 Home</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.productCard}>
        <View style={styles.productEmojiCircle}>
          <Text style={styles.productEmoji}>🥫</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.productName} numberOfLines={2}>{productName || 'Unknown product'}</Text>
          <Text style={styles.productBrand} numberOfLines={1}>{brand || ' '}</Text>
        </View>
      </View>

      <View style={[styles.verdictBanner, { backgroundColor: decisionMeta.bg, borderColor: C.border }]}>
        <Text style={[styles.verdictTitle, { color: decisionMeta.fg }]}>{decisionMeta.icon} {decisionMeta.text}</Text>
        <Text style={[styles.verdictReason, { color: decisionMeta.fg }]} numberOfLines={3}>
          {verdictReason || 'Verdict based on nutrition and ingredient profile.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nutrition per 100g</Text>
        <NutrientRow label="Calories" value={nutrition.calories ?? 0} max={500} color={C.sage} />
        <NutrientRow label="Sugar (g)" value={nutrition.sugar ?? 0} max={50} color={C.amberLight} />
        <NutrientRow label="Salt (g)" value={nutrition.salt ?? 0} max={10} color={C.redLight} />
        <NutrientRow label="Fat (g)" value={nutrition.fat ?? 0} max={70} color={C.amberLight} />
        <NutrientRow label="Protein (g)" value={nutrition.protein ?? 0} max={50} color={C.sageLight} />
        <NutrientRow label="Fiber (g)" value={nutrition.fiber ?? 0} max={30} color={C.sageLight} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Calculate for My Serving</Text>
        <Text style={styles.cardText}>How much are you eating? (g)</Text>
        <TextInput
          style={styles.servingInput}
          value={servingGrams}
          onChangeText={setServingGrams}
          keyboardType="numeric"
          placeholder="100"
          placeholderTextColor={C.muted}
        />

        <View style={styles.servingSummary}>
          <Text style={styles.servingLine}>For {servingSizeNum}g serving:</Text>
          <Text style={styles.servingLine}>{perServing.calories} calories</Text>
          <Text style={styles.servingLine}>{perServing.sugar}g sugar • {perServing.salt}g salt • {perServing.fat}g fat</Text>
          <Text style={styles.servingLine}>{perServing.protein}g protein • {perServing.fiber}g fiber • {perServing.carbs}g carbs</Text>
          {servingPctOfDaily !== null ? (
            <Text style={styles.servingPill}>This is {servingPctOfDaily}% of your daily calorie limit</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.flagsRow}>
        <View style={[styles.flagPill, { backgroundColor: ingredientRisk.bg, borderColor: C.border }]}>
          <Text style={[styles.flagText, { color: ingredientRisk.fg }]}>{ingredientRisk.icon} Ingredients: {ingredientRisk.text}</Text>
        </View>
        <View style={[styles.flagPill, { backgroundColor: additiveList.length ? C.amberLight : C.sageLight, borderColor: C.border }]}>
          <Text style={[styles.flagText, { color: additiveList.length ? '#7a4a0a' : '#1e5222' }]}>
            {additiveList.length ? '⚡' : '✅'} Additives: {additiveList.length ? additiveList.length : 0}
          </Text>
        </View>
      </View>

      <View style={styles.adviceBox}>
        <Text style={styles.adviceKicker}>💡 PERSONALISED ADVICE</Text>
        {friendlyDietNote ? <Text style={styles.dietNoteText}>{friendlyDietNote}</Text> : null}
        <Text style={styles.adviceText}>{adviceText}</Text>
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={styles.accordionHeader} onPress={() => {
          if (!explain && barcode && String(barcode) !== '00000000') loadExplain();
          setShowBreakdown((v) => !v);
        }}>
          <Text style={styles.cardTitle}>See Score Breakdown</Text>
          <Text style={styles.chevron}>{showBreakdown ? '▴' : '▾'}</Text>
        </TouchableOpacity>

        {loadingExplain ? (
          <View style={{ marginTop: 10 }}>
            <ActivityIndicator color={C.sage} />
          </View>
        ) : null}

        {showBreakdown ? (
          <>
            {explain && explain.score_calculation ? (
              <Text style={styles.cardText}>Calculation: {explain.score_calculation}</Text>
            ) : null}

            {breakdownSteps.length > 0
              ? breakdownSteps.map((s, idx) => {
                  const impact = Number(s?.impact) || 0;
                  const impactColor = impact >= 0 ? '#1e5222' : '#8c1a0a';
                  const value = s?.value ?? s?.val;
                  return (
                    <View key={idx} style={styles.step}>
                      <View style={styles.stepTopRow}>
                        <Text style={styles.stepFactor} numberOfLines={2}>{String(s?.factor || 'Factor')}</Text>
                        <Text style={[styles.stepImpact, { color: impactColor }]}>
                          {impact >= 0 ? '+' : ''}{impact}
                        </Text>
                      </View>
                      {value !== undefined && value !== null && String(value).length ? (
                        <Text style={styles.stepValue}>Value: {String(value)}</Text>
                      ) : null}
                      {s?.reason ? <Text style={styles.stepText}>{String(s.reason)}</Text> : null}
                    </View>
                  );
                })
              : null}

            {breakdownSteps.length === 0 && fallbackReasons.length > 0
              ? fallbackReasons.map((r, idx) => (
                  <View key={idx} style={styles.step}>
                    <Text style={styles.stepTitle}>Reason</Text>
                    <Text style={styles.stepText}>{String(r)}</Text>
                  </View>
                ))
              : null}

            {breakdownSteps.length === 0 && fallbackReasons.length === 0 && !loadingExplain ? (
              <Text style={styles.cardText}>No breakdown available for this scan.</Text>
            ) : null}
          </>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.inkBtn}
        onPress={() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Main' }],
          });
        }}
      >
        <Text style={styles.inkBtnText}>Scan Another</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: C.ink },
  headerBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  headerBtnText: { fontSize: 16, fontWeight: '900', color: C.ink },
  headerHomeText: { fontSize: 14, fontWeight: '900', color: C.ink },
  productCard: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  productEmojiCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.sageLight, alignItems: 'center', justifyContent: 'center' },
  productEmoji: { fontSize: 24 },
  productName: { fontSize: 18, fontWeight: '900', color: C.ink },
  productBrand: { marginTop: 4, color: C.muted, fontWeight: '600' },

  verdictBanner: { marginTop: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  verdictTitle: { fontSize: 16, fontWeight: '900' },
  verdictReason: { marginTop: 6, fontWeight: '700' },

  card: { marginTop: 12, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: C.ink },
  cardText: { color: C.muted, fontWeight: '600', marginTop: 8 },
  servingInput: { marginTop: 10, backgroundColor: C.white, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingVertical: 11, paddingHorizontal: 14, color: C.ink, fontWeight: '800' },
  servingSummary: { marginTop: 12, backgroundColor: C.cream, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12 },
  servingLine: { color: C.ink, fontWeight: '800', marginTop: 4 },
  servingPill: { marginTop: 10, color: '#1e5222', fontWeight: '900' },

  nRow: { marginTop: 12 },
  nRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nLabel: { color: C.ink, fontWeight: '800' },
  nValue: { color: C.muted, fontWeight: '800' },
  nBarBg: { height: 8, backgroundColor: C.white, borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginTop: 8 },
  nBarFill: { height: 8, borderRadius: 999 },

  flagsRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  flagPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  flagText: { fontWeight: '900' },

  adviceBox: { marginTop: 12, backgroundColor: C.sageLight, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  adviceKicker: { color: '#1e5222', fontWeight: '900' },
  dietNoteText: { marginTop: 6, color: '#1e5222', fontWeight: '900' },
  adviceText: { marginTop: 6, color: '#1e5222', fontWeight: '700' },

  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevron: { fontSize: 18, fontWeight: '900', color: C.ink },
  step: { marginTop: 12, backgroundColor: C.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  stepTitle: { fontWeight: '900', color: C.ink },
  stepTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  stepFactor: { flex: 1, fontWeight: '900', color: C.ink },
  stepImpact: { fontWeight: '900' },
  stepValue: { marginTop: 6, color: C.muted, fontWeight: '800' },
  stepText: { marginTop: 6, color: C.muted, fontWeight: '600' },

  inkBtn: { marginTop: 14, backgroundColor: C.ink, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  inkBtnText: { color: C.white, fontWeight: '900', fontSize: 16 },
});
