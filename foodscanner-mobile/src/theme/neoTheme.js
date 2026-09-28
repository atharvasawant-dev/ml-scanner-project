/**
 * PRAMAAN Neo-Brutalist Design Tokens
 * Source of Truth: Neo Brutalism UI Component Library
 * 
 * Visual characteristics:
 * - Warm cream canvas
 * - Chunky 2-2.5px solid black outlines
 * - Hard offset black shadows (zero blur)
 * - Saturated, high-contrast retro accents (coral, yellow, cyan, purple, pink, orange, mint)
 * - Tactile pressed button states
 * - Sticker-like badges and pills
 */

export const NEO_COLORS = {
  // Canvas & Structure - Warm Cream + Black
  bg: '#FAF6EE',         // Warm cream primary canvas (MUST STAY)
  bgAlt: '#F2ECE1',      // Supporting warm cream for nested areas / input backgrounds
  card: '#FFFFFF',       // Pure white card body
  ink: '#111111',        // Pure dark ink for text and borders
  border: '#111111',     // Standard solid black border (2-3px)
  white: '#FFFFFF',
  muted: '#6B665E',      // Neutral dark-gray for secondary text
  mutedLight: '#DDD7CC', // Subtle divider border

  // Primary Brand Color
  lime: '#B7FF00',       // Acid Lime: Primary CTA, active navigation, brand accent
  primary: '#B7FF00',

  // Secondary Functional Accents
  electricBlue: '#19A7FF', // Electric Blue: Barcode scanner, technical data
  blue: '#19A7FF',
  cyan: '#19A7FF',         // Alias for scanner/data compatibility

  // AI Assistant Accent
  violet: '#8B5CF6',     // Violet: AI Nutrition Assistant, RAG UI
  purple: '#8B5CF6',
  purpleLight: '#EDE9FE', // Soft violet tint
  ai: '#8B5CF6',

  // Semantic Colors
  green: '#20C997',      // SAFE / SUCCESS / positive health status
  greenLight: '#D3F9ED',
  yellow: '#FFB000',     // MODERATE / WARNING
  amber: '#FFB000',
  coral: '#FF4D4D',      // AVOID / DANGER
  red: '#FF4D4D',

  // Decorative accents (sparingly used)
  pink: '#F472B6',
  pinkLight: '#FCE7F3',
  orange: '#FB923C',

  // Status mapping
  status: {
    safe: '#20C997',
    safeBg: '#D3F9ED',
    moderate: '#FFB000',
    moderateBg: '#FFF3D6',
    avoid: '#FF4D4D',
    avoidBg: '#FFEBEB',
    neutral: '#E8E4DA',
  },
};

export const NEO_SHADOWS = {
  // Hard offset black shadows (No blur)
  sm: {
    shadowColor: '#111111',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  md: {
    shadowColor: '#111111',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  lg: {
    shadowColor: '#111111',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};

export const NEO_BORDERS = {
  thin: 1.5,
  regular: 2,
  thick: 2.5,
  extraThick: 3,
};

export const NEO_RADIUS = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
};

export const NEO_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const NEO_TYPOGRAPHY = {
  hero: {
    fontSize: 32,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 24,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 18,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  h3: {
    fontSize: 15,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  body: {
    fontSize: 14,
    fontWeight: '600',
    color: NEO_COLORS.ink,
    lineHeight: 20,
  },
  bodyBold: {
    fontSize: 14,
    fontWeight: '800',
    color: NEO_COLORS.ink,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '700',
    color: NEO_COLORS.muted,
  },
  badge: {
    fontSize: 11,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
};

export default {
  colors: NEO_COLORS,
  shadows: NEO_SHADOWS,
  borders: NEO_BORDERS,
  radius: NEO_RADIUS,
  spacing: NEO_SPACING,
  typography: NEO_TYPOGRAPHY,
};
