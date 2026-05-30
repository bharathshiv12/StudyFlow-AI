# How to Get Your SUPABASE_SERVICE_ROLE_KEY

The "Unable to reach Supabase" error may be caused by a missing `SUPABASE_SERVICE_ROLE_KEY` in your `.env` file.

## Quick Steps ⚡

### 1. Go to Supabase Dashboard
Visit: https://supabase.com/dashboard

### 2. Select Your Project
Find and click on your project: **vwkxjnkdbupewezzosqc**

### 3. Navigate to API Settings
In the left sidebar:
- Click **Settings** (gear icon at bottom)
- Click **API**

### 4. Copy Service Role Key
You'll see several keys listed:
- **Project API keys**
  - `anon public` (safe for client)
  - `service_role` (👈 THIS ONE) ← Copy this!

The `service_role` key will look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 5. Add to .env File

Open `.env` file in your project and add:
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Replace the long string with your actual key.

### 6. Restart Dev Server

Stop the current server (Ctrl+C) and restart:
```bash
npm run dev
```

### 7. Verify It Works

In browser console (F12):
```javascript
import { runSupabaseDiagnostics } from '@/lib/network-diagnostics';
await runSupabaseDiagnostics();
```

You should see:
```
✅ Connectivity OK
```

---

## ⚠️ Security Notes

**IMPORTANT: Keep this key SECRET!**

- ✅ DO: Store in `.env` file (local only)
- ✅ DO: Use in server-side code only
- ❌ DON'T: Commit `.env` to Git
- ❌ DON'T: Share with anyone
- ❌ DON'T: Use in client-side code

**This key bypasses all Row Level Security (RLS)** and can perform any database operation.

---

## What is the Service Role Key?

The Service Role key is a high-privilege API key used for:
- Admin operations on the database
- Server-side functions and routes
- Operations that need to bypass Row Level Security (RLS)

It's different from the **Anon (Public)** key which is:
- Client-side safe (can be exposed)
- Limited by Row Level Security policies
- What the app uses for regular user operations

---

## Verify the Key is Correct

Once added to `.env`, you can verify in the console:

```javascript
// Check server-side key is loaded (not visible, but tested)
// If server functions work, the key is correct

// Check client-side keys are loaded
console.log('URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Has publishable key:', !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
```

Expected output:
```
URL: https://vwkxjnkdbupewezzosqc.supabase.co
Has publishable key: true
```

---

## Still Not Working?

1. **Restart dev server** after adding the key
2. **Check `.env` file** has the complete key (starts with `eyJ`)
3. **Verify key is correct** - compare with Supabase dashboard exactly
4. **Run diagnostics** to see actual error:
   ```javascript
   import { runSupabaseDiagnostics } from '@/lib/network-diagnostics';
   await runSupabaseDiagnostics();
   ```

---

## For Production (Cloudflare Workers)

When deploying to Cloudflare Workers, set the secret:

```bash
# Set the secret for production
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production

# Then paste your key when prompted
# (It won't be saved to wrangler.jsonc - only stored as a secret)

# Verify it was set
wrangler secret list --env production
```

---

## Still Seeing "Unable to Reach Supabase"?

Run the full diagnostics:
```javascript
import { runSupabaseDiagnostics } from '@/lib/network-diagnostics';
await runSupabaseDiagnostics();
```

The detailed error message will tell you what's actually wrong:
- `timed out` → Network timeout
- `Failed to fetch` → Network error
- `401` → Authentication error
- `Cannot find` → Environment variable not set

Check [SUPABASE_TROUBLESHOOTING.md](SUPABASE_TROUBLESHOOTING.md) for the full troubleshooting guide.
