# Fixes Applied — v3

## 1. ❌ Product images missing → ✅ Fixed
- `ProdImg` now falls back to a **clickable "View on store" placeholder** linking to the live
  `smartlivingpakistan.com` product page whenever no image is saved, instead of just a flat icon.
- Added a `store_url` field to every product (DB column + Add/Edit modal field) so staff can paste
  the live product page link once and always have a way to find/copy the real photo.
- **Root cause fixed:** the WooCommerce sync routes (`/api/sync` and `/api/cron/sync`) used to
  overwrite `image_url` with `null` whenever WooCommerce returned no image for that pass. Sync now
  keeps the existing image if the new sync pass doesn't find one (`imageUrl || existing.image_url`).
- A small ✏️/🔗 quick-action appears on hover for any product missing an image, linking straight
  to its store page.

## 2. ❌ "Refresh brings old (deleted) data back" → ✅ Fixed
- **Root cause:** a daily Vercel Cron job (`vercel.json` → `/api/cron/sync`) and the in-app "Sync
  Store" button both pulled every product from WooCommerce and re-inserted/updated anything
  matching by `woo_id` or name — including products you had manually deleted from the inventory.
- Added a new `deleted_products` table that records the `woo_id` of anything you delete.
- Both sync routes (`/api/sync` and `/api/cron/sync`) now check this table first and **skip**
  re-creating any product you intentionally removed.
- Also removed a risky client-side effect that auto-triggered a full store sync whenever the
  visible product list was empty — that was the most common way deleted items silently reappeared
  right after a refresh.
- Run `supabase-migration-v3.sql` once in Supabase SQL Editor to add this table.

## 3. ❌ Banners couldn't be closed → ✅ Fixed
Three banners are now dismissible with an ✕ button:
- **Sync result banner** (top, after clicking "Sync Store")
- **Low / out-of-stock alert banner** (red banner above the category tabs) — it automatically
  reappears if the alert count goes up again after you dismiss it, so you don't miss new issues
- **Alert settings card** (email + threshold panel) can be hidden entirely and reopened via the
  new 🔔 bell button in the header (which also shows a live count badge)

## 4. ❌ No per-product alert bell → ✅ Fixed
- Every product now has a real, working **mute/unmute bell** (bottom-left on grid cards, inline on
  list rows).
- Muted products (`alert_enabled = false`) are excluded from:
  - the low/out-of-stock stat count and red banner
  - the automatic low-stock email notification
- Toggling is optimistic (instant UI feedback) and safely reverts if the database update fails.
- New column: `products.alert_enabled BOOLEAN NOT NULL DEFAULT true` (added by the migration).

---

## To deploy these fixes

1. Run **`supabase-migration-v3.sql`** in your Supabase project (SQL Editor → New query → Run).
   This adds: `deleted_products` table, `products.alert_enabled`, `products.store_url`.
2. Redeploy this code to Vercel (push to your connected Git repo, or `vercel --prod`).
3. No environment variable changes needed — existing `WOO_CONSUMER_KEY` / `WOO_CONSUMER_SECRET` /
   `SYNC_SECRET` / `CRON_SECRET` continue to work the same way.
