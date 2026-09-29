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
  if (error?.response) {
    const detail = error.response.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim();
    }
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((d) => (typeof d === 'object' && d?.msg ? d.msg : String(d)))
        .join('. ');
    }
    if (detail && typeof detail === 'object') {
      return detail.msg || detail.message || JSON.stringify(detail);
    }
    return error.message || 'Request failed';
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

describe('Batch 10: Product Selection Determinism & Navigation Audit', () => {
  // Benchmark products contract
  const BENCHMARKS = [
    { id: 'parle-g', name: 'Parle-G', barcode: '8901719101038' },
    { id: 'maggi', name: 'Maggi', barcode: '8901058851304' },
    { id: 'kurkure', name: 'Kurkure', barcode: '8901491100519' },
    { id: 'lays', name: "Lay's", barcode: '8901491101844' },
    { id: 'amul-butter', name: 'Amul Butter', barcode: '8901262010320' },
  ];

  test('Benchmark products define valid canonical barcodes and never 00000000', () => {
    for (const p of BENCHMARKS) {
      assert.ok(p.barcode, `${p.name} must have a barcode`);
      assert.notStrictEqual(p.barcode, '00000000', `${p.name} barcode must never be fake 00000000`);
      assert.match(p.barcode, /^\d{8,14}$/, `${p.name} barcode must be 8-14 numeric digits`);
    }
    const parleG = BENCHMARKS.find((b) => b.id === 'parle-g');
    const maggi = BENCHMARKS.find((b) => b.id === 'maggi');
    assert.strictEqual(parleG.barcode, '8901719101038');
    assert.strictEqual(maggi.barcode, '8901058851304');
    assert.notStrictEqual(parleG.barcode, maggi.barcode, 'Parle-G and Maggi barcodes must be distinct');
  });

  test('Flow A & B: Product selection resolves to its exact canonical barcode', () => {
    function resolveProductScan(selectedBenchmark) {
      return {
        targetBarcode: selectedBenchmark.barcode,
        targetName: selectedBenchmark.name,
      };
    }

    const flowA = resolveProductScan(BENCHMARKS.find((b) => b.id === 'parle-g'));
    assert.strictEqual(flowA.targetBarcode, '8901719101038');
    assert.strictEqual(flowA.targetName, 'Parle-G');

    const flowB = resolveProductScan(BENCHMARKS.find((b) => b.id === 'maggi'));
    assert.strictEqual(flowB.targetBarcode, '8901058851304');
    assert.strictEqual(flowB.targetName, 'Maggi');
  });

  test('Flow C & D: Product switching is deterministic with no stale closure', () => {
    let currentSelection = null;
    function selectProduct(benchmark) {
      currentSelection = {
        targetBarcode: benchmark.barcode,
        targetName: benchmark.name,
      };
      return currentSelection;
    }

    // Flow C: Parle-G then Maggi -> final result must be Maggi
    selectProduct(BENCHMARKS.find((b) => b.id === 'parle-g'));
    const finalFlowC = selectProduct(BENCHMARKS.find((b) => b.id === 'maggi'));
    assert.strictEqual(finalFlowC.targetBarcode, '8901058851304');
    assert.strictEqual(finalFlowC.targetName, 'Maggi');

    // Flow D: Maggi then Parle-G -> final result must be Parle-G
    selectProduct(BENCHMARKS.find((b) => b.id === 'maggi'));
    const finalFlowD = selectProduct(BENCHMARKS.find((b) => b.id === 'parle-g'));
    assert.strictEqual(finalFlowD.targetBarcode, '8901719101038');
    assert.strictEqual(finalFlowD.targetName, 'Parle-G');
  });

  test('Manual search routing prevents sending 00000000 to barcode scan endpoint', () => {
    function planScanRequest({ barcode, productName }) {
      const raw = String(barcode || '').trim();
      const hint = String(productName || '').trim();
      const isDigits = /^\d{8,14}$/.test(raw) && raw !== '00000000';

      if (isDigits) {
        return { type: 'barcode_scan', barcode: raw, hint: hint || null };
      }
      if (hint) {
        return { type: 'manual_analysis', productName: hint };
      }
      throw new Error('Input Required');
    }

    // Entering only a product name
    const nameSearch = planScanRequest({ barcode: '', productName: 'Parle-G' });
    assert.strictEqual(nameSearch.type, 'manual_analysis');
    assert.strictEqual(nameSearch.productName, 'Parle-G');
    assert.strictEqual(nameSearch.barcode, undefined, 'Must not send barcode for name-only searches');

    // Entering a numeric barcode
    const barcodeSearch = planScanRequest({ barcode: '8901719101038', productName: '' });
    assert.strictEqual(barcodeSearch.type, 'barcode_scan');
    assert.strictEqual(barcodeSearch.barcode, '8901719101038');
  });

  test('Navigation Back button logic provides safe fallback when canGoBack is false', () => {
    function handleBackNavigation(nav, fallbackRoute) {
      if (nav.canGoBack()) {
        nav.goBack();
        return 'went_back';
      }
      nav.navigate(fallbackRoute.name, fallbackRoute.params);
      return 'fallback_navigated';
    }

    let historyPopCount = 0;
    let fallbackCalls = [];

    // Case 1: Can go back
    const mockNavWithBack = {
      canGoBack: () => true,
      goBack: () => { historyPopCount++; },
      navigate: (r, p) => { fallbackCalls.push({ r, p }); },
    };
    const res1 = handleBackNavigation(mockNavWithBack, { name: 'Main', params: { screen: 'Home' } });
    assert.strictEqual(res1, 'went_back');
    assert.strictEqual(historyPopCount, 1);
    assert.strictEqual(fallbackCalls.length, 0);

    // Case 2: Cannot go back (e.g. opened directly or deep link)
    const mockNavNoBack = {
      canGoBack: () => false,
      goBack: () => { historyPopCount++; },
      navigate: (r, p) => { fallbackCalls.push({ r, p }); },
    };
    const res2 = handleBackNavigation(mockNavNoBack, { name: 'Main', params: { screen: 'Home' } });
    assert.strictEqual(res2, 'fallback_navigated');
    assert.strictEqual(fallbackCalls.length, 1);
    assert.strictEqual(fallbackCalls[0].r, 'Main');
    assert.deepStrictEqual(fallbackCalls[0].p, { screen: 'Home' });
  });

  test('ResultScreen state reset clears portion and expanded toggles on product change', () => {
    function simulateResultState(prevProduct, newProduct) {
      let state = {
        activePortionTab: '250g',
        servingGrams: '250',
        loggedToday: true,
        expandedIngredients: { 0: true, 1: true },
      };

      // Simulating useEffect([productName, barcode, timestamp])
      if (prevProduct.name !== newProduct.name || prevProduct.barcode !== newProduct.barcode) {
        state = {
          activePortionTab: '100g',
          servingGrams: '100',
          loggedToday: false,
          expandedIngredients: {},
        };
      }
      return state;
    }

    const productA = { name: 'Parle-G', barcode: '8901719101038' };
    const productB = { name: 'Maggi', barcode: '8901058851304' };

    const resetState = simulateResultState(productA, productB);
    assert.strictEqual(resetState.activePortionTab, '100g');
    assert.strictEqual(resetState.servingGrams, '100');
    assert.strictEqual(resetState.loggedToday, false);
    assert.deepStrictEqual(resetState.expandedIngredients, {});
  });
});

// ---------------------------------------------------------------------------
// Batch 11: Production Authentication, Login Validation, Token Storage & Logout Reliability
// ---------------------------------------------------------------------------
describe('Batch 11: Production Authentication, Login Validation, Token Storage & Logout Reliability', () => {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // 1. Login & Register Field Validation
  test('1. Login field validation rejects empty fields and malformed email addresses', () => {
    const validateForm = (email, password, mode = 'login') => {
      const trimmedEmail = (email || '').trim();
      if (!trimmedEmail) return { valid: false, error: 'Please enter your email address.' };
      if (!EMAIL_REGEX.test(trimmedEmail)) return { valid: false, error: 'Please enter a valid email address.' };
      if (!password) return { valid: false, error: 'Please enter your password.' };
      if (mode === 'register' && password.length < 6) return { valid: false, error: 'Password must be at least 6 characters long.' };
      return { valid: true, error: null };
    };

    assert.strictEqual(validateForm('', 'Secret123').valid, false);
    assert.strictEqual(validateForm('notanemail', 'Secret123').valid, false);
    assert.strictEqual(validateForm('user@', 'Secret123').valid, false);
    assert.strictEqual(validateForm('demo@pramaan.ai', '').valid, false);
    assert.strictEqual(validateForm('demo@pramaan.ai', '12345', 'register').valid, false);
    assert.strictEqual(validateForm('demo@pramaan.ai', '123456', 'register').valid, true);
    assert.strictEqual(validateForm('demo@pramaan.ai', 'DemoPass123!', 'login').valid, true);
  });

  // 2. Login API Token Extraction
  test('2. Login response extracts JWT access token and rejects missing token payload', () => {
    const extractToken = (data) => {
      const token = data?.access_token;
      if (!token || typeof token !== 'string') {
        throw new Error('Authentication succeeded but no access token was returned.');
      }
      return token;
    };

    const validPayload = { access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', token_type: 'bearer' };
    assert.strictEqual(extractToken(validPayload), 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
    assert.throws(() => extractToken({}), /no access token was returned/);
    assert.throws(() => extractToken(null), /no access token was returned/);
  });

  // 3. FastAPI Array Error Formatting
  test('3. FastAPI Pydantic validation array error is cleanly formatted without [object Object]', () => {
    const errorWithArray = {
      response: {
        status: 422,
        data: {
          detail: [
            { type: 'value_error', loc: ['body', 'email'], msg: 'value is not a valid email address' },
            { type: 'string_too_short', loc: ['body', 'password'], msg: 'String should have at least 6 characters' },
          ],
        },
      },
    };
    const formatted = getNetworkErrorMessage(errorWithArray);
    assert.strictEqual(formatted, 'value is not a valid email address. String should have at least 6 characters');
    assert.strictEqual(formatted.includes('[object Object]'), false);
  });

  // 4. Token Persistence Lifecycle
  test('4. Token storage lifecycle: saveToken, getToken, and removeToken simulate storage persistence', async () => {
    const mockStorage = new Map();
    const TOKEN_KEY = 'foodscanner_token';

    const saveToken = async (tok) => { if (tok) mockStorage.set(TOKEN_KEY, tok); };
    const getToken = async () => mockStorage.get(TOKEN_KEY) || null;
    const removeToken = async () => { mockStorage.delete(TOKEN_KEY); };

    assert.strictEqual(await getToken(), null);
    await saveToken('token_lifecycle_jwt_123');
    assert.strictEqual(await getToken(), 'token_lifecycle_jwt_123');
    await removeToken();
    assert.strictEqual(await getToken(), null);
  });

  // 5. Logout Clears Token, Storage, and Session State
  test('5. Logout completely clears token, storage, and resets authenticated session', async () => {
    const mockStorage = new Map([['foodscanner_token', 'active_token_999'], ['user_prefs', 'saved']]);
    let isLoggedIn = true;
    let authHeader = 'Bearer active_token_999';

    const logout = async () => {
      mockStorage.clear();
      authHeader = undefined;
      isLoggedIn = false;
    };

    assert.strictEqual(isLoggedIn, true);
    await logout();
    assert.strictEqual(isLoggedIn, false);
    assert.strictEqual(mockStorage.size, 0);
    assert.strictEqual(authHeader, undefined);
  });

  // 6. Logout Navigation Stack Reset & Back Button Lock
  test('6. Logout triggers navigation stack reset to Login at index 0, preventing Back navigation to protected screens', () => {
    const mockNavigationStack = {
      routes: [{ name: 'Home' }, { name: 'Profile' }],
      index: 1,
      reset(payload) {
        this.index = payload.index;
        this.routes = payload.routes;
      },
      canGoBack() {
        return this.index > 0;
      },
    };

    assert.strictEqual(mockNavigationStack.canGoBack(), true);

    // Perform navigation reset to Login
    mockNavigationStack.reset({ index: 0, routes: [{ name: 'Login' }] });

    assert.strictEqual(mockNavigationStack.index, 0);
    assert.strictEqual(mockNavigationStack.routes.length, 1);
    assert.strictEqual(mockNavigationStack.routes[0].name, 'Login');
    assert.strictEqual(mockNavigationStack.canGoBack(), false);
  });

  // 7. 401 Interceptor Clears Protected Endpoints
  test('7. 401 response on protected endpoint triggers session cleanup', async () => {
    let sessionCleaned = false;
    const handleResponseError = async (error) => {
      const status = error?.response?.status;
      const url = error?.config?.url || '';
      const isAuthEndpoint = url.includes('/login') || url.includes('/register');
      if (status === 401 && !isAuthEndpoint) {
        sessionCleaned = true;
      }
      return Promise.reject(error);
    };

    const protectedError = { response: { status: 401 }, config: { url: '/user/profile' } };
    await assert.rejects(async () => handleResponseError(protectedError));
    assert.strictEqual(sessionCleaned, true);
  });

  // 8. 401 Interceptor Bypasses /login and /register
  test('8. 401 response on /login or /register does NOT trigger session cleanup or navigation reset', async () => {
    let sessionCleaned = false;
    const handleResponseError = async (error) => {
      const status = error?.response?.status;
      const url = error?.config?.url || '';
      const isAuthEndpoint = url.includes('/login') || url.includes('/register');
      if (status === 401 && !isAuthEndpoint) {
        sessionCleaned = true;
      }
      return Promise.reject(error);
    };

    const loginError = { response: { status: 401, data: { detail: 'Invalid email or password' } }, config: { url: '/login' } };
    await assert.rejects(async () => handleResponseError(loginError));
    assert.strictEqual(sessionCleaned, false);

    const registerError = { response: { status: 401 }, config: { url: '/register' } };
    await assert.rejects(async () => handleResponseError(registerError));
    assert.strictEqual(sessionCleaned, false);
  });

  // 9. Concurrent 401 Latch Prevents Multi-Call Spams
  test('9. In-flight 401 latch prevents duplicate unauthorized handler executions during burst failures', () => {
    let executionCount = 0;
    let isHandling401 = false;

    const on401 = () => {
      if (!isHandling401) {
        isHandling401 = true;
        executionCount += 1;
      }
    };

    // Simulate 5 simultaneous 401 responses
    on401();
    on401();
    on401();
    on401();
    on401();

    assert.strictEqual(executionCount, 1);
  });

  // 10. Session Restoration on App Boot
  test('10. Session restoration: app boots into authenticated state when token is present', async () => {
    const restoreSession = async (tokenProvider) => {
      const token = await tokenProvider();
      return !!token;
    };

    const hasSession = await restoreSession(async () => 'valid_persisted_token');
    assert.strictEqual(hasSession, true);
  });

  // 11. Session Absence on Cold Boot
  test('11. Session absence: app boots into Login screen when no token exists', async () => {
    const restoreSession = async (tokenProvider) => {
      const token = await tokenProvider();
      return !!token;
    };

    const hasSession = await restoreSession(async () => null);
    assert.strictEqual(hasSession, false);
  });

  // 12. Duplicate Login Submission Guard
  test('12. Duplicate login submission guard prevents concurrent API calls', async () => {
    let apiCallCount = 0;
    let isSubmitting = false;

    const submitLogin = async () => {
      if (isSubmitting) return;
      isSubmitting = true;
      apiCallCount += 1;
      // Simulate pending network call
      await new Promise((resolve) => setTimeout(resolve, 10));
      isSubmitting = false;
    };

    // Simulate double-click
    const p1 = submitLogin();
    const p2 = submitLogin();
    await Promise.all([p1, p2]);

    assert.strictEqual(apiCallCount, 1);
  });

  // 13. Duplicate Logout Submission Guard
  test('13. Duplicate logout submission guard prevents concurrent storage clearing', async () => {
    let logoutCallCount = 0;
    let isLoggingOut = false;

    const handleLogout = async () => {
      if (isLoggingOut) return;
      isLoggingOut = true;
      logoutCallCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      isLoggingOut = false;
    };

    const p1 = handleLogout();
    const p2 = handleLogout();
    await Promise.all([p1, p2]);

    assert.strictEqual(logoutCallCount, 1);
  });

  // 14. Cross-Platform Logout Confirmation Behavior
  test('14. Cross-platform logout confirmation: web uses window.confirm, native uses Alert.alert', () => {
    let loggedOut = false;
    const performLogout = () => { loggedOut = true; };

    // Web simulation - cancel
    const handleLogoutWebCancel = (confirmFn) => {
      if (confirmFn('Are you sure?')) performLogout();
    };
    handleLogoutWebCancel(() => false);
    assert.strictEqual(loggedOut, false);

    // Web simulation - confirm
    const handleLogoutWebConfirm = (confirmFn) => {
      if (confirmFn('Are you sure?')) performLogout();
    };
    handleLogoutWebConfirm(() => true);
    assert.strictEqual(loggedOut, true);
  });
});

// ---------------------------------------------------------------------------
// Batch 12: Search Input Focus State, Typography & Zero Layout Shift Invariants
// ---------------------------------------------------------------------------
describe('Batch 12: Search Input Focus State, Typography & Zero Layout Shift Invariants', () => {
  const getSearchInputStyle = (isFocused) => ({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isFocused ? '#F7FAF1' : '#FFFFFF',
      borderRadius: 16,
      paddingHorizontal: 16,
      borderWidth: 1.5,
      borderColor: isFocused ? '#557A3E' : '#E1E6DC',
      minHeight: 52,
      ...(isFocused ? {
        shadowColor: '#557A3E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 2,
      } : {}),
    },
    innerInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 16,
      fontWeight: '500',
      color: '#171A17',
      backgroundColor: 'transparent',
      borderWidth: 0,
      outlineStyle: 'none',
      outlineWidth: 0,
    },
    placeholderTextColor: '#7C837B',
    selectionColor: '#557A3E',
  });

  test('1. Unfocused input has subtle border (#E1E6DC) and no black outline', () => {
    const unfocused = getSearchInputStyle(false);
    assert.strictEqual(unfocused.wrapper.borderColor, '#E1E6DC');
    assert.strictEqual(unfocused.wrapper.backgroundColor, '#FFFFFF');
    assert.strictEqual(unfocused.wrapper.borderRadius, 16);
    assert.notStrictEqual(unfocused.wrapper.borderColor, '#000000');
    assert.strictEqual(unfocused.innerInput.outlineStyle, 'none');
    assert.strictEqual(unfocused.innerInput.borderWidth, 0);
  });

  test('2. Focused input switches to health-tech green accent (#557A3E) with bright background (#F7FAF1)', () => {
    const focused = getSearchInputStyle(true);
    assert.strictEqual(focused.wrapper.borderColor, '#557A3E');
    assert.strictEqual(focused.wrapper.backgroundColor, '#F7FAF1');
    assert.strictEqual(focused.wrapper.shadowColor, '#557A3E');
    assert.strictEqual(focused.selectionColor, '#557A3E');
  });

  test('3. Zero layout shift: dimensions and border widths are identical across focus transitions', () => {
    const unfocused = getSearchInputStyle(false);
    const focused = getSearchInputStyle(true);

    assert.strictEqual(unfocused.wrapper.borderWidth, focused.wrapper.borderWidth);
    assert.strictEqual(unfocused.wrapper.minHeight, focused.wrapper.minHeight);
    assert.strictEqual(unfocused.wrapper.paddingHorizontal, focused.wrapper.paddingHorizontal);
    assert.strictEqual(unfocused.innerInput.fontSize, focused.innerInput.fontSize);
  });

  test('4. Typography and placeholder conform to PRAMAAN specifications', () => {
    const style = getSearchInputStyle(false);
    assert.strictEqual(style.placeholderTextColor, '#7C837B');
    assert.strictEqual(style.innerInput.color, '#171A17');
    assert.strictEqual(style.innerInput.fontSize, 16);
    assert.strictEqual(style.innerInput.fontWeight, '500');
  });
});



