import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

function normalizeSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    if (!url.hostname.includes('.supabase.')) {
      const hostname = url.hostname;
      if (/^[a-z0-9]+\.co$/i.test(hostname)) {
        url.hostname = `${hostname.replace(/\.co$/, '')}.supabase.co`;
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

const supabaseUrl = normalizeSupabaseUrl(
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    'https://osmlstklnlaikwolfcku.supabase.co',
);
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zbWxzdGtsbmxhaWt3b2xmY2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MjU4NjQsImV4cCI6MjEwMTEwMTg2NH0.9rtzkSYWNZ3xQMedDN6OOyw0hH5j1lIu-xEaccPihPI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: AsyncStorage as never,
  },
});
