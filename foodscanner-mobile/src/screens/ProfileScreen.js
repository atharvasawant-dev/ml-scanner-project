import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';

import { getUserProfile, updateUserProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS, NEO_TYPOGRAPHY } from '../theme/neoTheme';
import { NeoCard, NeoButton, NeoInput, NeoBadge, NeoSectionHeader } from '../components/neo';

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
      Alert.alert('Profile Saved', 'Your dietary and health preferences have been updated.');
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* User Header Hero */}
      <NeoCard variant="white" elevation="md" style={styles.userCard}>
        <View style={styles.userRow}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.userInfo}>
            <View style={styles.badgeRow}>
              <NeoBadge text="VERIFIED PROFILE" variant="purple" />
            </View>
            <Text style={styles.userName} numberOfLines={1}>
              {profile?.name || 'Verified User'}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {profile?.email || 'user@pramaan.ai'}
            </Text>
          </View>
        </View>
      </NeoCard>

      {/* Diet Type Selector */}
      <NeoCard variant="white" elevation="sm" style={styles.sectionCard}>
        <NeoSectionHeader title="Dietary Profile" count="Active" tagColor={NEO_COLORS.yellow} />
        <Text style={styles.hintText}>
          Food recommendations and scan warnings adapt to your selected diet.
        </Text>
        <View style={styles.pillsWrap}>
          {DIETS.map((d) => {
            const active = diet === d.key;
            return (
              <TouchableOpacity
                key={String(d.key)}
                style={[
                  styles.pill,
                  active ? styles.pillActiveDiet : styles.pillInactive,
                ]}
                onPress={() => setDiet(d.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </NeoCard>

      {/* Daily Calorie Limit */}
      <NeoCard variant="white" elevation="sm" style={styles.sectionCard}>
        <NeoSectionHeader title="Daily Energy Target" tagColor={NEO_COLORS.orange} />
        <Text style={styles.hintText}>
          Baseline maximum daily intake for your nutrition audit dashboard.
        </Text>
        <NeoInput
          label="Daily Calorie Limit"
          value={dailyLimit}
          onChangeText={setDailyLimit}
          keyboardType="numeric"
          placeholder="2000"
          rightElement={
            <NeoBadge text="KCAL / DAY" variant="yellow" style={{ marginHorizontal: 4 }} />
          }
        />
      </NeoCard>

      {/* Health Goal */}
      <NeoCard variant="white" elevation="sm" style={styles.sectionCard}>
        <NeoSectionHeader title="Health Objective" count="Goal" tagColor={NEO_COLORS.cyan} />
        <Text style={styles.hintText}>
          Select your primary wellness target to customize statutory insights.
        </Text>
        <View style={styles.pillsWrap}>
          {GOALS.map((g) => {
            const active = goal === g.key;
            return (
              <TouchableOpacity
                key={g.key}
                style={[
                  styles.pill,
                  active ? styles.pillActiveGoal : styles.pillInactive,
                ]}
                onPress={() => setGoal(g.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ marginTop: 14 }}>
          <NeoInput
            label="Target Timeline"
            value={goalDays}
            onChangeText={setGoalDays}
            keyboardType="numeric"
            placeholder="30"
            rightElement={
              <NeoBadge text="DAYS" variant="cyan" style={{ marginHorizontal: 4 }} />
            }
          />
        </View>
      </NeoCard>

      {/* Action Buttons */}
      <View style={styles.actionsWrap}>
        <NeoButton
          title={saving ? 'SAVING PREFERENCES...' : 'SAVE PROFILE PREFERENCES'}
          variant="green"
          size="lg"
          onPress={save}
          disabled={saving}
        />

        <NeoButton
          title="LOGOUT FROM PRAMAAN"
          variant="white"
          size="md"
          onPress={handleLogout}
          textStyle={{ color: NEO_COLORS.coral }}
          style={styles.logoutBtn}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEO_COLORS.bg,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  userCard: {
    padding: 16,
    marginBottom: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarBox: {
    width: 60,
    height: 60,
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...NEO_SHADOWS.sm,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  userInfo: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 12,
    fontWeight: '700',
    color: NEO_COLORS.muted,
    marginTop: 2,
  },
  sectionCard: {
    padding: 16,
    marginBottom: 16,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '600',
    color: NEO_COLORS.muted,
    marginBottom: 12,
    marginTop: -4,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: NEO_RADIUS.pill,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
  },
  pillInactive: {
    backgroundColor: NEO_COLORS.white,
  },
  pillActiveDiet: {
    backgroundColor: NEO_COLORS.coral,
    ...NEO_SHADOWS.sm,
  },
  pillActiveGoal: {
    backgroundColor: NEO_COLORS.cyan,
    ...NEO_SHADOWS.sm,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  pillTextActive: {
    color: NEO_COLORS.ink,
    fontWeight: '900',
  },
  actionsWrap: {
    gap: 12,
    marginTop: 4,
  },
  logoutBtn: {
    borderColor: NEO_COLORS.coral,
  },
});
