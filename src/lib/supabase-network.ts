export const SUPABASE_REQUEST_TIMEOUT_MS = 30000; // Increased from 10s to 30s for edge runtime compatibility

const NETWORK_ERROR_PATTERN =
  /failed to fetch|fetch failed|network|enotfound|err_name_not_resolved|remote name could not be resolved|timed out|abort/i;

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

export function getSupabaseErrorMessage(
  error: unknown,
  fallback = "Unable to connect to Supabase.",
) {
  const message = readErrorMessage(error);

  // Enhanced logging for debugging network issues
  if (typeof window !== 'undefined') {
    console.error('[Supabase Error Details]', {
      message,
      errorObject: error,
      isNetworkError: NETWORK_ERROR_PATTERN.test(message),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });
  } else {
    // Server-side logging
    console.error('[Supabase Server Error Details]', {
      message,
      errorObject: error,
      isNetworkError: NETWORK_ERROR_PATTERN.test(message),
      timestamp: new Date().toISOString(),
    });
  }

  if (NETWORK_ERROR_PATTERN.test(message)) {
    return "Unable to reach Supabase. Check the Supabase URL in .env and your network connection.";
  }

  return message || fallback;
}

export function withSupabaseTimeout<T>(
  operation: PromiseLike<T>,
  label = "Supabase request",
  timeoutMs = SUPABASE_REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs / 1000}s.`));
    }, timeoutMs);
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export function createSupabaseFetch(timeoutMs = SUPABASE_REQUEST_TIMEOUT_MS): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const upstreamSignal = init?.signal;
    const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Supabase request timed out after ${timeoutMs / 1000}s.`));
    }, timeoutMs);

    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        abortFromUpstream();
      } else {
        upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
      }
    }

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted && !upstreamSignal?.aborted) {
        throw new Error(`Supabase request timed out after ${timeoutMs / 1000}s.`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", abortFromUpstream);
    }
  };
}
