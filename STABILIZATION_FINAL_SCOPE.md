# Stabilization Final Scope

This package focuses on the final stabilization layer before major feature work.

## Included code fixes
- AppStorage expanded to cover plan persistence
- Current project pointer routed through AppStorage
- App reset clears all important persisted keys
- Redundant applyLang override removed
- updatePlanUI calc-mode fallback bug fixed
- Project snapshot restore sync moved through AppStorage
- Quote settings module prefers AppStorage

## What this package does NOT claim
The following are not fully rebuilt here in one pass:
- Full ASHRAE healthcare engine redesign
- Full report redesign
- OCR
- Complete Apple-style UI rewrite

## Recommended next phase
1. Engine hardening
2. Technical report redesign
3. UI refresh
4. OCR / automation features
