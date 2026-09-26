import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { verifyClaims } from '../services/api';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../theme/neoTheme';

const STANDARD_FSSAI_CLAIMS = [
  'No Added Sugar',
  'Sugar Free',
  'Low Sodium',
  'High Protein',
  'High Fibre',
  'Low Fat',
  'Zero Trans Fat',
];

function _claimStatusMeta(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'SUPPORTED') {
    return { label: 'SUPPORTED', bg: NEO_COLORS.green, fg: NEO_COLORS.ink, icon: '✓', dot: '#2E7D32' };
  }
  if (s === 'NOT_SUPPORTED') {
    return { label: 'NOT SUPPORTED', bg: NEO_COLORS.coral, fg: NEO_COLORS.ink, icon: '✕', dot: '#B83C28' };
  }
  if (s === 'NEEDS_REVIEW') {
    return { label: 'NEEDS REVIEW', bg: NEO_COLORS.yellow, fg: NEO_COLORS.ink, icon: '⚠', dot: '#EF6C00' };
  }
  return { label: 'INSUFFICIENT DATA', bg: NEO_COLORS.bgAlt, fg: NEO_COLORS.muted, icon: '?', dot: '#888179' };
}

export default function ClaimVerificationCard({
  initialVerification = null,
  barcode = null,
  nutrition = null,
  ingredients = null,
  productName = null,
}) {
  const [data, setData] = useState(initialVerification);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setData(initialVerification);
    setError(null);
  }, [initialVerification, barcode]);

  const results = Array.isArray(data?.results) ? data.results : [];
  const hasResults = results.length > 0;

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await verifyClaims({
        claims: STANDARD_FSSAI_CLAIMS,
        barcode: barcode && String(barcode) !== '00000000' ? String(barcode) : null,
        nutrition: nutrition || null,
        ingredients: ingredients || null,
        productName: productName || null,
      });
      setData(res);
      setExpanded(true);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Unable to verify claims';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const supportedCount = results.filter((r) => String(r?.status).toUpperCase() === 'SUPPORTED').length;

  return (
    <View style={[styles.card, NEO_SHADOWS.md]}>
      {/* Neo-Brutalist Accent Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.headerLeft}>
          <View style={styles.diamondMarker} />
          <Text style={styles.headerTitle}>FSSAI CLAIM VERIFICATION</Text>
        </View>
        {hasResults ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{supportedCount}/{results.length} PASS</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.cardSubtitle}>
              {hasResults
                ? `${supportedCount} of ${results.length} standard statutory claims verified against official FSSAI thresholds`
                : 'Audit front-of-pack claims against official FSSAI 2018 statutory criteria'}
            </Text>
          </View>

          {!hasResults && !loading ? (
            <TouchableOpacity
              style={[styles.actionBtn, NEO_SHADOWS.sm]}
              activeOpacity={0.85}
              onPress={handleVerify}
            >
              <Text style={styles.actionBtnText}>VERIFY NOW</Text>
            </TouchableOpacity>
          ) : null}

          {hasResults ? (
            <TouchableOpacity
              style={[styles.toggleBtn, NEO_SHADOWS.sm]}
              activeOpacity={0.85}
              onPress={() => setExpanded((v) => !v)}
            >
              <Text style={styles.toggleBtnText}>{expanded ? 'COLLAPSE ▴' : 'EXPAND ▾'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={NEO_COLORS.ink} size="small" />
            <Text style={styles.loadingText}>Validating FSSAI regulatory criteria...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleVerify}>
              <Text style={styles.retryText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {hasResults && expanded ? (
          <View style={styles.resultsWrap}>
            {results.map((item, idx) => {
              const meta = _claimStatusMeta(item?.status);
              const claimName = item?.claim || item?.normalized_claim || `Claim #${idx + 1}`;
              const reason = item?.reason || '';
              const citation = item?.source?.regulation
                ? `${item.source.regulation} (${item.source.schedule || 'Schedule I'})`
                : null;

              return (
                <View key={idx} style={[styles.claimItem, NEO_SHADOWS.sm]}>
                  <View style={styles.claimTopRow}>
                    <Text style={styles.claimName}>{claimName}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={styles.statusText}>
                        {meta.icon} {meta.label}
                      </Text>
                    </View>
                  </View>

                  {reason ? <Text style={styles.claimReason}>{reason}</Text> : null}

                  {citation ? (
                    <View style={styles.sourceRow}>
                      <Text style={styles.sourceLabel}>RULE:</Text>
                      <Text style={styles.claimSource}>{citation}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}

            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerTitle}>STATUTORY DISCLAIMER</Text>
              <Text style={styles.disclaimer}>
                {data?.disclaimer ||
                  'Rule-based assessment against referenced FSSAI regulatory criteria. Not a legal certification.'}
              </Text>
            </View>
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
    backgroundColor: NEO_COLORS.cyan,
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
  diamondMarker: {
    width: 8,
    height: 8,
    backgroundColor: NEO_COLORS.ink,
    transform: [{ rotate: '45deg' }],
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  cardContent: {
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSubtitle: {
    color: NEO_COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  actionBtn: {
    backgroundColor: NEO_COLORS.yellow,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: NEO_RADIUS.sm,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
  },
  actionBtnText: {
    color: NEO_COLORS.ink,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: NEO_RADIUS.sm,
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
  },
  toggleBtnText: {
    color: NEO_COLORS.ink,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    padding: 10,
    backgroundColor: NEO_COLORS.bgAlt,
    borderRadius: NEO_RADIUS.sm,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
  },
  loadingText: {
    color: NEO_COLORS.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  errorBox: {
    marginTop: 12,
    backgroundColor: NEO_COLORS.status.avoidBg,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    padding: 10,
    borderRadius: NEO_RADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: NEO_COLORS.ink,
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  retryBtn: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: NEO_RADIUS.xs,
  },
  retryText: {
    color: NEO_COLORS.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  resultsWrap: {
    marginTop: 14,
    gap: 10,
  },
  claimItem: {
    backgroundColor: NEO_COLORS.card,
    borderRadius: NEO_RADIUS.sm,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    padding: 12,
  },
  claimTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  claimName: {
    fontSize: 14,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: NEO_RADIUS.xs,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.4,
  },
  claimReason: {
    fontSize: 12,
    color: NEO_COLORS.ink,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 16,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: NEO_COLORS.bgAlt,
  },
  sourceLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: NEO_COLORS.muted,
  },
  claimSource: {
    fontSize: 10,
    color: NEO_COLORS.muted,
    fontWeight: '700',
    flex: 1,
  },
  disclaimerBox: {
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    padding: 10,
    marginTop: 6,
  },
  disclaimerTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.muted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  disclaimer: {
    fontSize: 11,
    color: NEO_COLORS.muted,
    fontWeight: '600',
    lineHeight: 15,
  },
});
