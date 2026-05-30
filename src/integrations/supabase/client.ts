import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { createSupabaseFetch } from '@/lib/supabase-network';
import { mockSupabaseClient } from './mock-client';

function sanitizeEnvVar(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, '');
}

function getSupabaseEnv(...values: Array<string | undefined>) {
  return values.map(sanitizeEnvVar).find(Boolean);
}

function getSupabaseUrlFromProjectId(projectId: string | undefined) {
  const id = sanitizeEnvVar(projectId);
  return id ? `https://${id}.supabase.co` : undefined;
}

let isOfflineMode = false;

function enableOfflineMode(reason?: string) {
  isOfflineMode = true;
  if (typeof window !== 'undefined') {
    (window as { __SUPABASE_OFFLINE__?: boolean }).__SUPABASE_OFFLINE__ = true;
    if (reason) {
      console.warn(`[Supabase] ${reason} Using local storage mode.`);
    }
    window.dispatchEvent(new CustomEvent('supabase-offline-changed', { detail: true }));
  }
}

if (typeof window !== 'undefined') {
  const forceLocal = import.meta.env.VITE_USE_LOCAL_DATABASE === 'true';
  if (forceLocal) {
    enableOfflineMode('VITE_USE_LOCAL_DATABASE is enabled.');
  } else {
    void (async () => {
      const SUPABASE_URL =
        getSupabaseEnv(import.meta.env.VITE_SUPABASE_URL, import.meta.env.SUPABASE_URL) ||
        getSupabaseUrlFromProjectId(
          getSupabaseEnv(import.meta.env.VITE_SUPABASE_PROJECT_ID, import.meta.env.SUPABASE_PROJECT_ID),
        );

      if (!SUPABASE_URL) {
        enableOfflineMode('Supabase URL is not configured.');
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        await fetch(`${SUPABASE_URL}/rest/v1/`, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
      } catch {
        enableOfflineMode('Remote Supabase is unreachable.');
      }
    })();
  }
}

function createSupabaseClient() {
  const SUPABASE_URL =
    getSupabaseEnv(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.SUPABASE_URL,
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_URL,
    ) ||
    getSupabaseUrlFromProjectId(
      getSupabaseEnv(
        import.meta.env.VITE_SUPABASE_PROJECT_ID,
        import.meta.env.SUPABASE_PROJECT_ID,
        process.env.VITE_SUPABASE_PROJECT_ID,
        process.env.SUPABASE_PROJECT_ID,
      ),
    );
  const SUPABASE_PUBLISHABLE_KEY = getSupabaseEnv(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    import.meta.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
  );

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Connect Supabase in Lovable Cloud.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(),
    },
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (typeof window !== 'undefined' && ((window as { __SUPABASE_OFFLINE__?: boolean }).__SUPABASE_OFFLINE__ || isOfflineMode)) {
      return Reflect.get(mockSupabaseClient, prop, receiver);
    }
    if (!_supabase) {
      try {
        _supabase = createSupabaseClient();
      } catch (e) {
        console.warn('[Supabase] Failed to create client. Falling back to mock local client.', e);
        enableOfflineMode();
        return Reflect.get(mockSupabaseClient, prop, receiver);
      }
    }
    return Reflect.get(_supabase, prop, receiver);
  },
});
