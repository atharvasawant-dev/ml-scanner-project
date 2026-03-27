import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';

import { getDailyReport, getWeeklyReport } from '../services/api';
import { resetToLogin } from '../utils/navigationRef';

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

function Bar({ label, consumed, limit }) {
  const pct = limit ? Math.min(100, (consumed / limit) * 100) : 0;
  const ratio = limit ? consumed / limit : 0;
  const color = ratio <= 0.8 ? C.sage : ratio <= 1 ? '#A9731B' : C.red;
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barMeta}>{Math.round(pct)}%</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barSub}>{consumed} / {limit}</Text>
    </View>
  );
}

export default function ReportScreen() {
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [d, w] = await Promise.all([getDailyReport(), getWeeklyReport()]);
        setDaily(d);
        setWeekly(w);
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
        <ActivityIndicator size="large" color={C.sage} />
      </View>
    );
  }

  if (!daily || !weekly) {
    return (
      <View style={styles.center}>
        <Text style={{ color: C.muted, fontWeight: '800' }}>Please log in again to see your report</Text>
      </View>
    );
  }

  const rating = daily?.overall_rating || 'N/A';
  const emoji = rating === 'GREAT' ? '🤩' : rating === 'GOOD' ? '🙂' : rating === 'FAIR' ? '😐' : '😟';

  const ratingBg = rating === 'GREAT' ? C.sageLight : rating === 'GOOD' ? C.sageLight : rating === 'FAIR' ? C.amberLight : C.redLight;
  const ratingFg = rating === 'FAIR' ? '#7a4a0a' : rating === 'POOR' ? '#8c1a0a' : '#1e5222';

  const nb = daily?.nutrition_breakdown || {};
  const days = weekly?.days || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.screenTitle}>Health Report</Text>

      <View style={[styles.ratingCard, { backgroundColor: ratingBg, borderColor: C.border }]}>
        <Text style={[styles.ratingTitle, { color: ratingFg }]}>{emoji} {rating}</Text>
        <Text style={[styles.ratingMeta, { color: ratingFg }]}>Score: {daily?.overall_score ?? 0}/100</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Nutrition</Text>
        {Object.keys(nb).map((k) => (
          <Bar key={k} label={k} consumed={nb[k].consumed} limit={nb[k].limit} />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Suggestions</Text>
        {(daily?.suggestions || []).map((s, idx) => (
          <Text key={idx} style={styles.suggestion}>→ {s}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Weekly Trend</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 10 }}>
          {days.map((d, idx) => {
            const score = Number(d?.day_score) || 0;
            const dot = score >= 70 ? C.sage : score >= 45 ? '#A9731B' : C.red;
            return (
              <View key={idx} style={styles.dayCard}>
                <Text style={styles.dayDate}>{d.date}</Text>
                <View style={[styles.dayDot, { backgroundColor: dot }]} />
                <Text style={styles.dayScore}>{score}/100</Text>
              </View>
            );
          })}
        </ScrollView>
        {weekly?.week_summary ? <Text style={styles.meta}>Trend: {weekly.week_summary.trend}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cream },
  screenTitle: { fontSize: 28, fontWeight: '900', color: C.ink, marginBottom: 12 },
  ratingCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  ratingTitle: { fontSize: 18, fontWeight: '900' },
  ratingMeta: { marginTop: 6, fontWeight: '800' },
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '900', color: C.ink },
  meta: { marginTop: 10, color: C.muted, fontWeight: '600' },
  suggestion: { marginTop: 10, color: C.ink, fontWeight: '700' },
  barLabel: { fontWeight: '800', color: C.ink },
  barMeta: { color: C.muted, fontWeight: '800' },
  barSub: { marginTop: 6, color: C.muted, fontWeight: '600' },
  barBg: { height: 8, backgroundColor: C.white, borderRadius: 999, overflow: 'hidden', marginTop: 8, borderWidth: 1, borderColor: C.border },
  barFill: { height: 8, borderRadius: 999 },
  dayCard: { width: 110, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 12 },
  dayDate: { color: C.muted, fontWeight: '700' },
  dayDot: { width: 10, height: 10, borderRadius: 5, marginTop: 10 },
  dayScore: { marginTop: 10, color: C.ink, fontWeight: '900' },
});
