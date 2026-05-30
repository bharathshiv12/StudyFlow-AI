# Supabase Connection Troubleshooting Guide

## Issue
Getting error: **"Unable to reach Supabase. Check the Supabase URL in .env and your network connection."**

This is a catch-all error message that masks the real issue. Follow this guide to diagnose and fix the problem.

---

## Quick Checklist (Do This First ✅)

- [ ] **Check .env file exists** at project root
- [ ] **Verify VITE_SUPABASE_URL** is set and correct format
- [ ] **Verify VITE_SUPABASE_PUBLISHABLE_KEY** is set  
- [ ] **Check internet connection** - can you access supabase.co in browser?
- [ ] **Verify network tab** - see if requests to Supabase are being made
- [ ] **Check browser console** - look for detailed error logs with [Supabase Error Details]

---

## Step 1: Verify Environment Variables

### In Development (npm run dev)

1. Open browser DevTools → Console tab
2. Look for messages starting with `[Supabase Error Details]`
3. The console will show:
   - Actual error message
   - Whether it's a network error
   - Your current URL
   - User agent

### Example Console Output
```
[Supabase Error Details] {
  message: "Failed to fetch",
  isNetworkError: true,
  timestamp: "2026-05-30T12:34:56.789Z",
  url: "http://localhost:5173/"
}
```

### Check Environment Variables Are Loaded

```javascript
// Paste in browser console
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Has publishable key:', !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
```

---

## Step 2: Test Supabase Connectivity

### Method 1: Use Built-in Diagnostics (Recommended)

```typescript
// In any component or console
import { runSupabaseDiagnostics } from '@/lib/network-diagnostics';

// Run this
await runSupabaseDiagnostics();
```

This will:
- ✅ Check if environment variables are loaded
- ✅ Test if Supabase server is reachable
- ✅ Measure response time
- ✅ Log detailed diagnostics to console

### Method 2: Manual Browser Console Test

```javascript
// Test if Supabase domain is reachable
fetch('https://vwkxjnkdbupewezzosqc.supabase.co/rest/v1/', {
  method: 'HEAD',
  headers: { 'Accept': 'application/json' }
})
.then(r => console.log('Status:', r.status))
.catch(e => console.error('Error:', e.message))
```

---

## Step 3: Identify Root Cause

### Symptom: "timed out after 30s"
**Cause**: Network is too slow or Supabase is unresponsive  
**Fix**:
1. Check your internet connection
2. Try from a different network
3. Verify Supabase status at https://status.supabase.io

### Symptom: "Failed to fetch" 
**Cause**: CORS issue or network blocked  
**Fix**:
1. Check browser DevTools Network tab
2. Look for failed requests to supabase.co
3. Check if behind corporate firewall/VPN
4. Try disabling browser extensions

### Symptom: "Cannot find module '@supabase/supabase-js'"
**Cause**: Dependencies not installed  
**Fix**:
```bash
npm install
# or
bun install
```

### Symptom: Undefined SUPABASE_URL in error
**Cause**: .env file not loading or vars not prefixed with VITE_  
**Fix**:
1. Restart dev server after .env changes: `npm run dev`
2. Ensure vars are `VITE_SUPABASE_*` for client
3. Check .env file is in project root

---

## Step 4: Missing SUPABASE_SERVICE_ROLE_KEY

This is a server-side only key used for admin operations. If you see errors when trying to use server functions, this is likely missing.

### Get Your Service Role Key

1. Go to https://supabase.com → Your Project
2. Settings → API
3. Copy **Service Role** (keep it secret!)
4. Add to `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=<paste-here>
   ```
5. **Restart dev server**

⚠️ **SECURITY**: Never commit this key to version control. It bypasses all Row Level Security (RLS) policies.

---

## Step 5: Cloudflare Workers Deployment

If it works locally but fails in production on Cloudflare:

### Option A: Using wrangler.jsonc
Environment variables are already configured in `wrangler.jsonc`. Deploy with:
```bash
npm run build
wrangler deploy
```

### Option B: Manual Secrets Setup
```bash
# Set production secrets
wrangler secret put SUPABASE_PUBLISHABLE_KEY --env production
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production

# Verify
wrangler secret list --env production
```

### Option C: Check Cloudflare Workers Logs
```bash
wrangler tail --env production
```
Look for `[Supabase Error Details]` in logs.

---

## Step 6: Advanced Diagnostics

### Check Network Timing
Look at actual fetch duration in Network tab:
- **< 500ms**: ✅ Excellent, likely network not the issue
- **500ms - 2s**: ✅ Good, normal latency
- **2s - 5s**: ⚠️ Slow, check connection
- **> 5s**: 🔴 Very slow or timing out

### Monitor localStorage for Errors
```javascript
// See last 10 errors stored by the app
JSON.parse(localStorage.getItem('supabase_errors') || '[]')
```

### Test with curl
```bash
# Test if Supabase is reachable
curl -I https://vwkxjnkdbupewezzosqc.supabase.co/rest/v1/
```

Expected response:
```
HTTP/2 401 
```
(401 is OK - means server is up but no auth provided)

---

## Step 7: Still Not Working?

### Check Your .env File

```bash
# Show environment variables (be careful - includes secrets!)
cat .env
```

Should contain:
```
VITE_SUPABASE_URL=https://vwkxjnkdbupewezzosqc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_URL=https://vwkxjnkdbupewezzosqc.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... (optional for dev, required for server functions)
```

### Verify Supabase Project is Active

1. Go to https://supabase.com/dashboard
2. Check if your project shows "Active"
3. Click project → Settings → General
4. Verify URL matches `.env` file

### Check Supabase Status

1. Visit https://status.supabase.io
2. Check if your region is experiencing issues

### Restart Everything

```bash
# Kill dev server (Ctrl+C)
# Remove node_modules cache
rm -rf node_modules/.vite
# Restart
npm run dev
```

---

## Getting Help

### Include This Information When Asking for Help

1. **Error message** from browser console with `[Supabase Error Details]`
2. **Network diagnostics** output (run `runSupabaseDiagnostics()`)
3. **Environment info**:
   ```javascript
   {
     supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
     nodeVersion: (run `node --version` in terminal),
     isCloudflareWorkers: (show if deploying to CF)
   }
   ```
4. **When it started**: Recently after changes? Or always?
5. **Where it happens**: Local dev? Production? Specific endpoint?

---

## Reference Files

- **Error logging**: [src/lib/supabase-network.ts](../../src/lib/supabase-network.ts)
- **Diagnostics utility**: [src/lib/network-diagnostics.ts](../../src/lib/network-diagnostics.ts)
- **Supabase client**: [src/integrations/supabase/client.ts](../../src/integrations/supabase/client.ts)
- **Configuration**: [wrangler.jsonc](../../wrangler.jsonc)
- **Environment example**: [.env.example](../../.env.example)

---

## Changes Made to Fix This Issue

✅ **Increased timeout** from 10s → 30s (handles slow networks)  
✅ **Enhanced error logging** (shows actual error details in console)  
✅ **Added network diagnostics** (test connectivity programmatically)  
✅ **Configured wrangler.jsonc** (fixes production on Cloudflare)  
✅ **Created .env.example** (documents required variables)  

These changes help pinpoint the real issue instead of showing a generic error.
