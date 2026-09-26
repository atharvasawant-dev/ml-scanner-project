import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { compareProducts } from '../services/api';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../theme/neoTheme';

const COMPARE_SUGGESTIONS = ['Parle-G', 'Maggi', 'Kurkure', "Lay's", 'Amul Butter'];

function _scorePill(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return { text: 'N/A', bg: NEO_COLORS.bgAlt, fg: NEO_COLORS.muted };
  if (s >= 70) return { text: `${s}`, bg: NEO_COLORS.green, fg: NEO_COLORS.ink };
  if (s >= 45) return { text: `${s}`, bg: NEO_COLORS.yellow, fg: NEO_COLORS.ink };
  return { text: `${s}`, bg: NEO_COLORS.coral, fg: NEO_COLORS.ink };
}

function _nutriscoreColor(grade) {
  const g = String(grade || '').toLowerCase();
  if (g === 'a') return '#2E7D32';
  if (g === 'b') return '#689F38';
  if (g === 'c') return '#FBC02D';
  if (g === 'd') return '#EF6C00';
  if (g === 'e') return '#C62828';
  return NEO_COLORS.muted;
}

export default function ComparisonCard({ currentProduct = null }) {
  const [expanded, setExpanded] = useState(false);
  const [targetQuery, setTargetQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState(null);

  const currentIdentifier =
    currentProduct?.barcode && String(currentProduct.barcode) !== '00000000'
      ? currentProduct.barcode
      : currentProduct?.name || currentProduct?.product_name || '';

  const handleCompare = async (target) => {
    const query = String(target || targetQuery || '').trim();
    if (!query || !currentIdentifier || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await compareProducts(currentIdentifier, query);
      setComparison(res);
      setTargetQuery(query);
      setExpanded(true);
    } catch (e) {
      const status = e?.response?.status;
      let msg = 'Could not compare products';
      if (status === 404) {
        msg = `Product "${query}" was not found. Try another barcode or name.`;
      } else if (e?.response?.data?.detail) {
        msg = String(e.response.data.detail);
      }
      setError(msg);
      setComparison(null);
    } finally {
      setLoading(false);
    }
  };

  const a = comparison?.product_a;
  const b = comparison?.product_b;
  const reasons = Array.isArray(comparison?.reasons) ? comparison.reasons : [];

  const aScore = _scorePill(a?.health_score);
  const bScore = _scorePill(b?.health_score);

  const aNutr = a?.nutrition || {};
  const bNutr = b?.nutrition || {};

  const metrics = [
    { label: 'Calories', a: aNutr.calories, b: bNutr.calories, unit: 'kcal' },
    { label: 'Sugar', a: aNutr.sugar, b: bNutr.sugar, unit: 'g' },
    { label: 'Fat', a: aNutr.fat, b: bNutr.fat, unit: 'g' },
    { label: 'Sat. Fat', a: aNutr.saturated_fat, b: bNutr.saturated_fat, unit: 'g' },
    { label: 'Salt/Sodium', a: aNutr.salt, b: bNutr.salt, unit: 'g' },
    { label: 'Protein', a: aNutr.protein, b: bNutr.protein, unit: 'g' },
    { label: 'Fiber', a: aNutr.fiber, b: bNutr.fiber, unit: 'g' },
  ];

  return (
    <View style={[styles.card, NEO_SHADOWS.md]}>
      {/* Neo-Brutalist Orange Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.headerLeft}>
          <View style={styles.triangleMarker} />
          <Text style={styles.headerTitle}>PRODUCT COMPARISON</Text>
        </View>
        <TouchableOpacity
          style={styles.toggleTag}
          activeOpacity={0.85}
          onPress={() => setExpanded((v) => !v)}
        >
          <Text style={styles.toggleTagText}>{expanded ? 'COLLAPSE ▴' : 'OPEN ▾'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardSubtitle}>
          Compare this product head-to-head with any other item or common benchmark
        </Text>

        {/* Suggestion Chips */}
        <View style={styles.suggestionsRow}>
          <Text style={styles.suggestLabel}>BENCHMARKS:</Text>
          <View style={styles.chipsWrap}>
            {COMPARE_SUGGESTIONS.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.chip}
                activeOpacity={0.8}
                onPress={() => {
                  setTargetQuery(item);
                  handleCompare(item);
                }}
              >
                <Text style={styles.chipText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Search input + Compare Button */}
        <View style={styles.inputRow}>
          <View style={[styles.searchBox, NEO_SHADOWS.sm]}>
            <TextInput
              style={styles.input}
              placeholder="Barcode or product name..."
              placeholderTextColor={NEO_COLORS.muted}
              value={targetQuery}
              onChangeText={setTargetQuery}
              onSubmitEditing={() => handleCompare()}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            style={[styles.compareBtn, NEO_SHADOWS.sm, loading && styles.compareBtnDisabled]}
            activeOpacity={0.85}
            onPress={() => handleCompare()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={NEO_COLORS.ink} size="small" />
            ) : (
              <Text style={styles.compareBtnText}>VS</Text>
            )}
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* Comparison Output */}
        {expanded && comparison ? (
          <View style={styles.compareResultWrap}>
            {/* Dual Column Headers */}
            <View style={styles.dualHeaderRow}>
              <View style={[styles.productPillar, { borderRightWidth: 1.5, borderRightColor: NEO_COLORS.border }]}>
                <View style={[styles.prodBadge, { backgroundColor: NEO_COLORS.cyan }]}>
                  <Text style={styles.prodBadgeText}>CURRENT</Text>
                </View>
                <Text style={styles.pillarName} numberOfLines={2}>{a?.product_name || 'Current Item'}</Text>
                <View style={[styles.scoreBadge, { backgroundColor: aScore.bg }]}>
                  <Text style={[styles.scoreBadgeText, { color: aScore.fg }]}>SCORE: {aScore.text}</Text>
                </View>
              </View>

              <View style={styles.productPillar}>
                <View style={[styles.prodBadge, { backgroundColor: NEO_COLORS.pink }]}>
                  <Text style={styles.prodBadgeText}>COMPARISON</Text>
                </View>
                <Text style={styles.pillarName} numberOfLines={2}>{b?.product_name || 'Target Item'}</Text>
                <View style={[styles.scoreBadge, { backgroundColor: bScore.bg }]}>
                  <Text style={[styles.scoreBadgeText, { color: bScore.fg }]}>SCORE: {bScore.text}</Text>
                </View>
              </View>
            </View>

            {/* Metrics Table */}
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.colLabel, { flex: 1.2 }]}>NUTRIENT (PER 100G)</Text>
                <Text style={[styles.colValueHeader, { flex: 1 }]}>CURRENT</Text>
                <Text style={[styles.colValueHeader, { flex: 1 }]}>TARGET</Text>
              </View>

              {metrics.map((m, idx) => {
                const valA = m.a !== undefined && m.a !== null ? `${m.a} ${m.unit}` : '—';
                const valB = m.b !== undefined && m.b !== null ? `${m.b} ${m.unit}` : '—';
                return (
                  <View key={idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: NEO_COLORS.bgAlt }]}>
                    <Text style={[styles.rowLabel, { flex: 1.2 }]}>{m.label}</Text>
                    <Text style={[styles.rowVal, { flex: 1 }]}>{valA}</Text>
                    <Text style={[styles.rowVal, { flex: 1 }]}>{valB}</Text>
                  </View>
                );
              })}
            </View>

            {/* Algorithmic Reasons */}
            {reasons.length > 0 ? (
              <View style={styles.reasonsBox}>
                <Text style={styles.reasonsTitle}>KEY NUTRITIONAL DIFFERENCES:</Text>
                {reasons.map((r, idx) => (
                  <Text key={idx} style={styles.reasonLine}>→ {String(r)}</Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    backgroundColor: NEO_COLORS.white,
    borderRadius: NEO_RADIUS.md,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    overflow: 'hidden',
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: NEO_COLORS.orange,
    borderBottomWidth: NEO_BORDERS.thick,
    borderBottomColor: NEO_COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  triangleMarker: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: NEO_COLORS.ink,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  toggleTag: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  toggleTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  cardContent: {
    padding: 14,
  },
  cardSubtitle: {
    color: NEO_COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginBottom: 10,
  },
  suggestionsRow: {
    marginBottom: 10,
  },
  suggestLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.muted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    paddingHorizontal: 10,
  },
  input: {
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    color: NEO_COLORS.ink,
  },
  compareBtn: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareBtnDisabled: {
    opacity: 0.6,
  },
  compareBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  errorBox: {
    marginTop: 10,
    backgroundColor: NEO_COLORS.status.avoidBg,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    padding: 8,
    borderRadius: NEO_RADIUS.sm,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  compareResultWrap: {
    marginTop: 14,
    borderTopWidth: NEO_BORDERS.regular,
    borderTopColor: NEO_COLORS.border,
    paddingTop: 12,
  },
  dualHeaderRow: {
    flexDirection: 'row',
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    overflow: 'hidden',
  },
  productPillar: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  prodBadge: {
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginBottom: 4,
  },
  prodBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  pillarName: {
    fontSize: 13,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    textAlign: 'center',
    minHeight: 34,
  },
  scoreBadge: {
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  scoreBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  table: {
    marginTop: 10,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: NEO_COLORS.ink,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.white,
    letterSpacing: 0.3,
  },
  colValueHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.white,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: NEO_COLORS.mutedLight,
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  rowVal: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    textAlign: 'center',
  },
  reasonsBox: {
    marginTop: 10,
    backgroundColor: NEO_COLORS.purpleLight,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    padding: 10,
  },
  reasonsTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  reasonLine: {
    fontSize: 11,
    fontWeight: '700',
    color: NEO_COLORS.ink,
    lineHeight: 16,
  },
});
