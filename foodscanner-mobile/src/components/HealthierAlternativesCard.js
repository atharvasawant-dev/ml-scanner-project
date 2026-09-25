import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { getHealthierAlternatives } from '../services/api';

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

function _nutriscoreColor(grade) {
  const g = String(grade || '').toLowerCase();
  if (g === 'a') return '#2E7D32';
  if (g === 'b') return '#689F38';
  if (g === 'c') return '#FBC02D';
  if (g === 'd') return '#EF6C00';
  if (g === 'e') return '#C62828';
  return C.muted;
}

export default function HealthierAlternativesCard({
  initialRecommendations = [],
  barcode = null,
  productName = null,
  nutrition = null,
  onSelectAlternative = null,
}) {
  const [items, setItems] = useState(
    Array.isArray(initialRecommendations) ? initialRecommendations : []
  );
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (Array.isArray(initialRecommendations) && initialRecommendations.length > 0) {
      setItems(initialRecommendations);
      setFetched(true);
    } else {
      setItems([]);
      setFetched(false);
    }
    setError(null);
  }, [initialRecommendations, barcode]);

  const handleFetchAlternatives = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getHealthierAlternatives({
        productName: productName || null,
        barcode: barcode && String(barcode) !== '00000000' ? String(barcode) : null,
        nutrition: nutrition || null,
        limit: 3,
      });
      const list = Array.isArray(res?.alternatives) ? res.alternatives : [];
      setItems(list);
      setFetched(true);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Could not fetch alternatives';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const hasItems = items.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>🌱 Healthier Alternatives</Text>
          <Text style={styles.cardSubtitle}>
            {hasItems
              ? `${items.length} better choices found in this category`
              : 'Discover healthier alternatives with higher scores'}
          </Text>
        </View>

        {!hasItems && !loading ? (
          <TouchableOpacity style={styles.findBtn} onPress={handleFetchAlternatives}>
            <Text style={styles.findBtnText}>Find</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={C.sage} size="small" />
          <Text style={styles.loadingText}>Searching category for better nutritional options...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

      {fetched && !hasItems && !loading && !error ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No healthier alternatives found for this category yet.
          </Text>
        </View>
      ) : null}

      {hasItems ? (
        <View style={styles.list}>
          {items.map((item, idx) => {
            const name = item?.product_name || item?.name || `Alternative #${idx + 1}`;
            const brand = item?.brand || '';
            const score = item?.health_score != null ? Math.round(Number(item.health_score)) : null;
            const nutriscore = item?.nutriscore ? String(item.nutriscore).toUpperCase() : null;
            const advantages = Array.isArray(item?.advantages)
              ? item.advantages
              : Array.isArray(item?.reasons)
                ? item.reasons
                : [];

            return (
              <View key={idx} style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={2}>{name}</Text>
                    {brand ? <Text style={styles.itemBrand} numberOfLines={1}>{brand}</Text> : null}
                  </View>

                  <View style={styles.scoresRow}>
                    {nutriscore ? (
                      <View
                        style={[
                          styles.nutriscoreBadge,
                          { backgroundColor: _nutriscoreColor(nutriscore) },
                        ]}
                      >
                        <Text style={styles.nutriscoreText}>{nutriscore}</Text>
                      </View>
                    ) : null}

                    {score !== null ? (
                      <View style={styles.scoreBadge}>
                        <Text style={styles.scoreText}>{score}</Text>
                        <Text style={styles.scoreSub}>score</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {advantages.length > 0 ? (
                  <View style={styles.advantagesRow}>
                    {advantages.map((adv, aIdx) => (
                      <View key={aIdx} style={styles.advantagePill}>
                        <Text style={styles.advantageText}>✨ {String(adv)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {typeof onSelectAlternative === 'function' ? (
                  <TouchableOpacity
                    style={styles.inspectBtn}
                    onPress={() => onSelectAlternative(item)}
                  >
                    <Text style={styles.inspectBtnText}>Check Alternative →</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
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
  findBtn: {
    backgroundColor: C.sage,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  findBtnText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 13,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  loadingText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  errorBox: {
    marginTop: 10,
    backgroundColor: C.redLight,
    padding: 10,
    borderRadius: 10,
  },
  errorText: {
    color: '#8c1a0a',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: C.cream,
    borderRadius: 12,
  },
  emptyText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  list: {
    marginTop: 14,
    gap: 10,
  },
  itemCard: {
    backgroundColor: C.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '900',
    color: C.ink,
  },
  itemBrand: {
    marginTop: 2,
    fontSize: 11,
    color: C.muted,
    fontWeight: '700',
  },
  scoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nutriscoreBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutriscoreText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 12,
  },
  scoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: C.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '900',
    color: C.ink,
  },
  scoreSub: {
    fontSize: 9,
    color: C.muted,
    fontWeight: '700',
  },
  advantagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  advantagePill: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C3D9C5',
  },
  advantageText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e5222',
  },
  inspectBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  inspectBtnText: {
    color: C.sage,
    fontWeight: '900',
    fontSize: 12,
  },
});
