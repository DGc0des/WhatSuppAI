import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase-client';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const styles = createStyles(theme);

  useEffect(() => {
    let isMounted = true;

    const initFromResetLink = async () => {
      try {
        console.log('[Reset Password] Screen mounted, checking for deep link...');

        // Get the initial URL that opened the app
        const url = await Linking.getInitialURL();
        console.log('[Reset Password] Initial URL:', url);

        if (!url) {
          // No URL means user navigated here directly without a reset link
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            Alert.alert('Error', 'Please use the password reset link from your email');
            router.replace('/auth');
            return;
          }
          setSessionReady(true);
          return;
        }

        // Parse URL for parameters (handles both query params and hash fragments)
        const parsedUrl = Linking.parse(url);
        console.log('[Reset Password] Parsed URL:', JSON.stringify(parsedUrl, null, 2));

        // Also check hash fragment which Supabase often uses
        let params: any = { ...parsedUrl.queryParams };
        if (url.includes('#')) {
          const hashPart = url.split('#')[1];
          if (hashPart) {
            const hashParams = new URLSearchParams(hashPart);
            hashParams.forEach((value, key) => {
              params[key] = value;
            });
          }
        }

        console.log('[Reset Password] Final params:', JSON.stringify(params, null, 2));

        // Check for errors
        if (params.error) {
          const msg = params.error_description
            ? decodeURIComponent(params.error_description)
            : 'Invalid or expired password reset link';
          Alert.alert('Error', msg);
          router.replace('/auth');
          return;
        }

        // Handle different auth flows
        if (params.access_token && params.refresh_token) {
          console.log('[Reset Password] Setting session with tokens...');
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });

          if (error) {
            console.error('[Reset Password] Session error:', error);
            Alert.alert('Error', error.message);
            router.replace('/auth');
            return;
          }

          console.log('[Reset Password] Session set successfully');
          if (isMounted) {
            setSessionReady(true);
          }
        } else if (params.code) {
          // PKCE flow
          console.log('[Reset Password] Exchanging code for session...');
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) {
            console.error('[Reset Password] Code exchange error:', error);
            Alert.alert('Error', error.message);
            router.replace('/auth');
            return;
          }
          console.log('[Reset Password] Code exchanged successfully');
          if (isMounted) {
            setSessionReady(true);
          }
        } else {
          // No tokens or code found
          console.log('[Reset Password] No auth tokens found in URL');
          Alert.alert('Error', 'Invalid password reset link. Please request a new one.');
          router.replace('/auth');
        }
      } catch (e: any) {
        console.error('[Reset Password] Initialization error:', e);
        Alert.alert('Error', e?.message ?? 'Something went wrong');
        router.replace('/auth');
      }
    };

    initFromResetLink();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      Alert.alert(
        'Success',
        'Your password has been reset successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your new password</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter new password"
            placeholderTextColor={theme.inputPlaceholder}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor={theme.inputPlaceholder}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/auth')}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: typeof Colors.light) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: theme.text,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: theme.textSecondary,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: theme.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: theme.inputBackground,
    color: theme.text,
  },
  button: {
    backgroundColor: theme.buttonPrimary,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: theme.buttonPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
