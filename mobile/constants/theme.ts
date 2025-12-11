/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    // Basic colors
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,

    // UI element colors
    cardBackground: '#f9f9f9',
    cardBorder: '#ddd',

    // Input colors
    inputBackground: '#f8f9fa',
    inputBorder: '#dee2e6',
    inputPlaceholder: '#6c757d',

    // Button colors
    buttonPrimary: '#007AFF',
    buttonSecondary: '#28a745',
    buttonDanger: '#dc3545',
    buttonWarning: '#ffc107',
    buttonDisabled: '#ccc',

    // Text variants
    textSecondary: '#555',
    textMuted: '#6c757d',
    textLight: '#777',

    // Border colors
    border: '#dee2e6',
    borderLight: '#e9ecef',

    // Status colors
    success: '#28a745',
    successLight: '#e7f5e7',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#007AFF',

    // Modal/Overlay
    modalOverlay: 'rgba(0, 0, 0, 0.5)',

    // Calendar specific
    calendarDot: '#007AFF',
    calendarSelected: '#007AFF',

    // Score colors
    scoreExcellent: '#28a745',
    scoreGood: '#ffc107',
    scoreFair: '#fd7e14',
    scorePoor: '#dc3545',
  },
  dark: {
    // Basic colors
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,

    // UI element colors
    cardBackground: '#1E1E1E',
    cardBorder: '#2C2C2C',

    // Input colors
    inputBackground: '#2C2C2C',
    inputBorder: '#3C3C3C',
    inputPlaceholder: '#8E8E93',

    // Button colors
    buttonPrimary: '#0A84FF',
    buttonSecondary: '#32D74B',
    buttonDanger: '#FF453A',
    buttonWarning: '#FFD60A',
    buttonDisabled: '#3C3C3C',

    // Text variants
    textSecondary: '#AEAEB2',
    textMuted: '#8E8E93',
    textLight: '#636366',

    // Border colors
    border: '#3C3C3C',
    borderLight: '#2C2C2C',

    // Status colors
    success: '#32D74B',
    successLight: '#1E3A1E',
    error: '#FF453A',
    warning: '#FFD60A',
    info: '#0A84FF',

    // Modal/Overlay
    modalOverlay: 'rgba(0, 0, 0, 0.75)',

    // Calendar specific
    calendarDot: '#0A84FF',
    calendarSelected: '#0A84FF',

    // Score colors
    scoreExcellent: '#32D74B',
    scoreGood: '#FFD60A',
    scoreFair: '#FF9F0A',
    scorePoor: '#FF453A',
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
