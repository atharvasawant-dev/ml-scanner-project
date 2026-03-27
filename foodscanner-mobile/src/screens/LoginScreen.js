import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { login, register } from '../services/api';
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

export default function LoginScreen() {
  const { login: authLogin } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Email and password are required');
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
      console.log('Login/Register failed:', e);
      console.log('Response data:', e?.response?.data);
      const msg = e?.response?.data?.detail || e?.message || 'Login failed';
      Alert.alert('Error', String(msg));
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
        <Text style={styles.heroTitle}>FoodScanner AI</Text>
        <Text style={styles.heroSubtitle}>Scan smarter. Eat healthier.</Text>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]}
              onPress={() => setMode('login')}
              disabled={loading}
            >
              <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'register' && styles.toggleBtnActive]}
              onPress={() => setMode('register')}
              disabled={loading}
            >
              <Text style={[styles.toggleText, mode === 'register' && styles.toggleTextActive]}>Register</Text>
            </TouchableOpacity>
          </View>

          {mode === 'register' ? (
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor="#777"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>
          ) : null}

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#777"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#777"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={loading}>
            <Text style={styles.submitText}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            Web uses localhost backend. Phone uses your LAN IP.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: C.cream,
  },
  kb: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: 420,
  },
  heroTitle: {
    color: C.ink,
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    color: C.muted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'transparent',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 999,
  },
  toggleBtnActive: {
    backgroundColor: C.ink,
  },
  toggleText: {
    fontWeight: '800',
    color: C.ink,
  },
  toggleTextActive: {
    color: C.white,
  },
  inputWrap: {
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  input: {
    color: C.ink,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 16,
    backgroundColor: C.ink,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.6,
  },
  note: {
    marginTop: 12,
    color: C.muted,
    fontSize: 12,
    textAlign: 'center',
  },
});
