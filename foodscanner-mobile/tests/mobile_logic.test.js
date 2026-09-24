const { test, describe } = require('node:test');
const assert = require('node:assert');

// 1. Re-implemented pure utility logic mirroring mobile app helpers
function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return null;
  return url.trim().replace(/\/+$/, '');
}

function extractHost(value) {
  if (!value || typeof value !== 'string') return null;
  const rawValue = value.trim();
  if (!rawValue) return null;

  try {
    const withProtocol = rawValue.includes('://') ? rawValue : `http://${rawValue}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname || null;
  } catch (_e) {
    const host = rawValue.split('/')[0].split(':')[0];
    return host || null;
  }
}

function getNetworkErrorMessage(error, baseUrl = 'http://127.0.0.1:8000') {
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error?.request || error?.message === 'Network Error') {
    return `Cannot reach backend at ${baseUrl}. Please check your internet connection and try again.`;
  }
  return error?.message || 'Request failed';
}

function getDecisionMeta(decision) {
  const d = String(decision || '').toUpperCase();
  if (d === 'SAFE') return { text: 'SAFE', color: 'green' };
  if (d === 'MODERATE') return { text: 'MODERATE', color: 'amber' };
  return { text: d || 'AVOID', color: 'red' };
}

function calculateServingNutrition(baseNutrition100g, servingGrams) {
  if (!baseNutrition100g || !servingGrams || servingGrams <= 0) return null;
  const ratio = servingGrams / 100.0;
  const result = {};
  for (const [key, val] of Object.entries(baseNutrition100g)) {
    if (val === null || val === undefined || isNaN(val)) {
      result[key] = null;
    } else {
      result[key] = Math.round(Number(val) * ratio * 10) / 10;
    }
  }
  return result;
}

describe('Mobile API and URL Resolution Logic', () => {
  test('normalizeBaseUrl removes trailing slashes and whitespace', () => {
    assert.strictEqual(normalizeBaseUrl('  http://192.168.1.50:8000/// '), 'http://192.168.1.50:8000');
    assert.strictEqual(normalizeBaseUrl('https://api.foodscanner.com/'), 'https://api.foodscanner.com');
    assert.strictEqual(normalizeBaseUrl(null), null);
    assert.strictEqual(normalizeBaseUrl(undefined), null);
    assert.strictEqual(normalizeBaseUrl(''), null);
  });

  test('extractHost parses host from various Expo debugger candidates', () => {
    assert.strictEqual(extractHost('192.168.1.45:8081'), '192.168.1.45');
    assert.strictEqual(extractHost('http://10.0.2.2:8081/index.bundle'), '10.0.2.2');
    assert.strictEqual(extractHost('exp://192.168.0.10:8081'), '192.168.0.10');
    assert.strictEqual(extractHost(''), null);
    assert.strictEqual(extractHost(null), null);
  });

  test('getNetworkErrorMessage provides user-friendly backend offline advice', () => {
    const offlineErr = { message: 'Network Error', request: {} };
    const msg = getNetworkErrorMessage(offlineErr, 'http://192.168.1.100:8000');
    assert.match(msg, /Cannot reach backend at http:\/\/192\.168\.1\.100:8000/);

    const apiErr = { response: { data: { detail: 'Product expired or invalid' } } };
    assert.strictEqual(getNetworkErrorMessage(apiErr), 'Product expired or invalid');
  });
});

describe('Mobile ResultScreen Decision and Serving Calculations', () => {
  test('getDecisionMeta maps SAFE, MODERATE, AVOID correctly', () => {
    assert.strictEqual(getDecisionMeta('safe').color, 'green');
    assert.strictEqual(getDecisionMeta('moderate').color, 'amber');
    assert.strictEqual(getDecisionMeta('avoid').color, 'red');
    assert.strictEqual(getDecisionMeta('').color, 'red');
  });

  test('calculateServingNutrition correctly scales from 100g baseline', () => {
    const base100g = {
      calories: 400,
      sugar: 20,
      fat: 10,
      salt: 1.5,
    };

    // 50g portion (half)
    const half = calculateServingNutrition(base100g, 50);
    assert.strictEqual(half.calories, 200);
    assert.strictEqual(half.sugar, 10);
    assert.strictEqual(half.fat, 5);
    assert.strictEqual(half.salt, 0.8); // 0.75 rounds to 0.8

    // 150g portion (1.5x)
    const oneAndHalf = calculateServingNutrition(base100g, 150);
    assert.strictEqual(oneAndHalf.calories, 600);
    assert.strictEqual(oneAndHalf.sugar, 30);
    assert.strictEqual(oneAndHalf.fat, 15);
  });
});
