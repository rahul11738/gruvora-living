# Task Plan

## Changes Required

### 1. UserDashboard.js
- [x] Remove circular avatar/photo upload section from sidebar
- [x] Add clean SaaS-level profile header with link to `/profile`

### 2. OwnerDashboard.js
- [x] Fix mobile responsiveness (Leads page layout, sidebar, main content margins)
- [x] LeadsSection: Remove phone/email hiding logic
- [x] Call button: Direct `tel:` link (always enabled for valid numbers)
- [x] Email button: Direct `mailto:` + Gmail compose
- [x] Chat button: Proper chat system navigation
- [x] Fix mock leads to use real booking data without hidden fallbacks

### 3. Backend
- [x] `get_owner_bookings` already returns real user_phone/user_email — no backend change needed

## Status
- [x] Plan created
- [x] Files analyzed
- [x] Implementing UserDashboard.js
- [x] Implementing OwnerDashboard.js
- [ ] Verify complete files

