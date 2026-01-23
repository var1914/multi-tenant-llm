# TokenTrail - Bugs Found During Testing

**Test Date:** January 22, 2026
**Environment:** https://tokentrailapp.com

---

## Bug List

### BUG-001: Dashboard shows fake percentage changes on fresh account
**Severity:** Low (cosmetic)
**Page:** Dashboard
**Status:** Open

**Description:**
Fresh dashboard with 0 customers, 0 usage, $0.00 cost shows percentage indicators:
- Total Customers: 0 (+12%)
- Total Usage: 0 (+8%)
- Total Cost: $0.00 (-3%)
- Active API Keys: 0

**Expected:**
- Should show no percentage change, or "N/A", or hide the badge entirely when there's no previous data to compare

**Screenshot:** Dashboard with zero values but percentage badges visible

**Fix Location:** Frontend - Dashboard stat cards component

---

### BUG-002: Blank page when creating customer without email
**Severity:** Medium
**Page:** Customers → Add Customer form
**Status:** Open

**Description:**
- Creating customer without email field → blank page, 403 error in logs
- No validation error shown in UI
- Page becomes unresponsive, requires refresh
- Works correctly when email is provided

**Root Cause:**
Form allows submission without email, backend rejects, UI doesn't handle error gracefully

**Expected:**
- Either: Email field marked as required with validation
- Or: Backend accepts customer without email
- Must: Show clear error message instead of blank page

**Fix Location:**
- Frontend: Add form validation OR error handling for failed requests
- Backend: Check if email is actually required in schema

---

### BUG-003: API Key text too light/hard to read
**Severity:** Low (UX)
**Page:** API Keys → Create dialog
**Status:** Open

**Description:**
- Generated API key text is very light gray, hard to read
- Same light text issue noticed in other places in the app

**Expected:**
- Key should be clearly visible (darker text or better contrast)
- Consider monospace font for API keys

**Fix Location:** Frontend - CSS/Tailwind text color classes

---

### BUG-004: Environment dropdown shows "prod/test" not "live/test"
**Severity:** Low (cosmetic)
**Page:** API Keys → Create dialog
**Status:** Open

**Description:**
- Environment options show "prod" and "test"
- API key prefix uses "tt_test_" or "tt_live_"
- Inconsistent naming

**Expected:**
- Dropdown should show "Live" and "Test" to match key prefixes
- Or allow customization of environment names

**Fix Location:** Frontend - API Key create form

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
| BUG-001 | Fake % changes on empty dashboard | Low | Dashboard | Open |
| BUG-002 | Blank page without email | Medium | Customers | Open |
| BUG-003 | API Key text too light | Low | API Keys | Open |
| BUG-004 | prod/test vs live/test naming | Low | API Keys | Open |
| BUG-005 | LiteLLM DATABASE_URL format | Critical | Infra | ✅ Resolved |
| BUG-006 | LiteLLM auth blocking tt_* keys | Critical | Infra | ✅ Resolved |
| BUG-007 | DB tables missing (migration conflict) | Critical | Infra | ✅ Resolved |
| BUG-008 | Callback not tracking usage | Critical | Infra | ✅ Resolved |

---

## Severity Levels
- **Critical:** App broken, can't proceed
- **High:** Feature not working
- **Medium:** Feature works but incorrect behavior
- **Low:** Cosmetic/UX issues

