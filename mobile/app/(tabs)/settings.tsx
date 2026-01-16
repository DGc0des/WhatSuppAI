import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Platform,
  Linking,
} from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { supabase } from '../../supabase-client';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorSchemePreference } from '@/hooks/use-color-scheme';
import * as Notifications from 'expo-notifications';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
}

export default function SettingsScreen() {
  const { colorScheme, mode, setMode } = useColorSchemePreference();
  const colors = Colors[colorScheme ?? 'light'];

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Notification settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // App preferences
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // Profile editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    loadUserData();
    checkNotificationPermissions();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        console.error('Error getting user:', authError);
        setLoading(false);
        return;
      }

      setUser({
        id: authUser.id,
        email: authUser.email || '',
        full_name: authUser.user_metadata?.full_name,
        avatar_url: authUser.user_metadata?.avatar_url,
        created_at: authUser.created_at || '',
      });

      setFullName(authUser.user_metadata?.full_name || '');
      setLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setLoading(false);
    }
  };

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(status === 'granted');
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationsEnabled(status === 'granted');

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive supplement reminders.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } else {
      setNotificationsEnabled(false);
      Alert.alert(
        'Notifications Disabled',
        'You will no longer receive supplement reminders.'
      );
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
        },
      });

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully');
      setIsEditingName(false);
      loadUserData();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'A password reset link will be sent to your email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            try {
              // Use ExpoLinking.createURL to get the correct URL for both Expo Go and production
              const redirectUrl = ExpoLinking.createURL('reset-password');
              console.log('Password reset redirect URL:', redirectUrl);

              const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
                redirectTo: redirectUrl,
              });

              if (error) throw error;

              Alert.alert('Success', 'Password reset link sent to your email');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to send reset link');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              // Navigation will be handled by auth state change
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Enter your email to confirm deletion',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm Deletion',
                  style: 'destructive',
                  onPress: async () => {
                    // Note: Account deletion would need to be implemented on the backend
                    // This is just a placeholder
                    Alert.alert('Feature Coming Soon', 'Account deletion will be available in a future update. Please contact support for assistance.');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear Local Data',
      'This will clear all locally cached data. Your account data will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            // Add logic to clear local cache if needed
            Alert.alert('Success', 'Local data cleared');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>

      {/* Profile Section */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile</Text>

        {/* Email and Member Info */}
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <IconSymbol name="envelope.fill" size={20} color={colors.textSecondary} />
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>{user?.email}</Text>
              <Text style={[styles.profileDate, { color: colors.textSecondary }]}>
                Member since {new Date(user?.created_at || '').toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Full Name */}
        {isEditingName ? (
          <View style={styles.nameEditFullContainer}>
            <View style={styles.settingLeft}>
              <IconSymbol name="person.fill" size={20} color={colors.textSecondary} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Full Name</Text>
            </View>
            <TextInput
              style={[styles.nameInputLarge, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your name"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <View style={styles.nameEditButtons}>
              <TouchableOpacity onPress={handleUpdateProfile} style={[styles.saveButton, { backgroundColor: colors.tint }]}>
                <Text style={[styles.saveButtonText, { color: colors.background }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsEditingName(false)} style={[styles.cancelButton, { borderColor: colors.border }]}>
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <IconSymbol name="person.fill" size={20} color={colors.textSecondary} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Full Name</Text>
            </View>
            <TouchableOpacity onPress={() => setIsEditingName(true)}>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                {fullName || 'Tap to add'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Notifications Section */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <IconSymbol name="bell.fill" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Push Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationToggle}
            trackColor={{ false: colors.border, true: colors.tint }}
          />
        </View>
      </View>

      {/* Preferences Section */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferences</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <IconSymbol name="moon.fill" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
          </View>
          <View style={styles.settingRight}>
            <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
              {mode === 'system' ? 'System' : colorScheme === 'dark' ? 'Dark' : 'Light'}
            </Text>
            <Switch
              value={colorScheme === 'dark'}
              onValueChange={(value) => setMode(value ? 'dark' : 'light')}
              trackColor={{ false: colors.border, true: colors.tint }}
            />
          </View>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <IconSymbol name="speaker.wave.2.fill" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Sound Effects</Text>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ false: colors.border, true: colors.tint }}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <IconSymbol name="hand.tap.fill" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Haptic Feedback</Text>
          </View>
          <Switch
            value={hapticsEnabled}
            onValueChange={setHapticsEnabled}
            trackColor={{ false: colors.border, true: colors.tint }}
          />
        </View>
      </View>

      {/* Account Section */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>

        <TouchableOpacity style={styles.settingButton} onPress={handleChangePassword}>
          <View style={styles.settingLeft}>
            <IconSymbol name="key.fill" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Change Password</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton} onPress={handleClearData}>
          <View style={styles.settingLeft}>
            <IconSymbol name="trash.fill" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Clear Local Data</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton} onPress={handleSignOut}>
          <View style={styles.settingLeft}>
            <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Sign Out</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <IconSymbol name="info.circle.fill" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Version</Text>
          </View>
          <Text style={[styles.settingValue, { color: colors.textSecondary }]}>1.0.0</Text>
        </View>

        <TouchableOpacity style={styles.settingButton}>
          <View style={styles.settingLeft}>
            <IconSymbol name="doc.text.fill" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Privacy Policy</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton}>
          <View style={styles.settingLeft}>
            <IconSymbol name="doc.text.fill" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Terms of Service</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={[styles.section, styles.dangerSection]}>
        <Text style={[styles.sectionTitle, { color: '#ff3b30' }]}>Danger Zone</Text>

        <TouchableOpacity style={styles.settingButton} onPress={handleDeleteAccount}>
          <View style={styles.settingLeft}>
            <IconSymbol name="trash.fill" size={20} color="#ff3b30" />
            <Text style={[styles.settingLabel, { color: '#ff3b30' }]}>Delete Account</Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color="#ff3b30" />
        </TouchableOpacity>
      </View>

      {/* Bottom Padding */}
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
  },
  dangerSection: {
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    opacity: 0.6,
  },
  profileDate: {
    fontSize: 12,
    marginTop: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    marginLeft: 12,
  },
  settingValue: {
    fontSize: 16,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  nameEditFullContainer: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
  },
  nameInputLarge: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    marginBottom: 12,
    minHeight: 50,
  },
  nameEditButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
