import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { getHealthierAlternatives } from '../services/api';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../theme/neoTheme';

function _nutriscoreColor(grade) {
  const g = String(grade || '').toLowerCase();
  if (g === 'a') return '#2E7D32';
  if (g === 'b') return '#689F38';
  if (g === 'c') return '#FBC02D';
  if (g === 'd') return '#EF6C00';
  if (g === 'e') return '#C62828';
  return NEO_COLORS.muted;
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
    <View style={[styles.card, NEO_SHADOWS.md]}>
      {/* Neo-Brutalist Green Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.headerLeft}>
          <View style={styles.squareMarker} />
          <Text style={styles.headerTitle}>HEALTHIER ALTERNATIVES</Text>
        </View>
        {hasItems ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{items.length} FOUND</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.cardSubtitle}>
              {hasItems
                ? `${items.length} category alternatives with higher nutritional balance found`
                : 'Discover healthier alternatives with higher scores in this category'}
            </Text>
          </View>

          {!hasItems && !loading ? (
            <TouchableOpacity
              style={[styles.findBtn, NEO_SHADOWS.sm]}
              activeOpacity={0.85}
              onPress={handleFetchAlternatives}
            >
              <Text style={styles.findBtnText}>FIND NOW</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={NEO_COLORS.ink} size="small" />
            <Text style={styles.loadingText}>Searching category for better nutritional options...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleFetchAlternatives}>
              <Text style={styles.retryText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {hasItems ? (
          <View style={styles.list}>
            {items.map((item, idx) => {
              const name = item?.product_name || item?.name || `Alternative #${idx + 1}`;
              const brand = item?.brand || '';
              const score = item?.health_score;
              const nutriscore = item?.nutriscore;
              const advantages = Array.isArray(item?.advantages) ? item.advantages : [];

              return (
                <View key={idx} style={[styles.itemCard, NEO_SHADOWS.sm]}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{name}</Text>
                      {brand ? <Text style={styles.itemBrand}>{brand}</Text> : null}
                    </View>

                    <View style={styles.badgeRow}>
                      {nutriscore ? (
                        <View style={[styles.nutriPill, { backgroundColor: _nutriscoreColor(nutriscore) }]}>
                          <Text style={styles.nutriText}>{String(nutriscore).toUpperCase()}</Text>
                        </View>
                      ) : null}

                      {score !== undefined && score !== null ? (
                        <View style={styles.scorePill}>
                          <Text style={styles.scoreText}>{score}/100</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {advantages.length > 0 ? (
                    <View style={styles.advWrap}>
                      {advantages.map((adv, aIdx) => (
                        <View key={aIdx} style={styles.advBadge}>
                          <Text style={styles.advText}>✓ {adv}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {onSelectAlternative ? (
                    <TouchableOpacity
                      style={styles.selectBtn}
                      activeOpacity={0.85}
                      onPress={() => onSelectAlternative(item)}
                    >
                      <Text style={styles.selectBtnText}>INSPECT THIS ALTERNATIVE →</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {fetched && !hasItems && !loading && !error ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No higher-scoring alternatives found in this specific food category.
            </Text>
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
    backgroundColor: NEO_COLORS.green,
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
  squareMarker: {
    width: 8,
    height: 8,
    backgroundColor: NEO_COLORS.ink,
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
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
  findBtn: {
    backgroundColor: NEO_COLORS.yellow,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: NEO_RADIUS.sm,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
  },
  findBtnText: {
    color: NEO_COLORS.ink,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.4,
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
  list: {
    marginTop: 14,
    gap: 10,
  },
  itemCard: {
    backgroundColor: NEO_COLORS.card,
    borderRadius: NEO_RADIUS.sm,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    padding: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  itemBrand: {
    fontSize: 11,
    fontWeight: '700',
    color: NEO_COLORS.muted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nutriPill: {
    width: 24,
    height: 24,
    borderRadius: NEO_RADIUS.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
  },
  nutriText: {
    color: NEO_COLORS.white,
    fontWeight: '900',
    fontSize: 12,
  },
  scorePill: {
    backgroundColor: NEO_COLORS.yellow,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: NEO_RADIUS.xs,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
  },
  scoreText: {
    fontWeight: '900',
    fontSize: 11,
    color: NEO_COLORS.ink,
  },
  advWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  advBadge: {
    backgroundColor: NEO_COLORS.greenLight,
    borderWidth: 1,
    borderColor: NEO_COLORS.green,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  advText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1e5222',
  },
  selectBtn: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: NEO_COLORS.bgAlt,
    alignItems: 'center',
  },
  selectBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.4,
  },
  emptyBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: NEO_COLORS.bgAlt,
    borderRadius: NEO_RADIUS.sm,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
  },
  emptyText: {
    fontSize: 12,
    color: NEO_COLORS.muted,
    fontWeight: '700',
    textAlign: 'center',
  },
});
