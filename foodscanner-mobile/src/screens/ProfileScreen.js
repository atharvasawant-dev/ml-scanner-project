import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getUserProfile, updateUserProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  PREMIUM_COLORS,
  PREMIUM_SHADOWS,
  PREMIUM_RADIUS,
} from '../theme/premiumTheme';
import { NeoButton, NeoInput, NeoBadge } from '../components/neo';

const DIETS = [
  { key: null, label: 'Standard / None' },
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

export default function ProfileScreen({ navigation }) {
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [diet, setDiet] = useState(null);
  const [goal, setGoal] = useState(null);
  const [goalDays, setGoalDays] = useState('30');
  const [dailyLimit, setDailyLimit] = useState('2000');
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      const payload = {
        diet_type: diet,
        daily_calorie_limit: dailyLimit ? Number(dailyLimit) : null,
        goal_type: goal,
        goal_target_days: goalDays ? Number(goalDays) : null,
      };
      await updateUserProfile(payload);
      Alert.alert('Profile Saved', 'Your dietary preferences and goals have been updated.');
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Update failed';
      Alert.alert('Error', String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of PRAMAAN?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: async () => await logout() },
      ]
    );
  };

  const initial = (profile?.name || profile?.email || 'U').trim().slice(0, 1).toUpperCase();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.categoryBadge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>ACCOUNT</Text>
          </View>
          <Text style={styles.screenTitle}>Health Profile</Text>
          <Text style={styles.screenSub}>Personalize nutritional limits & dietary scoring</Text>
        </View>

        {/* User Card */}
        <View style={[styles.userCard, PREMIUM_SHADOWS.sm]}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.userInfo}>
            <NeoBadge text="VERIFIED PROFILE" variant="safe" size="sm" showDot />
            <Text style={styles.userName} numberOfLines={1}>
              {profile?.name || 'Pramaan Member'}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {profile?.email || 'member@pramaan.ai'}
            </Text>
          </View>
        </View>

        {/* Dietary Preferences Card */}
        <View style={[styles.card, PREMIUM_SHADOWS.sm]}>
          <Text style={styles.cardTitle}>Dietary Profile</Text>
          <Text style={styles.cardSub}>
            Hazard thresholds and health scores automatically adapt to your diet.
          </Text>

          <View style={styles.chipsRow}>
            {DIETS.map((d) => {
              const active = diet === d.key;
              return (
                <TouchableOpacity
                  key={String(d.key)}
                  activeOpacity={0.85}
                  style={[
                    styles.chip,
                    active ? styles.chipActive : null,
                  ]}
                  onPress={() => setDiet(d.key)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Health Goal Card */}
        <View style={[styles.card, PREMIUM_SHADOWS.sm]}>
          <Text style={styles.cardTitle}>Primary Health Goal</Text>
          <Text style={styles.cardSub}>
            Focus recommendations on your specific wellness target.
          </Text>

          <View style={styles.chipsRow}>
            {GOALS.map((g) => {
              const active = goal === g.key;
              return (
                <TouchableOpacity
                  key={g.key}
                  activeOpacity={0.85}
                  style={[
                    styles.chip,
                    active ? styles.chipActive : null,
                  ]}
                  onPress={() => setGoal(g.key)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Targets & Budgets */}
        <View style={[styles.card, PREMIUM_SHADOWS.sm]}>
          <Text style={styles.cardTitle}>Calorie & Duration Targets</Text>
          <Text style={styles.cardSub}>Set your daily calorie allowance and goal timeline.</Text>

          <NeoInput
            label="Daily Calorie Budget (kcal)"
            value={dailyLimit}
            onChangeText={setDailyLimit}
            placeholder="2000"
            keyboardType="numeric"
          />

          <NeoInput
            label="Goal Duration (Days)"
            value={goalDays}
            onChangeText={setGoalDays}
            placeholder="30"
            keyboardType="numeric"
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <NeoButton
            title="Save Preferences"
            onPress={save}
            loading={saving}
            variant="black"
            size="lg"
          />

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={16} color={PREMIUM_COLORS.status.avoid} style={{ marginRight: 6 }} />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.bg,
  },
  scrollContent: {
    padding: 18,
    paddingTop: 52,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PREMIUM_COLORS.primaryDark,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: PREMIUM_COLORS.primaryDark,
    letterSpacing: 0.6,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: PREMIUM_COLORS.ink,
    letterSpacing: -0.4,
  },
  screenSub: {
    fontSize: 14,
    fontWeight: '400',
    color: PREMIUM_COLORS.secondary,
    marginTop: 4,
    lineHeight: 20,
  },

  // User Card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PREMIUM_COLORS.card,
    borderRadius: PREMIUM_RADIUS.xl,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.border,
    gap: 14,
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: PREMIUM_COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: PREMIUM_COLORS.primaryDark,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: PREMIUM_COLORS.ink,
    marginTop: 2,
  },
  userEmail: {
    fontSize: 13,
    fontWeight: '400',
    color: PREMIUM_COLORS.secondary,
  },

  // Cards
  card: {
    backgroundColor: PREMIUM_COLORS.card,
    borderRadius: PREMIUM_RADIUS.xl,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.border,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: PREMIUM_COLORS.ink,
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 13,
    fontWeight: '400',
    color: PREMIUM_COLORS.secondary,
    marginTop: 2,
    marginBottom: 12,
  },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: PREMIUM_COLORS.bgAlt,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: PREMIUM_RADIUS.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: PREMIUM_COLORS.primaryLight,
    borderColor: PREMIUM_COLORS.status.safeBorder,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: PREMIUM_COLORS.ink,
  },
  chipTextActive: {
    color: PREMIUM_COLORS.primaryDark,
    fontWeight: '700',
  },

  // Actions
  actionsContainer: {
    marginTop: 10,
    gap: 12,
  },
  logoutBtn: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: PREMIUM_COLORS.status.avoid,
  },
});
