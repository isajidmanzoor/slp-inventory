# Design System — Smart Living Pakistan Inventory

A visual reference for the colors, components, and layout patterns used across the inventory management app. Use this as the source of truth when building new screens or features.

---

## 1. Brand

| Token | Value |
|---|---|
| App name | Smart Living Pakistan — Inventory |
| Logo | `https://smartlivingpakistan.com/wp-content/uploads/2025/07/New-logo-Smart-Living-Pakistan-mobile-7.png.webp` |
| Font | `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| Page background | `#F5F4F0` |
| Card background | `#FFFFFF` |
| Default border | `#E4E2DC` |
| Border radius (cards) | `12px` (`rounded-xl`) |
| Border radius (pills/badges) | `9999px` (`rounded-full`) |
| Border radius (buttons/inputs) | `8–10px` (`rounded-lg` / `rounded-xl`) |

---

## 2. Color palette

### Brand & semantic colors

| Name | Hex | Usage |
|---|---|---|
| Primary blue | `#1A5FA8` | Primary buttons, links, active states |
| Primary blue (light bg) | `#E8F1FB` | Selected tab bg, info badges |
| Success green | `#0D6E4F` | In-stock badge text |
| Success green (bg) | `#E3F5EE` | In-stock badge background |
| Warning amber | `#8A4D0B` | Low-stock badge text |
| Warning amber (bg) | `#FDF0DC` | Low-stock badge background |
| Danger red | `#9B2B2B` | Out-of-stock, delete actions, errors |
| Danger red (bg) | `#FDEAEA` / `#FFF5F5` | Out-of-stock badge, alert banners |
| Muted text | `#9C9B97` | Secondary labels, placeholders |
| Body text | `#1C1B19` | Primary text |

### Category color ramps

Each product category gets a distinct color + emoji used for tag pills and card accents:

| Category | Emoji | Text color | Background | Border |
|---|---|---|---|---|
| Lights | 💡 | `#0C447C` | `#E8F1FB` | `#B8D4F5` |
| Switch Plates | 🔌 | `#3C3489` | `#EEEDFE` | `#CECBF6` |
| Smart Home | 🏠 | `#085041` | `#E3F5EE` | `#9FE1CB` |
| Hardware | 🔧 | `#712B13` | `#FAECE7` | `#F5C4B3` |
| Wall Decor | 🖼️ | `#633806` | `#FDF0DC` | `#FAC775` |
| Gym | 🏋️ | `#27500A` | `#EAF3DE` | `#C0DD97` |
| Home Decor | 🌿 | `#72243E` | `#FBEAF0` | `#F4C0D1` |

---

## 3. Typography scale

| Style | Size | Weight | Usage |
|---|---|---|---|
| Page title | 15px | 700 (bold) | Header brand name |
| Section heading | 13–14px | 600–700 | Card titles, modal headers |
| Body / label | 12–13px | 500–600 | Form labels, table headers |
| Caption / meta | 10–11px | 400–500 | Sub-category, timestamps, badges |
| Stat number | 18–20px | 700 (bold) | Dashboard stat cards |

---

## 4. Core components

### 4.1 Stat cards (dashboard header)

4-up grid on desktop, 2-up on mobile. Each card is clickable and acts as a filter.

```
┌─────────────────────┐
│ [icon]  123          │
│         Products      │
└─────────────────────┘
```

- Active/selected state: 2px colored border + tinted background
- Inactive state: 1px `#E4E2DC` border, white background
- Icon container: 36×36px rounded square, tinted to match the stat's semantic color

### 4.2 Product card (grid view)

```
┌─────────────────────────┐
│ [-25%]           [🔔]    │  ← image area, 145px tall
│        💡 (emoji          │
│      placeholder if       │
│      no image)            │
├─────────────────────────┤
│ 💡 Lights                 │  ← category pill
│ 12W LED Ceiling Light     │  ← name (bold, 12px)
│ Ceiling Lights            │  ← sub-category (muted)
│ ₨2,320  ~~₨3,200~~        │  ← price + strikethrough original
├─────────────────────────┤
│ ✓ 8 in stock              │  ← stock badge (footer)
└─────────────────────────┘
```

Hover reveals edit (✏️) and delete (🗑️) icon buttons top-right — **admin only**.

### 4.3 Product row (list view)

Table layout: thumbnail · name+meta · category pill · price · discount % · stock badge · actions. Used for dense scanning; switches via grid/list toggle in header.

### 4.4 Stock status badge

Three states, color-coded:

| State | Condition | Style |
|---|---|---|
| In stock | `stock > threshold` | Green pill, ✓ icon |
| Low stock | `0 < stock <= threshold` | Amber pill, ⚠ icon |
| Out of stock | `stock === 0` | Red pill, 📦 icon |

Threshold can be **global** (set once) or **per-product** (custom override via the bell icon popup).

### 4.5 Bell / alert popup

Click the bell icon on any product to open a panel with:
- On/off toggle for alerts on that specific product
- Custom low-stock threshold input (overrides the global default)
- Current stock readout
- Save / Cancel actions

### 4.6 Notification dropdown (header)

Bell icon in the header shows a badge count of all low/out-of-stock alert-enabled products. Clicking opens a scrollable list; clicking an item opens that product's bell popup directly. A short ring animation plays when the alert count increases.

### 4.7 Buttons

| Variant | Background | Text | Usage |
|---|---|---|---|
| Primary | `#1A5FA8` | White | Add Product, Save, Sign In |
| Secondary / outline | White | `#3E3D3A` | Cancel |
| Success / soft | `#E3F5EE` | `#085041` | Sync Store |
| Danger / soft | `#FDEAEA` | `#9B2B2B` | Delete |
| Icon-only | White / transparent | — | Refresh, grid/list toggle, edit, delete |

### 4.8 Role badges

| Role | Background | Text |
|---|---|---|
| Admin | `#FDEAEA` | `#9B2B2B` |
| User (view-only) | `#E8F1FB` | `#1A5FA8` |

Admins can add/edit/delete products, manage users, sync the store, and access invoices. Users have read-only access to the inventory list.

---

## 5. Layout patterns

### 5.1 Header (sticky)

```
[Logo]  Smart Living Pakistan     [Invoices] [Sync] [Refresh] [🔔] [Grid/List] [+Add] [👤]
```

Collapses progressively on mobile: text labels hide first, then non-essential buttons hide behind the user menu.

### 5.2 Filter bar

Search input (flex-grow) + sort dropdown, both 36px tall, sit below the stat cards.

### 5.3 Category tabs

Horizontal scrollable pill row. Each pill shows emoji + name + count badge. Active pill gets a 1.5px colored border matching its category ramp.

### 5.4 Modals / sheets

- Desktop: centered card, `rounded-2xl`, max-width 420–480px
- Mobile: bottom sheet, `rounded-t-2xl`, full width, safe-area-aware bottom padding for the iPhone home indicator

---

## 6. Pages

| Route | Purpose | Access |
|---|---|---|
| `/` | Main inventory dashboard | All authenticated users |
| `/auth` | Login / request access | Public |
| `/users` | User management (view/delete accounts) | Admin only |
| `/invoices` | Invoice list | Admin only |
| `/invoices/new` | Create invoice | Admin only |
| `/invoices/[id]` | Invoice detail | Admin only |
| `/invoice/[token]` | Public shareable invoice view | Public (token-gated) |

---

## 7. Iconography

Using [lucide-react](https://lucide.dev). Common icons in use:

`Search` `LayoutGrid` `List` `Plus` `Pencil` `Trash2` `PackageX` `AlertTriangle` `CheckCircle2` `Bell` `BellOff` `X` `Upload` `RefreshCw` `Package` `Tag` `DollarSign` `LogOut` `RefreshCcw` `Wifi` `User` `ExternalLink` `FileText` `Users` `UserX`

---

## 8. Accessibility & responsiveness notes

- All icon-only buttons carry a `title` attribute as a tooltip / accessible name.
- Toggle switches use `aria-pressed`.
- Bottom sheets and dropdowns respect `env(safe-area-inset-bottom)` for notch devices.
- Grid columns auto-fit down to `145px` minimum on small screens.
- Dropdowns reposition to `fixed` full-width sheets below `sm` breakpoint to avoid off-screen clipping.

---

## 9. Tech stack reference

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS (inline utility classes) + inline styles for dynamic/themed values
- **Backend:** Supabase (Postgres + Auth + RLS)
- **Icons:** lucide-react
- **Email:** Nodemailer (Gmail SMTP)
- **Hosting:** Vercel
- **Sync source:** `smartlivingpakistan.com` product sitemap (scraped daily via cron)

---

*Generated as a living reference — update this file whenever a new component or color is introduced.*
