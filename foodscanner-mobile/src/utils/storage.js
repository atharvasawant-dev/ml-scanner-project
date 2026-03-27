import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'foodscanner_token';

export async function saveToken(token) {
  if (!token) return;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function removeToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}
