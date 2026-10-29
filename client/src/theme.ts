import {
  ActionIcon,
  AppShell,
  Badge,
  Button,
  Code,
  Combobox,
  createTheme,
  Menu,
  Modal,
  Notification,
  Popover,
  rem,
  ScrollArea,
  Table,
  Title,
  Tooltip,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';

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

/**
 * Cool neutrals. 0 is the hover tone on white, 1 the sidebar and top bar, 2 neutral badges,
 * 3 hairlines, 6 dimmed text (5.1:1 on 1), 9 body text.
 */
const gray: MantineColorsTuple = [
  '#f6f8fb',
  '#f1f4f9',
  '#e6eaef',
  '#d8dde2',
  '#c3c8ce',
  '#9da2a9',
  '#626871',
  '#4a505a',
  '#30363f',
  '#151a21',
];

/** The near-white page ground behind the conversation, a step lighter than every gray. */
const pageGround = '#fcfcfd';

/**
 * Mantine's own dark ramp, cool like the grays: 0 text, 2 dimmed, 3 placeholder, 4 borders, 5 hover,
 * 6 inputs and raised surfaces, 7 the page, 8 the chrome.
 */
const dark: MantineColorsTuple = [
  '#e9ecf1',
  '#cdd2d9',
  '#939ba8',
  '#8a92a0',
  '#3f4651',
  '#272d36',
  '#1a1e25',
  '#14171d',
  '#0f1217',
  '#0a0c10',
];

/**
 * The gray, ink, amber and red shades are roles, not lightness steps (gray 0 is the hover tone, 1 the
 * chrome, 3 hairlines, 6 dimmed text, 9 body text). In the dark scheme each role gets a dark value, so
 * components that ask for "gray.6" or "red.1" read correctly in both schemes.
 */
const darkRoles = {
  gray: ['#1f242c', '#0f1217', '#272d36', '#2b313a', '#3f4651', '#5f6774', '#939ba8', '#aeb5c0', '#cdd2d9', '#e9ecf1'],
  ink: { 0: '#182136', 1: '#1f2b47', 2: '#2c3e66', 9: '#c9d8f5' },
  yellow: { 0: '#221c0e', 1: '#2e2512', 2: '#4a3a16', 7: '#e3a93a', 8: '#f0c060', 9: '#f2c46b' },
  red: { 0: '#241313', 1: '#3a1818', 2: '#5a2323', 7: '#f0716a', 8: '#f58a83', 9: '#ffaaa4' },
} as const;

/** CSS variables that give each dark role its value. */
function darkRoleVariables(): Record<string, string> {
  const variables: Record<string, string> = {};
  darkRoles.gray.forEach((value, shade) => {
    variables[`--mantine-color-gray-${shade}`] = value;
  });
  for (const color of ['ink', 'yellow', 'red'] as const) {
    for (const [shade, value] of Object.entries(darkRoles[color])) variables[`--mantine-color-${color}-${shade}`] = value;
  }
  return variables;
}

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

/** Where the light or dark choice is kept. index.html reads the same key before the app loads. */
export const COLOR_SCHEME_STORAGE_KEY = 'atlas-color-scheme';

/** Motion for state changes only: short, exponential ease-out. */
export const motion = {
  durationMs: 180,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

/** The Mantine theme: every colour, size, radius and component default in the client comes from here. */
export const theme = createTheme({
  colors: { ink, gray, yellow, red, dark },
  primaryColor: 'ink',
  // Shade 6 on the dark page keeps white button text at 6.3:1 and still reads as the action.
  primaryShade: { light: 7, dark: 6 },
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

  components: {
    // The top bar and sidebar are one continuous chrome field; the conversation sits on it as an inset sheet.
    AppShell: AppShell.extend({
      defaultProps: { transitionDuration: motion.durationMs, transitionTimingFunction: motion.easing, withBorder: false },
      styles: {
        header: { backgroundColor: 'var(--mantine-color-gray-1)' },
        navbar: { backgroundColor: 'var(--mantine-color-gray-1)' },
        main: { backgroundColor: 'var(--mantine-color-gray-1)' },
      },
    }),
    // One badge size: 12px sentence-case label on a 20px chip. Neutral unless a status earns colour.
    Badge: Badge.extend({
      defaultProps: { variant: 'light', color: 'gray', radius: 'sm' },
      vars: () => ({
        root: {
          '--badge-height': rem(20),
          '--badge-fz': 'var(--mantine-font-size-xs)',
          '--badge-padding-x': rem(6),
        },
      }),
      styles: { root: { textTransform: 'none', letterSpacing: 0, fontWeight: 600 } },
    }),
    Button: Button.extend({
      defaultProps: { size: 'sm', loaderProps: { type: 'dots' } },
    }),
    ActionIcon: ActionIcon.extend({
      defaultProps: { variant: 'subtle', color: 'gray', size: 'lg' },
    }),
    Table: Table.extend({
      defaultProps: {
        fz: 'sm',
        verticalSpacing: 'xs',
        horizontalSpacing: 'sm',
        highlightOnHover: true,
        tabularNums: true,
      },
      styles: {
        th: { color: 'var(--mantine-color-dimmed)', fontWeight: 600, whiteSpace: 'nowrap' },
      },
    }),
    Tooltip: Tooltip.extend({
      defaultProps: {
        openDelay: 400,
        multiline: true,
        maw: rem(320),
        fz: 'xs',
        transitionProps: { transition: 'fade', duration: 150 },
      },
      styles: { tooltip: { backgroundColor: 'var(--atlas-tooltip-bg)', color: 'var(--atlas-tooltip-color)' } },
    }),
    // Floating surfaces sit on the raised surface ground, so in the dark scheme they lift off the page.
    Modal: Modal.extend({
      defaultProps: {
        centered: true,
        radius: 'lg',
        shadow: 'lg',
        padding: 'lg',
        transitionProps: { transition: 'pop', duration: motion.durationMs, timingFunction: motion.easing },
      },
      styles: {
        overlay: { backgroundColor: 'var(--atlas-overlay)' },
        content: { backgroundColor: 'var(--atlas-surface)', border: '1px solid var(--atlas-float-edge)' },
        header: { backgroundColor: 'var(--atlas-surface)' },
        title: { fontWeight: 600, fontSize: 'var(--mantine-font-size-lg)' },
      },
    }),
    Menu: Menu.extend({
      defaultProps: { shadow: 'md', radius: 'md' },
      styles: { dropdown: { backgroundColor: 'var(--atlas-surface)' } },
    }),
    Popover: Popover.extend({
      defaultProps: { shadow: 'md', radius: 'md' },
      styles: { dropdown: { backgroundColor: 'var(--atlas-surface)' } },
    }),
    Combobox: Combobox.extend({
      defaultProps: { shadow: 'md', radius: 'md' },
      styles: { dropdown: { backgroundColor: 'var(--atlas-surface)' } },
    }),
    Notification: Notification.extend({ defaultProps: { radius: 'md', withBorder: true } }),
    ScrollArea: ScrollArea.extend({ defaultProps: { scrollbarSize: 8, type: 'hover' } }),
    Code: Code.extend({ defaultProps: { color: 'gray.1' } }),
    Title: Title.extend({ styles: { root: { letterSpacing: '-0.01em' } } }),
  },
});

/** Badge and alert tokens that point at role shades, so they follow the scheme with the roles. */
const roleTokens = {
  '--mantine-color-dimmed': 'var(--mantine-color-gray-6)',
  '--mantine-color-default-border': 'var(--mantine-color-gray-4)',
  '--mantine-color-error': 'var(--mantine-color-red-8)',
  // Mantine's dark default paints a disabled control in the raised surface's own colour, so it vanishes.
  '--mantine-color-disabled': 'var(--mantine-color-gray-2)',
  '--mantine-color-disabled-color': 'var(--mantine-color-gray-5)',
  '--mantine-color-disabled-border': 'var(--mantine-color-gray-3)',
  '--mantine-color-gray-light': 'var(--mantine-color-gray-2)',
  '--mantine-color-gray-light-hover': 'var(--mantine-color-gray-3)',
  '--mantine-color-gray-light-color': 'var(--mantine-color-gray-8)',
  '--mantine-color-yellow-light': 'var(--mantine-color-yellow-1)',
  '--mantine-color-yellow-light-hover': 'var(--mantine-color-yellow-2)',
  '--mantine-color-yellow-light-color': 'var(--mantine-color-yellow-9)',
  '--mantine-color-red-light': 'var(--mantine-color-red-1)',
  '--mantine-color-red-light-hover': 'var(--mantine-color-red-2)',
  '--mantine-color-red-light-color': 'var(--mantine-color-red-9)',
};

/**
 * Surface tokens on top of Mantine's defaults, per scheme: the page ground, the raised surface that
 * holds content you read (`--atlas-surface`: white in light, a lifted slate in dark), readable dimmed
 * and placeholder text (at least 4.5:1), the focus ring, tooltips, and the role shades above.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    ...roleTokens,
    '--mantine-color-body': pageGround,
    '--mantine-color-placeholder': 'var(--mantine-color-gray-6)',
    '--atlas-surface': '#ffffff',
    '--atlas-overlay': shadowTint(0.32),
    '--atlas-float-edge': 'transparent',
    '--atlas-focus': 'var(--mantine-color-ink-7)',
    '--atlas-tooltip-bg': 'var(--mantine-color-gray-9)',
    '--atlas-tooltip-color': '#ffffff',
  },
  dark: {
    ...darkRoleVariables(),
    ...roleTokens,
    '--mantine-color-body': dark[7],
    '--mantine-color-text': dark[0],
    '--mantine-color-bright': '#f4f6f9',
    '--mantine-color-placeholder': dark[3],
    '--mantine-color-anchor': 'var(--mantine-color-ink-4)',
    '--atlas-surface': dark[6],
    // A shadow does not read on a near-black page, so floating surfaces also take a hairline edge.
    '--atlas-overlay': 'rgba(5, 6, 9, 0.62)',
    '--atlas-float-edge': dark[4],
    '--atlas-focus': 'var(--mantine-color-ink-4)',
    '--atlas-tooltip-bg': dark[0],
    '--atlas-tooltip-color': dark[7],
  },
});
