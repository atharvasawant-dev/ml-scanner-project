import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { verifyClaims } from '../services/api';

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
    return { label: 'SUPPORTED', bg: '#E8F5E9', fg: '#1e5222', icon: '✓', dot: '#2E7D32' };
  }
  if (s === 'NOT_SUPPORTED') {
    return { label: 'NOT SUPPORTED', bg: C.redLight, fg: '#8c1a0a', icon: '✕', dot: '#B83C28' };
  }
  if (s === 'NEEDS_REVIEW') {
    return { label: 'NEEDS REVIEW', bg: C.amberLight, fg: '#7a4a0a', icon: '⚠', dot: '#EF6C00' };
  }
  return { label: 'INSUFFICIENT DATA', bg: '#F5F2EC', fg: '#666159', icon: '?', dot: '#888179' };
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
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>FSSAI Claim Verification</Text>
          <Text style={styles.cardSubtitle}>
            {hasResults
              ? `${supportedCount} of ${results.length} standard statutory claims verified`
              : 'Verify package claims against official FSSAI 2018 regulations'}
          </Text>
        </View>

        {!hasResults && !loading ? (
          <TouchableOpacity style={styles.actionBtn} onPress={handleVerify}>
            <Text style={styles.actionBtnText}>Verify</Text>
          </TouchableOpacity>
        ) : null}

        {hasResults ? (
          <TouchableOpacity style={styles.toggleBtn} onPress={() => setExpanded((v) => !v)}>
            <Text style={styles.toggleBtnText}>{expanded ? 'Hide ▴' : 'View ▾'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={C.sage} size="small" />
          <Text style={styles.loadingText}>Checking FSSAI regulatory criteria...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleVerify}>
            <Text style={styles.retryText}>Retry</Text>
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
              <View key={idx} style={styles.claimItem}>
                <View style={styles.claimTopRow}>
                  <Text style={styles.claimName}>{claimName}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg, borderColor: C.border }]}>
                    <Text style={[styles.statusText, { color: meta.fg }]}>
                      {meta.icon} {meta.label}
                    </Text>
                  </View>
                </View>

                {reason ? <Text style={styles.claimReason}>{reason}</Text> : null}

                {citation ? (
                  <Text style={styles.claimSource}>Source: {citation}</Text>
                ) : null}
              </View>
            );
          })}

          <Text style={styles.disclaimer}>
            {data?.disclaimer ||
              'Rule-based assessment against referenced FSSAI regulatory criteria. Not a legal certification.'}
          </Text>
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
    gap: 10,
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
  actionBtn: {
    backgroundColor: C.sage,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 13,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleBtnText: {
    color: C.ink,
    fontWeight: '800',
    fontSize: 12,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 8,
  },
  loadingText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    marginTop: 12,
    backgroundColor: C.redLight,
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#8c1a0a',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  retryBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: C.white,
    borderRadius: 6,
  },
  retryText: {
    color: C.ink,
    fontWeight: '800',
    fontSize: 11,
  },
  resultsWrap: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
  },
  claimItem: {
    backgroundColor: C.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 8,
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
    color: C.ink,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  claimReason: {
    marginTop: 6,
    color: C.ink,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  claimSource: {
    marginTop: 4,
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  disclaimer: {
    marginTop: 8,
    fontSize: 11,
    color: C.muted,
    fontStyle: 'italic',
    lineHeight: 15,
  },
});
