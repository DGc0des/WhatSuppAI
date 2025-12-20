# Current Issues Identified - January 2025

This document lists issues found during the current code review session.

## 🔴 CRITICAL ISSUES

### 1. Bundling Error - Metro Cache Issue
**Priority:** 🔴 CRITICAL  
**Location:** `mobile/app/(tabs)/index.tsx:132`  
**Status:** Likely cache issue - code appears correct

**Error Message:**
```
Unable to resolve "/Users/dimitrisgrezios/Desktop/vs_code_projects/WhatSuppAI/mobile/node_modules/@expo/metro-config/build/async-require.js" from "app/(tabs)/index.tsx"
> 132 |       const { scanImageForBarcode } = await import('../../lib/api');
```

**Analysis:**
- The error references a dynamic import (`await import()`)
- However, the current code shows `scanImageForBarcode` is already imported statically at line 5
- Line 132 correctly uses: `const scanResult = await scanImageForBarcode(base64Image);`
- This suggests Metro bundler cache is stale

**Fix:**
1. Clear Metro bundler cache:
   ```bash
   cd mobile
   npx expo start --clear
   ```
2. If that doesn't work, clear all caches:
   ```bash
   rm -rf node_modules/.cache
   rm -rf .expo
   npx expo start --clear
   ```

---

## 🟠 HIGH PRIORITY ISSUES

### 2. Excessive Console Logging
**Priority:** 🟠 HIGH  
**Location:** `mobile/lib/scheduleStorage.ts:43,62`  
**Status:** ✅ FIXED

**Issue:**
- `getScheduledSupplements()` logs every time it's called
- Called on every screen focus via `useFocusEffect` in both `calendar.tsx` and `chat.tsx`
- Causes console spam: logs appear 10+ times per minute

**Fix Applied:**
- Removed verbose console.log statements
- Added conditional logging only in development mode
- Reduces console noise in production

---

### 3. Outdated Package Versions
**Priority:** 🟠 HIGH  
**Location:** `mobile/package.json`  
**Status:** ⚠️ Needs attention

**Issue:**
Metro bundler reports 20+ packages should be updated:
- `@expo/vector-icons@15.0.2` → `^15.0.3`
- `expo@54.0.13` → `~54.0.30`
- `expo-camera@17.0.8` → `~17.0.10`
- `expo-notifications@0.32.14` → `~0.32.15`
- `expo-router@6.0.12` → `~6.0.21`
- `react-native@0.81.4` → `0.81.5`
- And 15+ more...

**Impact:**
- Potential compatibility issues
- Missing bug fixes and security patches
- May cause runtime errors

**Fix:**
```bash
cd mobile
npx expo install --fix
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### 4. Repeated Data Fetching on Screen Focus
**Priority:** 🟡 MEDIUM  
**Location:** `mobile/app/(tabs)/calendar.tsx:68-75`, `mobile/app/(tabs)/chat.tsx:58-62`

**Issue:**
- Both screens use `useFocusEffect` to reload data every time screen comes into focus
- Causes unnecessary API calls and database queries
- No caching or debouncing mechanism

**Impact:**
- Increased network usage
- Slower screen transitions
- Potential performance issues

**Recommendation:**
- Consider adding a refresh mechanism instead of auto-reload
- Implement caching with timestamp checks
- Only reload if data is stale (>30 seconds old)

---

### 5. Missing Error Boundaries
**Priority:** 🟡 MEDIUM  
**Location:** App-wide

**Issue:**
- No React Error Boundaries implemented
- Unhandled errors in components will crash the entire app
- Poor error recovery

**Recommendation:**
- Add Error Boundary component
- Wrap main screens in error boundaries
- Show user-friendly error messages

---

### 6. Potential Memory Leaks from useFocusEffect
**Priority:** 🟡 MEDIUM  
**Location:** Multiple screens using `useFocusEffect`

**Issue:**
- `useFocusEffect` callbacks may not properly clean up
- If async operations complete after component unmount, could cause memory leaks

**Recommendation:**
- Add cleanup functions to cancel pending requests
- Use AbortController for fetch requests
- Track mounted state before state updates

---

## 🟢 LOW PRIORITY ISSUES

### 7. Console Logging in Production
**Priority:** 🟢 LOW  
**Location:** Multiple files

**Issue:**
- Many `console.log` statements throughout codebase
- Should be removed or wrapped in `__DEV__` checks for production builds

**Recommendation:**
- Use a logging utility that automatically filters in production
- Or wrap all console.log calls in `if (__DEV__)` checks

---

### 8. TypeScript `any` Types
**Priority:** 🟢 LOW  
**Location:** Multiple files (already documented in ISSUES.md)

**Issue:**
- 30+ instances of `any` type
- Reduces type safety benefits

**Note:** Already documented in `ISSUES.md` #9

---

## Summary

**Total Issues Found:** 8
- 🔴 Critical: 1 (cache issue)
- 🟠 High: 2 (1 fixed, 1 needs attention)
- 🟡 Medium: 3
- 🟢 Low: 2

**Immediate Actions Required:**
1. Clear Metro bundler cache to fix bundling error
2. Update packages using `npx expo install --fix`
3. Monitor console logs after fix to verify reduced spam

**Next Steps:**
- Review and implement error boundaries
- Consider adding data caching layer
- Audit all console.log statements

