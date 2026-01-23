# TokenTrail - Bugs Found During Testing

**Test Date:** January 22-23, 2026
**Environment:** https://tokentrailapp.com

---

## Bug List

### BUG-001: Dashboard shows fake percentage changes on fresh account
**Severity:** Low (cosmetic)
**Page:** Dashboard
**Status:** ✅ RESOLVED

**Description:**
Fresh dashboard with 0 customers, 0 usage, $0.00 cost shows percentage indicators:
- Total Customers: 0 (+12%)
- Total Usage: 0 (+8%)
- Total Cost: $0.00 (-3%)
- Active API Keys: 0

**Fix Applied:**
Removed hardcoded percentage trends. Trends now show `null` until historical comparison data is available.

**File Changed:** `frontend/src/components/dashboard/StatsCards.tsx`

---

### BUG-002: Blank page when creating customer without email
**Severity:** Medium
**Page:** Customers → Add Customer form
**Status:** ✅ RESOLVED

**Description:**
- Creating customer without email field → blank page, 403 error in logs
- No validation error shown in UI
- Page becomes unresponsive, requires refresh

**Root Cause:**
Frontend sent empty string `""` for email, but backend expects valid EmailStr or `null`. Pydantic validation failed.

**Fix Applied:**
Convert empty strings to `null` before sending to API for both `name` and `email` fields.

**File Changed:** `frontend/src/pages/Customers.tsx`

---

### BUG-003: API Key text too light/hard to read
**Severity:** Low (UX)
**Page:** API Keys → Create dialog
**Status:** ✅ RESOLVED

**Description:**
- Generated API key text is very light gray, hard to read

**Fix Applied:**
Changed API key display to dark background (`bg-gray-800`) with green terminal-style text (`text-green-400`) for better contrast and readability.

**File Changed:** `frontend/src/pages/ApiKeys.tsx`

---

### BUG-004: Environment dropdown shows "prod/test" not "live/test"
**Severity:** Low (cosmetic)
**Page:** API Keys → Create dialog
**Status:** ✅ RESOLVED

**Description:**
- Environment options showed "Production" and "Test"
- API key prefix uses "tt_test_" or "tt_live_"
- Inconsistent naming

**Fix Applied:**
- Changed dropdown labels from "Production/Test" to "Live/Test"
- Updated table display to show "Live" instead of "production"
- Added helper text showing key prefix format

**File Changed:** `frontend/src/pages/ApiKeys.tsx`

---

### BUG-005: LiteLLM crashing - DATABASE_URL not configured
**Severity:** Critical (blocking)
**Page:** N/A - Server infrastructure
**Status:** ✅ RESOLVED

**Description:**
LiteLLM container keeps restarting with Prisma error:
```
Error validating datasource `client`: the URL must start with the protocol `postgresql://` or `postgres://`.
url = env("DATABASE_URL")
```

**Root Cause:**
1. DATABASE_URL in .env used `postgresql+asyncpg://` format (for SQLAlchemy async)
2. LiteLLM's Prisma requires standard `postgresql://` format

**Fix Applied:**
1. Set `DATABASE_URL=postgresql://...` in docker-compose.prod.yml environment (overrides .env)
2. Point LiteLLM to separate database (`litellm_db`) to avoid migration conflicts
3. Added `DISABLE_SPEND_LOGS=true` and `STORE_MODEL_IN_DB=false`

---

### BUG-006: LiteLLM auth blocks TokenTrail API keys
**Severity:** Critical (blocking)
**Page:** N/A - LLM Proxy
**Status:** ✅ RESOLVED

**Description:**
LiteLLM built-in auth expects `sk-*` keys, rejects TokenTrail `tt_*` keys

**Fix Applied:**
Added to litellm_config.yaml:
```yaml
general_settings:
  master_key: null
  enable_jwt_auth: false
```

---

## Feature Ideas (from competitor research)

### FEATURE-001: Pricing Calculator on Landing Page
**Source:** Helicone
**Priority:** Medium

**Description:**
Interactive pricing calculator that shows:
- Slider for "Requests per month" (10K, 100K, 1M, etc.)
- Input for "Tokens per request" (default 8000)
- Breakdown showing:
  - Storage cost
  - Request cost
  - **Estimated monthly total**

**TokenTrail Version:**
Could show:
- Requests per month
- Avg tokens per request
- Model mix (% GPT-4 vs GPT-3.5)
- **Your cost** vs **Revenue** (with markup slider)
- **Profit margin**

This helps potential customers understand the economics before signing up.

---

### BUG-007: Database tables missing after LiteLLM migrations
**Severity:** CRITICAL
**Page:** All - Can't login
**Status:** ✅ RESOLVED

**Description:**
After LiteLLM Prisma migrations ran, TokenTrail tables were missing:
```
relation "users" does not exist
```

**Root Cause:**
LiteLLM and TokenTrail were sharing the same database. LiteLLM's Prisma migrations conflicted with TokenTrail's Alembic migrations.

**Fix Applied:**
1. Re-ran TokenTrail's Alembic migrations to restore tables
2. Configured LiteLLM to use SEPARATE database (`litellm_db`)
3. Now LiteLLM and TokenTrail have isolated database schemas

**Prevention:**
- LiteLLM now has its own `litellm_db` database
- TokenTrail keeps using `tokentrail` database
- No more migration conflicts

---

### BUG-008: LiteLLM callback not tracking usage
**Severity:** Critical (blocking)
**Page:** N/A - LLM Proxy
**Status:** ✅ RESOLVED

**Description:**
LiteLLM callback was initialized but `async_log_success_event` was never invoked. Usage not tracked.

**Root Cause:**
1. Config used `success_callback: ["module.instance"]` (array format for built-in integrations)
2. Custom `CustomLogger` classes require `callbacks: module.instance` (direct reference under `litellm_settings`)
3. Also: `user_api_key_dict` is a `UserAPIKeyAuth` Pydantic object, not a dict - code used `.get()` instead of `getattr()`

**Fix Applied:**
1. Changed `litellm_config.yaml`:
   ```yaml
   litellm_settings:
     callbacks: tokentrail_callback.tokentrail_callback  # NOT success_callback: [...]
   ```
2. Fixed `tokentrail_callback.py` to use `getattr(user_api_key_dict, 'api_key', None)` instead of `user_api_key_dict.get("api_key")`

**Files Changed:**
- `deployment/litellm_config.yaml`
- `litellm/tokentrail_callback.py`

---

## Bug Summary

| ID | Description | Severity | Page | Status |
|----|-------------|----------|------|--------|
| BUG-001 | Fake % changes on empty dashboard | Low | Dashboard | ✅ Resolved |
| BUG-002 | Blank page without email | Medium | Customers | ✅ Resolved |
| BUG-003 | API Key text too light | Low | API Keys | ✅ Resolved |
| BUG-004 | prod/test vs live/test naming | Low | API Keys | ✅ Resolved |
| BUG-005 | LiteLLM DATABASE_URL format | Critical | Infra | ✅ Resolved |
| BUG-006 | LiteLLM auth blocking tt_* keys | Critical | Infra | ✅ Resolved |
| BUG-007 | DB tables missing (migration conflict) | Critical | Infra | ✅ Resolved |
| BUG-008 | Callback not tracking usage | Critical | Infra | ✅ Resolved |
| BUG-009 | Notification bell always shows badge | Low | Header | ✅ Resolved |
| BUG-010 | "Total Usage" label unclear (should say Tokens) | Low | Dashboard | ✅ Resolved |

## Feature Requests Summary

| ID | Description | Priority | Page |
|----|-------------|----------|------|
| FEATURE-001 | Pricing calculator on landing page | Medium | Landing |
| FEATURE-002 | Smart Routing toggle in UI | High | Settings |
| FEATURE-003 | Budget blocking visibility & quick actions | High | Dashboard |

---

## Feature Requests (from Testing)

### FEATURE-002: Smart Routing Toggle in UI
**Priority:** High
**Page:** Settings / Routing

**Description:**
Add ability to enable/disable smart routing from the UI with clear choices.

**Current State:**
- Smart routing is controlled via database field `smart_routing_enabled`
- No UI toggle exists

**Requested:**
- Toggle switch in Settings page
- Show current routing status
- Option to configure routing rules/thresholds

---

### FEATURE-003: Budget Blocking Visibility in UI
**Priority:** High
**Page:** Dashboard / Customers

**Description:**
Show when a customer is blocked due to budget limits and provide quick action to unblock.

**Requested:**
- Visual indicator when customer is blocked (red badge/icon)
- "Blocked Requests" count on dashboard
- Quick action: "Reset Budget" or "Increase Limit" button
- Notification when customer gets blocked

---

### BUG-009: Notification Bell Always Shows Badge
**Severity:** Low (UX)
**Page:** All - Header/Navbar
**Status:** ✅ RESOLVED

**Description:**
- Notification bell icon always shows a red dot/badge
- Clicking on it does nothing or shows empty state

**Fix Applied:**
Removed the always-visible red notification badge. Added tooltip "Notifications coming soon".

**File Changed:** `frontend/src/components/common/Header.tsx`

---

### BUG-010: "Total Usage" Label Unclear
**Severity:** Low (UX)
**Page:** Dashboard
**Status:** ✅ RESOLVED

**Description:**
Dashboard shows "Total Usage" which doesn't clearly indicate it's about tokens.

**Fix Applied:**
Changed label from "Total Usage" to "Total Tokens" for clarity.

**File Changed:** `frontend/src/components/dashboard/StatsCards.tsx`

---

## Severity Levels
- **Critical:** App broken, can't proceed
- **High:** Feature not working
- **Medium:** Feature works but incorrect behavior
- **Low:** Cosmetic/UX issues

