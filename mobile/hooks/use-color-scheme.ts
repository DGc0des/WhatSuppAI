import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

type ColorSchemeMode = 'system' | 'light' | 'dark';

type ColorSchemeContextValue = {
  colorScheme: 'light' | 'dark';
  mode: ColorSchemeMode;
  setMode: (mode: ColorSchemeMode) => void;
};

const COLOR_SCHEME_KEY = 'color-scheme-preference';

const ColorSchemeContext = React.createContext<ColorSchemeContextValue | null>(null);

export function ColorSchemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useRNColorScheme() ?? 'light';
  const [mode, setMode] = useState<ColorSchemeMode>('system');
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(COLOR_SCHEME_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setMode(stored);
        }
      } catch {
        // Ignore storage errors and fall back to system.
      } finally {
        setHasLoaded(true);
      }
    };

    loadPreference();
  }, []);

  const setModeAndStore = async (nextMode: ColorSchemeMode) => {
    setMode(nextMode);
    try {
      await AsyncStorage.setItem(COLOR_SCHEME_KEY, nextMode);
    } catch {
      // Ignore storage errors to avoid blocking UI.
    }
  };

  const colorScheme = (mode === 'system' ? systemScheme : mode) as 'light' | 'dark';

  const value = useMemo(
    () => ({
      colorScheme: hasLoaded ? colorScheme : systemScheme,
      mode,
      setMode: setModeAndStore,
    }),
    [colorScheme, mode, systemScheme, hasLoaded]
  );

  return React.createElement(ColorSchemeContext.Provider, { value }, children);
}

export function useColorScheme() {
  const context = useContext(ColorSchemeContext);
  return context?.colorScheme ?? (useRNColorScheme() ?? 'light');
}

export function useColorSchemePreference() {
  const context = useContext(ColorSchemeContext);
  if (!context) {
    return {
      colorScheme: useRNColorScheme() ?? 'light',
      mode: 'system' as ColorSchemeMode,
      setMode: () => {},
    };
  }
  return context;
}
