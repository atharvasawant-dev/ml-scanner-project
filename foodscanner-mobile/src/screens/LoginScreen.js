import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import { getNetworkErrorMessage, login, register } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../theme/neoTheme';
import { NeoCard, NeoButton, NeoInput, NeoBadge } from '../components/neo';

export default function LoginScreen() {
  const { login: authLogin } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Info', 'Email and password are required');
      return;
    }

    setLoading(true);
    try {
      let data;
      if (mode === 'register') {
        data = await register(email.trim(), password, name.trim() || null);
      } else {
        data = await login(email.trim(), password);
      }

      const token = data?.access_token;
      if (!token) {
        Alert.alert('Error', 'No token returned from server');
        return;
      }
      await authLogin(token);
    } catch (e) {
      const msg = getNetworkErrorMessage(e) || 'Authentication failed';
      Alert.alert('Authentication Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.kb}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Brand Sticker */}
          <View style={styles.brandRow}>
            <NeoBadge text="VERIFIED INTELLIGENCE" variant="yellow" />
            <Text style={styles.brandTag}>⚡ BATCH 9B</Text>
          </View>

          <Text style={styles.heroTitle}>PRAMAAN</Text>
          <Text style={styles.heroSubtitle}>
            Scan Smarter • Decode Ingredients • Eat Verified
          </Text>

          {/* Form Card */}
          <NeoCard variant="white" elevation="lg" style={styles.card}>
            {/* Chunky Tab Toggle */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]}
                onPress={() => setMode('login')}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>
                  LOG IN
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, mode === 'register' && styles.toggleBtnActive]}
                onPress={() => setMode('register')}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, mode === 'register' && styles.toggleTextActive]}>
                  REGISTER
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'register' ? (
              <NeoInput
                label="Full Name"
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
              />
            ) : null}

            <NeoInput
              label="Email Address"
              placeholder="e.g. user@pramaan.ai"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />

            <NeoInput
              label="Password"
              placeholder="Enter secure password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />

            <NeoButton
              title={loading ? 'VERIFYING...' : mode === 'login' ? 'LOG IN TO PRAMAAN' : 'CREATE VERIFIED ACCOUNT'}
              variant="coral"
              size="lg"
              onPress={onSubmit}
              disabled={loading}
              style={styles.submitBtn}
            />

            {/* Neo-brutalist footnote badge */}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>🛡️</Text>
              <Text style={styles.infoText}>
                Statutory claim verification & evidence-based health scoring engine.
              </Text>
            </View>
          </NeoCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEO_COLORS.bg,
  },
  kb: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  brandTag: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: NEO_COLORS.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    padding: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    padding: 3,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: NEO_RADIUS.sm,
  },
  toggleBtnActive: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    ...NEO_SHADOWS.sm,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: NEO_COLORS.muted,
    letterSpacing: 0.5,
  },
  toggleTextActive: {
    color: NEO_COLORS.ink,
    fontWeight: '900',
  },
  submitBtn: {
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
    gap: 8,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: NEO_COLORS.muted,
    lineHeight: 15,
  },
});
