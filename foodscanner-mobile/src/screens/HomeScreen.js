import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getDailyReport, getTodayFoods, getUserProfile } from '../services/api';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../theme/neoTheme';

function _formatDate(d) {
  try {
    return new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  } catch {
    return '';
  }
}

function _scoreColor(score) {
  const s = Number(score) || 0;
  if (s >= 70) return NEO_COLORS.green;
  if (s >= 45) return NEO_COLORS.yellow;
  return NEO_COLORS.coral;
}

function _greeting(name) {
  const h = new Date().getHours();
  const prefix = h < 12 ? 'GOOD MORNING' : h < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  return `${prefix}, ${String(name || '').toUpperCase()}!`;
}

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [report, setReport] = useState(null);
  const [todayFoods, setTodayFoods] = useState([]);

  const todayLabel = useMemo(() => _formatDate(new Date()), []);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, t] = await Promise.all([getUserProfile(), getDailyReport(), getTodayFoods()]);
      setProfile(p);
      setReport(r);
      setTodayFoods(Array.isArray(t?.foods) ? t.foods : []);
    } catch (_e) {
      // Gracefully retain existing/default state on temporary network hiccups
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const name = profile?.name || 'there';
  const overallScore = report?.overall_score ?? 0;
  const calories = report?.nutrition_breakdown?.calories;
  const caloriePct = calories?.limit ? Math.min(1, (calories.consumed || 0) / calories.limit) : 0;

  const scoreBadgeBg = _scoreColor(overallScore);

  const foodsTodayOnly = useMemo(() => {
    const arr = Array.isArray(todayFoods) ? todayFoods : [];
    const today = new Date().toISOString().slice(0, 10);
    return arr.filter((f) => {
      const ts = String(f?.consumed_at || '').slice(0, 10);
      return ts === today;
    });
  }, [todayFoods]);

  const hasFoods = foodsTodayOnly.length > 0;
  const greeting = useMemo(() => _greeting(name), [name]);

  const consumedKcal = Number(calories?.consumed) || 0;
  const limitKcal = Number(calories?.limit) || 2000;
  const scansCount = foodsTodayOnly.length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={NEO_COLORS.ink} />
        <Text style={styles.loadingText}>LOADING PRAMAAN DASHBOARD...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        {/* 1. Brand & Header Bar */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.brandRow}>
              <View style={styles.brandTag}>
                <Text style={styles.brandTagText}>PRAMAAN</Text>
              </View>
              <View style={styles.dateBadge}>
                <Text style={styles.dateBadgeText}>{todayLabel}</Text>
              </View>
            </View>
            <Text style={styles.greetingText}>{greeting}</Text>
          </View>

          {/* Daily Health Score Badge */}
          <View style={[styles.scoreBadgeBox, { backgroundColor: scoreBadgeBg }, NEO_SHADOWS.sm]}>
            <Text style={styles.scoreBadgeVal}>{Number(overallScore) || 0}</Text>
            <Text style={styles.scoreBadgeSub}>SCORE</Text>
          </View>
        </View>

        {/* 2. Primary Scan CTA Hero Button */}
        <TouchableOpacity
          style={[styles.primaryScanBtn, NEO_SHADOWS.lg]}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('Main', { screen: 'Scan' })}
        >
          <View style={styles.scanBtnLeft}>
            <View style={styles.scanIconBox}>
              <Text style={styles.scanIconEmoji}>📷</Text>
            </View>
            <View>
              <Text style={styles.scanBtnTitle}>SCAN FOOD BARCODE</Text>
              <Text style={styles.scanBtnSub}>Instant FSSAI, NutriScore & Hazard Audit</Text>
            </View>
          </View>
          <View style={styles.arrowBox}>
            <Text style={styles.arrowText}>→</Text>
          </View>
        </TouchableOpacity>

        {/* 3. Secondary Quick Actions */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: NEO_COLORS.cyan }, NEO_SHADOWS.sm]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ManualEntry')}
          >
            <Text style={styles.quickEmoji}>✏️</Text>
            <Text style={styles.quickTitle}>MANUAL ENTRY</Text>
            <Text style={styles.quickSub}>Type nutrition data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: NEO_COLORS.pink }, NEO_SHADOWS.sm]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('OCRScan')}
          >
            <Text style={styles.quickEmoji}>📸</Text>
            <Text style={styles.quickTitle}>OCR LABEL</Text>
            <Text style={styles.quickSub}>Photo text extract</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Daily Nutrition Stat Pills */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, NEO_SHADOWS.sm]}>
            <View style={styles.statTag}>
              <Text style={styles.statTagText}>CALORIES</Text>
            </View>
            <Text style={styles.statNum}>{consumedKcal}</Text>
            <Text style={styles.statTarget}>of {limitKcal} kcal</Text>
          </View>

          <View style={[styles.statBox, NEO_SHADOWS.sm]}>
            <View style={[styles.statTag, { backgroundColor: NEO_COLORS.yellow }]}>
              <Text style={styles.statTagText}>DAY SCORE</Text>
            </View>
            <Text style={styles.statNum}>{Number(overallScore) || 0}</Text>
            <Text style={styles.statTarget}>out of 100</Text>
          </View>

          <View style={[styles.statBox, NEO_SHADOWS.sm]}>
            <View style={[styles.statTag, { backgroundColor: NEO_COLORS.purpleLight }]}>
              <Text style={styles.statTagText}>LOGGED</Text>
            </View>
            <Text style={styles.statNum}>{scansCount}</Text>
            <Text style={styles.statTarget}>items eaten</Text>
          </View>
        </View>

        {/* 5. Calorie Budget Progress Card */}
        <View style={[styles.budgetCard, NEO_SHADOWS.md]}>
          <View style={styles.budgetHeader}>
            <Text style={styles.budgetTitle}>DAILY CALORIE BUDGET</Text>
            <Text style={styles.budgetPct}>{Math.round(caloriePct * 100)}% CONSUMED</Text>
          </View>
          <View style={styles.budgetTrack}>
            <View
              style={[
                styles.budgetFill,
                {
                  width: `${caloriePct * 100}%`,
                  backgroundColor: caloriePct > 1 ? NEO_COLORS.coral : NEO_COLORS.yellow,
                },
              ]}
            />
          </View>
          <View style={styles.budgetFooter}>
            <Text style={styles.budgetKcal}>{consumedKcal} kcal consumed</Text>
            <Text style={styles.budgetRemaining}>
              {Math.max(0, limitKcal - consumedKcal)} kcal remaining
            </Text>
          </View>
        </View>

        {/* 6. Today's Diary / Food Intake */}
        <View style={styles.sectionHeadingRow}>
          <View style={styles.headingMarker} />
          <Text style={styles.sectionHeading}>TODAY'S FOOD INTAKE</Text>
          <View style={styles.foodCountBadge}>
            <Text style={styles.foodCountText}>{foodsTodayOnly.length} ITEMS</Text>
          </View>
        </View>

        {!hasFoods ? (
          <View style={[styles.emptyWrap, NEO_SHADOWS.sm]}>
            <Text style={styles.emptyIcon}>🥫</Text>
            <Text style={styles.emptyTitle}>NO INTAKE LOGGED TODAY</Text>
            <Text style={styles.emptySubtitle}>
              Scan food items and tap "+ Log to Daily Diary" on results to record your intake.
            </Text>
          </View>
        ) : (
          foodsTodayOnly.map((f, idx) => {
            const prodName = f?.product_name || f?.name || f?.product || `Product ${idx + 1}`;
            const kcal = Number(f?.calories) || 0;
            return (
              <View key={idx} style={[styles.diaryItemRow, NEO_SHADOWS.sm]}>
                <View style={styles.diaryIconBox}>
                  <Text style={{ fontSize: 18 }}>🍽️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.diaryProdName} numberOfLines={1}>{prodName}</Text>
                  <Text style={styles.diaryMeta}>{kcal} kcal</Text>
                </View>
                <View style={styles.loggedBadge}>
                  <Text style={styles.loggedBadgeText}>LOGGED</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Bottom Quick Scan Bar */}
      <View style={styles.bottomBarContainer}>
        <TouchableOpacity
          style={[styles.floatingScanBtn, NEO_SHADOWS.md]}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('Main', { screen: 'Scan' })}
        >
          <Text style={styles.floatingScanText}>📷 TAP TO SCAN BARCODE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEO_COLORS.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEO_COLORS.bg,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  brandTag: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  brandTagText: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 1,
  },
  dateBadge: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: NEO_COLORS.muted,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: -0.5,
  },
  scoreBadgeBox: {
    width: 60,
    height: 60,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBadgeVal: {
    fontSize: 22,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  scoreBadgeSub: {
    fontSize: 8,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  primaryScanBtn: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  scanBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  scanIconBox: {
    width: 44,
    height: 44,
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanIconEmoji: {
    fontSize: 22,
  },
  scanBtnTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.3,
  },
  scanBtnSub: {
    fontSize: 11,
    fontWeight: '700',
    color: NEO_COLORS.ink,
    marginTop: 2,
  },
  arrowBox: {
    width: 32,
    height: 32,
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 18,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  quickCard: {
    flex: 1,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    padding: 12,
  },
  quickEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  quickTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.3,
  },
  quickSub: {
    fontSize: 10,
    fontWeight: '700',
    color: NEO_COLORS.ink,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    padding: 10,
    alignItems: 'center',
  },
  statTag: {
    backgroundColor: NEO_COLORS.cyan,
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginBottom: 4,
  },
  statTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.3,
  },
  statNum: {
    fontSize: 20,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  statTarget: {
    fontSize: 10,
    fontWeight: '700',
    color: NEO_COLORS.muted,
    marginTop: 2,
  },
  budgetCard: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    padding: 14,
    marginBottom: 16,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.4,
  },
  budgetPct: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.muted,
  },
  budgetTrack: {
    height: 14,
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: 7,
    overflow: 'hidden',
  },
  budgetFill: {
    height: '100%',
    borderRightWidth: 2,
    borderRightColor: NEO_COLORS.border,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  budgetKcal: {
    fontSize: 11,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  budgetRemaining: {
    fontSize: 11,
    fontWeight: '800',
    color: NEO_COLORS.muted,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  headingMarker: {
    width: 8,
    height: 8,
    backgroundColor: NEO_COLORS.coral,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
    flex: 1,
  },
  foodCountBadge: {
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  foodCountText: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.muted,
  },
  emptyWrap: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    padding: 20,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: NEO_COLORS.muted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  diaryItemRow: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  diaryIconBox: {
    width: 36,
    height: 36,
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaryProdName: {
    fontSize: 13,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  diaryMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: NEO_COLORS.muted,
    marginTop: 2,
  },
  loggedBadge: {
    backgroundColor: NEO_COLORS.greenLight,
    borderWidth: 1,
    borderColor: NEO_COLORS.green,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  loggedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1e5222',
  },
  bottomBarContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  floatingScanBtn: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingScanText: {
    fontSize: 14,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.8,
  },
});
