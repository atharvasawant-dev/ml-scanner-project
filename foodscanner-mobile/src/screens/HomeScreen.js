import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getDailyReport, getTodayFoods, getUserProfile } from '../services/api';

const C = {
  cream: '#F5F2EC',
  ink: '#1A1A17',
  sage: '#0288D1',
  sageLight: '#B3E5FC',
  amberLight: '#F0D9A8',
  redLight: '#F0C8C0',
  border: '#DDD8CE',
  muted: '#888179',
  white: '#FFFFFF',
  red: '#B83C28',
};

function _formatDate(d) {
  try {
    return new Date(d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function _scoreColor(score) {
  const s = Number(score) || 0;
  if (s >= 70) return '#0288D1';
  if (s >= 45) return '#A9731B';
  return C.red;
}

function _greeting(name) {
  const h = new Date().getHours();
  const prefix = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${prefix}, ${name}!`;
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

  const ringColor = _scoreColor(overallScore);

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
  const limitKcal = Number(calories?.limit) || 0;

  const scansCount = foodsTodayOnly.length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={'#0288D1'} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{greeting}</Text>
            <Text style={styles.headerDate}>{todayLabel}</Text>
          </View>
          <View style={[styles.scoreBadge, { borderColor: ringColor }]}
          >
            <Text style={[styles.scoreBadgeText, { color: ringColor }]}>{Number(overallScore) || 0}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statTitle}>🔥 Calories</Text>
              <Text style={styles.statValue}>{limitKcal ? `${consumedKcal} / ${limitKcal}` : `${consumedKcal}`}</Text>
              <Text style={styles.statSub}>kcal</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statTitle}>📊 Score</Text>
              <Text style={[styles.statValue, { color: ringColor }]}>{Number(overallScore) || 0}</Text>
              <Text style={styles.statSub}>today</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statTitle}>🥗 Scans</Text>
              <Text style={styles.statValue}>{scansCount}</Text>
              <Text style={styles.statSub}>items</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardKicker}>Calories</Text>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${caloriePct * 100}%` }]} />
            </View>
            <Text style={styles.meta}>{calories ? `${calories.consumed} / ${calories.limit} kcal` : 'No data'}</Text>
          </View>

          <Text style={styles.sectionHeader}>Today's Food Log</Text>
          {!hasFoods ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No scans yet today 🔍</Text>
              <Text style={styles.emptySub}>Start scanning to track your health!</Text>
            </View>
          ) : (
            foodsTodayOnly.map((f, idx) => {
              const productName = f?.product_name || f?.name || f?.product || `Product ${idx + 1}`;
              const decision = String(f?.result || f?.final_decision || f?.decision || '').toUpperCase();
              const kcal = Number(f?.calories) || 0;
              const badgeMeta =
                decision === 'SAFE'
                  ? { bg: '#E8F5E9', fg: '#1e5222', text: 'SAFE', dot: '#2E7D32' }
                  : decision === 'MODERATE'
                    ? { bg: C.amberLight, fg: '#7a4a0a', text: 'MODERATE', dot: '#EF6C00' }
                    : { bg: C.redLight, fg: '#8c1a0a', text: decision || 'AVOID', dot: '#B83C28' };
              return (
                <View key={idx} style={styles.logRow}>
                  <View style={[styles.dot, { backgroundColor: badgeMeta.dot }]} />
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.logName} numberOfLines={1}>{productName}</Text>
                    <Text style={styles.logMeta}>{kcal} kcal</Text>
                  </View>
                  <View style={[styles.verdictPill, { backgroundColor: badgeMeta.bg, borderColor: C.border }]}>
                    <Text style={[styles.verdictText, { color: badgeMeta.fg }]}>{badgeMeta.text}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.scanBtn} onPress={() => navigation.navigate('Main', { screen: 'Scan' })}>
        <Text style={styles.scanText}>SCAN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cream },
  header: { paddingTop: 18, paddingBottom: 18, paddingHorizontal: 16, backgroundColor: '#B3E5FC', flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: C.ink, fontSize: 26, fontWeight: '900' },
  headerDate: { marginTop: 6, color: C.ink, fontWeight: '700', opacity: 0.7 },
  scoreBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.white, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  scoreBadgeText: { fontWeight: '900', fontSize: 16 },
  body: { padding: 16, paddingTop: 14 },
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 14 },
  cardKicker: { color: C.muted, fontWeight: '800', marginBottom: 6 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  statTitle: { color: C.muted, fontWeight: '900', fontSize: 12 },
  statValue: { marginTop: 6, color: C.ink, fontWeight: '900', fontSize: 18 },
  statSub: { marginTop: 2, color: C.muted, fontWeight: '700', fontSize: 12 },
  sectionHeader: { fontSize: 16, fontWeight: '900', color: C.ink, marginBottom: 10, marginTop: 4 },
  meta: { marginTop: 8, color: C.muted, fontWeight: '600' },
  progressBg: { height: 8, backgroundColor: C.white, borderRadius: 999, overflow: 'hidden', marginTop: 10, borderWidth: 1, borderColor: C.border },
  progressFill: { height: 8, backgroundColor: '#0288D1' },
  emptyWrap: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
  emptyText: { color: C.ink, fontWeight: '900', fontSize: 16 },
  emptySub: { marginTop: 6, color: C.muted, fontWeight: '700' },
  logRow: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  logName: { fontWeight: '900', color: C.ink },
  logMeta: { marginTop: 4, color: C.muted, fontWeight: '700' },
  verdictPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  verdictText: { fontWeight: '900', fontSize: 12 },
  scanBtn: { position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: '#0288D1', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  scanText: { color: C.white, fontWeight: '900', fontSize: 16, letterSpacing: 1 },
});
