import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://missing-supabase-url.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'missing-supabase-anon-key';

function readEnvValue(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes('YOUR_')) return fallback;
  return trimmed;
}

function readSupabaseUrl(value: string | undefined): string {
  const trimmed = readEnvValue(value, FALLBACK_SUPABASE_URL);
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') return trimmed;
  } catch {
    // Fall through to the safe dummy URL so a bad Vercel env var does not blank the app.
  }
  return FALLBACK_SUPABASE_URL;
}

const supabaseUrl = readSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = readEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY, FALLBACK_SUPABASE_ANON_KEY);

if (supabaseUrl === FALLBACK_SUPABASE_URL || supabaseAnonKey === FALLBACK_SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase configuration is missing or invalid. Photo uploads will fail until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const SUPABASE_PHOTO_BUCKET = import.meta.env.VITE_SUPABASE_PHOTO_BUCKET || 'photo';
