# Project: EduSmart World-Class Financial Infrastructure & Kashier Integration

## Architecture
- **Backend**: Django 5.2 + Django REST Framework (Port 8000: `http://127.0.0.1:8000/api/v1`)
  - `apps.finance`: Multi-wallet ledger, Kashier payment gateway service, webhooks, checkout sessions, pricing plans, subscriptions, coupons, escrow holdings, payout pipeline, receipts/invoices.
  - `apps.activation_codes`: Voucher code generation (ES-XXXXXXXX), PIN protection, batch management, course access & wallet top-up redemption.
  - `apps.accounts` & `apps.enrollments`: Roles (student, instructor, center, super_admin), center licensing, student course enrollments.
- **Frontend**: React + Vite + TypeScript + Tailwind CSS (Port 8080: `http://localhost:8080`)
  - Complete Financial UI: Checkout modal with Kashier iFrame / popup & mobile wallet instructions, Pricing Page with Monthly/Yearly toggle, Student Balance & Wallet Dashboard with voucher redemption, Instructor Financial HQ with 14-day escrow countdown, Super-Admin Financial Control Center with Maker-Checker approval queue and financial analytics.
- **Data Flow & Consistency**:
  - Pessimistic locking (`select_for_update`) inside atomic database transactions for all wallet and ledger operations.
  - Double-entry ledger invariant: Every transaction generates balanced `LedgerEntry` records (`sum(debits) == sum(credits)`).
  - 14-day escrow holding rule: Instructor/center revenues remain in `pending_balance` for 14 days before automatic settlement into `available_balance`.
  - Maker-Checker governance: Super-admin approvals enforce `requested_by != approver` and append to `DetailedAuditLog`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Kashier Checkout Session Creation | Generates hosted iFrame / Pop-up / redirect checkout sessions with HMAC-SHA256 signature | M1 | ORIGINAL_REQUEST.md § R1 |
| 2 | Kashier Webhook Processor | Constant-time HMAC-SHA256 verification and 100% idempotent webhook reconciliation | M1 | ORIGINAL_REQUEST.md § R1 |
| 3 | Recurring Hybrid Engine | Tokenized card auto-debit on renewal dates, pre-due wallet notices, 3-day grace period | M1 | ORIGINAL_REQUEST.md § R1 |
| 4 | Multi-Wallet Model (`select_for_update`) | Pessimistic locking wallet model for Platform, Instructor, Student, Center | M2 | ORIGINAL_REQUEST.md § R2 |
| 5 | Double-Entry Financial Ledger | Balanced DEBIT/CREDIT ledger records for all sales, splits, top-ups, payouts, refunds | M2 | ORIGINAL_REQUEST.md § R2 |
| 6 | Instructor Contract Revenue Splits | Evaluates percentage/fixed/hybrid contracts, credits instructor `pending_balance` | M2 | ORIGINAL_REQUEST.md § R2 |
| 7 | Automated 14-Day Escrow Settlement | Celery task releasing matured escrow funds from `pending_balance` to `available_balance` | M2 | ORIGINAL_REQUEST.md § R2 |
| 8 | Pay-Per-Course / Exam Checkout | Single & bundle item checkout via Kashier with instant enrollment and receipt | M3 | ORIGINAL_REQUEST.md § R3 |
| 9 | SaaS Subscription Tiers | Teacher & Center monthly/yearly plans with trial periods, dunning, and B2B invoicing | M3 | ORIGINAL_REQUEST.md § R3 |
| 10 | Prepaid Digital Wallet Top-Ups | Direct student/instructor wallet charging via Kashier with instant balance allocation | M3 | ORIGINAL_REQUEST.md § R3 |
| 11 | Pay-With-Balance Checkout | Direct deduction from student `available_balance` with double-entry ledger settlement | M3 | ORIGINAL_REQUEST.md § R3 |
| 12 | Activation Codes Voucher Engine | `ES-XXXXXXXX` generation, PIN auth, batch PDF export, and wallet top-up / course redemption | M3 | ORIGINAL_REQUEST.md § R3 |
| 13 | B2B Center Bulk Licensing | Center bulk seat packs (e.g. 100 seats/pack) with license allocation management | M3 | ORIGINAL_REQUEST.md § R3 |
| 14 | Coupon & Promotions Engine | Percentage & fixed discounts, min cart amount, expiry limits, per-user limits, stackability | M3 | ORIGINAL_REQUEST.md § R3 |
| 15 | Payout Request Pipeline | Instructor & Center payout request pipeline (minimum 500 EGP) | M4 | ORIGINAL_REQUEST.md § R4 |
| 16 | Multi-Channel Disbursement | Payout execution via InstaPay (IPA/Mobile), Mobile Wallets, and Egyptian Bank Wire (IBAN) | M4 | ORIGINAL_REQUEST.md § R4 |
| 17 | Maker-Checker Governance | Super-admin approval queue enforcing `requested_by != approver` and detailed audit logs | M4 | ORIGINAL_REQUEST.md § R4 |
| 18 | Tax-Free Receipt & Invoice Generator | Standard invoices/receipts with unique ref numbers, ETA UUID, and secure signed URLs | M4 | ORIGINAL_REQUEST.md § R4 |
| 19 | Full & Partial Refund Pipeline | Ledger reversals, instructor pending clawback, enrollment revocation, gateway refund | M4 | ORIGINAL_REQUEST.md § R4 |
| 20 | Student Checkout & Payment Modal | Responsive modal with Kashier iFrame, mobile wallet instructions, coupon validator (Port 8080) | M5 | ORIGINAL_REQUEST.md § R5 |
| 21 | Pricing & Subscription Page | Modern pricing plans (Monthly/Yearly toggle), plan cards, 1-click subscription checkout (Port 8080) | M5 | ORIGINAL_REQUEST.md § R5 |
| 22 | Student Balance & Wallet Dashboard | Real-time balance view, Kashier top-up, activation code card redeemer, ledger list (Port 8080) | M5 | ORIGINAL_REQUEST.md § R5 |
| 23 | Instructor Financial Headquarters | Revenue metrics, available balance, 14-day escrow countdown, payout request modal (Port 8080) | M5 | ORIGINAL_REQUEST.md § R5 |
| 24 | Super-Admin Financial Control Center | MRR/ARR/Churn metrics, Payout Approval Queue with Maker-Checker buttons, Audit logs (Port 8080) | M5 | ORIGINAL_REQUEST.md § R5 |
| 25 | 4-Tier E2E Testing Suite | Comprehensive test suite (Tiers 1-4) with test runner, fixtures, and assertions | M-E2E | ORIGINAL_REQUEST.md § AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M-E2E | E2E Testing Suite Track | Opaque-box 4-tier E2E testing suite (Tiers 1-4, 33 tests), test runner, published `TEST_READY.md` & `TEST_INFRA.md` | none | DONE |
| M1 | Kashier Payment Gateway & Webhooks | `KashierService`, HMAC-SHA256 signature generator & validator, webhook listener, callback handler, recurring tokenization & grace period | none | DONE |
| M2 | Double-Entry Ledger, Multi-Wallet & Escrow | Multi-wallet model (`student`, `center`), pessimistic locking, double-entry ledger, `EscrowHolding` model & 14-day settlement task | M1 | DONE |
| M3 | Full Hybrid Monetization & Checkout | Pay-per-course/exam, pay-with-balance, wallet top-ups, activation code balance vouchers, B2B bulk licensing, coupon engine | M2 | DONE |
| M4 | Payout Disbursement & Maker-Checker | Payout request pipeline (>= 500 EGP, InstaPay/Mobile/Bank), Maker-Checker approvals, `DetailedAuditLog`, invoices, refund pipeline | M2, M3 | IN_PROGRESS |
| M5 | Frontend Financial UI & Final E2E Pass | Complete UI on Port 8080 (Checkout, Pricing, Wallet, Instructor HQ, Super-Admin Center), 100% E2E test pass across Tiers 1-4, Phase 2 Adversarial Hardening (Tier 5) | M-E2E, M1, M2, M3, M4 | PLANNED |

## Key Outputs
- **M-E2E**: `Backend/apps/finance/tests/` (33 tests), `TEST_READY.md`, `TEST_INFRA.md`.
- **M1**: `Backend/config/settings/base.py` (`KASHIER_*`), `Backend/apps/finance/services/kashier.py`, `Backend/apps/finance/views.py` (Kashier views), `Backend/apps/finance/urls.py`, `Backend/apps/finance/tasks.py` (recurring auto-debit, pre-due alerts, 3-day dunning), `Backend/apps/finance/tests/test_kashier_gateway.py` (20+ tests). Gate passed: 2 Reviewers Approved, 2 Challengers Approved, Forensic Auditor Clean.
- **M2**: Multi-wallet models (`student`, `center`), double-entry ledger, `EscrowHolding` 14-day settlement task. Gate passed: Hardened.
- **M3**: `apps.activation_codes` (CSPRNG `secrets`, 6-digit PIN, `pin_hash` PBKDF2, `DIGITAL_BALANCE` wallet vouchers), `apps.finance` (`BulkLicensePack`, `SeatAllocation`, `BulkLicensingService`, `CouponUsage`, unified `CouponService`). Gate passed: 2 Reviewers Approved, 2 Challengers Approved, Forensic Auditor Clean.

## Interface Contracts
### Kashier Gateway (`KashierService`)
- Hash calculation: `hmac.new(iframe_key, f"/?payment={mid}.{order_id}.{amount}.{currency}", sha256).hexdigest()`
- Callback / Webhook verification: Constant-time comparison over ordered parameter query string.
- Endpoints:
  - `POST /api/v1/finance/checkout/session/` -> `{ order_id, checkout_url, kashier_order_hash, amount, currency }`
  - `POST /api/v1/finance/webhooks/kashier/` -> `{ status: "payment_completed", transaction_id }`
  - `GET /api/v1/finance/kashier/callback/` -> Redirect to frontend `/pricing/success` or `/checkout/success`

### Multi-Wallet & Double-Entry Ledger
- `Wallet`: `wallet_type` in `["platform", "instructor", "student", "center"]`, `current_balance`, `pending_balance`, `available_balance`, `withdrawn_balance`.
- Invariant: `sum(entries.filter(entry_type="debit").amount) == sum(entries.filter(entry_type="credit").amount)`
- 14-day Escrow: `EscrowHolding` with `mature_at = created_at + 14 days`, released via `settle_escrow_balances_task`.

### Payout & Maker-Checker
- `PayoutRequest`: `amount >= 500.00`, `channel` in `["instapay", "mobile_wallet", "bank_wire"]`, `status` in `["pending", "approved", "rejected", "processed"]`.
- Maker-Checker: Approver super-admin != Request creator (`requested_by`). Logs entry to `DetailedAuditLog`.

## Code Layout
- Backend:
  - `Backend/apps/finance/models.py`: Core financial, wallet, ledger, subscription, payout, escrow, and audit models.
  - `Backend/apps/finance/services.py` & `Backend/apps/finance/services/kashier.py`: Kashier, ledger, and payout services.
  - `Backend/apps/finance/views.py`: REST API endpoints.
  - `Backend/apps/finance/tasks.py`: Celery background tasks (escrow settlement, dunning).
  - `Backend/apps/finance/urls.py`: URL routing under `/api/v1/finance/`.
  - `Backend/apps/activation_codes/`: Code batching, validation, redemption.
  - `Backend/apps/finance/tests/`: Comprehensive 4-Tier E2E test suite (33 test cases) + `test_kashier_gateway.py`.
- Frontend:
  - `Frontend/src/pages/Pricing.tsx`: Public pricing and subscription plans (Port 8080).
  - `Frontend/src/pages/student/StudentWalletPage.tsx`: Student balance, top-up modal, code activation (Port 8080).
  - `Frontend/src/pages/instructor/InstructorEarnings.tsx`: Instructor Financial Headquarters (Port 8080).
  - `Frontend/src/pages/super-admin/SuperAdminFinancials.tsx`: Super-Admin Financial Control Center (Port 8080).
  - `Frontend/src/components/finance/CheckoutModal.tsx`: Kashier modal & wallet payment options (Port 8080).
