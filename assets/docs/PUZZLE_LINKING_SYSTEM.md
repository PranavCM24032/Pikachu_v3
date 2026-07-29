# Puzzle Linking System - ID-Based Architecture

## Overview
The puzzle linking system uses **puzzle IDs** for prerequisites and **single answer values**, making administration easier and creating a cleaner puzzle progression chain.

## Changes Made

### 1. **puzzle.json** Structure Update
**Before:**
```json
{
  "id": 2,
  "answers": ["32"],
  "previousPuzzleAnswers": ["-5"]
}
```

**After:**
```json
{
  "id": 2,
  "answer": "32",
  "previousPuzzleId": [1]
}
```

### 2. Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `answer` | `string` | Single correct answer for this puzzle |
| `previousPuzzleId` | `array` | Array of puzzle IDs that can unlock this puzzle |
| `[0]` | Special value | Indicates a **starting puzzle** (no prerequisite) |

### 3. Puzzle Progression Chain

```
Puzzle 1 (previousPuzzleId: [0]) → Starting puzzle
    ↓ (answer: "-5")
Puzzle 2 (previousPuzzleId: [1]) → Unlocked by Puzzle 1's answer
    ↓ (answer: "32")
Puzzle 3 (previousPuzzleId: [2]) → Unlocked by Puzzle 2's answer
    ↓ (answer: "32")
Puzzle 4 (previousPuzzleId: [3]) → Unlocked by Puzzle 3's answer
    ↓ (answer: "19")
Puzzle 5 (previousPuzzleId: [4]) → Unlocked by Puzzle 4's answer
```

### 4. Multiple Prerequisites (OR Logic)

You can now have puzzles unlocked by **multiple different puzzles**:

```json
{
  "id": 10,
  "answer": "FINAL",
  "previousPuzzleId": [7, 8, 9]
}
```

This means Puzzle 10 can be unlocked by completing **any** of:
- Puzzle 7 (enter its answer)
- Puzzle 8 (enter its answer)  
- Puzzle 9 (enter its answer)

## How It Works

### Unlock Validation Logic

1. **Starting Puzzles** (`previousPuzzleId: [0]`)
   - Accept **any code** to unlock
   - Allows multiple entry points

2. **Sequential Puzzles** (`previousPuzzleId: [N]`)
   - Find each previous puzzle by ID
   - Validate that entered code matches **ANY** of the previous puzzles' answers
   - Only unlock if validation passes

### Example Flow

**Player wants to unlock Puzzle 3:**
1. System checks: `Puzzle 3.previousPuzzleId = [2]`
2. System finds: `Puzzle 2`
3. Player enters: `"32"`
4. System validates: `"32" === Puzzle 2.answer` ✓
5. **Result:** Puzzle 3 unlocked!

**Player wants to unlock Puzzle 10 (multiple prerequisites):**
1. System checks: `Puzzle 10.previousPuzzleId = [7, 8, 9]`
2. Player enters: `"ANSWER8"`
3. System validates: `"ANSWER8" === Puzzle 8.answer` ✓
4. **Result:** Puzzle 10 unlocked!

## Benefits

### ✅ **Easier Administration**
- No need to remember/copy answers
- Just reference puzzle IDs: `[1]`, `[2]`, `[3]`
- Single answer value (no array needed)

### ✅ **Cleaner Data Structure**
```json
{
  "answer": "32",              // Single value, not array
  "previousPuzzleId": [2]      // Array for flexibility
}
```

### ✅ **Better Tracking**
- Google Sheets logs show: `"unlockedVia": "Puzzle 2"`
- For multiple: `"unlockedVia": "Puzzle 7 OR 8 OR 9"`
- Clear audit trail of puzzle progression

### ✅ **Flexible Entry Points**
- Multiple starting puzzles: `"previousPuzzleId": [0]`
- Multiple paths to same puzzle: `"previousPuzzleId": [5, 6]`

### ✅ **Simpler Answer Handling**
- One answer per puzzle (cleaner)
- No array iteration needed
- Direct string comparison

## Adding New Puzzles

### Starting Puzzle
```json
{
  "id": 10,
  "linkid": "XG10",
  "answer": "NEWSTART",
  "previousPuzzleId": [0]
}
```

### Sequential Puzzle
```json
{
  "id": 11,
  "linkid": "XG11",
  "answer": "ANSWER11",
  "previousPuzzleId": [10]
}
```

### Multiple Prerequisites (Branching Paths)
```json
{
  "id": 20,
  "linkid": "XG20",
  "answer": "CONVERGENCE",
  "previousPuzzleId": [15, 16, 17]
}
```
*This puzzle can be unlocked by completing puzzle 15, 16, OR 17*

## Migration Notes

- Old `previousPuzzleAnswers` field → removed
- Old `answers` array → changed to single `answer` string
- All existing puzzles updated to use `previousPuzzleId` array
- Backward compatibility: **NOT maintained** (clean break)
- Google Sheets logging enhanced with `unlockedVia` field

## Testing Checklist

- [ ] Starting puzzle (ID 1) accepts any code
- [ ] Puzzle 2 requires Puzzle 1's answer ("-5")
- [ ] Puzzle 3 requires Puzzle 2's answer ("32")
- [ ] Invalid codes are rejected
- [ ] Google Sheets logs show correct `unlockedVia` data
- [ ] QR code scanning still works
- [ ] Manual entry still works
- [ ] Multiple prerequisites work (if implemented)

---

**Last Updated:** 2026-01-28  
**Version:** 3.0 - Array-Based Prerequisites + Single Answer

