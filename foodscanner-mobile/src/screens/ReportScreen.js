import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';

import { getDailyReport, getWeeklyReport, getGoalReport } from '../services/api';
import { resetToLogin } from '../utils/navigationRef';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../theme/neoTheme';

function NeoReportBar({ label, consumed, limit }) {
  const c = Number(consumed) || 0;
  const l = Number(limit) || 1;
  const pct = Math.min(100, Math.round((c / l) * 100));
  const ratio = c / l;
  const color = ratio <= 0.8 ? NEO_COLORS.green : ratio <= 1 ? NEO_COLORS.yellow : NEO_COLORS.coral;

  return (
    <View style={styles.barItem}>
      <View style={styles.barRowTop}>
        <Text style={styles.barLabel}>{label}</Text>
        <View style={[styles.barPctBadge, { backgroundColor: color }]}>
          <Text style={styles.barPctText}>{pct}%</Text>
        </View>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barSub}>{c} / {l} limit</Text>
    </View>
  );
}

export default function ReportScreen() {
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [goal, setGoal] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [d, w, g] = await Promise.all([
          getDailyReport(),
          getWeeklyReport(),
          getGoalReport().catch(() => null),
        ]);
        setDaily(d);
        setWeekly(w);
        setGoal(g);
      } catch (e) {
        if (e?.response?.status === 401) {
          resetToLogin();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={NEO_COLORS.ink} />
        <Text style={styles.loadingText}>GENERATING NUTRITION REPORT...</Text>
      </View>
    );
  }

  if (!daily || !weekly) {
    return (
      <View style={styles.center}>
        <View style={[styles.card, NEO_SHADOWS.md, { padding: 20, alignItems: 'center' }]}>
          <Text style={{ color: NEO_COLORS.ink, fontWeight: '900', fontSize: 15 }}>
            UNABLE TO LOAD HEALTH REPORTS
          </Text>
          <Text style={{ marginTop: 6, color: NEO_COLORS.muted, fontWeight: '700', fontSize: 12 }}>
            Please check connection to the backend and try again.
          </Text>
        </View>
      </View>
    );
  }

  const rating = daily?.overall_rating || 'N/A';
  const emoji = rating === 'GREAT' ? '🤩' : rating === 'GOOD' ? '🙂' : rating === 'FAIR' ? '😐' : '😟';
  const ratingBg = rating === 'GREAT' || rating === 'GOOD' ? NEO_COLORS.green : rating === 'FAIR' ? NEO_COLORS.yellow : NEO_COLORS.coral;

  const nb = daily?.nutrition_breakdown || {};
  const days = weekly?.days || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Screen Title */}
      <View style={styles.headerRow}>
        <View style={styles.screenTag}>
          <Text style={styles.screenTagText}>NUTRITION AUDIT</Text>
        </View>
        <Text style={styles.screenTitle}>HEALTH REPORT</Text>
      </View>

      {/* 1. Overall Daily Rating Hero Card */}
      <View style={[styles.ratingCard, NEO_SHADOWS.md]}>
        <View style={[styles.ratingBanner, { backgroundColor: ratingBg }]}>
          <Text style={styles.ratingTitle}>{emoji} {rating}</Text>
          <View style={styles.scorePill}>
            <Text style={styles.scorePillText}>SCORE: {daily?.overall_score ?? 0}/100</Text>
          </View>
        </View>
        <View style={styles.ratingBody}>
          <Text style={styles.ratingDesc}>
            {rating === 'GREAT' || rating === 'GOOD'
              ? 'Your nutritional intake aligns well with recommended dietary standards.'
              : 'Keep an eye on elevated sodium, sugar, or saturated fats in your daily logs.'}
          </Text>
        </View>
      </View>

      {/* 2. Macronutrient Breakdown */}
      <View style={[styles.card, NEO_SHADOWS.md]}>
        <View style={styles.cardHeaderBanner}>
          <View style={styles.headerSquare} />
          <Text style={styles.cardHeaderTitle}>DAILY NUTRIENT BREAKDOWN</Text>
        </View>
        <View style={styles.cardBody}>
          {Object.keys(nb).map((k) => (
            <NeoReportBar key={k} label={k.toUpperCase()} consumed={nb[k].consumed} limit={nb[k].limit} />
          ))}
        </View>
      </View>

      {/* 3. Personalized Suggestions */}
      {daily?.suggestions && daily.suggestions.length > 0 ? (
        <View style={[styles.card, NEO_SHADOWS.md]}>
          <View style={[styles.cardHeaderBanner, { backgroundColor: NEO_COLORS.yellow }]}>
            <Text style={styles.cardHeaderTitle}>AI CLINICAL RECOMMENDATIONS</Text>
          </View>
          <View style={styles.cardBody}>
            {daily.suggestions.map((s, idx) => (
              <View key={idx} style={styles.suggestionItem}>
                <Text style={styles.suggestionBullet}>→</Text>
                <Text style={styles.suggestionText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* 4. Weekly Trend Section */}
      <View style={[styles.card, NEO_SHADOWS.md]}>
        <View style={[styles.cardHeaderBanner, { backgroundColor: NEO_COLORS.cyan }]}>
          <Text style={styles.cardHeaderTitle}>7-DAY INTAKE TREND</Text>
        </View>
        <View style={styles.cardBody}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 4 }}>
            {days.map((d, idx) => {
              const score = Number(d?.day_score) || 0;
              const dot = score >= 70 ? NEO_COLORS.green : score >= 45 ? NEO_COLORS.yellow : NEO_COLORS.coral;
              return (
                <View key={idx} style={[styles.dayCard, NEO_SHADOWS.sm]}>
                  <Text style={styles.dayDate}>{d.date}</Text>
                  <View style={[styles.dayDot, { backgroundColor: dot }]} />
                  <Text style={styles.dayScore}>{score}/100</Text>
                </View>
              );
            })}
          </ScrollView>
          {weekly?.week_summary ? (
            <View style={styles.trendSummaryBox}>
              <Text style={styles.trendSummaryTitle}>TREND SUMMARY:</Text>
              <Text style={styles.trendSummaryText}>{weekly.week_summary.trend}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* 5. Health Goal Progress (Batch 9A) */}
      {goal && (goal.goal_type || goal.status) ? (
        <View style={[styles.card, NEO_SHADOWS.md]}>
          <View style={[styles.cardHeaderBanner, { backgroundColor: NEO_COLORS.pink }]}>
            <Text style={styles.cardHeaderTitle}>🎯 HEALTH GOAL PROGRESS</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>ACTIVE GOAL:</Text>
              <View style={styles.goalPill}>
                <Text style={styles.goalPillText}>{goal.goal_type || 'Healthy Eating'}</Text>
              </View>
            </View>

            {goal.streak_days != null ? (
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 {goal.streak_days} DAY ACTIVE STREAK</Text>
              </View>
            ) : null}

            {goal.adherence_rate_pct != null ? (
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.adherenceLabel}>GOAL ADHERENCE</Text>
                  <Text style={styles.adherencePct}>{Math.round(goal.adherence_rate_pct)}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.min(100, Math.max(0, goal.adherence_rate_pct))}%`,
                        backgroundColor: NEO_COLORS.green,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : null}

            {goal.summary ? (
              <View style={styles.goalSummaryBox}>
                <Text style={styles.goalSummaryText}>{goal.summary}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
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
  headerRow: {
    marginBottom: 12,
  },
  screenTag: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  screenTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.6,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: -0.5,
  },
  ratingCard: {
    backgroundColor: NEO_COLORS.white,
    borderRadius: NEO_RADIUS.md,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  ratingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: NEO_BORDERS.thick,
    borderBottomColor: NEO_COLORS.border,
  },
  ratingTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.3,
  },
  scorePill: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scorePillText: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  ratingBody: {
    padding: 12,
  },
  ratingDesc: {
    fontSize: 12,
    fontWeight: '700',
    color: NEO_COLORS.ink,
    lineHeight: 16,
  },
  card: {
    backgroundColor: NEO_COLORS.white,
    borderRadius: NEO_RADIUS.md,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  cardHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: NEO_COLORS.yellow,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: NEO_BORDERS.thick,
    borderBottomColor: NEO_COLORS.border,
  },
  headerSquare: {
    width: 8,
    height: 8,
    backgroundColor: NEO_COLORS.ink,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 14,
  },
  barItem: {
    marginBottom: 12,
  },
  barRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  barLabel: {
    fontWeight: '900',
    fontSize: 12,
    color: NEO_COLORS.ink,
  },
  barPctBadge: {
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  barPctText: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  barTrack: {
    height: 12,
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRightWidth: 1.5,
    borderRightColor: NEO_COLORS.border,
  },
  barSub: {
    marginTop: 4,
    color: NEO_COLORS.muted,
    fontWeight: '700',
    fontSize: 11,
  },
  suggestionItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  suggestionBullet: {
    fontSize: 14,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '700',
    color: NEO_COLORS.ink,
    lineHeight: 17,
    flex: 1,
  },
  dayCard: {
    width: 105,
    backgroundColor: NEO_COLORS.white,
    borderRadius: NEO_RADIUS.sm,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    padding: 10,
    alignItems: 'center',
  },
  dayDate: {
    color: NEO_COLORS.muted,
    fontWeight: '800',
    fontSize: 11,
  },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
    marginVertical: 8,
  },
  dayScore: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  trendSummaryBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: NEO_COLORS.bgAlt,
  },
  trendSummaryTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.muted,
    letterSpacing: 0.5,
  },
  trendSummaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: NEO_COLORS.ink,
    marginTop: 2,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  goalLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.muted,
  },
  goalPill: {
    backgroundColor: NEO_COLORS.purpleLight,
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  goalPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  streakBadge: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    padding: 6,
    alignItems: 'center',
    marginVertical: 4,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  adherenceLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.muted,
  },
  adherencePct: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  goalSummaryBox: {
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    padding: 8,
    marginTop: 10,
  },
  goalSummaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: NEO_COLORS.ink,
    lineHeight: 16,
  },
});
