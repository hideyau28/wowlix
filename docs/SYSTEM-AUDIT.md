# WoWlix (hk-marketplace) — System Audit

> Generated: 2026-02-16

---

## A. AUTH 系統

### Auth 方案
✅ **自己寫（Custom）** — 冇用 NextAuth / Auth.js。兩套獨立 auth 系統：

| 系統 | 用途 | Library | Cookie |
|------|------|---------|--------|
| Customer auth | 買家 OTP 登入 | `jose` (HS256 JWT) | `hk_session` |
| Tenant Admin auth | 店主 email/password + OAuth | `jsonwebtoken` | `tenant-admin-token` + `admin_session` |

### Login Providers

| Provider | 狀態 | 檔案 |
|----------|------|------|
| Email + Password | ✅ 正常運作 | `app/api/tenant/login/route.ts`, `app/api/tenant/register/route.ts` |
| Google OAuth | ✅ 有完整 code | `app/api/tenant-admin/google/route.ts`, `app/api/tenant-admin/google/callback/route.ts` |
| Facebook OAuth | ✅ 有完整 code | `lib/auth/facebook.ts`, `app/api/tenant-admin/facebook/route.ts`, `app/api/tenant-admin/facebook/callback/route.ts` |
| Phone OTP (Customer) | ✅ 有完整 code | `lib/auth.ts`, `app/api/auth/send-otp/route.ts`, `app/api/auth/verify-otp/route.ts` |

### Google OAuth Client ID
✅ 透過 env var `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` 設定（`.env.example:33-34`）

### Facebook OAuth
✅ 完整運作 — `lib/auth/facebook.ts` 有 `getFacebookAuthURL()`, `exchangeCodeForToken()`, `getFacebookUser()`
- Env vars: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`（`.env.example:37-38`）

### Auth Callback / Redirect
- Google: `app/api/tenant-admin/google/callback/route.ts` — exchange code → find/create TenantAdmin → set JWT cookies → redirect to admin
- Facebook: `app/api/tenant-admin/facebook/callback/route.ts` — same pattern

### Session 管理
✅ **JWT-based**（冇用 DB session）
- Customer: `jose` library, cookie `hk_session`, 7 day expiry（`lib/auth.ts:10`）
- Admin: `jsonwebtoken` library, cookie `tenant-admin-token`, 7 day expiry（`lib/auth/jwt.ts:19`）
- Admin 另有 `admin_session` cookie（middleware guard 用）, 24h expiry

### Auth Middleware
✅ `middleware.ts:142-157`
- 保護所有 `/{locale}/admin/*` routes（除咗 `/admin/login`）
- 檢查 `admin_session` 或 `tenant-admin-token` cookie
- 冇 cookie → redirect 去 `/{locale}/admin/login`
- 已登入用戶訪問 login page → redirect 去 `/{locale}/admin`（`middleware.ts:160-168`）

### 新用戶註冊流程
✅ 自動建立 Tenant + TenantAdmin（`app/api/tenant/register/route.ts`）
- 一個 API call 建立：Tenant → TenantAdmin → TenantPaymentConfig → StoreSettings
- 自動 set `admin_session` + `tenant-admin-token` cookies（auto-login）
- 有 manual rollback：如果 admin 建立失敗會 delete tenant（`:103-107`）

### ⚠️ 安全風險（已修正）
- ~~`lib/auth.ts:42` — OTP hardcode `"123456"` always accepted~~ ✅ 已移除（Stream 1）
- ~~`lib/auth.ts:6-7` — JWT secret 有 hardcoded fallback~~ ✅ 已改為 lazy check（Stream 1）
- OTP 儲存用 in-memory Map（`lib/auth.ts:26`），server restart 會失效
- 冇 rate limiting 喺 register/login endpoints

---

## B. ROUTING + 頁面結構

### App Route Tree
```
app/
├── [locale]/
│   ├── (admin)/admin/
│   │   ├── page.tsx                     # Dashboard
│   │   ├── login/page.tsx               # Admin login
│   │   ├── products/page.tsx            # Product management
│   │   ├── orders/page.tsx              # Order management
│   │   ├── orders/[id]/page.tsx         # Order detail
│   │   ├── customers/page.tsx           # Customer list
│   │   ├── customers/[phone]/page.tsx   # Customer detail
│   │   ├── payments/page.tsx            # Payment methods
│   │   ├── coupons/page.tsx             # Coupon management
│   │   ├── billing/page.tsx             # Subscription billing
│   │   ├── homepage/page.tsx            # Homepage CMS
│   │   ├── logs/page.tsx                # Admin logs
│   │   ├── settings/page.tsx            # Store settings
│   │   └── settings/payments/page.tsx   # Payment settings
│   │
│   ├── (customer)/
│   │   ├── page.tsx                     # Store homepage
│   │   ├── products/page.tsx            # Product listing
│   │   ├── product/[id]/page.tsx        # Product detail
│   │   ├── categories/[slug]/page.tsx   # Category page
│   │   ├── collections/page.tsx         # Collections
│   │   ├── search/page.tsx              # Search
│   │   ├── cart/page.tsx                # Cart
│   │   ├── checkout/page.tsx            # Checkout
│   │   ├── orders/page.tsx              # Order list
│   │   ├── orders/[id]/page.tsx         # Order detail
│   │   ├── profile/page.tsx             # Profile
│   │   ├── profile/orders/page.tsx      # Profile orders
│   │   ├── login/page.tsx               # Customer login
│   │   ├── track/page.tsx               # Order tracking
│   │   ├── terms/page.tsx               # Terms of Service
│   │   └── privacy/page.tsx             # Privacy Policy
│   │
│   ├── (marketing)/
│   │   └── pricing/page.tsx             # Pricing page
│   │
│   ├── start/page.tsx                   # Onboarding wizard
│   └── [slug]/page.tsx                  # Bio Link storefront
│
├── not-found.tsx                         # Global 404
├── error.tsx                             # Global 500
└── api/                                  # (see API routes below)
```

### Key URLs
| 功能 | URL |
|------|-----|
| Admin 入口 | `/{locale}/admin` |
| Onboarding | `/{locale}/start` |
| 商店前台 | `/{locale}/` (subdomain) 或 `/{slug}` (path) |
| Landing page | `wowlix.com` / `www.wowlix.com`（bare domain） |
| Pricing | `/{locale}/pricing` |
| Checkout | `/{locale}/checkout` |
| Bio Link | `/{locale}/{slug}` |

### API Routes（完整列表）

**Auth**
- `POST /api/auth/send-otp` — 發送 OTP
- `POST /api/auth/verify-otp` — 驗證 OTP
- `GET /api/auth/me` — 當前用戶
- `GET /api/auth/orders` — 用戶訂單
- `POST /api/auth/logout` — 登出
- `GET|PATCH /api/auth/profile` — 用戶 profile

**Tenant Admin Auth**
- `POST /api/tenant/register` — 註冊（建 Tenant + Admin）
- `POST /api/tenant/login` — 登入
- `POST /api/tenant/check-slug` — 檢查 slug
- `GET /api/tenant/branding` — 品牌設定
- `POST /api/tenant-admin/login` — 舊版 admin 登入
- ~~`POST /api/tenant-admin/register`~~ — **已移除**（零認證孤兒 route，任何人用公開 tenantId 可建立 victim admin 接管商戶；正常 onboarding 行 `/api/tenant/register`）
- `POST /api/tenant-admin/logout` — Admin 登出
- `GET /api/tenant-admin/me` — 當前 admin
- `GET|PATCH /api/tenant-admin/account` — Admin 帳號
- `GET /api/tenant-admin/google` — Google OAuth start
- `GET /api/tenant-admin/google/callback` — Google OAuth callback
- `GET /api/tenant-admin/facebook` — Facebook OAuth start
- `GET /api/tenant-admin/facebook/callback` — Facebook OAuth callback

**Admin CRUD**
- `GET|POST /api/admin/products` — 產品 CRUD
- `GET|PATCH|DELETE /api/admin/products/[id]` — 單個產品
- `POST /api/admin/products/reorder` — 產品排序
- `POST /api/admin/products/import` — CSV 匯入
- `GET /api/admin/products/csv-template` — CSV 模板下載
- `GET|POST /api/admin/products/[id]/variants` — 變體管理
- `PATCH|DELETE /api/admin/products/[id]/variants/[variantId]`
- `POST /api/admin/products/[id]/variants/sync`
- `GET|POST /api/admin/orders/[id]/confirm-payment`
- `GET /api/admin/orders/count`
- `GET /api/admin/orders/export` — CSV 導出
- `GET|POST /api/admin/coupons` + `/[id]`
- `GET|POST /api/admin/categories` + `/[id]`
- `GET|POST /api/admin/badges` + `/[id]`
- `GET|POST /api/admin/attributes` + `/[id]`
- `GET|POST /api/admin/payment-config` + `/[providerId]`
- `GET|POST /api/admin/payments`
- `GET /api/admin/customers` + `/[phone]`
- `GET|PATCH /api/admin/tenant-settings`
- `GET /api/admin/plan`
- `GET /api/admin/billing`
- `POST /api/admin/select-tenant`
- `GET /api/admin/tenants`
- `POST /api/admin/login` — 舊版 basic auth
- `POST /api/admin/logout`
- `POST /api/admin/upload`

**Admin Analytics**
- `GET /api/admin/analytics/daily`
- `GET /api/admin/analytics/summary`
- `GET /api/admin/analytics/top-products`

**Admin Subscription**
- `POST /api/admin/subscription/checkout` — Stripe Checkout
- `POST /api/admin/subscription/portal` — Customer Portal

**Public Storefront**
- `GET /api/products` — 產品列表
- `GET /api/products/filter-counts`
- `GET /api/products/filter-options`
- `GET /api/categories`
- `GET /api/store-settings`
- `GET /api/payment-config`
- `GET /api/payment-methods` + `/[id]`
- `GET /api/top-sellers`
- `POST /api/coupons/validate`
- `GET /api/features/coupon`

**Orders**
- `POST /api/orders` — 落單
- `POST /api/biolink/orders` — Bio Link 落單
- `GET /api/orders/search`
- `GET|PATCH /api/orders/[id]`
- `POST /api/orders/[id]/payment` — 上傳付款證明
- `GET /api/orders/[id]/track`
- `POST /api/orders/[id]/notes`

**Checkout & Stripe**
- `POST /api/checkout/session` — Stripe Checkout Session
- `POST /api/stripe/webhook` — 付款 webhook
- `POST /api/stripe/subscription-webhook` — 訂閱 webhook

**Other**
- `POST /api/upload` — 圖片上傳
- `GET /api/address/lookup`
- `GET|POST /api/homepage/sections` + `/[id]`
- `GET|POST /api/homepage/banners` + `/[id]`

### Middleware
✅ `middleware.ts`（188 行）
- Tenant slug 解析（subdomain / header / query param）
- Platform bare domain 偵測（wowlix.com → landing page）
- Path-based slug routing（`/{slug}` → `/en/{slug}` rewrite）
- Admin auth guard（check cookies → redirect to login）
- 所有 request 設 `x-tenant-slug` header

---

## C. DATABASE / PRISMA

### Schema 檔案
✅ `prisma/schema.prisma`（557 行）

### 所有 Models

| Model | 用途 | 欄位數 | Tenant-scoped |
|-------|------|--------|---------------|
| `Tenant` | 商店/租戶 | 44 fields | — (root) |
| `TenantAdmin` | 店主帳號 | 8 fields | ✅ |
| `Product` | 產品 | 25 fields | ✅ |
| `ProductVariant` | 產品變體 | 14 fields | ✅ |
| `Order` | 訂單 | 30+ fields | ✅ |
| `PaymentAttempt` | Stripe 付款嘗試 | 16 fields | via Order |
| `User` | 買家 | 8 fields | ✅ |
| `Category` | 產品分類（tree） | 11 fields | ✅ |
| `Badge` | 產品標籤 | 7 fields | ✅ |
| `Coupon` | 優惠券 | 11 fields | ✅ |
| `StoreSettings` | 店鋪設定 | 23 fields | ✅ |
| `HomepageSection` | 首頁區塊 | 12 fields | ✅ |
| `HomepageBanner` | 首頁 Banner | 11 fields | ✅ |
| `PaymentMethod` | 付款方式（舊） | 9 fields | ✅ |
| `TenantPaymentConfig` | 付款設定（新） | 8 fields | ✅ |
| `AttributeDefinition` | 產品屬性定義 | 9 fields | ✅ |
| `SiteContent` | 網站內容 | 13 fields | ✅ |
| `AdminLog` | 管理日誌 | 8 fields | ✅ |
| `IdempotencyKey` | 防重複提交 | 8 fields | ✅ |

### Enums
- `OrderStatus`: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, COMPLETED, CANCELLED, REFUNDED + legacy (PAID, FULFILLING, DISPUTED)
- `FulfillmentType`: PICKUP, DELIVERY
- `PaymentProvider`: STRIPE
- `PaymentAttemptStatus`: CREATED, REQUIRES_ACTION, PROCESSING, SUCCEEDED, FAILED, CANCELLED, REFUNDED, DISPUTED
- `CouponDiscountType`: PERCENTAGE, FIXED

### Tenant model 有 pluginType
✅ 確認 — `prisma/schema.prisma:344`: `pluginType String @default("mini-store")`

### Seed 檔案
✅ `scripts/seed-products.ts`（透過 `npm run db:seed`）

### Chassis vs E-commerce Models
| Chassis（共用） | E-commerce 專用 |
|-----------------|----------------|
| Tenant, TenantAdmin | Product, ProductVariant |
| StoreSettings | Order, PaymentAttempt |
| AdminLog | HomepageSection, HomepageBanner |
| IdempotencyKey | Category, Badge, Coupon |
| SiteContent | PaymentMethod, TenantPaymentConfig |
| User | AttributeDefinition |

---

## D. TENANT 系統

### Tenant Resolution 完整流程
✅ `middleware.ts` → `lib/tenant.ts`

1. **Middleware**（`middleware.ts:85-182`）
   - 從 hostname 解析 subdomain（`resolveSlugFromHostname()`）
   - Dev fallback: `?tenant=` query param（localhost only）
   - Platform bare domain（wowlix.com）→ `DEFAULT_SLUG`
   - Path-based slug（`/{slug}` → rewrite to `/en/{slug}`）
   - 設定 `x-tenant-slug` header

2. **API / Server Component**（`lib/tenant.ts`）
   - `resolveTenant(req)`: Priority: x-tenant-slug header → hostname → ?tenant= → DEFAULT_SLUG
   - `getTenantId(req)`: x-tenant-id header → JWT token → resolveTenant fallback
   - `getServerTenantId()`: 從 next/headers 讀 x-tenant-slug
   - `getAdminTenantId()`: 只從 JWT cookie 讀（冇 fallback）

### DEFAULT_SLUG Fallback
✅ `DEFAULT_SLUG = "maysshop"`（`lib/tenant.ts:16`, `middleware.ts:4`）
- 用於：冇 subdomain / bare domain / localhost
- `DEFAULT_HOSTS`: `["hk-marketplace", "www", "localhost", "127.0.0.1"]`

### Tenant Isolation
✅ 所有 model 都有 `tenantId` field + `@@index([tenantId])`
- Admin API 全部用 `getAdminTenantId()`（從 JWT 讀）
- Public API 用 `getTenantId(req)` / `resolveTenant(req)`

### 新 Tenant 建立
✅ 透過 Onboarding API — `POST /api/tenant/register`

### Tenant Settings
✅ `StoreSettings` model + `Tenant` model 合併
- 可改：店名、WhatsApp、Instagram、Logo、Tagline、Template、Brand Color
- 送貨設定：SF Locker fee、Home Delivery fee、Free shipping threshold
- 付款設定：FPS、PayMe、Stripe Connect
- 進階：Custom domain、Hide branding（plan-gated）

---

## E. PLAN + FEATURE GATING

### Plan 定義

| Plan | maxSku | maxOrders/月 | Features |
|------|--------|-------------|----------|
| Free | 10 | 50 | （無） |
| Lite | 50 | ∞ | whatsapp, coupon, csv_export, analytics |
| Pro | ∞ | ∞ | 以上全部 + cart_recovery, crm, top_sellers, custom_domain, remove_branding, multi_staff |

### checkPlanLimit() 邏輯
✅ `lib/plan.ts:133-158`
- `sku`: count active products vs `maxSku`
- `orders`: count current month orders vs `maxOrdersPerMonth`
- Returns `{ allowed, current, limit }`

### hasFeature() 邏輯
✅ `lib/plan.ts:164-170`
- `getPlan(tenantId)` → check `limits.features.includes(feature)`
- 考慮 plan expiry + grace period

### Plan 升級 / 降級
✅ 透過 Stripe Subscription
- 升級：`POST /api/admin/subscription/checkout` → Stripe Checkout → webhook 更新 plan
- 降級：subscription.deleted webhook → set grace period (7 days) → 到期後降 free
- Customer Portal：`POST /api/admin/subscription/portal` → Stripe Portal

---

## F. STRIPE BILLING

### Stripe Env Vars
| Env Var | 用途 |
|---------|------|
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_PUBLISHABLE_KEY` | Client-side key |
| `STRIPE_WEBHOOK_SECRET` | Order payment webhook |
| `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` | Subscription webhook |
| `STRIPE_PRICE_LITE_MONTHLY` | Lite plan Price ID |
| `STRIPE_PRICE_PRO_MONTHLY` | Pro plan Price ID |

### Stripe Checkout Session
✅ `lib/stripe-subscription.ts:89-116`
- `createSubscriptionCheckout()` — mode: "subscription", metadata: { tenantId }
- Price IDs 從 env var 讀

### Webhook Handler
✅ `app/api/stripe/subscription-webhook/route.ts`（267 行）

| Event Type | 處理邏輯 |
|------------|----------|
| `checkout.session.completed` | 設定 plan, stripeCustomerId, stripeSubscriptionId, planStartedAt |
| `invoice.paid` | 續費成功 — 更新 planExpiresAt, 清除 grace period |
| `invoice.payment_failed` | 設定 7 日 grace period |
| `customer.subscription.updated` | 升降級 — 更新 plan + planExpiresAt |
| `customer.subscription.deleted` | 設定 grace period, 清除 subscriptionId |

### Billing Page
✅ `app/[locale]/(admin)/admin/billing/page.tsx`

### Customer Portal
✅ `lib/stripe-subscription.ts:122-134` — `createCustomerPortalSession()`

---

## G. STOREFRONT（前台）

### 商店首頁
✅ `app/[locale]/(customer)/page.tsx` — full store mode homepage
✅ `app/[locale]/[slug]/page.tsx` — Bio Link storefront

### 產品列表頁
✅ `app/[locale]/(customer)/products/page.tsx`

### 產品詳情頁
✅ `app/[locale]/(customer)/product/[id]/page.tsx`

### Template System（4 款主題）
✅ `lib/cover-templates.ts`（147 行）
- 4 templates: **noir**（暗黑）, **linen**（棉麻）, **mochi**（抹茶, default）, **petal**（花瓣）
- Context API: `lib/template-context.tsx` → `useTemplate()` hook

---

## H. CART + CHECKOUT

### Cart 狀態管理
✅ **React state**（component-level）

### Cart Drawer
✅ `components/biolink/CartSheet.tsx`

### Checkout 頁面
✅ `components/biolink/CheckoutPage.tsx`

### Payment Methods 顯示邏輯
✅ 先 fetch API（new TenantPaymentConfig），失敗就 fallback 到 legacy Tenant flags

### Order 建立流程
✅ `POST /api/biolink/orders` (Bio Link) / `POST /api/orders` (Full Store)

---

## I. ADMIN DASHBOARD

### Sidebar Items
✅ `app/[locale]/(admin)/admin/admin-sidebar.tsx`

| Item | Route | Biolink Mode |
|------|-------|-------------|
| Dashboard | `/admin` | ✅ |
| Products | `/admin/products` | ✅ |
| Homepage Management | `/admin/homepage` | ❌ fullstore only |
| Orders | `/admin/orders` | ✅ |
| Customers | `/admin/customers` | ✅ |
| Payments | `/admin/payments` | ❌ fullstore only |
| Coupons | `/admin/coupons` | ❌ fullstore only |
| Billing | `/admin/billing` | ✅ |
| Logs | `/admin/logs` | ❌ fullstore only |
| Settings | `/admin/settings` | ✅ |

---

## J. ONBOARDING

### OnboardingWizard
✅ `components/onboarding/OnboardingWizard.tsx`

### 步驟（5 步）

| Step | 內容 |
|------|------|
| 1. Plan Selection | Free/Lite/Pro 三個 plan 選擇 |
| 2. Store Info + Account | 店名、slug、email、password、WhatsApp、Instagram |
| 3. Theme Selection | 4 templates + optional tagline |
| 4. Payment Methods | FPS/PayMe/AlipayHK/Bank Transfer 多選 |
| 5. Completion | 恭喜頁面、store link、upgrade CTA |

---

## K. MARKETING PAGES

### LandingPage
✅ `components/marketing/LandingPage.tsx`

| Section | 內容 |
|---------|------|
| 1. Navigation | Logo + Pricing link + Start Free CTA |
| 2. Hero | "One Link · Turn Followers into Sales" + phone mockup |
| 3. How It Works | 3 steps: Photo → Payments → IG Bio |
| 4. Pain Points | Problem/solution cards |
| 5. Features Grid | 4 feature cards |
| 6. Mini Plan Preview | Free/Lite/Pro pricing cards |
| 7. Templates + Trust | 4 theme previews + 3 trust signals |
| 8. Final CTA | "Still using Google Forms?" |
| 9. Footer | Links: Pricing, Terms, Privacy |

### PricingPage
✅ `app/[locale]/(marketing)/pricing/page.tsx`

---

## L. i18n + SEO

### i18n 設定
✅ `lib/i18n.ts`
- **Locales**: `zh-HK`（繁體中文）, `en`（English）
- **Library**: Custom dictionary-based

### SEO
- ✅ robots.txt
- ✅ Dynamic sitemap（Stream 2 改為 app/sitemap.ts）
- ✅ OG Tags（Stream 2 加入）

---

## M. 錯誤處理 + QUALITY

### 404 / 500 Pages
✅ `app/not-found.tsx` + `app/[locale]/not-found.tsx`
✅ `app/error.tsx` + `app/[locale]/error.tsx`

### API Error Format
✅ `{ ok: boolean, error?: { code, message }, data?: {...} }`

---

## N. DEPENDENCIES + CONFIG

### 主要 Dependencies

| Package | Version | 用途 |
|---------|---------|------|
| next | 16.1.4 | Framework |
| react / react-dom | 19.2.3 | UI |
| @prisma/client | ^7.3.0 | ORM |
| stripe | ^20.2.0 | Payments |
| recharts | ^3.7.0 | Charts |
| framer-motion | ^12.29.0 | Animations |
| lucide-react | ^0.563.0 | Icons |

### Deployment
✅ `vercel.json` — Region: `hkg1`（Hong Kong）

---

## O. BUILD + TEST

### npm run ci:build
✅ `npx prisma generate && npm run build`

### Tests
- ✅ Smoke tests（6 scripts）
- ✅ E2E checklist（5 endpoint checks）
- ❌ 冇 unit tests
- ❌ 冇 E2E tests（Playwright / Cypress）

---

## P. 已知技術債 + 風險

| 風險 | 嚴重程度 | 狀態 |
|------|----------|------|
| ~~OTP hardcode bypass "123456"~~ | ~~🔴 High~~ | ✅ 已修正 |
| ~~JWT secret hardcoded fallback~~ | ~~🔴 High~~ | ✅ 已修正 |
| In-memory OTP store | 🟡 Medium | 待處理 |
| 冇 rate limiting | 🟡 Medium | 待處理 |
| ~~Sitemap hardcoded domain~~ | ~~🟡 Medium~~ | ✅ 已修正 |
| ~~冇 OG tags~~ | ~~🟡 Medium~~ | ✅ 已加入 |
| 2 套 JWT library | 🟢 Low | 技術債 |
| 冇 unit/E2E tests | 🟡 Medium | 待處理 |
| TypeScript `any` types | 🟢 Low | 部分已修正 |
| ~~console.log 殘留~~ | ~~🟡 Medium~~ | ✅ 已清理 |
