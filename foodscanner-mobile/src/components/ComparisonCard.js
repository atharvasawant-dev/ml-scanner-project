import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { compareProducts } from '../services/api';

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

const COMPARE_SUGGESTIONS = ['Parle-G', 'Maggi', 'Kurkure', "Lay's", 'Amul Butter'];

function _scorePill(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return { text: 'N/A', bg: C.white, fg: C.muted };
  if (s >= 70) return { text: `${s}`, bg: '#E8F5E9', fg: '#1e5222' };
  if (s >= 45) return { text: `${s}`, bg: C.amberLight, fg: '#7a4a0a' };
  return { text: `${s}`, bg: C.redLight, fg: '#8c1a0a' };
}

function _nutriscoreColor(grade) {
  const g = String(grade || '').toLowerCase();
  if (g === 'a') return '#2E7D32';
  if (g === 'b') return '#689F38';
  if (g === 'c') return '#FBC02D';
  if (g === 'd') return '#EF6C00';
  if (g === 'e') return '#C62828';
  return C.muted;
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
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.headerRow}
        onPress={() => setExpanded((v) => !v)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>⚖️ Compare Products</Text>
          <Text style={styles.cardSubtitle}>
            Side-by-side nutritional comparison against another food
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.contentWrap}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Enter product name or barcode..."
              placeholderTextColor={C.muted}
              value={targetQuery}
              onChangeText={setTargetQuery}
              editable={!loading}
              onSubmitEditing={() => handleCompare(targetQuery)}
            />
            <TouchableOpacity
              style={[styles.compareBtn, !targetQuery.trim() || loading ? styles.btnDisabled : null]}
              onPress={() => handleCompare(targetQuery)}
              disabled={!targetQuery.trim() || loading}
            >
              <Text style={styles.compareBtnText}>Compare</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chipsRow}>
            {COMPARE_SUGGESTIONS.map((s, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.chip}
                onPress={() => {
                  setTargetQuery(s);
                  handleCompare(s);
                }}
                disabled={loading}
              >
                <Text style={styles.chipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={C.sage} size="small" />
              <Text style={styles.loadingText}>Comparing nutrition and scores...</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          {comparison && a && b ? (
            <View style={styles.resultsWrap}>
              <View style={styles.tableHeader}>
                <View style={styles.colA}>
                  <Text style={styles.colTitle} numberOfLines={2}>{a.name || 'This Product'}</Text>
                  {a.brand ? <Text style={styles.colBrand} numberOfLines={1}>{a.brand}</Text> : null}
                  <View style={styles.badgeRow}>
                    <View style={[styles.scoreBadge, { backgroundColor: aScore.bg }]}>
                      <Text style={[styles.scoreBadgeText, { color: aScore.fg }]}>{aScore.text}</Text>
                    </View>
                    {a.nutriscore ? (
                      <View style={[styles.nsBadge, { backgroundColor: _nutriscoreColor(a.nutriscore) }]}>
                        <Text style={styles.nsText}>{String(a.nutriscore).toUpperCase()}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.colMid}>
                  <Text style={styles.vsText}>VS</Text>
                </View>

                <View style={styles.colB}>
                  <Text style={styles.colTitle} numberOfLines={2}>{b.name || targetQuery}</Text>
                  {b.brand ? <Text style={styles.colBrand} numberOfLines={1}>{b.brand}</Text> : null}
                  <View style={styles.badgeRow}>
                    <View style={[styles.scoreBadge, { backgroundColor: bScore.bg }]}>
                      <Text style={[styles.scoreBadgeText, { color: bScore.fg }]}>{bScore.text}</Text>
                    </View>
                    {b.nutriscore ? (
                      <View style={[styles.nsBadge, { backgroundColor: _nutriscoreColor(b.nutriscore) }]}>
                        <Text style={styles.nsText}>{String(b.nutriscore).toUpperCase()}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={styles.metricsTable}>
                {metrics.map((m, idx) => {
                  const valA = m.a != null ? `${m.a} ${m.unit}` : '—';
                  const valB = m.b != null ? `${m.b} ${m.unit}` : '—';
                  return (
                    <View key={idx} style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowAlt : null]}>
                      <Text style={styles.metricA}>{valA}</Text>
                      <Text style={styles.metricLabel}>{m.label}</Text>
                      <Text style={styles.metricB}>{valB}</Text>
                    </View>
                  );
                })}
              </View>

              {reasons.length > 0 ? (
                <View style={styles.reasonsBox}>
                  <Text style={styles.reasonsTitle}>Key Nutritional Differences:</Text>
                  {reasons.map((r, rIdx) => (
                    <Text key={rIdx} style={styles.reasonItem}>• {r}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: C.ink,
  },
  cardSubtitle: {
    marginTop: 4,
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 18,
    fontWeight: '900',
    color: C.ink,
  },
  contentWrap: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: C.ink,
    fontWeight: '600',
  },
  compareBtn: {
    backgroundColor: C.sage,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  compareBtnText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 13,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 6,
  },
  chip: {
    backgroundColor: C.cream,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.ink,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.muted,
  },
  errorBox: {
    marginTop: 10,
    backgroundColor: C.redLight,
    padding: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#8c1a0a',
    fontSize: 12,
    fontWeight: '700',
  },
  resultsWrap: {
    marginTop: 12,
    backgroundColor: C.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  colA: {
    flex: 1,
  },
  colMid: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  colB: {
    flex: 1,
    alignItems: 'flex-end',
  },
  colTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: C.ink,
  },
  colBrand: {
    fontSize: 10,
    color: C.muted,
    fontWeight: '700',
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  scoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  nsBadge: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nsText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 10,
  },
  vsText: {
    fontSize: 12,
    fontWeight: '900',
    color: C.muted,
  },
  metricsTable: {
    marginTop: 8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 6,
  },
  metricA: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: C.ink,
  },
  metricLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    textAlign: 'center',
  },
  metricB: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: C.ink,
    textAlign: 'right',
  },
  reasonsBox: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  reasonsTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: C.ink,
    marginBottom: 4,
  },
  reasonItem: {
    fontSize: 11,
    color: C.ink,
    fontWeight: '600',
    lineHeight: 16,
  },
});
