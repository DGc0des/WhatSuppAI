import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';

import { ColorSchemeProvider, useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/supabase-client';
import { snoozeNotification } from '@/lib/notificationService';
import { markSupplementAsTaken } from '@/lib/scheduleStorage';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <ColorSchemeProvider>
      <RootLayoutContent />
    </ColorSchemeProvider>
  );
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    // Handle notification responses (when user taps Taken or Snooze)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async response => {
      const { actionIdentifier, notification } = response;
      const data = notification.request.content.data as any;

      console.log('[Notifications] User action:', actionIdentifier);
      console.log('[Notifications] Notification data:', data);

      if (actionIdentifier === 'taken') {
        // User marked supplement as taken
        console.log('[Notifications] ✅ Marked as taken:', data.supplementName);

        // Mark in database if scheduleId is provided
        if (data.scheduleId) {
          const success = await markSupplementAsTaken(data.scheduleId);
          if (success) {
            console.log('[Notifications] ✅ Database updated - marked as taken');
          }
        }
      } else if (actionIdentifier === 'snooze') {
        // User wants to snooze
        console.log('[Notifications] ⏰ Snoozing:', data.supplementName);
        snoozeNotification(
          data.supplementName as string,
          data.supplementBrand as string | undefined,
          data.dosage as string | null
        );
      }
    });

    return () => {
      subscription.unsubscribe();
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Deep links are automatically handled by Expo Router
  // The reset-password.tsx screen will receive URL parameters via useLocalSearchParams

  useEffect(() => {
    if (isAuthenticated === null) return; // Still loading

    const inAuthGroup = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to auth if not authenticated
      router.replace('/auth');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to tabs if authenticated
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
