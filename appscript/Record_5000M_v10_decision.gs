function doGet(e) {
  if (!e || !e.parameter || !e.parameter.action) {
    return jsonOutput_({
      status: "error",
      message: "Missing action. Use query_history, get_latest, or get_strategy_info."
    });
  }

  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Sheet1");

  if (!sheet) {
    return jsonOutput_({ status: "error", message: "Sheet1 not found." });
  }

  var table = readTable_(sheet);
  var rows = table.rows;
  var idx = table.index;

  if (action === "query_history") {
    return jsonOutput_(queryHistory_(rows, idx, e.parameter));
  }

  if (action === "get_latest") {
    return jsonOutput_(getLatest_(ss, rows, idx));
  }

  if (action === "get_strategy_info") {
    return jsonOutput_(getStrategyInfo_(ss, rows, idx));
  }

  return ContentService
    .createTextOutput("Unknown API action.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function readTable_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return { headers: [], index: {}, rows: [] };
  }

  var headers = values[0].map(function(header) {
    return String(header || "").trim();
  });

  var index = {};
  headers.forEach(function(header, i) {
    if (header) index[header] = i;
  });

  return {
    headers: headers,
    index: index,
    rows: values.slice(1)
  };
}

function getValue_(row, idx, header, fallback) {
  if (idx[header] === undefined) return fallback;
  var value = row[idx[header]];
  return value === "" || value === null || value === undefined ? fallback : value;
}

function numberOrZero_(value) {
  if (value === "" || value === null || value === undefined) return 0;
  var parsed = Number(String(value).replace(/,/g, ""));
  return isFinite(parsed) ? parsed : 0;
}

function formatDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy/MM/dd");
  }
  return String(value || "");
}

function parseDate_(value) {
  if (value instanceof Date) return value;
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function validDataRow_(row, idx) {
  var date = parseDate_(getValue_(row, idx, "Date", ""));
  var strategy = String(getValue_(row, idx, "Strategy", "") || "").trim();
  return date && strategy;
}

function queryHistory_(rows, idx, params) {
  var validRows = rows.filter(function(row) {
    return validDataRow_(row, idx);
  });

  if (validRows.length === 0) return [];

  var firstDateInSheet = parseDate_(getValue_(validRows[0], idx, "Date", ""));
  var lastDateInSheet = parseDate_(getValue_(validRows[validRows.length - 1], idx, "Date", ""));
  var day90Ms = 90 * 24 * 60 * 60 * 1000;
  var defaultStart = firstDateInSheet;
  var defaultEnd = lastDateInSheet;

  if (lastDateInSheet && firstDateInSheet && (lastDateInSheet - firstDateInSheet) > day90Ms) {
    defaultStart = new Date(lastDateInSheet.getTime() - day90Ms);
    defaultEnd = lastDateInSheet;
  }

  var startDate = params.start ? new Date(params.start) : defaultStart;
  var endDate = params.end ? new Date(params.end) : defaultEnd;
  endDate.setHours(23, 59, 59, 999);

  var strategyList = [];
  if (params.strategy && params.strategy !== "all") {
    strategyList = params.strategy.split(",").map(function(item) {
      return item.trim();
    });
  }

  var results = [];
  validRows.forEach(function(row) {
    var rowDate = parseDate_(getValue_(row, idx, "Date", ""));
    var strategyName = String(getValue_(row, idx, "Strategy", "") || "").trim();
    var isMatch = strategyList.length === 0 || strategyList.indexOf(strategyName) !== -1;

    if (isMatch && rowDate >= startDate && rowDate <= endDate) {
      results.push({
        date: formatDate_(rowDate),
        platform: getValue_(row, idx, "Platform", ""),
        strategy: strategyName,
        grossPnL: getValue_(row, idx, "GrossPnL", 0),
        profitShare: getValue_(row, idx, "ProfitShare", 0),
        floatingPL: getValue_(row, idx, "FloatingPL", 0),
        endBalance: getValue_(row, idx, "EndBalance", 0),
        equality: getValue_(row, idx, "Equality", 0),
        fundPool: getValue_(row, idx, "FundPool", 0)
      });
    }
  });

  return results;
}

function getLatest_(ss, rows, idx) {
  var latestData = {};

  for (var i = rows.length - 1; i >= 0; i--) {
    var row = rows[i];
    if (!validDataRow_(row, idx)) continue;

    var strategyName = String(getValue_(row, idx, "Strategy", "") || "").trim();
    if (latestData[strategyName] !== undefined) continue;

    latestData[strategyName] = {
      date: formatDate_(getValue_(row, idx, "Date", "")),
      equality: getValue_(row, idx, "Equality", 0),
      credit: getValue_(row, idx, "EndCredit", 0),
      balance: getValue_(row, idx, "EndBalance", 0),
      floatingPL: getValue_(row, idx, "FloatingPL", 0)
    };
  }

  return enrichLatestWithStrategyControl_(ss, latestData);
}

function getStrategyInfo_(ss, rows, idx) {
  var strategyInfo = {};

  rows.forEach(function(row) {
    if (!validDataRow_(row, idx)) return;

    var strategyName = String(getValue_(row, idx, "Strategy", "") || "").trim();
    var transferInVal = numberOrZero_(getValue_(row, idx, "TransferIn-Bal", 0));
    var bonusCredVal = numberOrZero_(getValue_(row, idx, "Bonus-Cred", 0));

    if (strategyInfo[strategyName] === undefined) {
      strategyInfo[strategyName] = {
        platform: getValue_(row, idx, "Platform", ""),
        joinDate: formatDate_(getValue_(row, idx, "Date", "")),
        initialBalance: transferInVal,
        initialCredit: bonusCredVal
      };
    } else {
      strategyInfo[strategyName].initialBalance += transferInVal;
      strategyInfo[strategyName].initialCredit += bonusCredVal;
    }
  });

  return enrichStrategyInfoWithControl_(ss, strategyInfo);
}

function readControlByStrategy_(ss) {
  var sheet = ss.getSheetByName("StrategyControl");
  if (!sheet) return {};

  var table = readTable_(sheet);
  var byStrategy = {};

  table.rows.forEach(function(row) {
    var strategyName = String(getValue_(row, table.index, "strategy", "") || "").trim();
    if (!strategyName) return;

    byStrategy[strategyName] = {
      status: getValue_(row, table.index, "status", ""),
      riskLevel: getValue_(row, table.index, "riskLevel", ""),
      actionNote: getValue_(row, table.index, "actionNote", ""),
      maxDrawdown: getValue_(row, table.index, "maxDrawdown", 0),
      stopLossRatio: getValue_(row, table.index, "stopLossRatio", ""),
      watchRatio: getValue_(row, table.index, "watchRatio", ""),
      updatedAt: getValue_(row, table.index, "updatedAt", ""),
      note: getValue_(row, table.index, "note", "")
    };
  });

  return byStrategy;
}

function normalizeStatus_(value) {
  var normalized = String(value || "").trim().toLowerCase();
  if (["active", "normal", "ok"].indexOf(normalized) >= 0) return "active";
  if (["watch", "observe"].indexOf(normalized) >= 0) return "watch";
  if (["paused", "pause", "warning"].indexOf(normalized) >= 0) return "paused";
  if (["stopped", "stop", "closed"].indexOf(normalized) >= 0) return "stopped";
  return "";
}

function inferRiskFields_(latest, control) {
  var balance = numberOrZero_(latest.balance);
  var floatingPL = numberOrZero_(latest.floatingPL);
  var equity = numberOrZero_(latest.equality);
  var floatingRatio = balance > 0 ? floatingPL / balance : 0;
  var watchRatio = control.watchRatio !== "" && control.watchRatio !== undefined
    ? Number(control.watchRatio)
    : -0.10;
  var pauseRatio = control.stopLossRatio !== "" && control.stopLossRatio !== undefined
    ? Number(control.stopLossRatio)
    : -0.20;

  var status = normalizeStatus_(control.status);
  if (!status) {
    if (equity <= 0 && balance <= 0) status = "stopped";
    else if (floatingRatio <= pauseRatio) status = "paused";
    else if (floatingRatio <= watchRatio) status = "watch";
    else status = "active";
  }

  var riskLevel = control.riskLevel || (
    status === "active" ? "low" :
    status === "watch" ? "medium" :
    status === "paused" ? "high" :
    "stopped"
  );

  var actionNote = control.actionNote || (
    status === "active" ? "hold" :
    status === "watch" ? "watch_one_week" :
    status === "paused" ? "reduce_capital_or_pause_copy" :
    "remove_from_portfolio"
  );

  return {
    status: status,
    riskLevel: riskLevel,
    actionNote: actionNote,
    floatingRatio: floatingRatio,
    maxDrawdown: numberOrZero_(control.maxDrawdown)
  };
}

function enrichLatestWithStrategyControl_(ss, latestData) {
  var controlByStrategy = readControlByStrategy_(ss);

  Object.keys(latestData).forEach(function(strategyName) {
    var control = controlByStrategy[strategyName] || {};
    var risk = inferRiskFields_(latestData[strategyName], control);
    latestData[strategyName] = Object.assign({}, latestData[strategyName], risk);
  });

  return latestData;
}

function enrichStrategyInfoWithControl_(ss, strategyInfo) {
  var controlByStrategy = readControlByStrategy_(ss);

  Object.keys(strategyInfo).forEach(function(strategyName) {
    var control = controlByStrategy[strategyName] || {};
    strategyInfo[strategyName] = Object.assign({}, strategyInfo[strategyName], {
      status: normalizeStatus_(control.status),
      riskLevel: control.riskLevel || "",
      actionNote: control.actionNote || "",
      maxDrawdown: numberOrZero_(control.maxDrawdown),
      watchRatio: control.watchRatio === undefined ? "" : control.watchRatio,
      stopLossRatio: control.stopLossRatio === undefined ? "" : control.stopLossRatio
    });
  });

  return strategyInfo;
}
