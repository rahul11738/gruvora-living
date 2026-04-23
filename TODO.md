# URGENT: Nested Helmet Fix - Production Crash

## Status: Plan Approved ✅ Ready to Execute

**Root Cause:** HelmetManager wrapper in App.js causes nesting violation with page SeoHead components.

## Steps (Execute Sequentially):

### 1. Code Changes ✅
- [x] Edit `frontend/src/App.js`: Remove HelmetManager import & wrapper
- [x] Delete `frontend/src/components/HelmetManager.jsx`  

### 2. Build & Test ✅
- [x] `cd frontend && npm run build` (should succeed, no errors)
- [x] `npm start` 
- [x] Test pages: Home, Category, ListingDetail, Policy, Reels - no console errors
- [x] Verify <SeoHead /> renders titles/metas correctly

### 3. Deploy & Verify
- [ ] Deploy to Vercel 
- [ ] Verify gruvora.com loads (no "Something went wrong")
- [ ] Check console: No nested Helmet invariant violation

### 4. Completion
- [ ] Update this TODO.md with ✓ marks
- [ ] attempt_completion

**Expected Result:** Production crash fixed permanently.
