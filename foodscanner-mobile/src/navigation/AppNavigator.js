import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
        tabBarActiveTintColor: '#0288D1',
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopColor: C.border,
          borderTopWidth: 1,
        },
        tabBarIcon: () => {
          const icons = { Home: '🏠', Scan: '📷', Report: '📊', Profile: '👤' };
          return <Text style={{ fontSize: 20 }}>{icons[route.name] || '•'}</Text>;
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
