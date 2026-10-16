# AirCalc Pro Stress Test Report

Version target: v1.0.0-beta.1  
Date: 2026-07-25

## Scope

Stress test focused on deterministic project data scale:

- 10 rooms
- 50 rooms
- 100 rooms
- 250 rooms
- 500 rooms

The benchmark generated synthetic room records, calculated project totals, and generated a technical-report-like HTML table model. This is not a full browser DOM rendering benchmark because automated browser launch was blocked by the current sandbox.

## Automated Benchmark Results

| Rooms | Execution Time | Memory Delta | Report HTML Size | Errors | Warnings |
|---:|---:|---:|---:|---:|---:|
| 10 | 0.877 ms | 874.7 KB | 918 bytes | 0 | 0 |
| 50 | 0.164 ms | 36.7 KB | 4,249 bytes | 0 | 0 |
| 100 | 0.256 ms | 71.9 KB | 8,412 bytes | 0 | 0 |
| 250 | 0.574 ms | 179.0 KB | 20,900 bytes | 0 | 0 |
| 500 | 2.506 ms | -57.6 KB | 41,714 bytes | 0 | 0 |

Latest `npm run verify` stress pass:

| Rooms | Execution Time | Memory Delta | Report HTML Size | Errors | Warnings |
|---:|---:|---:|---:|---:|---:|
| 10 | 0.442 ms | -560.9 KB | 918 bytes | 0 | 0 |
| 50 | 0.080 ms | 36.3 KB | 4,249 bytes | 0 | 0 |
| 100 | 0.122 ms | 71.1 KB | 8,412 bytes | 0 | 0 |
| 250 | 0.257 ms | 177.1 KB | 20,900 bytes | 0 | 0 |
| 500 | 0.588 ms | 1,091.8 KB | 41,714 bytes | 0 | 0 |

Memory deltas are approximate because Node garbage collection may run during the test.

## Functional Test Coverage

All available Node tests passed:

- 44 tests passed.
- 0 tests failed.

Covered areas include engineering calculation engine, equipment database, equipment selector, reports, cloud sync foundation, collaboration foundation, AI foundation, Copilot health, and Firestore rules.

## Findings

### Critical

None found in automated stress path.

### High

- Full browser rendering with 250 to 500 visible room cards should be manually verified because the static benchmark does not measure DOM layout cost.

### Medium

- Large report tables may need pagination or virtual rendering after beta if real users manage hundreds of rooms in one project.
- PDF generation for very large room counts should be tested manually with actual browser PDF libraries.

### Low

- Synthetic results show calculations scale linearly and quickly in Node.

## Recommendations

1. Keep current beta scope.
2. Add real browser performance profiling before public launch.
3. Consider report pagination or grouped room summaries if projects above 100 rooms become common.

## Result

Stress test result: Beta Pass for deterministic computation, with browser-rendering verification remaining.
