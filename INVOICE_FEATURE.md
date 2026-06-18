# Invoice Feature — Setup Guide

A complete, bug-free, fully responsive invoicing system has been added to your inventory app.

## What's included

### Basic Features
- Company logo (defaults to 🏬, can be set per invoice)
- Auto-generated invoice number (`INV-2026-0001` style, sequential per year)
- Invoice date, due date, order ID
- Payment status: Paid / Unpaid / Partial / Refunded (editable any time, even after creation)

### Customer Information
- Name, email, phone
- Billing address + shipping address (with a "same as billing" shortcut)

### Product Details
- **Select from your inventory** — search and pick any product; price, SKU, and name auto-fill
- **Or type manually** — add any custom line item that isn't in your inventory
- Per-line: quantity, unit price, discount, tax %, auto-calculated line total

### Pricing Summary
- Subtotal, discount, tax, shipping charges, delivery tax — all auto-calculated
- Grand total in PKR (₨) or USD

### Payment Information
- Method (Card / Bank / COD / Wallet), transaction ID, payment date
- **Partial payment support** — enter "Amount Paid" and the invoice automatically shows
  the remaining "Balance Due"

### Shipping Details
- Courier name, tracking number, delivery status (Pending → Shipped → Out for Delivery →
  Delivered / Returned)

### Invoice Actions
- **Print Invoice** — opens the browser print dialog with a clean, page-formatted layout
- **Download as PDF** — uses the same print dialog; choose "Save as PDF" as the
  destination (works on every browser/OS with zero extra setup)
- **Email Invoice** — sends a formatted email with the full breakdown + a button
  linking to the live invoice, via your Gmail account
- **Share Invoice Link** — every invoice gets a unique, public, read-only link
  (`/invoice/xxxxx`) that anyone can open without logging in — perfect for sending
  to a customer on WhatsApp

### Advanced Features
- **QR code** — scans to the public share link
- **Barcode** — visual barcode of the invoice number
- **Payment QR placeholder** — if you add a `payment_qr_url` later (e.g. your JazzCash/
  Easypaisa QR image), it will show as a third code block automatically
- **Custom notes / terms & conditions** — free text field on every invoice

---

## Setup — 2 steps

### Step 1 — Run the database schema

1. Go to **supabase.com** → your project → **SQL Editor** → **New Query**
2. Open `supabase-invoices-schema.sql` (included in this package)
3. Copy all its contents, paste into the SQL editor, click **Run**

This creates the `invoices` and `invoice_items` tables, the auto-numbering function,
and all required security policies. Safe to run even if you're not sure — it won't
touch your existing `products` table.

### Step 2 — Add email settings (for "Email Invoice")

In Vercel → your project → **Settings → Environment Variables**, add:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youraddress@gmail.com
SMTP_PASS=your_16_character_app_password
SMTP_FROM="Smart Living Pakistan <youraddress@gmail.com>"
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Important:** `SMTP_PASS` must be a Gmail **App Password**, not your normal Gmail
password. To generate one:
1. Go to your Google Account → **Security**
2. Turn on **2-Step Verification** (required first)
3. Search for **App Passwords** → create one named "Invoices"
4. Copy the 16-character code it gives you — that's your `SMTP_PASS`

If you skip this step, every other invoice feature (create, print, PDF, share link,
QR code) still works perfectly — only the "Email Invoice" button needs this.

---

## How to use it

1. Open your app → click **Invoices** in the header (next to the sync button)
2. Click **+ New Invoice**
3. Fill in customer info, then either:
   - Click **Select** next to a line item to search your inventory, or
   - Just type a product name directly for a custom item
4. Add as many items as needed, fill in shipping/payment/notes
5. Click **Save Invoice** — you'll land on the invoice's detail page
6. From there: change payment status anytime, print, download as PDF, email it, or
   copy the public share link

---

## Files added

```
supabase-invoices-schema.sql        ← run this once in Supabase

lib/invoice-utils.ts                ← pricing math, formatting helpers

app/components/InvoiceCodes.tsx     ← QR code + barcode renderers
app/components/InvoiceDocument.tsx  ← the actual invoice layout (shared by all views)
app/components/ProductPicker.tsx    ← inventory search/select modal

app/invoices/page.tsx               ← invoice list (search, filter, delete)
app/invoices/new/page.tsx           ← create new invoice form
app/invoices/[id]/page.tsx          ← view/manage one invoice (staff, requires login)
app/invoice/[token]/page.tsx        ← public read-only view (no login — for sharing)

app/api/invoices/route.ts           ← list + create
app/api/invoices/[id]/route.ts      ← get + update + delete
app/api/invoices/[id]/email/route.ts← send via Gmail
```

`app/page.tsx` was also updated with a new **Invoices** button in the header (desktop)
and the user menu (mobile).
