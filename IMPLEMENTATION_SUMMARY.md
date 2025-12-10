# History and Stack Implementation Summary

## Overview
Implemented a two-tier system for supplements:
- **History**: Auto-saved scan history (all scanned items)
- **Stack**: User's curated supplement collection (manually added from history)

## Database Changes

### 1. Run `create_history_table.sql` in Supabase SQL Editor

This script will:
- Rename `Scanned` table to `History`
- Create new `Stack` table with identical structure
- Set up RLS policies for `Stack`
- Update foreign keys in `ScheduledSupplements` to reference `Stack`
- Create performance indexes

### 2. Run `fix_all_constraints.sql` in Supabase SQL Editor

This script will:
- Remove problematic unique constraints (image, name, brand, etc.)
- Keep only `(barcode, user_id)` unique constraint
- Prevents duplicate key errors when scanning

## New App Structure

### Tab Navigation (5 tabs total):
1. **Scan** (index.tsx) - Camera/Gallery scanning
2. **History** (history.tsx) - Scan history with "Add to Stack" buttons
3. **Stack** (explore.tsx) - Curated supplements with scheduling
4. **Schedule** (calendar.tsx) - View scheduled supplements
5. **Chat** (chat.tsx) - AI assistant

## File Changes

### Created Files:
- `mobile/app/(tabs)/history.tsx` - New history tab
- `create_history_table.sql` - Database migration script
- `fix_all_constraints.sql` - Constraint cleanup script

### Modified Files:
- `mobile/lib/storage.ts` - Added History and Stack functions
- `mobile/app/(tabs)/explore.tsx` - Now shows Stack (renamed from HistoryScreen to StackScreen)
- `mobile/app/(tabs)/_layout.tsx` - Added History tab, updated tab names
- `mobile/app/(tabs)/chat.tsx` - Updated to use Stack instead of Scanned

## New Functions in storage.ts

### History Functions:
- `saveToHistory()` - Save scanned item to history
- `getAllHistory()` - Get all scan history
- `deleteFromHistory(id)` - Remove from scan history

### Stack Functions:
- `addToStack(supplement)` - Add supplement to stack
- `getAllStack()` - Get all stack items
- `removeFromStack(id)` - Remove from stack
- `isInStack(barcode)` - Check if barcode is in stack

### Legacy Compatibility:
- `saveScannedSupplement()` - Now calls `saveToHistory()`
- `getAllScannedSupplements()` - Now calls `getAllStack()`
- `deleteScannedSupplement()` - Now calls `removeFromStack()`

## User Flow

1. **Scan** → Item automatically saved to **History**
2. **History** → User reviews and clicks "Add to Stack"
3. **Stack** → User can schedule supplements
4. **Schedule** → View and manage scheduled items
5. **Chat** → AI assistant with access to Stack

## Required Steps to Deploy

1. ✅ Run `fix_all_constraints.sql` in Supabase (to fix current constraint errors)
2. ⏳ Run `create_history_table.sql` in Supabase (to create new schema)
3. ⏳ Test scanning a supplement - should go to History
4. ⏳ Test adding from History to Stack
5. ⏳ Test scheduling from Stack
6. ⏳ Verify Chat AI can see Stack items

## Notes

- Scanning now saves to History automatically (no more "Add to Stack" prompt needed)
- Users manually curate their Stack from History
- Only Stack items can be scheduled
- Chat AI only sees Stack items (not full history)
- All existing code remains compatible through legacy functions
