import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getToken, removeToken } from '../utils/storage';
import { resetToLogin } from '../utils/navigationRef';

const DEFAULT_WEB_URL = 'http://localhost:8000';
const DEFAULT_ANDROID_EMULATOR_URL = 'http://10.0.2.2:8000';
const DEFAULT_LAN_URL = 'http://192.168.29.149:8000';

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return null;
  return url.trim().replace(/\/+$/, '');
}

function getExpoHostIp() {
  try {
    const hostUri = Constants?.expoConfig?.hostUri;
    if (!hostUri || typeof hostUri !== 'string') return null;
    const host = hostUri.split(':')[0];
    if (!host || host === 'localhost') return null;
    return host;
  } catch (e) {
    return null;
  }
}

const envBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
const expoHostIp = getExpoHostIp();
const expoDerivedUrl = expoHostIp ? `http://${expoHostIp}:8000` : null;
const defaultNativeUrl = Platform.OS === 'android' ? expoDerivedUrl || DEFAULT_LAN_URL : DEFAULT_WEB_URL;
export const BASE_URL =
  envBaseUrl ||
  (Platform.OS === 'web'
    ? DEFAULT_WEB_URL
    : Platform.OS === 'android'
      ? defaultNativeUrl
      : DEFAULT_WEB_URL);

let _baseUrlLogged = false;
export function getApiBaseUrl() {
  return BASE_URL;
}

function logBaseUrlOnce() {
  if (_baseUrlLogged) return;
  _baseUrlLogged = true;
  // eslint-disable-next-line no-console
  console.log('API BASE_URL =', BASE_URL);
}

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

client.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      try {
        await removeToken();
      } catch (e) {
        // ignore
      }
      try {
        resetToLogin();
      } catch (e) {
        // ignore
      }
    }
    return Promise.reject(error);
  }
);

export async function login(email, password) {
  logBaseUrlOnce();
  const res = await client.post('/login', { email, password });
  return res.data;
}

export async function register(email, password, name) {
  logBaseUrlOnce();
  const res = await client.post('/register', { email, password, name });
  return res.data;
}

export async function pingApi() {
  logBaseUrlOnce();
  const res = await client.get('/docs');
  return res.status;
}

export async function scanProduct(barcode, productName) {
  const res = await client.post('/scan', { barcode, product_name: productName || null });
  return res.data;
}

export async function searchProduct(query) {
  const res = await client.get('/search', { params: { query } });
  return res.data;
}

export async function getDailyReport() {
  const res = await client.get('/report/daily');
  return res.data;
}

export async function getWeeklyReport() {
  const res = await client.get('/report/weekly');
  return res.data;
}

export async function explainProduct(barcode) {
  const res = await client.get(`/explain/${encodeURIComponent(barcode)}`);
  return res.data;
}

export async function analyzeManualProduct(data) {
  const res = await client.post('/analyze', data);
  return res.data;
}

export async function scanNutritionLabel(base64Image) {
  const res = await client.post('/ocr', { image_base64: base64Image });
  return res.data;
}

export const logFoodManual = async (productName, calories) => {
  const token = await getToken();
  const response = await axios.post(
    `${BASE_URL}/food-log`,
    {
      product_name: productName,
      calories: parseFloat(calories) || 0,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export async function getUserProfile() {
  const res = await client.get('/user/profile');
  return res.data;
}

export async function updateUserProfile(data) {
  const res = await client.put('/user/profile', data);
  return res.data;
}

export async function getHistory() {
  const res = await client.get('/history');
  return res.data;
}

export async function getTodayFoods() {
  const res = await client.get('/today');
  return res.data;
}
