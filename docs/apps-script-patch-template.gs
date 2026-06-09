/**
 * Apps Script patch template for Dashboard_EA_0511.
 *
 * This is not a full replacement until the current Apps Script source is pasted
 * into the repo. Use these helpers to extend the existing implementation while
 * preserving current endpoint names:
 *
 * - query_history
 * - get_latest
 * - get_strategy_info
 */

const SHEET_NAMES = {
  history: 'History',
  strategyInfo: 'StrategyInfo',
  strategyControl: 'StrategyControl',
  apiConfig: 'ApiConfig',
};

const DEFAULT_RISK = {
  watchRatio: -0.10,
  pauseRatio: -0.20,
};

function normalizeHeader_(value) {
  return String(value || '').trim();
}

function numberOrZero_(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus_(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['active', 'normal', 'ok'].indexOf(normalized) >= 0) return 'active';
  if (['watch', 'observe'].indexOf(normalized) >= 0) return 'watch';
  if (['paused', 'pause', 'warning'].indexOf(normalized) >= 0) return 'paused';
  if (['stopped', 'stop', 'closed'].indexOf(normalized) >= 0) return 'stopped';
  return '';
}

function rowsToObjects_(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(normalizeHeader_);
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return cell !== '' && cell !== null; });
  }).map(function(row) {
    const obj = {};
    headers.forEach(function(header, index) {
      if (header) obj[header] = row[index];
    });
    return obj;
  });
}

function keyBy_(rows, keyField) {
  return rows.reduce(function(acc, row) {
    const key = String(row[keyField] || '').trim();
    if (key) acc[key] = row;
    return acc;
  }, {});
}

function inferRiskFields_(strategyName, latest, control) {
  const balance = numberOrZero_(latest.balance);
  const floatingPL = numberOrZero_(latest.floatingPL);
  const equity = numberOrZero_(latest.equality);
  const floatingRatio = balance > 0 ? floatingPL / balance : 0;
  const watchRatio = control.watchRatio !== undefined && control.watchRatio !== ''
    ? Number(control.watchRatio)
    : DEFAULT_RISK.watchRatio;
  const pauseRatio = control.stopLossRatio !== undefined && control.stopLossRatio !== ''
    ? Number(control.stopLossRatio)
    : DEFAULT_RISK.pauseRatio;

  let status = normalizeStatus_(control.status);
  if (!status) {
    if (equity <= 0 && balance <= 0) status = 'stopped';
    else if (floatingRatio <= pauseRatio) status = 'paused';
    else if (floatingRatio <= watchRatio) status = 'watch';
    else status = 'active';
  }

  const riskLevel = control.riskLevel || (
    status === 'active' ? 'low' :
    status === 'watch' ? 'medium' :
    status === 'paused' ? 'high' :
    'stopped'
  );

  const actionNote = control.actionNote || (
    status === 'active' ? 'hold' :
    status === 'watch' ? 'watch_one_week' :
    status === 'paused' ? 'reduce_capital_or_pause_copy' :
    'remove_from_portfolio'
  );

  return {
    status: status,
    riskLevel: riskLevel,
    actionNote: actionNote,
    floatingRatio: floatingRatio,
    maxDrawdown: numberOrZero_(control.maxDrawdown),
  };
}

/**
 * Add this join step inside the current get_latest implementation after the
 * latest-by-strategy object is built.
 */
function enrichLatestWithStrategyControl_(latestByStrategy) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const controlRows = rowsToObjects_(ss.getSheetByName(SHEET_NAMES.strategyControl));
  const controlByStrategy = keyBy_(controlRows, 'strategy');

  Object.keys(latestByStrategy).forEach(function(strategyName) {
    const control = controlByStrategy[strategyName] || {};
    const risk = inferRiskFields_(strategyName, latestByStrategy[strategyName], control);
    latestByStrategy[strategyName] = Object.assign({}, latestByStrategy[strategyName], risk);
  });

  return latestByStrategy;
}

/**
 * Add this join step inside the current get_strategy_info implementation after
 * the strategy-info object is built.
 */
function enrichStrategyInfoWithControl_(strategyInfoByName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const controlRows = rowsToObjects_(ss.getSheetByName(SHEET_NAMES.strategyControl));
  const controlByStrategy = keyBy_(controlRows, 'strategy');

  Object.keys(strategyInfoByName).forEach(function(strategyName) {
    const control = controlByStrategy[strategyName] || {};
    strategyInfoByName[strategyName] = Object.assign({}, strategyInfoByName[strategyName], {
      status: normalizeStatus_(control.status),
      riskLevel: control.riskLevel || '',
      actionNote: control.actionNote || '',
      maxDrawdown: numberOrZero_(control.maxDrawdown),
      watchRatio: control.watchRatio === undefined ? '' : control.watchRatio,
      stopLossRatio: control.stopLossRatio === undefined ? '' : control.stopLossRatio,
    });
  });

  return strategyInfoByName;
}

/**
 * Expected endpoint integration:
 *
 * if (action === 'get_latest') {
 *   const latest = buildExistingLatestObjectSomehow_();
 *   return json_(enrichLatestWithStrategyControl_(latest));
 * }
 *
 * if (action === 'get_strategy_info') {
 *   const info = buildExistingStrategyInfoObjectSomehow_();
 *   return json_(enrichStrategyInfoWithControl_(info));
 * }
 *
 * query_history can remain unchanged for v1 unless you want to expose netPnL or
 * row-level floatingRatio.
 */
