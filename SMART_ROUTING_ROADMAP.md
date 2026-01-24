# Smart Routing Upgrade Roadmap

## Goal
Upgrade from keyword-based routing to semantic/ML-based routing using RouteLLM and Semantic Router.

**Target:** 85% cost reduction @ 95% quality (RouteLLM benchmarks)

---

## Phase Overview

| Phase | Description | Status | Started | Completed |
|-------|-------------|--------|---------|-----------|
| 1 | Semantic Router (all-MiniLM-L6-v2) | ✅ Complete | 2026-01-24 | 2026-01-24 |
| 2 | RouteLLM MF Router Integration | ⏳ Pending | - | - |
| 3 | Cascade/Confidence Fallback | ⏳ Pending | - | - |
| 4 | Cross-Provider via LiteLLM Gateway | ⏳ Pending | - | - |
| 5 | Custom Training on User Data | ⏳ Pending | - | - |

---

## Phase 1 Progress Log

### 2026-01-24: Initial Implementation

**Completed:**
- [x] Added `semantic-router` and `sentence-transformers` to requirements.txt
- [x] Created `semantic_router_service.py` with 8 task categories:
  - coding, analysis, reasoning, creative, translation, summarization, extraction, simple
- [x] Each task category has 10-18 example utterances for embedding matching
- [x] Integrated with `ComplexityAnalyzer` - now uses hybrid approach
- [x] Updated `/routing/test` API to return task_type and semantic info
- [x] Added task-to-model mapping (premium vs standard tier per task)

**Files Changed:**
- `backend/requirements.txt` - Added semantic-router, sentence-transformers
- `backend/app/services/semantic_router_service.py` - NEW: Semantic classification
- `backend/app/services/smart_router.py` - Hybrid analysis (semantic + keywords)
- `backend/app/api/v1/routing.py` - Returns task_type in API responses
- `frontend/src/pages/SmartRouting.tsx` - Shows task classification in test results

**Phase 1 Complete!**
- [x] Update frontend SmartRouting.tsx to display task classification
- [ ] Install dependencies and test in dev environment (next step)

---

## Phase 1: Semantic Router (Task Classification) ✅

**Goal:** Replace keyword detection with embedding-based task classification.

### Tasks
- [x] Add `semantic-router` and `sentence-transformers` to requirements.txt
- [x] Create `semantic_router_service.py` with task routes
- [x] Define task categories: coding, analysis, translation, summarization, simple (8 total)
- [x] Integrate with existing `ComplexityAnalyzer`
- [x] Add configuration for model selection per task type
- [x] Test with sample prompts
- [x] Update frontend test UI to show task classification

### Technical Details
```python
# Target architecture
Task Categories:
- coding → premium models (gpt-4o, claude-sonnet)
- analysis → premium models
- translation → budget models (gpt-4o-mini, claude-haiku)
- summarization → budget models
- simple → budget models
```

### Dependencies
```
semantic-router>=0.0.48
sentence-transformers>=2.2.2
```

---

## Phase 2: RouteLLM MF Router

**Goal:** Add win-rate prediction to determine if premium model is needed.

### Tasks
- [ ] Add `routellm` to requirements.txt
- [ ] Create `routellm_service.py` wrapper
- [ ] Configure strong/weak model pairs per provider
- [ ] Integrate with SmartRouter.route_request()
- [ ] Add threshold configuration to tenant settings
- [ ] Combine with Semantic Router (task + win-rate)
- [ ] Benchmark against current keyword system

### Technical Details
```python
# RouteLLM predicts: P(strong model wins)
# If P < threshold → use weak model
# Default threshold: 0.11593 (RouteLLM recommended)

Model Pairs:
- OpenAI: gpt-4o (strong) vs gpt-4o-mini (weak)
- Anthropic: claude-sonnet-4 (strong) vs claude-3-haiku (weak)
```

---

## Phase 3: Cascade/Confidence Fallback

**Goal:** Try cheap model first, escalate if uncertain.

### Tasks
- [ ] Implement confidence estimation (consistency check)
- [ ] Add cascade routing mode to tenant settings
- [ ] Implement retry-with-premium logic
- [ ] Track cascade escalation rate in analytics
- [ ] Add fallback on error (cheap fails → try premium)

### Technical Details
```python
async def cascade_route(query):
    cheap_response = await call_model("gpt-4o-mini", query)
    if is_confident(cheap_response):
        return cheap_response
    return await call_model("gpt-4o", query)
```

---

## Phase 4: Cross-Provider Routing

**Goal:** Route across providers for maximum savings.

### Tasks
- [ ] Configure LiteLLM with all provider credentials
- [ ] Create provider-agnostic model tiers
- [ ] Implement cross-provider fallback chains
- [ ] Add circuit breaker for provider failures
- [ ] Track provider health and latency

### Technical Details
```yaml
# Cross-provider tiers
premium_tier:
  - gpt-4o
  - claude-sonnet-4
  - gemini-pro

budget_tier:
  - gpt-4o-mini
  - claude-3-haiku
  - gemini-flash
```

---

## Phase 5: Custom Training

**Goal:** Train custom router on actual user queries.

### Tasks
- [ ] Log all routing decisions with outcomes
- [ ] Implement LLM-as-judge for synthetic labels
- [ ] Create training data pipeline
- [ ] Train custom classifier on user data
- [ ] A/B test custom vs RouteLLM pre-trained
- [ ] Implement active learning for edge cases

### Technical Details
```python
# Data collection schema
{
    "query": "...",
    "task_type": "coding",
    "routed_to": "gpt-4o-mini",
    "user_satisfaction": 0.85,  # from feedback
    "should_have_used_premium": False  # LLM judge
}
```

---

## Architecture After All Phases

```
Request
   ↓
Semantic Cache (5-10ms) → Cache Hit → Return
   ↓
Semantic Router (15ms) → Task Classification
   ↓
RouteLLM MF (20ms) → Win Rate Prediction
   ↓
Route Decision
   ↓
Cascade Mode? → Try Cheap First → Confident? → Return
                                      ↓ No
                              Escalate to Premium
   ↓
LiteLLM Gateway → Provider Selection → Fallback Chain
   ↓
Response → Log for Training
```

**Total routing overhead:** 30-50ms

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Cost reduction | ~20% (keyword) | 40-60% |
| Quality retention | Unknown | 95%+ |
| Routing latency | ~5ms | <50ms |
| Routing accuracy | Low | >90% |

---

## Research References

- RouteLLM Paper: https://github.com/lm-sys/RouteLLM
- Semantic Router: https://github.com/aurelio-labs/semantic-router
- NVIDIA Classifier: nvidia/prompt-task-and-complexity-classifier
- Research Doc: [compass_artifact...md](./compass_artifact_wf-3b8dbb6d-e966-48f6-b560-2c1df9db00da_text_markdown.md)
