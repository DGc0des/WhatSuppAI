import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { supabase } from "../supabase-client";
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function AuthScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const styles = createStyles(theme);

  const handleAuth = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      if (isForgotPassword) {
        // Handle password reset
        if (!email) {
          setError('Please enter your email address');
          return;
        }

        // Send password reset email
        // Note: Supabase doesn't tell us if the user exists for security reasons
        // So we always send the reset request and show a success message
        // Use ExpoLinking.createURL to get the correct URL for both Expo Go and production
        const redirectUrl = ExpoLinking.createURL('reset-password');
        console.log('Password reset redirect URL:', redirectUrl);

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl,
        });

        if (resetError) {
          // Check for specific error messages that indicate user doesn't exist
          if (resetError.message.toLowerCase().includes('user not found') ||
              resetError.message.toLowerCase().includes('not found') ||
              resetError.message.toLowerCase().includes('no user')) {
            setError('There is not an account with the provided email. You can always sign up here');
            return;
          }
          // For any other error, show the error message
          setError(resetError.message);
          return;
        }

        // Success - show generic message (user will only get email if account exists)
        setSuccessMessage('If an account exists with ' + email + ', a password reset link has been sent. Please check your email.');
        setEmail('');
        return;
      }

      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        // Check if email confirmation is required
        if (data.user && !data.session) {
          setSuccessMessage('Please check your email to verify your account. A verification link has been sent to ' + email);
          setEmail('');
          setPassword('');
          return;
        }

        // If session exists, user is automatically signed in (email confirmation disabled)
        // Navigation will happen automatically via _layout.tsx
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        // Sign in successful - navigation will happen automatically via _layout.tsx
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>WhatSuppAI</Text>
          <Text style={styles.subtitle}>
            {isForgotPassword ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
          </Text>

          {error ? (
            <View style={styles.errorContainer}>
              {error.includes('sign up here') ? (
                <View style={styles.errorTextContainer}>
                  <Text style={styles.errorText}>
                    There is not an account with the provided email. You can always sign up{' '}
                    <Text
                      style={styles.errorLinkInline}
                      onPress={() => {
                        setIsForgotPassword(false);
                        setIsSignUp(true);
                        setError('');
                      }}
                    >
                      here
                    </Text>
                  </Text>
                </View>
              ) : (
                <Text style={styles.errorText}>{error}</Text>
              )}
            </View>
          ) : null}
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={theme.inputPlaceholder}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          {!isForgotPassword && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={theme.inputPlaceholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
              />
            </View>
          )}

          {!isForgotPassword && !isSignUp && (
            <TouchableOpacity
              onPress={() => {
                setIsForgotPassword(true);
                setError('');
                setSuccessMessage('');
              }}
              style={styles.forgotPasswordButton}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Loading...' : isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Sign Up' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <View style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {isForgotPassword ? 'Remember your password?' : isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </Text>
            <TouchableOpacity onPress={() => {
              if (isForgotPassword) {
                setIsForgotPassword(false);
              } else {
                setIsSignUp(!isSignUp);
              }
              setError('');
              setSuccessMessage('');
            }}>
              <Text style={styles.toggleLink}>
                {isForgotPassword ? 'Sign In' : isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: typeof Colors.light) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContainer: {
    flexGrow: 1,
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
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    gap: 4,
  },
  toggleText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  toggleLink: {
    color: theme.buttonPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    marginBottom: 16,
  },
  errorTextContainer: {
    padding: 12,
    backgroundColor: theme.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.error,
  },
  errorText: {
    color: theme.error,
    fontSize: 14,
    textAlign: 'center',
    padding: 12,
    backgroundColor: theme.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.error,
  },
  errorLinkInline: {
    color: theme.buttonPrimary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  errorLinkButton: {
    marginTop: 8,
    alignSelf: 'center',
  },
  errorLinkText: {
    color: theme.buttonPrimary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  successText: {
    color: theme.success,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    padding: 12,
    backgroundColor: theme.successLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.success,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -10,
    marginBottom: 10,
  },
  forgotPasswordText: {
    color: theme.buttonPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
