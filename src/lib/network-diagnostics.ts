/**
 * Network Diagnostics Utilities for Supabase Connectivity
 * Use this to debug connection issues in development and production
 */

export interface ConnectivityTestResult {
  reachable: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
  timestamp: string;
}

/**
 * Test if Supabase is reachable
 * Performs a lightweight HEAD request to check connectivity
 */
export async function testSupabaseConnectivity(): Promise<ConnectivityTestResult> {
  const start = performance.now();
  const timestamp = new Date().toISOString();

  try {
    const supabaseUrl = 
      typeof window !== 'undefined' 
        ? (window as any).VITE_SUPABASE_URL || (import.meta as any).env.VITE_SUPABASE_URL
        : process.env.SUPABASE_URL;

    if (!supabaseUrl) {
      return {
        reachable: false,
        responseTime: performance.now() - start,
        error: 'SUPABASE_URL environment variable not set',
        timestamp,
      };
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'Accept': 'application/json',
      },
    });

    const responseTime = performance.now() - start;

    if (response.ok || response.status === 401) {
      // 401 is expected (no auth), but it means the server is reachable
      console.log(`[Supabase Diagnostics] ✅ Connectivity OK (${responseTime.toFixed(0)}ms)`);
      return {
        reachable: true,
        responseTime,
        statusCode: response.status,
        timestamp,
      };
    }

    return {
      reachable: false,
      responseTime,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${response.statusText}`,
      timestamp,
    };
  } catch (error) {
    const responseTime = performance.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[Supabase Diagnostics] ❌ Connectivity Failed (${responseTime.toFixed(0)}ms)`, {
      error: errorMessage,
      type: error instanceof Error ? error.constructor.name : typeof error,
    });

    return {
      reachable: false,
      responseTime,
      error: errorMessage,
      timestamp,
    };
  }
}

/**
 * Comprehensive connectivity check with detailed diagnostics
 */
export async function runSupabaseDiagnostics(): Promise<void> {
  console.group('[Supabase Network Diagnostics]');

  try {
    // Check environment variables
    const hasViteUrl = !!(
      typeof window !== 'undefined'
        ? (window as any).VITE_SUPABASE_URL
        : (import.meta as any).env.VITE_SUPABASE_URL
    );
    const hasProcessUrl = !!process.env.SUPABASE_URL;

    console.log('Environment Variables:', {
      hasViteUrl,
      hasProcessUrl,
      isClientSide: typeof window !== 'undefined',
    });

    // Perform connectivity test
    const result = await testSupabaseConnectivity();
    console.log('Connectivity Test:', result);

    if (!result.reachable) {
      console.warn('⚠️ Supabase is not reachable. Possible causes:');
      console.warn('  - Network connection issue');
      console.warn('  - Invalid SUPABASE_URL in .env');
      console.warn('  - Firewall/CORS blocking the request');
      console.warn('  - Supabase service is down');
    }
  } finally {
    console.groupEnd();
  }
}

/**
 * Get detailed error information for better debugging
 */
export function extractErrorDetails(error: unknown): {
  message: string;
  type: string;
  code?: string;
  status?: number;
} {
  if (error instanceof TypeError) {
    return {
      message: error.message,
      type: 'TypeError',
      code: error.message.includes('fetch')
        ? 'FETCH_ERROR'
        : error.message.includes('timeout')
        ? 'TIMEOUT_ERROR'
        : undefined,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      type: error.constructor.name,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as any;
    return {
      message: obj.message || JSON.stringify(obj),
      type: obj.constructor?.name || 'UnknownObject',
      status: obj.status,
      code: obj.code,
    };
  }

  return {
    message: String(error),
    type: typeof error,
  };
}

/**
 * Log detailed connectivity error for support/debugging
 */
export function logConnectivityError(error: unknown): void {
  const details = extractErrorDetails(error);
  const diagnostics = {
    ...details,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
  };

  console.error('[Supabase Connectivity Error]', diagnostics);

  // Store in localStorage for debugging (optional)
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const errors = JSON.parse(localStorage.getItem('supabase_errors') || '[]');
      errors.push(diagnostics);
      // Keep only last 10 errors
      localStorage.setItem('supabase_errors', JSON.stringify(errors.slice(-10)));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }
}
