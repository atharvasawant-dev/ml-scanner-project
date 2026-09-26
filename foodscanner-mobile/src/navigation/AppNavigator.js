import React from 'react';
import { Text, View, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NEO_COLORS, NEO_BORDERS } from '../theme/neoTheme';

import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import ResultScreen from '../screens/ResultScreen';
import ReportScreen from '../screens/ReportScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ManualEntryScreen from '../screens/ManualEntryScreen';
import OCRScanScreen from '../screens/OCRScanScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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


function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: NEO_COLORS.ink,
        tabBarInactiveTintColor: NEO_COLORS.muted,
        tabBarLabelStyle: {
          fontWeight: '900',
          fontSize: 11,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: NEO_COLORS.card,
          borderTopColor: NEO_COLORS.ink,
          borderTopWidth: NEO_BORDERS.thick,
          height: Platform.OS === 'ios' ? 84 : 68,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
          elevation: 8,
        },
        tabBarIcon: ({ focused }) => {
          const icons = { Home: '🏠', Scan: '📷', Report: '📊', Profile: '👤' };
          return (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: focused ? NEO_COLORS.yellow : 'transparent',
                borderWidth: focused ? 1.5 : 0,
                borderColor: NEO_COLORS.ink,
              }}
            >
              <Text style={{ fontSize: 19 }}>{icons[route.name] || '•'}</Text>
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
      />
      <Tab.Screen
        name="Report"
        component={ReportScreen}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoggedIn } = useAuth();

  if (isLoggedIn === null) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isLoggedIn ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen
            name="Result"
            component={ResultScreen}
            options={{ unmountOnBlur: true, headerShown: false }}
          />
          <Stack.Screen name="ManualEntry" component={ManualEntryScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OCRScan" component={OCRScanScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}
