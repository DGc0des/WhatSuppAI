/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0F4B2E';
const tintColorDark = '#7D8B6A';

export const Colors = {
  light: {
    // Basic colors
    text: '#1F241F',
    background: '#F6F2E8',
    tint: tintColorLight,
    icon: '#6F776B',
    tabIconDefault: '#91988E',
    tabIconSelected: tintColorLight,

    // UI element colors
    cardBackground: '#FBF8F0',
    cardBorder: '#E4DDCF',

    // Input colors
    inputBackground: '#F1EBDD',
    inputBorder: '#E4DDCF',
    inputPlaceholder: '#91988E',

    // Button colors
    buttonPrimary: '#0F4B2E',
    buttonSecondary: '#9B8A67',
    buttonDanger: '#B5635A',
    buttonWarning: '#B5A048',
    buttonDisabled: '#CFC7B9',

    // Text variants
    textSecondary: '#6F776B',
    textMuted: '#91988E',
    textLight: '#A7ADA4',

    // Border colors
    border: '#E4DDCF',
    borderLight: '#F1EBDD',

    // Status colors
    success: '#0F4B2E',
    successLight: '#E4EFE6',
    error: '#B5635A',
    warning: '#B5A048',
    info: '#0F4B2E',

    // Modal/Overlay
    modalOverlay: 'rgba(0, 0, 0, 0.5)',

    // Calendar specific
    calendarDot: '#0F4B2E',
    calendarSelected: '#0F4B2E',

    // Score colors
    scoreExcellent: '#0F4B2E',
    scoreGood: '#B5A048',
    scoreFair: '#C4883A',
    scorePoor: '#B5635A',
  },
  dark: {
    // Basic colors
    text: '#F0EDE6',
    background: '#1A1915',
    tint: tintColorDark,
    icon: '#A8A49C',
    tabIconDefault: '#706C65',
    tabIconSelected: tintColorDark,

    // UI element colors
    cardBackground: '#252320',
    cardBorder: '#3A3632',

    // Input colors
    inputBackground: '#2D2A26',
    inputBorder: '#3A3632',
    inputPlaceholder: '#706C65',

    // Button colors
    buttonPrimary: '#7D8B6A',
    buttonSecondary: '#A68B6A',
    buttonDanger: '#B5635A',
    buttonWarning: '#B5A048',
    buttonDisabled: '#3A3632',

    // Text variants
    textSecondary: '#A8A49C',
    textMuted: '#706C65',
    textLight: '#5B5650',

    // Border colors
    border: '#3A3632',
    borderLight: '#2F2C28',

    // Status colors
    success: '#7D8B6A',
    successLight: '#2D3328',
    error: '#B5635A',
    warning: '#B5A048',
    info: '#7D8B6A',

    // Modal/Overlay
    modalOverlay: 'rgba(0, 0, 0, 0.75)',

    // Calendar specific
    calendarDot: '#7D8B6A',
    calendarSelected: '#7D8B6A',

    // Score colors
    scoreExcellent: '#7D8B6A',
    scoreGood: '#B5A048',
    scoreFair: '#C4883A',
    scorePoor: '#B5635A',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
