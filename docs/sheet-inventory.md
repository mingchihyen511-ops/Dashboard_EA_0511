# Record_5000M Workbook Inventory

## Workbook

File: `Record_5000M.xlsx`

Sheets:

- `Sheet1`: 985 rows x 15 columns.
- `EA_information`: 15 rows x 7 columns.
- `app script`: 996 rows x 5 columns.
- `Note_cash`: 16 rows x 1 column.

## `Sheet1` Columns

| Index | Column | Header | Current Apps Script usage |
| --- | --- | --- | --- |
| 0 | A | Date | `date` |
| 1 | B | Platform | `platform` |
| 2 | C | Strategy | `strategy` |
| 3 | D | GrossPnL | `grossPnL` |
| 4 | E | ProfitShare | `profitShare` |
| 5 | F | Withdrawal-Bal | not exposed |
| 6 | G | Drop-Cred | not exposed |
| 7 | H | FloatingPL | `floatingPL` |
| 8 | I | TransferIn-Bal | `initialBalance` accumulator |
| 9 | J | Bonus-Cred | `initialCredit` accumulator |
| 10 | K | EndBalance | `endBalance`, `balance` |
| 11 | L | EndCredit | `credit` |
| 12 | M | Equality | `equality` |
| 13 | N | FundPool | `fundPool` |
| 14 | O | Notes | not exposed |

## Important Formulas

- `Equality` rows use formulas like `=L2+K2+H2`.
- `FundPool` rows chain forward/backward with formulas like `=N3+M2` and `=N10`.
- Several rows contain hand-built `GrossPnL` formulas, for example `=547.25+1113.75+1311.75+1179.92`.

## Current Risk

The Apps Script currently reads columns by numeric index. That works for the current sheet, but it is fragile if columns are inserted before existing fields. The replacement script should resolve columns by header name and keep all current endpoint output fields unchanged.

## Recommended Additions

Add a new `StrategyControl` sheet:

| Header | Type | Notes |
| --- | --- | --- |
| strategy | text | Must match `Sheet1!C:C`. |
| status | dropdown/text | `active`, `watch`, `paused`, `stopped`. |
| riskLevel | dropdown/text | `low`, `medium`, `high`, `stopped`. |
| actionNote | text | `hold`, `watch_one_week`, `reduce_capital`, `remove_from_portfolio`. |
| maxDrawdown | number | Optional manual or formula-backed max drawdown. |
| stopLossRatio | number | Optional strategy-specific pause threshold, e.g. `-0.20`. |
| watchRatio | number | Optional strategy-specific watch threshold, e.g. `-0.10`. |
| updatedAt | date/text | Optional audit field. |
| note | text | Free-form operating note. |

Add an optional `ApiConfig` sheet:

| key | value |
| --- | --- |
| defaultWatchRatio | `-0.10` |
| defaultPauseRatio | `-0.20` |
