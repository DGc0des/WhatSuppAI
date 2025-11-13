import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase credentials
// Note: Supabase anon key is safe to expose in client-side code
// It's designed to be public and is protected by Row Level Security (RLS) policies
const supabaseUrl = 'https://ocborljfnmmodrnbtoqb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYm9ybGpmbm1tb2RybmJ0b3FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NjU1MDcsImV4cCI6MjA3NzQ0MTUwN30.dkjnQyZte5s-7HlwgADNOxajFvombSuLYfy2MX0Yvlc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
