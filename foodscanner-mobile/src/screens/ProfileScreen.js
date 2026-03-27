import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getUserProfile, updateUserProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';

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

const DIETS = [
  { key: null, label: 'None' },
  { key: 'diabetic', label: 'Diabetic' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'low_sodium', label: 'Low Sodium' },
];

const GOALS = [
  { key: 'lose_weight', label: 'Lose Weight' },
  { key: 'control_sugar', label: 'Control Sugar' },
  { key: 'eat_clean', label: 'Eat Clean' },
  { key: 'build_muscle', label: 'Build Muscle' },
  { key: 'reduce_sodium', label: 'Reduce Sodium' },
];

function Pill({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [diet, setDiet] = useState(null);
  const [goal, setGoal] = useState(null);
  const [goalDays, setGoalDays] = useState('30');
  const [dailyLimit, setDailyLimit] = useState('2000');

  useEffect(() => {
    (async () => {
      try {
        const p = await getUserProfile();
        setProfile(p);
        setDiet(p?.diet_type ?? null);
        setGoal(p?.goal_type ?? null);
        setGoalDays(String(p?.goal_target_days ?? 30));
        setDailyLimit(String(p?.daily_calorie_limit ?? 2000));
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const save = async () => {
    try {
      const payload = {
        diet_type: diet,
        daily_calorie_limit: dailyLimit ? Number(dailyLimit) : null,
        goal_type: goal,
        goal_target_days: goalDays ? Number(goalDays) : null,
      };
      await updateUserProfile(payload);
      Alert.alert('Saved', 'Profile updated');
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Update failed';
      Alert.alert('Error', String(msg));
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const initial = (profile?.name || profile?.email || 'U').trim().slice(0, 1).toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile?.name || 'User'}</Text>
          <Text style={styles.email}>{profile?.email || ''}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Diet Type</Text>
        <View style={styles.pills}>
          {DIETS.map((d) => (
            <Pill key={String(d.key)} label={d.label} active={diet === d.key} onPress={() => setDiet(d.key)} />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Daily Calorie Limit</Text>
        <TextInput style={styles.input} value={dailyLimit} onChangeText={setDailyLimit} keyboardType="numeric" />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Health Goal</Text>
        <View style={styles.pills}>
          {GOALS.map((g) => (
            <Pill key={g.key} label={g.label} active={goal === g.key} onPress={() => setGoal(g.key)} />
          ))}
        </View>

        <Text style={[styles.section, { marginTop: 14 }]}>Goal target days</Text>
        <TextInput style={styles.input} value={goalDays} onChangeText={setGoalDays} keyboardType="numeric" />
      </View>

      <TouchableOpacity style={styles.inkBtn} onPress={save}>
        <Text style={styles.inkBtnText}>SAVE</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>LOGOUT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.sageLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  avatarText: { fontWeight: '900', color: '#1e5222', fontSize: 20 },
  name: { fontSize: 20, fontWeight: '900', color: C.ink },
  email: { marginTop: 4, color: C.muted, fontWeight: '600' },
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 14 },
  section: { fontSize: 16, fontWeight: '900', color: C.ink },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  pill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  pillActive: { backgroundColor: C.sage, borderColor: C.sage },
  pillText: { fontWeight: '800', color: C.ink },
  pillTextActive: { color: C.white },
  input: { backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginTop: 10, borderWidth: 1.5, borderColor: C.border, color: C.ink, fontWeight: '700' },
  inkBtn: { marginTop: 6, backgroundColor: C.ink, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  inkBtnText: { color: C.white, fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  logoutBtn: { marginTop: 12, borderWidth: 1.5, borderColor: C.red, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: 'transparent' },
  logoutText: { color: C.red, fontWeight: '900', fontSize: 16, letterSpacing: 1 },
});
