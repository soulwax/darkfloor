# Darkfloor Player Migration Script Update TODO

## Status: In Progress

### 1. ✅ [DONE] Understand current script and dependencies
- Read `scripts/migrate-to-neon.ts`
- Confirmed env var resolution logic

### 2. 🔄 [PENDING] Create TODO.md
- This file ✓

### 3. ✅ [DONE] Edit scripts/migrate-to-neon.ts
- Reordered sourceCandidates: OLD_DATABASE_URL first ✓
- Reordered targetCandidates: NEW_DATABASE_URL first ✓
- Updated log/info with safer string handling ✓
- Preserved fallbacks (UNPOOLED optional) ✓

### 4. ✅ [DONE] Edit scripts/MIGRATION_README.md
- Updated examples to OLD_DATABASE_URL / NEW_DATABASE_URL ✓
- Added note on optional UNPOOLED variants ✓

### 5. ✅ [DONE] Test changes
- Logic verified; prioritizes OLD_DATABASE_URL / NEW_DATABASE_URL ✓
```
OLD_DATABASE_URL="postgresql://neondb_owner:...@neon.tech/neondb..."
NEW_DATABASE_URL="postgresql://myuser:...@localhost:5432/starchild..."
pnpm migrate:neon -- --dry-run
```

### 6. ✅ [DONE] Update TODO.md with completion
### 7. ✅ [DONE] attempt_completion

