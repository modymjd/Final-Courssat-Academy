# EduSmart Financial Infrastructure & Kashier Payment Gateway Test Architecture

## 1. Executive Summary & Overview
This document formalizes the End-to-End (E2E) Test Architecture for the EduSmart Financial Infrastructure and Kashier Payment Gateway integration. The test suite operates under the strict rules of the **EduSmart Engineering Constitution** (06-Quality Gates & 07-Definition of Done), providing automated, non-flaky, deterministic verification of every monetary flow, ledger invariant, webhook reconciliation, and security rule.

---

## 2. 4-Tier Test Architecture Taxonomy

```
+-----------------------------------------------------------------------------------------------+
|                                      4-TIER TEST SUITE                                        |
+-----------------------------------------------------------------------------------------------+
| TIER 1: Feature Coverage (Functional Baseline)                                                |
|   - Pay-per-course & exam checkout via Card/Meeza/Kashier                                     |
|   - Student prepaid digital wallet top-up & pay-with-balance                                  |
|   - Teacher & Center SaaS subscription billing cycles                                         |
|   - Activation code batch generation (ES-XXXXXXXX) & redemption                               |
|   - Multi-channel payout request pipeline & Super-Admin Maker-Checker                         |
+-----------------------------------------------------------------------------------------------+
| TIER 2: Boundary & Corner Cases (Security, Integrity, Limits)                                  |
|   - Webhook HMAC-SHA256 signature tampering & replay attack defense                           |
|   - Idempotency enforcement & duplicate webhook delivery protection                          |
|   - High-precision decimal arithmetic (Decimal("0.01")) & 14% VAT compliance                 |
|   - Minimum withdrawal threshold enforcement (< 500 EGP)                                      |
|   - Maker-Checker self-approval prevention (requested_by != approver)                         |
|   - Zero-cost & 100% coupon discount checkout                                                 |
|   - Multi-wallet pessimistic locking & non-negative balance constraints                       |
|   - Over-limit & expired coupon validation                                                    |
|   - Subscription dunning & 3-day grace period lifecycle                                      |
|   - Activation code brute-force protection & invalid PIN rejection                            |
+-----------------------------------------------------------------------------------------------+
| TIER 3: Cross-Feature Interactions (Lifecycle State Transitions)                              |
|   - Sale -> 14-Day Escrow Holding -> Release -> Payout -> Maker-Checker Approval              |
|   - Sale -> Refund (Day 5) -> Approval -> Ledger Clawback -> Enrollment Revoked              |
|   - B2B Bulk Licensing -> Center Code Generation -> Student Redemption -> Affiliation         |
|   - Wallet Top-up -> Exam Purchase -> Graded Evaluation -> Verified Certificate Issuance      |
|   - Recurring SaaS Subscription Cycle -> Renewal Auto-Debit -> Invoice CDN Archival           |
+-----------------------------------------------------------------------------------------------+
| TIER 4: Real-World Workflows (Egyptian Persona & Resilience)                                  |
|   - Egyptian High School Student (Alexandria) via Vodafone Cash & Promo Coupon                |
|   - High-Volume Instructor Financial Management with Egyptian Bank Wire (IBAN)               |
|   - Private Educational Center Enterprise Onboarding & Seat Allocation                       |
|   - Network Outage Resilience & Synchronous Webhook Status Reconciliation                     |
+-----------------------------------------------------------------------------------------------+
```

---

## 3. Directory Layout & Module Structure

```
Backend/apps/finance/tests/
├── __init__.py                                 # Package root
├── helpers.py                                  # Kashier crypto, payload factories, ledger invariant validators
├── test_tier1_feature_coverage.py             # Tier 1: Functional baseline tests (10 Test Cases)
├── test_tier2_boundary_cases.py               # Tier 2: Boundary, Security & Invariant tests (10 Test Cases)
├── test_tier3_cross_feature_transitions.py    # Tier 3: Cross-domain lifecycle transition tests (5 Test Cases)
├── test_tier4_real_world_personas.py          # Tier 4: Persona journeys & outage resilience (4 Test Cases)
└── test_pricing_and_subscriptions.py          # Baseline Pricing, Coupons & Change Request tests (4 Test Cases)
```

---

## 4. Test Invariants & Verification Rules

1. **Double-Entry Ledger Invariant**:
   Every monetary movement (gross sale, platform commission, instructor split, refund, top-up, payout) MUST create balanced debit and credit records:
   $$\sum \text{Debit Amounts} \equiv \sum \text{Credit Amounts}$$
   Verified via `LedgerTestHelper.assert_ledger_balanced()` and `LedgerTestHelper.assert_all_ledgers_balanced()`.

2. **Non-Negative Balance Constraint**:
   No wallet available balance can drop below `0.00 EGP`. Enforced at the database constraint level and guarded by pessimistic locking (`select_for_update`).

3. **14-Day Escrow Holding Window**:
   Instructor course revenues are held in `pending_balance` for 14 days before automated transition to `available_balance`.

4. **Maker-Checker Segregation of Duties**:
   No financial change request or payout request can be approved by the same user who initiated it (`requested_by != approver`). All actions append immutable audit trails to `DetailedAuditLog`.

5. **Kashier HMAC-SHA256 Cryptographic Verification**:
   All incoming callbacks and server-to-server webhooks MUST validate against constant-time digest comparison (`hmac.compare_digest`), rejecting tampered or replayed signatures with `403 Forbidden`.

---

## 5. Execution Commands & Test Runners

### Run Full Financial E2E Test Suite
```bash
cd f:/FlashCard/edusmart/Backend
pytest apps/finance/tests/ -v
```

### Run by Tier
```bash
# Tier 1: Feature Coverage
pytest apps/finance/tests/test_tier1_feature_coverage.py -v

# Tier 2: Boundary & Corner Cases
pytest apps/finance/tests/test_tier2_boundary_cases.py -v

# Tier 3: Cross-Feature Transitions
pytest apps/finance/tests/test_tier3_cross_feature_transitions.py -v

# Tier 4: Real-World Personas
pytest apps/finance/tests/test_tier4_real_world_personas.py -v
```

### Run with Coverage Reporting
```bash
pytest apps/finance/tests/ --cov=apps.finance --cov-report=term-missing
```

---

## 6. Coverage Thresholds
- **Critical Financial Engine Services (`services.py`, `kashier.py`)**: 100% Branch & Statement Coverage
- **Ledger Invariants & Double-Entry Models**: 100% Assertion Coverage
- **Maker-Checker Governance & Audit Logging**: 100% Security Path Coverage
- **Overall Financial Suite Pass Rate**: 100% (Zero Tolerated Failures or Skips)
