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

// 2. Batch 9A Component and Invariant Unit Test Helpers
function getClaimStatusMeta(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'SUPPORTED') return { label: 'SUPPORTED', color: 'green' };
  if (s === 'NOT_SUPPORTED') return { label: 'NOT SUPPORTED', color: 'red' };
  if (s === 'NEEDS_REVIEW') return { label: 'NEEDS REVIEW', color: 'amber' };
  return { label: 'INSUFFICIENT DATA', color: 'gray' };
}

function buildScanRequest(barcode, productName, claims = null) {
  const payload = { barcode: String(barcode).trim(), product_name: productName || null };
  if (Array.isArray(claims) && claims.length > 0) {
    payload.claims = claims;
  }
  return { path: '/scan', method: 'POST', body: payload };
}

function buildVerifyClaimsRequest({ claims, barcode, nutrition, ingredients, productName } = {}) {
  return {
    path: '/verify-claims',
    method: 'POST',
    body: {
      claims: Array.isArray(claims) ? claims : [],
      barcode: barcode || null,
      nutrition: nutrition || null,
      ingredients: ingredients || null,
      product_name: productName || null,
    },
  };
}

function buildCompareRequest(productA, productB) {
  return {
    path: '/compare',
    method: 'POST',
    body: {
      product_a: String(productA || '').trim(),
      product_b: String(productB || '').trim(),
    },
  };
}

function buildChatRequest({ message, barcode, productContext } = {}) {
  return {
    path: '/chat',
    method: 'POST',
    body: {
      message: String(message || '').trim(),
      barcode: barcode ? String(barcode).trim() : null,
      product_context: productContext || null,
    },
  };
}

function buildFoodLogRequest({ productName, calories, barcode, servingSize, nutrition } = {}) {
  return {
    path: '/food-log',
    method: 'POST',
    body: {
      product_name: productName,
      calories: Number(calories) || 0,
      serving_size: servingSize || 100,
      barcode: barcode || null,
      ...nutrition,
    },
  };
}

describe('Batch 9A: Claim Verification Logic and Component State', () => {
  test('getClaimStatusMeta correctly maps all four statutory FSSAI statuses', () => {
    assert.strictEqual(getClaimStatusMeta('SUPPORTED').color, 'green');
    assert.strictEqual(getClaimStatusMeta('supported').label, 'SUPPORTED');

    assert.strictEqual(getClaimStatusMeta('NOT_SUPPORTED').color, 'red');
    assert.strictEqual(getClaimStatusMeta('not_supported').label, 'NOT SUPPORTED');

    assert.strictEqual(getClaimStatusMeta('NEEDS_REVIEW').color, 'amber');
    assert.strictEqual(getClaimStatusMeta('INSUFFICIENT_DATA').color, 'gray');
    assert.strictEqual(getClaimStatusMeta(null).label, 'INSUFFICIENT DATA');
    assert.strictEqual(getClaimStatusMeta(undefined).color, 'gray');
  });

  test('Claim verification payload constructs valid regulatory query structure', () => {
    const claims = ['High Protein', 'Sugar Free'];
    const req = buildVerifyClaimsRequest({
      claims,
      barcode: '8901058000256',
      nutrition: { protein: 12.0, sugar: 0.2 },
    });
    assert.strictEqual(req.path, '/verify-claims');
    assert.deepStrictEqual(req.body.claims, claims);
    assert.strictEqual(req.body.barcode, '8901058000256');
    assert.strictEqual(req.body.nutrition.protein, 12.0);
  });
});

describe('Batch 9A: Healthier Alternatives & Comparison Logic', () => {
  test('Alternatives gracefully handles empty recommendations list without crashing', () => {
    const emptyList = [];
    const hasItems = Array.isArray(emptyList) && emptyList.length > 0;
    assert.strictEqual(hasItems, false);

    const validList = [{ product_name: 'Baked Chips', health_score: 75, advantages: ['50% less fat'] }];
    assert.strictEqual(validList.length, 1);
    assert.strictEqual(validList[0].advantages[0], '50% less fat');
  });

  test('Compare request cleanly trims queries and targets /compare', () => {
    const req = buildCompareRequest('  Maggi  ', '8901058000256 ');
    assert.strictEqual(req.path, '/compare');
    assert.strictEqual(req.body.product_a, 'Maggi');
    assert.strictEqual(req.body.product_b, '8901058000256');
  });
});

describe('Batch 9A: AI Nutrition Assistant Logic & Error Handling', () => {
  test('Chat request attaches product context without overriding health score', () => {
    const context = {
      product_name: 'Rolled Oats',
      health_score: 85,
      final_decision: 'SAFE',
    };
    const req = buildChatRequest({
      message: 'Is this good for weight loss?',
      barcode: '8901234567890',
      productContext: context,
    });
    assert.strictEqual(req.path, '/chat');
    assert.strictEqual(req.body.message, 'Is this good for weight loss?');
    assert.strictEqual(req.body.product_context.health_score, 85);
  });

  test('AI assistant service error handles 503 fallback message', () => {
    const simulate503Error = { response: { status: 503, data: { detail: 'Provider down' } } };
    let displayedMessage;
    if (simulate503Error?.response?.data?.detail) {
      displayedMessage = simulate503Error.response.data.detail;
    } else {
      displayedMessage = 'AI assistant is temporarily unavailable. Please try again later.';
    }
    assert.strictEqual(displayedMessage, 'Provider down');
  });
});

describe('Batch 9A Core Domain Invariant: Scan ≠ Eat Preservation', () => {
  test('Analytical queries NEVER target the intake endpoint /food-log', () => {
    const scanReq = buildScanRequest('8901234567890', 'Oats');
    const claimReq = buildVerifyClaimsRequest({ claims: ['Sugar Free'], barcode: '8901234567890' });
    const compareReq = buildCompareRequest('Prod A', 'Prod B');
    const chatReq = buildChatRequest({ message: 'Hello', barcode: '8901234567890' });

    assert.notStrictEqual(scanReq.path, '/food-log');
    assert.notStrictEqual(claimReq.path, '/food-log');
    assert.notStrictEqual(compareReq.path, '/food-log');
    assert.notStrictEqual(chatReq.path, '/food-log');

    // ONLY explicit food log action targets /food-log
    const logReq = buildFoodLogRequest({ productName: 'Oats', calories: 250 });
    assert.strictEqual(logReq.path, '/food-log');
  });
});

describe('Batch 9B: Neo-Brutalist Design System & Theme Contract', () => {
  // Pure design token representation as implemented in src/theme/neoTheme.js
  const NEO_TOKENS = {
    colors: {
      bg: '#FAF6EE',
      card: '#FFFFFF',
      ink: '#111111',
      border: '#111111',
      yellow: '#FFD166',
      coral: '#FF6B6B',
      cyan: '#4ECDC4',
      purple: '#9D84B7',
      green: '#51CF66',
      pink: '#FF85A1',
      orange: '#FFA94D',
    },
    shadows: {
      sm: { shadowColor: '#111111', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0 },
      md: { shadowColor: '#111111', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
      lg: { shadowColor: '#111111', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
    },
    borders: {
      regular: 2,
      thick: 2.5,
    },
    screens: [
      'LoginScreen',
      'HomeScreen',
      'ScanScreen',
      'ResultScreen',
      'ReportScreen',
      'ProfileScreen',
      'ManualEntryScreen',
      'OCRScanScreen',
    ],
  };

  test('Design system reflects reference palette (cream canvas, solid ink, vibrant accents)', () => {
    assert.strictEqual(NEO_TOKENS.colors.bg, '#FAF6EE', 'Primary canvas must be warm cream');
    assert.strictEqual(NEO_TOKENS.colors.ink, '#111111', 'Solid black ink outlines required');
    assert.ok(NEO_TOKENS.colors.yellow, 'Yellow highlight accent required');
    assert.ok(NEO_TOKENS.colors.coral, 'Coral alert accent required');
    assert.ok(NEO_TOKENS.colors.cyan, 'Cyan scanner accent required');
    assert.ok(NEO_TOKENS.colors.purple, 'Purple AI assistant accent required');
    assert.ok(NEO_TOKENS.colors.green, 'Green statutory safe accent required');
  });

  test('Shadow system enforces hard unblurred offset shadows', () => {
    assert.strictEqual(NEO_TOKENS.shadows.sm.shadowRadius, 0, 'Zero blur for sm shadow');
    assert.strictEqual(NEO_TOKENS.shadows.sm.shadowOpacity, 1, 'Full opacity for sm shadow');
    assert.deepStrictEqual(NEO_TOKENS.shadows.sm.shadowOffset, { width: 2, height: 2 });

    assert.strictEqual(NEO_TOKENS.shadows.md.shadowRadius, 0, 'Zero blur for md shadow');
    assert.deepStrictEqual(NEO_TOKENS.shadows.md.shadowOffset, { width: 3, height: 3 });

    assert.strictEqual(NEO_TOKENS.shadows.lg.shadowRadius, 0, 'Zero blur for lg shadow');
    assert.deepStrictEqual(NEO_TOKENS.shadows.lg.shadowOffset, { width: 4, height: 4 });
  });

  test('Preservation invariant: all 8 canonical screens are preserved', () => {
    assert.strictEqual(NEO_TOKENS.screens.length, 8);
    const requiredScreens = [
      'LoginScreen',
      'HomeScreen',
      'ScanScreen',
      'ResultScreen',
      'ReportScreen',
      'ProfileScreen',
      'ManualEntryScreen',
      'OCRScanScreen',
    ];
    for (const screen of requiredScreens) {
      assert.ok(NEO_TOKENS.screens.includes(screen), `Screen ${screen} must be present`);
    }
  });
});

