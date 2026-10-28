import { createTheme, rem, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core';

/** Deep ink blue, the only brand hue. Shade 7 is the primary; OKLCH ramp at hue 260 to 265. */
const ink: MantineColorsTuple = [
  '#f1f6fe',
  '#e0eafb',
  '#c2d5f6',
  '#9cb8eb',
  '#7698d9',
  '#5478c1',
  '#3b5da7',
  '#2a488b',
  '#213870',
  '#172953',
];

/** Cool neutrals. 0 is the page ground, 1 the sidebar and top bar, 6 the dimmed text (4.8:1 on 1). */
const gray: MantineColorsTuple = [
  '#fbfcfd',
  '#f2f5f9',
  '#e6eaef',
  '#d8dde2',
  '#c3c8ce',
  '#9da2a9',
  '#666c75',
  '#4a505a',
  '#30363f',
  '#151a21',
];

/** Amber for warnings (scanned, too large). Shade 9 on shade 1 reads at 7.7:1. */
const yellow: MantineColorsTuple = [
  '#fff9e2',
  '#fef0c3',
  '#fdde93',
  '#f9c965',
  '#f0b135',
  '#e39a07',
  '#c47d04',
  '#a46311',
  '#854f15',
  '#6e4015',
];

/** Red for errors (corrupt, encrypted). Shade 9 on shade 1 reads at 8.9:1. */
const red: MantineColorsTuple = [
  '#fff3f3',
  '#ffe3e1',
  '#ffc6c3',
  '#fda19b',
  '#f17871',
  '#e1524c',
  '#cc3430',
  '#b32322',
  '#971b1a',
  '#7a1615',
];

const fontFamily = [
  '"Segoe UI"',
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Helvetica Neue"',
  '"Noto Sans"',
  '"Noto Sans Arabic"',
  '"Geeza Pro"',
  'Tahoma',
  'Arial',
  'sans-serif',
  '"Segoe UI Emoji"',
  '"Apple Color Emoji"',
].join(', ');

const fontFamilyMonospace = [
  'ui-monospace',
  '"Cascadia Mono"',
  '"Cascadia Code"',
  'Consolas',
  '"SF Mono"',
  'Menlo',
  '"Liberation Mono"',
  'monospace',
].join(', ');

/** Overlay shadows carry an ink tint, an offset and a soft blur. Surfaces use hairline borders instead. */
const shadowTint = (alpha: number) => `rgba(21, 26, 33, ${alpha})`;

/** Motion for state changes only: short, exponential ease-out. */
export const motion = {
  durationMs: 180,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

/** The Mantine theme: every colour, size, radius and component default in the client comes from here. */
export const theme = createTheme({
  colors: { ink, gray, yellow, red },
  primaryColor: 'ink',
  primaryShade: 7,
  white: '#ffffff',
  black: gray[9],
  autoContrast: true,
  cursorType: 'pointer',
  focusRing: 'auto',
  respectReducedMotion: true,

  fontFamily,
  fontFamilyMonospace,
  fontSizes: {
    xs: rem(12),
    sm: rem(13),
    md: rem(15),
    lg: rem(17),
    xl: rem(20),
  },
  lineHeights: {
    xs: '1.4',
    sm: '1.45',
    md: '1.55',
    lg: '1.5',
    xl: '1.4',
  },
  fontWeights: {
    regular: '400',
    medium: '600',
    bold: '700',
  },
  headings: {
    fontFamily,
    fontWeight: '600',
    textWrap: 'balance',
    sizes: {
      h1: { fontSize: rem(26), lineHeight: '1.25' },
      h2: { fontSize: rem(20), lineHeight: '1.3' },
      h3: { fontSize: rem(17), lineHeight: '1.4' },
      h4: { fontSize: rem(15), lineHeight: '1.45' },
      h5: { fontSize: rem(13), lineHeight: '1.45' },
      h6: { fontSize: rem(12), lineHeight: '1.45' },
    },
  },

  spacing: {
    xs: rem(8),
    sm: rem(12),
    md: rem(16),
    lg: rem(24),
    xl: rem(32),
  },
  // Only 4, 6 and 8 px exist; xs and xl collapse onto them so Mantine's own defaults stay on the scale.
  radius: {
    xs: rem(4),
    sm: rem(4),
    md: rem(6),
    lg: rem(8),
    xl: rem(8),
  },
  defaultRadius: 'md',
  shadows: {
    xs: `0 ${rem(1)} ${rem(2)} ${shadowTint(0.06)}`,
    sm: `0 ${rem(2)} ${rem(6)} ${shadowTint(0.07)}, 0 ${rem(1)} ${rem(2)} ${shadowTint(0.05)}`,
    md: `0 ${rem(6)} ${rem(16)} ${rem(-4)} ${shadowTint(0.14)}, 0 ${rem(2)} ${rem(4)} ${shadowTint(0.05)}`,
    lg: `0 ${rem(12)} ${rem(32)} ${rem(-8)} ${shadowTint(0.2)}, 0 ${rem(4)} ${rem(8)} ${shadowTint(0.06)}`,
    xl: `0 ${rem(24)} ${rem(48)} ${rem(-12)} ${shadowTint(0.24)}, 0 ${rem(6)} ${rem(12)} ${shadowTint(0.06)}`,
  },

  other: { motion },
});

/**
 * Light-scheme surface tokens on top of Mantine's defaults: near-white page ground, readable
 * dimmed and placeholder text (at least 4.5:1), and neutral light badges that stay visible
 * on the cooler sidebar.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': 'var(--mantine-color-gray-0)',
    '--mantine-color-dimmed': 'var(--mantine-color-gray-6)',
    '--mantine-color-placeholder': 'var(--mantine-color-gray-6)',
    '--mantine-color-default-hover': 'var(--mantine-color-gray-1)',
    '--mantine-color-default-border': 'var(--mantine-color-gray-4)',
    '--mantine-color-error': 'var(--mantine-color-red-8)',
    '--mantine-color-gray-light': 'var(--mantine-color-gray-2)',
    '--mantine-color-gray-light-hover': 'var(--mantine-color-gray-3)',
    '--mantine-color-gray-light-color': 'var(--mantine-color-gray-8)',
  },
  dark: {},
});
