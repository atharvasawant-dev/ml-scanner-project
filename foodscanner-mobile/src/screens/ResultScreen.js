import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';

import { explainProduct, logFoodItem, scanProduct } from '../services/api';
import ClaimVerificationCard from '../components/ClaimVerificationCard';
import HealthierAlternativesCard from '../components/HealthierAlternativesCard';
import ComparisonCard from '../components/ComparisonCard';
import AIChatSection from '../components/AIChatSection';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../theme/neoTheme';

function _decisionMeta(decision) {
  const d = String(decision || '').toUpperCase();
  if (d === 'SAFE') {
    return { text: 'SAFE', bg: NEO_COLORS.green, fg: NEO_COLORS.ink, icon: '✅', label: 'RECOMMENDED' };
  }
  if (d === 'MODERATE') {
    return { text: 'MODERATE', bg: NEO_COLORS.yellow, fg: NEO_COLORS.ink, icon: '⚡', label: 'CONSUME IN MODERATION' };
  }
  return { text: d || 'AVOID', bg: NEO_COLORS.coral, fg: NEO_COLORS.ink, icon: '⛔', label: 'HIGH RISK NUTRIENTS' };
}

function _riskBadge(level) {
  const l = String(level || '').toUpperCase();
  if (l.includes('LOW')) return { text: 'LOW RISK', bg: NEO_COLORS.green, fg: NEO_COLORS.ink, icon: '✅' };
  if (l.includes('MED')) return { text: 'MODERATE RISK', bg: NEO_COLORS.yellow, fg: NEO_COLORS.ink, icon: '⚡' };
  if (l.includes('HIGH')) return { text: 'HIGH RISK', bg: NEO_COLORS.coral, fg: NEO_COLORS.ink, icon: '⛔' };
  return { text: l || 'UNKNOWN', bg: NEO_COLORS.bgAlt, fg: NEO_COLORS.muted, icon: '•' };
}

function NeoNutrientRow({ label, value, max, unit = 'g', color = NEO_COLORS.yellow }) {
  const v = Number(value) || 0;
  const m = Number(max) || 100;
  const pct = Math.max(0, Math.min(1, m ? v / m : 0));

  return (
    <View style={styles.nRow}>
      <View style={styles.nRowTop}>
        <Text style={styles.nLabel}>{label}</Text>
        <Text style={styles.nValue}>{v}{unit}</Text>
      </View>
      <View style={styles.nBarTrack}>
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

  const [activePortionTab, setActivePortionTab] = useState('100g'); // '100g' or 'custom'
  const [servingGrams, setServingGrams] = useState('100');

  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explain, setExplain] = useState(null);
  const [explainError, setExplainError] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [loggingFood, setLoggingFood] = useState(false);
  const [foodLogged, setFoodLogged] = useState(false);

  useEffect(() => {
    setServingGrams('100');
    setActivePortionTab('100g');
    setExplain(null);
    setExplainError(false);
    setShowBreakdown(false);
    setLoadingExplain(false);
    setFoodLogged(false);
    setLoggingFood(false);
  }, [route?.params?.timestamp]);

  useEffect(() => {
    setServingGrams('100');
  }, [barcode]);

  const decisionMeta = useMemo(() => _decisionMeta(decision), [decision]);
  const ingredientRisk = useMemo(() => _riskBadge(ingredientAnalysis?.risk_level), [ingredientAnalysis]);

  const handleSelectAlternative = async (alt) => {
    const altBarcode = alt?.barcode;
    const altName = alt?.product_name || alt?.name;
    if (!altBarcode && !altName) return;
    try {
      const res = await scanProduct(altBarcode || '00000000', altBarcode ? null : altName);
      navigation.push('Result', { result: res, timestamp: Date.now() });
    } catch (_e) {
      Alert.alert(
        'Alternative Selected',
        `Selected: ${altName || 'Product'}. Use manual search on the Scan screen to view full details.`
      );
    }
  };

  const handleLogToDiary = async () => {
    if (loggingFood || foodLogged) return;
    setLoggingFood(true);
    try {
      await logFoodItem({
        product_name: productName || 'Unknown Product',
        barcode: barcode || 'manual',
        calories: perServing.calories ?? 0,
        fat: perServing.fat,
        sugar: perServing.sugar,
        salt: perServing.salt,
        protein: perServing.protein,
        fiber: perServing.fiber,
        carbs: perServing.carbs,
        serving_size: servingSizeNum,
      });
      setFoodLogged(true);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Could not log item to diary.';
      Alert.alert('Logging Failed', String(msg));
    } finally {
      setLoggingFood(false);
    }
  };

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
    if (activePortionTab === '100g') return 100;
    const n = Number(String(servingGrams || '').trim());
    if (!Number.isFinite(n) || n <= 0) return 100;
    return n;
  }, [activePortionTab, servingGrams]);

  const servingRatio = useMemo(() => servingSizeNum / 100, [servingSizeNum]);

  const perServing = useMemo(() => {
    const scale = (v) => {
      const num = Number(v);
      if (!Number.isFinite(num)) return 0;
      return Math.round(num * servingRatio * 10) / 10;
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
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 20 }]}>
        <View style={[styles.productCard, NEO_SHADOWS.md]}>
          <Text style={{ color: NEO_COLORS.ink, fontWeight: '900', fontSize: 16 }}>No scan result to display.</Text>
          <TouchableOpacity
            style={[styles.diaryBtn, { marginTop: 16 }, NEO_SHADOWS.sm]}
            onPress={() => navigation.navigate('Main', { screen: 'Scan' })}
          >
            <Text style={styles.diaryBtnText}>SCAN A PRODUCT</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const numericScore = healthScore !== undefined && healthScore !== null ? Number(healthScore) : null;
  const scoreDisplay = numericScore !== null && Number.isFinite(numericScore) ? Math.round(numericScore) : 'N/A';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* 1. Header Navigation Bar */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, NEO_SHADOWS.sm]}
          activeOpacity={0.85}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.navBtnIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.screenTag}>
          <Text style={styles.screenTagText}>AUDIT REPORT</Text>
        </View>

        <TouchableOpacity
          style={[styles.navBtn, NEO_SHADOWS.sm]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Main', { screen: 'Home' })}
        >
          <Text style={styles.navHomeText}>🏠 HOME</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Product Identity Card */}
      <View style={[styles.productCard, NEO_SHADOWS.md]}>
        <View style={styles.productTopRow}>
          <View style={styles.productIconBox}>
            <Text style={styles.productIconEmoji}>🥫</Text>
          </View>
          <View style={{ flex: 1 }}>
            {brand ? (
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>{brand}</Text>
              </View>
            ) : null}
            <Text style={styles.productName} numberOfLines={2}>
              {productName || 'Unknown Product'}
            </Text>
            {barcode && String(barcode) !== '00000000' ? (
              <Text style={styles.barcodeText}>UPC: {barcode}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* 3. HEALTH SCORE HERO (Visually Dominant Component Library Card) */}
      <View style={[styles.heroCard, NEO_SHADOWS.lg]}>
        <View style={styles.heroHeader}>
          <View style={styles.heroHeaderLeft}>
            <View style={styles.heroMarker} />
            <Text style={styles.heroHeaderText}>PRAMAAN HEALTH SCORE</Text>
          </View>
          <View style={[styles.heroDecisionPill, { backgroundColor: decisionMeta.bg }]}>
            <Text style={styles.heroDecisionText}>{decisionMeta.text}</Text>
          </View>
        </View>

        <View style={styles.heroBody}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreBig}>{scoreDisplay}</Text>
            <Text style={styles.scoreScale}>/100</Text>
          </View>

          {/* Hard-outlined Progress Bar */}
          <View style={styles.scoreTrack}>
            <View
              style={[
                styles.scoreFill,
                {
                  width: `${numericScore !== null ? Math.min(100, Math.max(0, numericScore)) : 0}%`,
                  backgroundColor: decisionMeta.bg,
                },
              ]}
            />
          </View>

          {/* Verdict Banner */}
          <View style={[styles.verdictCallout, { backgroundColor: decisionMeta.bg }]}>
            <Text style={styles.verdictTitle}>{decisionMeta.icon} {decisionMeta.label}</Text>
            <Text style={styles.verdictReason} numberOfLines={3}>
              {verdictReason || 'Algorithmic decision based on nutritional density and ingredient quality.'}
            </Text>
          </View>
        </View>
      </View>

      {/* 4. Portion Selector & Nutrition Breakdown */}
      <View style={[styles.sectionCard, NEO_SHADOWS.md]}>
        <View style={[styles.sectionHeaderBanner, { backgroundColor: NEO_COLORS.yellow }]}>
          <Text style={styles.sectionBannerTitle}>NUTRITIONAL PROFILE</Text>
          <Text style={styles.sectionBannerSub}>{servingSizeNum}g portion</Text>
        </View>

        <View style={styles.sectionInner}>
          {/* Segmented Portion Tabs */}
          <View style={styles.portionTabWrap}>
            <TouchableOpacity
              style={[
                styles.portionTab,
                activePortionTab === '100g' && [styles.portionTabActive, NEO_SHADOWS.sm],
              ]}
              onPress={() => setActivePortionTab('100g')}
            >
              <Text style={[styles.portionTabText, activePortionTab === '100g' && styles.portionTabTextActive]}>
                100G BASELINE
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.portionTab,
                activePortionTab === 'custom' && [styles.portionTabActive, NEO_SHADOWS.sm],
              ]}
              onPress={() => setActivePortionTab('custom')}
            >
              <Text style={[styles.portionTabText, activePortionTab === 'custom' && styles.portionTabTextActive]}>
                MY PORTION (CUSTOM)
              </Text>
            </TouchableOpacity>
          </View>

          {activePortionTab === 'custom' ? (
            <View style={styles.customPortionBox}>
              <Text style={styles.customPortionLabel}>PORTION SIZE (GRAMS):</Text>
              <View style={styles.portionInputRow}>
                <TextInput
                  style={[styles.portionInput, NEO_SHADOWS.sm]}
                  value={servingGrams}
                  onChangeText={setServingGrams}
                  keyboardType="numeric"
                  placeholder="100"
                  placeholderTextColor={NEO_COLORS.muted}
                />
                <View style={styles.quickPortionBtns}>
                  <TouchableOpacity
                    style={styles.quickPortionBtn}
                    onPress={() => setServingGrams('50')}
                  >
                    <Text style={styles.quickPortionText}>50g</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPortionBtn}
                    onPress={() => setServingGrams('150')}
                  >
                    <Text style={styles.quickPortionText}>150g</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPortionBtn}
                    onPress={() => setServingGrams('200')}
                  >
                    <Text style={styles.quickPortionText}>200g</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {servingPctOfDaily !== null ? (
                <View style={styles.dailyPercentBadge}>
                  <Text style={styles.dailyPercentText}>
                    ⚡ Provides {servingPctOfDaily}% of your daily {dailyCalorieLimit} kcal limit
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Macro Bars */}
          <View style={styles.nutrientsList}>
            <NeoNutrientRow
              label="Calories"
              value={perServing.calories}
              max={600}
              unit=" kcal"
              color={NEO_COLORS.yellow}
            />
            <NeoNutrientRow
              label="Sugar"
              value={perServing.sugar}
              max={40}
              unit="g"
              color={NEO_COLORS.coral}
            />
            <NeoNutrientRow
              label="Salt / Sodium"
              value={perServing.salt}
              max={5}
              unit="g"
              color={NEO_COLORS.orange}
            />
            <NeoNutrientRow
              label="Total Fat"
              value={perServing.fat}
              max={50}
              unit="g"
              color={NEO_COLORS.pink}
            />
            <NeoNutrientRow
              label="Protein"
              value={perServing.protein}
              max={40}
              unit="g"
              color={NEO_COLORS.green}
            />
            <NeoNutrientRow
              label="Dietary Fiber"
              value={perServing.fiber}
              max={25}
              unit="g"
              color={NEO_COLORS.cyan}
            />
            <NeoNutrientRow
              label="Carbohydrates"
              value={perServing.carbs}
              max={80}
              unit="g"
              color={NEO_COLORS.purpleLight}
            />
          </View>
        </View>
      </View>

      {/* 5. Ingredient & Additive Hazards */}
      <View style={styles.flagsRow}>
        <View style={[styles.hazardPill, NEO_SHADOWS.sm]}>
          <Text style={styles.hazardHeader}>INGREDIENTS</Text>
          <View style={[styles.hazardBadge, { backgroundColor: ingredientRisk.bg }]}>
            <Text style={styles.hazardBadgeText}>{ingredientRisk.text}</Text>
          </View>
        </View>

        <View style={[styles.hazardPill, NEO_SHADOWS.sm]}>
          <Text style={styles.hazardHeader}>ADDITIVES DETECTED</Text>
          <View
            style={[
              styles.hazardBadge,
              { backgroundColor: additiveList.length ? NEO_COLORS.yellow : NEO_COLORS.green },
            ]}
          >
            <Text style={styles.hazardBadgeText}>
              {additiveList.length ? `${additiveList.length} CODIFIED` : '0 CLEAN'}
            </Text>
          </View>
        </View>
      </View>

      {/* 6. Personalised Diet Advice */}
      <View style={[styles.adviceCard, NEO_SHADOWS.sm]}>
        <View style={styles.adviceTopRow}>
          <Text style={styles.adviceIcon}>💡</Text>
          <Text style={styles.adviceKicker}>PERSONALISED DIET ADVICE</Text>
        </View>
        {friendlyDietNote ? (
          <Text style={styles.dietNoteText}>{friendlyDietNote}</Text>
        ) : null}
        <Text style={styles.adviceText}>{adviceText}</Text>
      </View>

      {/* 7. Score Factor Breakdown Accordion */}
      <View style={[styles.breakdownCard, NEO_SHADOWS.sm]}>
        <TouchableOpacity
          style={styles.breakdownHeader}
          activeOpacity={0.85}
          onPress={() => {
            if (!explain && barcode && String(barcode) !== '00000000') loadExplain();
            setShowBreakdown((v) => !v);
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.breakdownTitle}>ALGORITHMIC SCORE FACTORS</Text>
            <View style={styles.factorCountBadge}>
              <Text style={styles.factorCountText}>AI AUDIT</Text>
            </View>
          </View>
          <Text style={styles.chevron}>{showBreakdown ? '▴' : '▾'}</Text>
        </TouchableOpacity>

        {loadingExplain ? (
          <View style={{ padding: 12, alignItems: 'center' }}>
            <ActivityIndicator color={NEO_COLORS.ink} size="small" />
            <Text style={{ marginTop: 6, fontSize: 11, fontWeight: '800', color: NEO_COLORS.muted }}>
              Loading scoring rationale...
            </Text>
          </View>
        ) : null}

        {showBreakdown ? (
          <View style={styles.breakdownContent}>
            {explain && explain.score_calculation ? (
              <View style={styles.formulaBox}>
                <Text style={styles.formulaText}>{explain.score_calculation}</Text>
              </View>
            ) : null}

            {breakdownSteps.length > 0
              ? breakdownSteps.map((s, idx) => {
                  const impact = Number(s?.impact) || 0;
                  const impactBg = impact >= 0 ? NEO_COLORS.green : NEO_COLORS.coral;
                  const value = s?.value ?? s?.val;

                  return (
                    <View key={idx} style={[styles.stepItem, NEO_SHADOWS.sm]}>
                      <View style={styles.stepTopRow}>
                        <Text style={styles.stepFactor} numberOfLines={2}>
                          {String(s?.factor || 'Factor')}
                        </Text>
                        <View style={[styles.impactPill, { backgroundColor: impactBg }]}>
                          <Text style={styles.impactPillText}>
                            {impact >= 0 ? '+' : ''}{impact}
                          </Text>
                        </View>
                      </View>
                      {value !== undefined && value !== null && String(value).length ? (
                        <Text style={styles.stepValue}>Measured Value: {String(value)}</Text>
                      ) : null}
                      {s?.reason ? <Text style={styles.stepText}>{String(s.reason)}</Text> : null}
                    </View>
                  );
                })
              : null}

            {breakdownSteps.length === 0 && fallbackReasons.length > 0
              ? fallbackReasons.map((r, idx) => (
                  <View key={idx} style={styles.stepItem}>
                    <Text style={styles.stepText}>→ {String(r)}</Text>
                  </View>
                ))
              : null}
          </View>
        ) : null}
      </View>

      {/* 8. Batch 9A: Claim Verification */}
      <ClaimVerificationCard
        initialVerification={result?.claim_verification}
        barcode={barcode}
        nutrition={nutrition}
        ingredients={result?.product?.ingredients || result?.ingredients}
        productName={productName}
      />

      {/* 9. Batch 9A: Healthier Alternatives */}
      <HealthierAlternativesCard
        initialRecommendations={result?.recommendations || []}
        barcode={barcode}
        productName={productName}
        nutrition={nutrition}
        onSelectAlternative={handleSelectAlternative}
      />

      {/* 10. Batch 9A: Comparison Card */}
      <ComparisonCard
        currentProduct={{
          name: productName,
          brand: brand,
          barcode: barcode,
          nutrition: nutrition,
          health_score: healthScore,
          nutriscore: result?.product?.nutriscore || result?.nutriscore,
        }}
      />

      {/* 11. Batch 9A: AI Nutrition Assistant */}
      <AIChatSection
        barcode={barcode}
        productName={productName}
        nutrition={nutrition}
        healthScore={healthScore}
        decision={decision}
      />

      {/* 12. Primary Action Buttons (Tactile Neo-Brutalist) */}
      <View style={styles.actionsWrap}>
        <TouchableOpacity
          style={[
            styles.diaryBtn,
            foodLogged ? styles.diaryBtnSuccess : null,
            NEO_SHADOWS.md,
          ]}
          activeOpacity={0.88}
          onPress={handleLogToDiary}
          disabled={loggingFood || foodLogged}
        >
          {loggingFood ? (
            <ActivityIndicator color={NEO_COLORS.ink} size="small" />
          ) : (
            <Text style={styles.diaryBtnText}>
              {foodLogged ? '✓ LOGGED TO DAILY DIARY' : '+ LOG TO DAILY DIARY'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.scanAnotherBtn, NEO_SHADOWS.sm]}
          activeOpacity={0.88}
          onPress={() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          }}
        >
          <Text style={styles.scanAnotherText}>SCAN ANOTHER PRODUCT</Text>
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
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  navBtn: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navBtnIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  screenTag: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  screenTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.8,
  },
  navHomeText: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  productCard: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    padding: 14,
    marginBottom: 14,
  },
  productTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productIconBox: {
    width: 52,
    height: 52,
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productIconEmoji: {
    fontSize: 26,
  },
  brandBadge: {
    backgroundColor: NEO_COLORS.pinkLight,
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 3,
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 18,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: -0.3,
  },
  barcodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: NEO_COLORS.muted,
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    overflow: 'hidden',
    marginBottom: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: NEO_COLORS.yellow,
    borderBottomWidth: NEO_BORDERS.thick,
    borderBottomColor: NEO_COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroMarker: {
    width: 8,
    height: 8,
    backgroundColor: NEO_COLORS.ink,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  heroHeaderText: {
    fontSize: 13,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  heroDecisionPill: {
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroDecisionText: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.6,
  },
  heroBody: {
    padding: 16,
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4,
  },
  scoreBig: {
    fontSize: 60,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: -2,
  },
  scoreScale: {
    fontSize: 20,
    fontWeight: '900',
    color: NEO_COLORS.muted,
    marginLeft: 4,
  },
  scoreTrack: {
    width: '100%',
    height: 14,
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: 7,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 14,
  },
  scoreFill: {
    height: '100%',
    borderRightWidth: 2,
    borderRightColor: NEO_COLORS.border,
  },
  verdictCallout: {
    width: '100%',
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    padding: 12,
  },
  verdictTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  verdictReason: {
    fontSize: 12,
    fontWeight: '700',
    color: NEO_COLORS.ink,
    lineHeight: 17,
  },
  sectionCard: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    overflow: 'hidden',
    marginBottom: 14,
  },
  sectionHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: NEO_BORDERS.thick,
    borderBottomColor: NEO_COLORS.border,
  },
  sectionBannerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.4,
  },
  sectionBannerSub: {
    fontSize: 11,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  sectionInner: {
    padding: 14,
  },
  portionTabWrap: {
    flexDirection: 'row',
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    padding: 3,
    marginBottom: 12,
  },
  portionTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: NEO_RADIUS.xs,
  },
  portionTabActive: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
  },
  portionTabText: {
    fontSize: 11,
    fontWeight: '800',
    color: NEO_COLORS.muted,
  },
  portionTabTextActive: {
    color: NEO_COLORS.ink,
    fontWeight: '900',
  },
  customPortionBox: {
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    padding: 10,
    marginBottom: 14,
  },
  customPortionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  portionInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  portionInput: {
    width: 80,
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    textAlign: 'center',
  },
  quickPortionBtns: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  quickPortionBtn: {
    flex: 1,
    backgroundColor: NEO_COLORS.white,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingVertical: 7,
    alignItems: 'center',
  },
  quickPortionText: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  dailyPercentBadge: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: NEO_COLORS.mutedLight,
  },
  dailyPercentText: {
    fontSize: 11,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  nutrientsList: {
    gap: 10,
  },
  nRow: {
    marginVertical: 1,
  },
  nRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  nLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  nValue: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  nBarTrack: {
    height: 10,
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  nBarFill: {
    height: '100%',
    borderRightWidth: 1.5,
    borderRightColor: NEO_COLORS.border,
  },
  flagsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  hazardPill: {
    flex: 1,
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    padding: 10,
    alignItems: 'center',
  },
  hazardHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.muted,
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  hazardBadge: {
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  hazardBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.4,
  },
  adviceCard: {
    backgroundColor: NEO_COLORS.purpleLight,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    padding: 12,
    marginBottom: 14,
  },
  adviceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  adviceIcon: {
    fontSize: 14,
  },
  adviceKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  dietNoteText: {
    fontSize: 12,
    fontWeight: '800',
    color: NEO_COLORS.coral,
    marginBottom: 4,
  },
  adviceText: {
    fontSize: 12,
    fontWeight: '700',
    color: NEO_COLORS.ink,
    lineHeight: 17,
  },
  breakdownCard: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    overflow: 'hidden',
    marginBottom: 14,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: NEO_COLORS.bgAlt,
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.4,
  },
  factorCountBadge: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  factorCountText: {
    fontSize: 9,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  chevron: {
    fontSize: 14,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  breakdownContent: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: NEO_COLORS.border,
    gap: 8,
  },
  formulaBox: {
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    padding: 8,
    marginBottom: 4,
  },
  formulaText: {
    fontSize: 11,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  stepItem: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    padding: 10,
  },
  stepTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepFactor: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    flex: 1,
  },
  impactPill: {
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  impactPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  stepValue: {
    fontSize: 11,
    color: NEO_COLORS.muted,
    fontWeight: '700',
    marginTop: 4,
  },
  stepText: {
    fontSize: 11,
    fontWeight: '700',
    color: NEO_COLORS.ink,
    marginTop: 4,
    lineHeight: 15,
  },
  actionsWrap: {
    marginTop: 8,
    gap: 10,
  },
  diaryBtn: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaryBtnSuccess: {
    backgroundColor: NEO_COLORS.green,
  },
  diaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.8,
  },
  scanAnotherBtn: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanAnotherText: {
    fontSize: 13,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.6,
  },
});
