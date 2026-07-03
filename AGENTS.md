# Session Context

## Goal
Build full notification system, add "Load More" + search across tables, fix PostgreSQL compatibility bugs (boolean vs int, audit logs), implement tenant-customizable sidebar labels, and improve phone input with country picker.

## Constraints & Preferences
- `btn-primary` must use tenant's primary color (`var(--primary-600)`) not green
- "Load More" after 35 rows as default table experience; pagination only when server-side totalPages provided
- `searchable={true}` + `searchKeys` on every table for client-side search
- Notification system: per-tenant, polls every 30s, dropdown with badge count, mark-all-read
- Audit `actor_name` must come from JWT `name` field (was missing)
- `created_at` must be explicitly set in INSERT (PostgreSQL default was broken)
- `boolean = integer` comparisons fail in PostgreSQL — use `= false` / `= true`
- Sidebar labels (My Ledger Book, My Business, My HR) configurable from Settings; stable internal keys preserved
- Phone input: `react-phone-number-input` with country flag selector, E.164 output, `isValidPhoneNumber` validation, country prefill by priority (stored > tenant settings > system country code > browser locale > 'KW')
- `is_read` is SMALLINT not boolean — `= 0/1` comparisons are fine for that column

## Done
- **Loading component** (`src/components/Loading.jsx`): SVG arc spinner using `var(--primary-600)`, used by `ResponsiveTable.jsx`
- **Loading states wired to tables** (11 pages): Invoices, PurchaseOrders, Suppliers, Customers, BalanceSheet, AdvancePayments, LeaveApprovals, Replacements, PayrollConsole, Employees, KiranaStore — added `loading` state + `loading={loading}` prop
- **Button color fixed**: `btn-primary` from `var(--secondary, green)` → `var(--primary-600, navy)`. Hover uses `var(--primary-700)`, focus ring uses `var(--primary-500)`
- **"Load More" + Search** in `ResponsiveTable.jsx`: incremental mode default (35 rows, "Load More" button), pagination mode when `totalPages > 1`, `searchable` prop with client-side filter over `searchKeys`
- **`searchable` + `searchKeys` added to 11 table pages** with appropriate column keys; fetch limits bumped 15→200 for Invoices, PurchaseOrders, Suppliers, Customers
- **Notification system backend**: migration `20260626_add_notifications.sql` (UUID PK, tenant_id, recipient_id, title, message, type, is_read SMALLINT, created_at DEFAULT CURRENT_TIMESTAMP), `utils/notify.js` (`create()` + `notifyAdmins()`), controller (`getNotifications`, `markAsRead`, `markAllAsRead`), routes registered at `/api/v1/core/notifications`
- **Notification triggers**: leave apply → `notifyAdmins()`, leave approve/reject → `create()` to employee; advance request → `notifyAdmins()`, advance approve/reject → `create()` to employee; replacement create → `create()` to both permanent and adhoc employees
- **Notification system frontend**: `hr.service.js` — `getNotifications()`, `markNotificationRead(id)`, `markAllNotificationsRead()`. `NotificationBell.jsx` — polls every 30s, badge count, dropdown. Wired into `AdminLayout.jsx`
- **Audit log JWT fix**: Added `name` to JWT sign payload in `auth.controller.js`
- **Audit `created_at` fix**: Changed INSERT to explicitly pass `NOW()`. Added `ALTER COLUMN SET DEFAULT CURRENT_TIMESTAMP`. Backfilled null records
- **PostgreSQL boolean fix**: Changed `verified = 0/1` → `verified = false/true` in `otp.controller.js` and `auth.controller.js`
- **Custom sidebar labels**: Settings.jsx — `groupLabels` state, 3 text inputs, saved to backend + localStorage. AdminLayout.jsx — `labelOf(key)` helper, sidebar headers and page titles use custom labels
- **Phone input component** (`src/components/PhoneInput.jsx`): wraps `react-phone-number-input`, E.164 output, validation, country flag selector, `getInitialCountry()` with fallback priority
- **Backend phone validation** (`hris-backend/utils/phone.js`): `validateE164()` using `libphonenumber-js`, integrated into OTP controller (sendOtp, verifyOtp) and auth controller (registerTenant)
- **Geo country endpoint** (`GET /api/v1/public/country`): returns best country from system settings, used by `auth.service.js` `getGeoCountry()`
- **Login.jsx phone input upgrade**: replaced raw `<input type="tel">` with `<PhoneField>` in both login and forgot-password flows, with `isValidPhoneNumber` validation
- **Login redirect fixed (Jul 3)**: Login.jsx now navigates directly based on API response's `subscriptionPlan` (avoids React state timing race). PublicRoute.jsx updated to use plan-aware routing instead of hardcoded `/admin/ledger` — eliminating the race where PublicRoute's `<Navigate to="/admin/ledger" />` fired alongside Login.jsx's redirect in the same render cycle.

## In Progress
- (none)

## Key Decisions
- Internal sidebar group keys (used for `hiddenGroups`, `openGroups`, `pageTitles`) remain the original English labels; only visible text uses `labelOf()` lookup
- `is_read` left as SMALLINT (not boolean) in notifications table
- Phone country detection prioritizes explicit user choice (localStorage) over automatic detection
- Notification system uses 30s polling instead of WebSocket for simplicity

## Next Steps
1. Run migration `20260626_add_notifications.sql` on production DB if not already applied

## Subscription System (Phase 1-2 Complete)

### Pricing
| Plan | Price | Target |
|------|-------|--------|
| Free | ₹0 | Solo entrepreneurs (50 customers, 2 staff, 500 txns/mo) |
| Business | ₹999/yr (₹83/mo) | Growing teams (unlimited customers/staff, invoices, payroll) |
| Pro | ₹2,499/yr (₹208/mo) | Established businesses (inventory, 5 branches, WhatsApp, API) |

### Database (PostgreSQL)
- `subscription_plans` — seed data with JSONB feature maps
- `subscriptions` — per-tenant active/trialing/expired with period tracking
- `payments` — Razorpay order/payment records
- `tenant_feature_overrides` — promo overrides per feature
- Migration renames legacy plans: `pro→business`, `enterprise→pro`, backfills 9 tenants

### Backend Endpoints (`/api/v1/core/subscription`)
| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /plans` | Tenant header | List plans with features + prices |
| `GET /plan` | JWT | Current plan + feature limits + usage |
| `GET /check-feature?feature=invoices` | JWT | Granular feature check |
| `POST /create-order` | JWT | Create Razorpay order |
| `POST /verify-payment` | JWT | Verify + activate subscription |
| `POST /start-trial` | JWT | 14-day trial |
| `POST /webhook` | Signature | Async payment confirmation |

### Backend Files
- `migrations/20260701_add_subscription_infrastructure.sql` — full schema
- `utils/subscription.js` — `canAccess()`, `getSubscriptionStatus()`, `planRank()` with legacy compat
- `middleware/planGate.js` — updated ranks (free=0, business=1, pro=2)
- `controllers/subscription.controller.js` — full Razorpay integration
- `routes/subscription.routes.js` — all subscription endpoints

### Frontend Files
- `src/hooks/useFeature.js` — `useFeature(featureKey)` + `useUpgradeTrigger()`
- `src/services/subscription.service.js` — API methods for all subscription endpoints
- `src/components/UpgradeModal.jsx` — Razorpay checkout modal with trial option
- `src/components/PlanRoute.jsx` — route guard (updated for new plan names)
- `src/pages/landing/Pricing.jsx` — full pricing page with FAQ
- `src/layouts/AdminLayout.jsx` — plan badge, upgrade button, sidebar gating updated

### Key Decisions
- Annual-only billing (simpler, higher retention for Indian SMBs)
- No credit card required for trial
- Data preserved on downgrade (soft lock)
- Old plan names (`pro`, `enterprise`) still work via backward-compat mapping
- Razorpay checkout.js loaded from CDN in index.html

## Next Steps (Phase 3-5)
1. Add usage-based upgrade nudges to specific pages (Customers 80% limit, Invoices paywall)
2. Set up email notifications for expiry/trial end
3. Referral program
4. Seasonal discount campaigns
5. Analytics on conversion

## Critical Context
- JWT payload now includes `name` — existing tokens without `name` will still work but `actor_name` in audit logs will be null until re-login
- Server restart after backend changes: `lsof -ti :5001 | xargs kill -9; sleep 1; nohup node server.js > /tmp/backend.log 2>&1 &`
- `react-phone-number-input` CSS imported in `PhoneInput.jsx`; custom overrides use inline `<style>` tag

## Relevant Files
- `hris-frontend/src/components/PhoneInput.jsx`: country phone picker
- `hris-backend/utils/phone.js`: E.164 validation
- `hris-backend/controllers/otp.controller.js`: phone validation integrated
- `hris-backend/controllers/auth.controller.js`: phone validation integrated
- `hris-backend/server.js`: `/api/v1/public/country` endpoint
- `hris-frontend/src/pages/auth/Login.jsx`: PhoneField in login + forgot-password
- `hris-frontend/src/pages/auth/Register.jsx`: PhoneField in phone step
- `hris-frontend/src/pages/admin/Employees.jsx`: PhoneField in onboard/edit form
- `hris-frontend/src/services/auth.service.js`: `getGeoCountry()` added
