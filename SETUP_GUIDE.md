# Smart Living Pakistan — Inventory System v2
## Complete Setup Guide: Supabase + Vercel

---

## STEP 1 — Supabase Database Setup

1. Go to **https://supabase.com** → Sign up (free)
2. Click **New Project** → Name it, set a strong password, choose Singapore or Mumbai region
3. Wait ~2 minutes for project to provision

### Run the SQL Schema
4. In Supabase dashboard → **SQL Editor** → **New Query**
5. Open `supabase-schema.sql`, copy ALL contents, paste, click **Run**
   - This creates: `products`, `profiles`, `sync_log` tables
   - Inserts all 83 seed products
   - Sets up Row Level Security policies
   - Creates auto-profile trigger on sign-up

### Get your API Keys
6. **Settings → API** (left sidebar) — copy:
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon / public key** → starts with `eyJ…`

### Enable Auth Providers (optional: phone OTP)
7. **Authentication → Providers**
   - Email: ON by default ✅
   - Phone: Toggle ON → add Twilio credentials for real SMS OTP
   - (Without Twilio, use Email login only — OTP tab still works via email link)

### Enable Password Reset Emails ⚠️ IMPORTANT
8. **Authentication → Email Templates**
   - Click **Confirm signup** → make sure it's enabled
   - Click **Reset Password** → make sure it's enabled
   - Click **Email Provider** → Must have one configured:
     - Option A: **Supabase built-in** (free, includes daily limit)
     - Option B: **SendGrid** (recommended for production, higher limits)
     - Option C: **PostMark** or **AWS SES**
   - Without an email provider configured, password reset emails will NOT send
   - Once configured, set the **Redirect URL** in **Authentication → URL Configuration**:
     - For local: `http://localhost:3000`
     - For production: `https://your-app-name.vercel.app`
   - This ensures reset links point to YOUR app, not Supabase

### Enable Realtime
9. **Database → Replication** → toggle `products` table ON

---

## STEP 2 — Local Setup

```bash
cd slp-inventory
npm install
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Optional — for WooCommerce auto-sync
WOO_CONSUMER_KEY=ck_xxxx
WOO_CONSUMER_SECRET=cs_xxxx
SYNC_SECRET=any-random-string
NEXT_PUBLIC_SYNC_SECRET=same-random-string
```

```bash
npm run dev
# Open http://localhost:3000
```

---

## STEP 3 — WooCommerce REST API Keys (for Auto-Sync)

1. In WordPress admin → **WooCommerce → Settings → Advanced → REST API**
2. Click **Add Key**
3. Description: `SLP Inventory Sync`
4. User: your admin user
5. Permissions: **Read**
6. Click **Generate API Key**
7. Copy the **Consumer Key** (`ck_...`) and **Consumer Secret** (`cs_...`)
8. Add to your `.env.local` and Vercel env vars

### How Sync Works
- Click **Sync Store** button in the app header
- It fetches ALL published products from smartlivingpakistan.com via WooCommerce API
- New products → inserted automatically
- Existing products (matched by WooCommerce ID or name) → prices & stock updated
- A green WiFi icon 🛜 appears on synced products
- Last sync status shown in the header dropdown

---

## STEP 4 — Deploy to Vercel

```bash
git init
git add .
git commit -m "SLP Inventory v2"
git remote add origin https://github.com/YOUR_USERNAME/slp-inventory.git
git push -u origin main
```

1. Go to **https://vercel.com** → New Project → Import repo
2. Add ALL Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   WOO_CONSUMER_KEY
   WOO_CONSUMER_SECRET
   SYNC_SECRET
   NEXT_PUBLIC_SYNC_SECRET
   ```
3. Click **Deploy** 🎉

---

## STEP 5 — Auth & User Management

### First-Time Login
- Open your app URL
- Click **Sign up** → create your admin account with email + password
- Verify your email (Supabase sends a confirmation link)
- Sign in

### For Staff Members
- Share the app URL
- They create their own account via Sign up
- Each account is independent (unique email/phone)
- To promote someone to admin: run in Supabase SQL Editor:
  ```sql
  UPDATE profiles SET role = 'admin' WHERE email = 'staff@example.com';
  ```

### Password Reset Flow
- Click **Forgot password?** on login page
- Choose Email or Phone
- Email: receive reset link → click → set new password
- Phone: receive SMS OTP (requires Twilio configured in Supabase) → enter 6-digit code → signed in

---

## Public Stock API

```
GET https://your-app.vercel.app/api/stock
GET https://your-app.vercel.app/api/stock?id=5
GET https://your-app.vercel.app/api/stock?name=Yoga+Mat
```

No auth needed — add to WooCommerce or any storefront.

---

## Features Summary

| Feature | Details |
|---------|---------|
| ✅ Auth | Email/password login, signup, forgot password |
| ✅ OTP | Phone OTP via Supabase (needs Twilio) or email link |
| ✅ Unique accounts | Each email/phone is unique per user |
| ✅ Auto-sync | Fetch ALL products from WooCommerce store automatically |
| ✅ New products | Any new product on your store → auto-added on sync |
| ✅ 83 products | Pre-loaded seed data |
| ✅ Real-time | Changes sync instantly via Supabase Realtime |
| ✅ Stock alerts | Low stock (≤5) and out-of-stock highlighted |
| ✅ Public API | `/api/stock` for live storefront |
| ✅ Mobile-first | Fully responsive on all screen sizes |
| ✅ Free tier | Supabase free + Vercel free = Rs.0/month |
