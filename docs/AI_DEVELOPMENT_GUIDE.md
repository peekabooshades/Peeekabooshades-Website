# AI Development Guide - Peekaboo Shades

## Overview

This document describes how AI (Claude) was used to develop the Peekaboo Shades CRM/OMS/Finance/Analytics system, including prompts used, AI behavior patterns, and guidelines for future AI-assisted development.

---

## AI Development Context

### Model Used
- **Model:** Claude Opus 4.5 (claude-opus-4-5-20251101)
- **Interface:** Claude Code CLI
- **Development Period:** January 2026

### Development Approach
The AI was given a comprehensive system prompt with the full scope of the project and iteratively built components following a phased approach.

---

## Master Prompt Used

The following master prompt was provided to initiate the project:

```
PRIMARY GOAL
Create an end-to-end automated CRM tool that connects:
Product Detail Page → Admin Dashboard → Orders → Manufacturer Portal →
Tracking Portal → Invoicing/Email → Finance/Accounting → Analytics

Entry product page (customer-facing):
- http://localhost:3001/product/affordable-custom-roller-blinds

Admin dashboard (internal):
- http://localhost:3001/admin/

AUTOMATION TARGET
Customer selects options on product detail page → customer price shown
instantly (from backend) → order placed → order appears in admin in real time
→ approval/manufacturer workflow → tracking updates → customer gets email
updates + invoice → finance tracks P&L, tax, shipping, expenses → analytics
shows conversion funnels & segmentation.

NON-NEGOTIABLE CONSTRAINTS
1) Keep UI stable: do not redesign customer pages
2) Admin must control data and configuration
3) Every entity must have strong IDs and audit history
4) Must be production-style architecture

SCOPE DETAILS
A) PRODUCT + PRICING MANAGEMENT (ADMIN)
B) IMPORT MANUFACTURER PRICES FROM PDFs
C) REAL-TIME PRICE UPDATES ON PRODUCT DETAIL PAGE
D) ORDER MANAGEMENT (ADMIN)
E) CUSTOMER ORDER TRACKING PORTAL
F) MANUFACTURER PORTAL
G) SHIPPING + TRACKING INTEGRATIONS
H) INVOICING + EMAIL NOTIFICATIONS
I) FINANCE / ACCOUNTING DASHBOARD
J) ANALYTICS DASHBOARD

IMPLEMENTATION PHASES
Phase 1: Repo/Stack Discovery
Phase 2: Data Model + Price Engine
Phase 3: Admin Modules
Phase 4: Customer Touchpoints
Phase 5: Observability + QA
```

---

## AI Behavior Patterns

### 1. Exploration Before Implementation

The AI follows a pattern of:
1. **Explore** the existing codebase using Glob, Grep, Read tools
2. **Understand** existing patterns and conventions
3. **Plan** the implementation approach
4. **Implement** following existing patterns
5. **Document** what was built

### 2. Task Tracking

The AI uses a todo list to track progress:
```
[completed] Phase 1: Current State Documentation
[completed] Phase 2a: Extended Database Schema
[completed] Phase 2b: PDF Price Ingestion
[completed] Phase 2c: Unified Price Engine
[in_progress] Create comprehensive documentation
[pending] Phase 3a: Admin Product/Fabric Management
...
```

### 3. File Creation Patterns

**Services:** Created as singleton classes with exports
```javascript
class ServiceName {
  // Methods
}
const serviceName = new ServiceName();
module.exports = { serviceName, ServiceName };
```

**Documentation:** Markdown files with:
- Table of contents
- Code examples
- Architecture diagrams (ASCII)
- File references

### 4. Code Style Adherence

The AI:
- Matches existing code style (indentation, naming)
- Uses existing patterns (e.g., `loadDatabase()` function)
- Follows existing error handling patterns
- Maintains consistent API response format

---

## Prompts for Common Tasks

### Adding a New Feature

```
I need to add [FEATURE NAME] to the Peekaboo Shades system.

Requirements:
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

Please:
1. Explore the existing codebase to understand patterns
2. Create necessary database schema extensions
3. Implement backend service
4. Add API endpoints
5. Create admin UI if needed
6. Update documentation
```

### Fixing a Bug

```
There's an issue with [COMPONENT]:
- Expected behavior: [WHAT SHOULD HAPPEN]
- Actual behavior: [WHAT IS HAPPENING]

Please:
1. Investigate the relevant files
2. Identify the root cause
3. Fix the issue
4. Verify the fix doesn't break other functionality
```

### Extending Existing Feature

```
I need to extend [EXISTING FEATURE] to also:
- [New capability 1]
- [New capability 2]

Constraints:
- Don't break existing functionality
- Maintain backward compatibility
- Follow existing patterns
```

### Creating Documentation

```
Please create documentation for [COMPONENT/FEATURE]:

Include:
- How it works (architecture)
- API reference
- Usage examples
- Configuration options
- Troubleshooting guide
```

---

## AI Capabilities & Limitations

### What AI Does Well

1. **Pattern Recognition:** Identifies existing code patterns and replicates them
2. **Comprehensive Implementation:** Creates complete solutions (schema + service + API + docs)
3. **Documentation:** Generates detailed, well-structured documentation
4. **Error Handling:** Implements robust error handling following patterns
5. **Code Organization:** Creates modular, maintainable code structure

### What Requires Human Guidance

1. **Business Decisions:** Margin percentages, pricing strategies
2. **UI/UX Design:** Visual layout, user experience choices
3. **Third-Party Integration Details:** API keys, specific provider configurations
4. **Testing with Real Data:** Actual PDF files, production data
5. **Deployment:** Server configuration, environment-specific settings

### Limitations to Be Aware Of

1. **File Size:** Very large files (>7000 lines) are read in chunks
2. **PDF Parsing:** Complex PDF tables may require CSV fallback
3. **Real-Time Testing:** Cannot verify live server behavior without running commands
4. **External APIs:** Cannot make actual API calls to third-party services

---

## Development Workflow with AI

### Recommended Process

```
1. DESCRIBE the goal clearly
   - What feature/fix is needed
   - What constraints exist
   - What the expected outcome is

2. LET AI EXPLORE
   - Allow AI to read relevant files
   - Let it understand existing patterns
   - Don't rush to implementation

3. REVIEW the plan
   - AI will create todo list
   - Verify approach makes sense
   - Provide feedback if needed

4. IMPLEMENT iteratively
   - AI creates files one by one
   - Review each file
   - Test as you go

5. DOCUMENT
   - AI updates documentation
   - Includes usage examples
   - Adds to knowledge base
```

### Prompt Engineering Tips

**Be Specific:**
```
❌ "Add pricing"
✅ "Add manufacturer cost lookup that finds prices from the manufacturerPrices
    table by matching productType and fabricCode, with fallback to
    dimension-based calculation if no match found"
```

**Provide Context:**
```
❌ "Fix the bug"
✅ "The calculateCustomerPrice function in extended-pricing-engine.js returns
    0 for manufacturer cost when fabricCode is not found. It should fall back
    to dimension-based calculation instead."
```

**Reference Files:**
```
❌ "Update the pricing"
✅ "Update the calculateCustomerPrice method in
    backend/services/extended-pricing-engine.js to include warranty pricing
    from the systemConfig"
```

---

## Files Created by AI

### Phase 2 Files

| File | Purpose | Lines |
|------|---------|-------|
| `backend/services/database-schema.js` | Extended schema definitions | ~450 |
| `backend/services/price-import-service.js` | PDF/CSV import service | ~600 |
| `backend/services/extended-pricing-engine.js` | Pricing with margins | ~500 |
| `docs/ARCHITECTURE.md` | System architecture | ~400 |
| `docs/KNOWLEDGE_TRANSFER.md` | KT documentation | ~500 |
| `docs/AI_DEVELOPMENT_GUIDE.md` | This file | ~400 |
| `docs/API_DOCUMENTATION.md` | API reference | ~500 |

### File Naming Conventions

- **Services:** `lowercase-hyphenated-service.js`
- **Middleware:** `lowercase.js`
- **Config:** `lowercase-config.js`
- **Documentation:** `UPPERCASE_UNDERSCORED.md`
- **Admin Pages:** `lowercase-hyphenated.html`

---

## Quality Checklist

Before considering a feature complete, verify:

### Code Quality
- [ ] Follows existing code patterns
- [ ] Includes error handling
- [ ] Has appropriate comments
- [ ] Uses consistent naming

### Functionality
- [ ] Works with existing data
- [ ] Handles edge cases
- [ ] Doesn't break existing features
- [ ] API returns consistent format

### Documentation
- [ ] Updated relevant docs
- [ ] Includes usage examples
- [ ] API endpoints documented
- [ ] Configuration options listed

### Testing
- [ ] Manual testing performed
- [ ] Edge cases tested
- [ ] Error scenarios tested
- [ ] Integration points verified

---

## Continuing Development

### Resuming Work

When resuming AI-assisted development:

1. **Provide Context:**
```
We're continuing work on Peekaboo Shades CRM system.

Previously completed:
- Phase 1: Architecture documentation
- Phase 2: Database schema, price import, pricing engine

Current state:
- [Describe what's working]
- [Describe what's pending]

Next steps:
- [What to work on next]
```

2. **Reference Documentation:**
```
Please read:
- docs/ARCHITECTURE.md for system overview
- docs/KNOWLEDGE_TRANSFER.md for component details
- docs/API_DOCUMENTATION.md for API reference
```

3. **Specify Scope:**
```
For this session, let's focus on:
- [Specific feature/component]
- [Expected deliverables]
- [Any constraints]
```

### Handoff to New Developer/AI

1. Share these documentation files
2. Provide access to codebase
3. Start with exploration prompt:
```
Please read the documentation in the docs/ folder and explore the codebase
to understand:
1. System architecture
2. Existing patterns
3. Current state of implementation
4. What needs to be built next
```

---

## Troubleshooting AI Development

### AI Seems Stuck

```
Let me clarify the requirements:
- [Restate the goal]
- [Provide more specific details]
- [Reference specific files]
```

### AI Creates Wrong Pattern

```
The code you created doesn't match existing patterns.

Please look at [EXISTING FILE] for the correct pattern:
- [Specific pattern to follow]
- [Example from existing code]
```

### AI Misunderstands Scope

```
Let me clarify the scope:

IN SCOPE:
- [What should be done]

OUT OF SCOPE:
- [What should NOT be done]

Please focus only on the in-scope items.
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial creation with Phase 1-2 documentation |
