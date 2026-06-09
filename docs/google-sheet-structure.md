# Google Sheet Structure Upgrade Plan

## Current API Shape

The live Apps Script API currently exposes three dashboard endpoints:

- `query_history`: array rows with `date`, `platform`, `strategy`, `grossPnL`, `profitShare`, `floatingPL`, `endBalance`, `equality`, `fundPool`.
- `get_latest`: object keyed by strategy with `date`, `equality`, `credit`, `balance`, `floatingPL`.
- `get_strategy_info`: object keyed by strategy with `platform`, `joinDate`, `initialBalance`, `initialCredit`.

The Google Sheet itself could not be read directly because the CSV export returned `401 Unauthorized`, so the sheet/tab/formula inventory below is based on the live API contract and the dashboard requirements.

## Actual Workbook Tabs Found

The uploaded workbook `Record_5000M.xlsx` contains:

- `Sheet1`: main transaction/history table, 985 rows x 15 columns.
- `EA_information`: strategy metadata and target-profit table, 15 rows x 7 columns.
- `app script`: deployment/version notes and test links.
- `Note_cash`: manual notes for `BANK_CASH` withdrawal handling.

## Recommended Tabs

### 1. `Sheet1` (keep existing)

Purpose: append-only daily strategy/account records from broker/copy-trading data.

Required columns:

| Column | Field | Owner | Notes |
| --- | --- | --- | --- |
| Column | Current header | API field | Notes |
| --- | --- | --- | --- |
| A | Date | date | Use `yyyy/mm/dd`; this is the primary timeline key. |
| B | Platform | platform | Example: `Vantange`, `SignalStart`, `VPS`. |
| C | Strategy | strategy | Must exactly match strategy names used in strategy info. |
| D | GrossPnL | grossPnL | Store in the same unit as current API data. |
| E | ProfitShare | profitShare | API subtracts `abs(profitShare)`. |
| F | Withdrawal-Bal | not exposed | Balance withdrawal helper. |
| G | Drop-Cred | not exposed | Credit drop helper. |
| H | FloatingPL | floatingPL | Current floating P/L. |
| I | TransferIn-Bal | initialBalance source | Accumulated by strategy in API. |
| J | Bonus-Cred | initialCredit source | Accumulated by strategy in API. |
| K | EndBalance | endBalance / balance | Latest endpoint exposes this as `balance`. |
| L | EndCredit | credit | Latest endpoint exposes this as `credit`. |
| M | Equality | equality | Keep spelling for current dashboard compatibility. |
| N | FundPool | fundPool | Global reserve pool snapshot. |
| O | Notes | not exposed | Manual row notes. |

Optional derived columns:

| Field | Formula / Meaning |
| --- | --- |
| netPnL | `grossPnL - ABS(profitShare)` |
| floatingRatio | `floatingPL / endBalance`, guarded when balance is `0`. |

### 2. `EA_information` (keep existing)

Purpose: stable strategy metadata and capital base.

Required columns:

| Column | Field | Owner | Notes |
| --- | --- | --- | --- |
| Column | Current header | Recommended role |
| --- | --- | --- |
| A | Strategy | Strategy key. |
| B | Platform | Strategy platform/source. |
| C | SharePrescent | Profit-share rate. Keep typo for backward compatibility if formulas depend on it. |
| D | StartFund | Original display/reference capital. |
| E | target monthly profit % | Target percentage. |
| F | expected profit USD | Formula output. |

### 3. `StrategyControl`

Purpose: manual decision layer that will not be overwritten by imported trading data.

Recommended columns:

| Column | Field | Owner | Allowed values / Notes |
| --- | --- | --- | --- |
| A | strategy | manual | Must match `History.strategy`. |
| B | status | manual | `active`, `watch`, `paused`, `stopped`. |
| C | riskLevel | manual | `low`, `medium`, `high`, or Chinese labels if Apps Script normalizes them. |
| D | actionNote | manual | Example: `hold`, `watch_one_week`, `reduce_capital`, `remove_from_portfolio`. |
| E | maxDrawdown | formula/manual | Can be strategy-level current max drawdown. |
| F | stopLossRatio | manual | Optional per-strategy threshold, e.g. `-0.20`. |
| G | watchRatio | manual | Optional per-strategy threshold, e.g. `-0.10`. |
| H | updatedAt | manual/formula | Useful audit timestamp. |
| I | note | manual | Free-form operating notes. |

### 4. `ApiConfig` (optional)

Purpose: centralize defaults without editing Apps Script.

Recommended rows:

| key | value |
| --- | --- |
| defaultWatchRatio | `-0.10` |
| defaultPauseRatio | `-0.20` |
| includeStoppedInLatest | `true` |

## Dashboard Field Mapping

The dashboard can already calculate fallback values, but the API should eventually return these fields:

| API field | Source |
| --- | --- |
| `status` | `StrategyControl.status`, fallback from floating ratio / zero equity. |
| `riskLevel` | `StrategyControl.riskLevel`, fallback from status. |
| `actionNote` | `StrategyControl.actionNote`, fallback from status. |
| `floatingRatio` | `latest.floatingPL / latest.balance`, fallback `0` if balance is zero. |
| `maxDrawdown` | `StrategyControl.maxDrawdown` or calculated from history. |

## Data Validation Rules

- `StrategyControl.status`: dropdown with `active`, `watch`, `paused`, `stopped`.
- `StrategyControl.riskLevel`: dropdown with `low`, `medium`, `high`.
- `StrategyControl.strategy`: should match an existing `StrategyInfo.strategy`.
- Money fields should stay numeric; avoid `$` signs inside source cells.

## Implementation Order

1. Add `StrategyControl` tab first; do not modify imported history columns.
2. Add optional `ApiConfig` tab for default thresholds.
3. Update Apps Script to join `StrategyControl` into `get_latest` and `get_strategy_info`.
4. Keep old API fields unchanged for frontend backward compatibility.
