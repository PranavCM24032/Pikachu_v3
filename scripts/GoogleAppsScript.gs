// =================================================================
// PYKACHU HUNT - MULTI-TAB (1-ROW-PER-TEAM PER SHEET) BACKEND
// =================================================================
// 4 Tabs in 1 Workbook: Registration, L1, L2, L3
// Each team gets ONLY 1 ROW per tab, updated in-place.
// Events are routed to the tab matching the team's REGISTERED mission
// level: L1_* -> L1, L2_* -> L2, L3_* -> L3. Registration events go
// only to the Registration tab. All 3 level tabs share one schema.

var GAME_STEP_ACTIONS = [
  'QR_SCANNED',
  'PUZZLE_UNLOCKED',
  'UNLOCK_FAILED',
  'SOLVED',
  'WRONG_ATTEMPT',
  'HINT_REQUESTED',
  'HINT_USED',
  'PENALTY_TRIGGERED',
  'PENALTY'
];

var ACCESS_TOKEN = 'pyk2026@secGX42';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetsExist(ss);

    var data = JSON.parse(e.postData.contents);

    if (!data.token || data.token !== ACCESS_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'SESSION_BATCH' && Array.isArray(data.events)) {
      data.events.forEach(function(event) { processEvent(ss, event); });
    } else {
      processEvent(ss, data);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function processEvent(ss, data) {
  var action = data.action || '';
  if (action.indexOf('MEME') !== -1) return;

  var timestamp = data.timestamp || new Date().toISOString();
  var teamName = (data.teamName || data.team || '').toString().trim();
  if (!teamName || teamName === 'Unknown' || teamName === 'NO TEAM') return;

  var tid = (data.tid || '').toString().trim();
  var mission = (data.mission || '').toString();

  // 1. REGISTRATION TAB only (never a level tab)
  if (action === 'REGISTRATION') {
    var regSheet = ss.getSheetByName("Registration");
    updateRegistrationRow(regSheet, teamName, tid, data, timestamp);
    return;
  }

  // Ignore non-game-step telemetry (SESSION_START, CONNECTION_TEST, PROMISE_REJECTION, ...)
  if (GAME_STEP_ACTIONS.indexOf(action) === -1) return;

  // 2. Route by registered mission level: L1/L2/L3
  var level = mission.split('_')[0].toUpperCase();
  if (level !== 'L1' && level !== 'L2' && level !== 'L3') return;

  var sheet = ss.getSheetByName(level);
  updateLevelRow(sheet, teamName, tid, mission, action, data, timestamp);
}

// Update Registration Sheet Row
function updateRegistrationRow(sheet, teamName, tid, data, timestamp) {
  var rowIdx = findTeamRow(sheet, teamName);
  var rowArray = [
    timestamp,
    tid,
    teamName,
    data.language || 'PYTHON',
    data.mission || 'L1',
    data.sessionId || ''
  ];
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, 6).setValues([rowArray]);
  } else {
    sheet.appendRow(rowArray);
  }
}

// Unified row updater for L1/L2/L3 tabs (same 12-column schema)
function updateLevelRow(sheet, teamName, tid, mission, action, data, timestamp) {
  var rowIdx = findTeamRow(sheet, teamName);
  var isAnswerSubmission = (action === 'SOLVED' || action === 'WRONG_ATTEMPT');

  var record = {
    lastActive: isAnswerSubmission ? timestamp : '',
    tid: tid,
    teamName: teamName,
    mission: mission,
    status: 'ACTIVE',
    wrongAttempts: 0,
    tabSwitches: 0,
    hintUsed: 'NO',
    solveTime: '',
    nodesPath: '',
    lastNode: '',
    totalScans: 0
  };

  if (rowIdx > 0) {
    var vals = sheet.getRange(rowIdx, 1, 1, 12).getValues()[0];
    record.lastActive = isAnswerSubmission ? timestamp : (vals[0] || timestamp);
    record.tid = tid || vals[1];
    record.teamName = vals[2] || teamName;
    record.mission = mission || vals[3] || '';
    record.status = vals[4] || 'ACTIVE';
    record.wrongAttempts = parseInt(vals[5] || 0);
    record.tabSwitches = parseInt(vals[6] || 0);
    record.hintUsed = vals[7] || 'NO';
    record.solveTime = vals[8] || '';
    record.nodesPath = vals[9] || '';
    record.lastNode = vals[10] || '';
    record.totalScans = parseInt(vals[11] || 0);
  }

  // Track scanned/unlocked nodes in the path
  var node = (data.linkId || data.puzzleLink || data.scannedData || '').toString();
  if (node && (action === 'QR_SCANNED' || action === 'PUZZLE_UNLOCKED')) {
    var nodesList = record.nodesPath ? record.nodesPath.split(' -> ') : [];
    if (nodesList.indexOf(node) === -1) nodesList.push(node);
    record.nodesPath = nodesList.join(' -> ');
    record.lastNode = node;
    record.totalScans = nodesList.length;
  }

  if (action === 'SOLVED') {
    record.status = 'SOLVED';
    record.solveTime = timestamp;
    record.lastActive = timestamp;
  } else if (action === 'WRONG_ATTEMPT') {
    record.wrongAttempts += 1;
    record.status = 'RETRYING';
    record.lastActive = timestamp;
  } else if (action === 'PUZZLE_UNLOCKED') {
    record.status = 'UNLOCKED';
  } else if (action === 'UNLOCK_FAILED') {
    record.status = 'LOCKED';
  } else if (action === 'PENALTY_TRIGGERED' || action === 'PENALTY') {
    if (typeof data.penaltyCount === 'number') record.tabSwitches = data.penaltyCount;
    else if (typeof data.tabSwitches === 'number') record.tabSwitches = data.tabSwitches;
    else record.tabSwitches += 1;
  } else if (action === 'HINT_USED' || action === 'HINT_REQUESTED') {
    record.hintUsed = 'YES';
  }

  var rowArray = [
    record.lastActive,
    record.tid,
    record.teamName,
    record.mission,
    record.status,
    record.wrongAttempts,
    record.tabSwitches,
    record.hintUsed,
    record.solveTime,
    record.nodesPath,
    record.lastNode,
    record.totalScans
  ];

  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, 12).setValues([rowArray]);
  } else {
    sheet.appendRow(rowArray);
  }
}

function findTeamRow(sheet, teamName) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] && data[i][2].toString().trim().toUpperCase() === teamName.toUpperCase()) {
      return i + 1;
    }
  }
  return -1;
}

function ensureSheetsExist(ss) {
  var tabs = [
    { name: "Registration", headers: ["Registration Time", "TID", "Team Name", "Language", "Mission", "Session ID"] },
    { name: "L1", headers: ["Last Active", "TID", "Team Name", "Mission", "Status", "Wrong Attempts", "Tab Switches", "Hint Used", "Solve Time", "Nodes Path", "Last Node", "Total Scans"] },
    { name: "L2", headers: ["Last Active", "TID", "Team Name", "Mission", "Status", "Wrong Attempts", "Tab Switches", "Hint Used", "Solve Time", "Nodes Path", "Last Node", "Total Scans"] },
    { name: "L3", headers: ["Last Active", "TID", "Team Name", "Mission", "Status", "Wrong Attempts", "Tab Switches", "Hint Used", "Solve Time", "Nodes Path", "Last Node", "Total Scans"] }
  ];

  tabs.forEach(function(t) {
    var sheet = ss.getSheetByName(t.name);
    if (!sheet) {
      sheet = ss.insertSheet(t.name);
    }
    var headerRange = sheet.getRange(1, 1, 1, t.headers.length);
    headerRange.setValues([t.headers]);
    headerRange.setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  });
}

// Serves clean aggregated JSON data to the Admin Dashboard
function doGet(e) {
  try {
    if (!e.parameter.token || e.parameter.token !== ACCESS_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ error: true, message: "unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetsExist(ss);
    var list = [];

    // 1. Read Registration
    var regSheet = ss.getSheetByName("Registration");
    var regData = regSheet ? regSheet.getDataRange().getValues() : [];
    for (var i = 1; i < regData.length; i++) {
      list.push({
        isSummary: true,
        action: 'REGISTRATION',
        registered: true,
        lastActive: regData[i][0],
        tid: regData[i][1],
        teamName: regData[i][2],
        language: regData[i][3],
        mission: regData[i][4]
      });
    }

    // 2. Read L1/L2/L3 (identical schemas)
    ['L1', 'L2', 'L3'].forEach(function(sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      var rows = sheet ? sheet.getDataRange().getValues() : [];
      for (var j = 1; j < rows.length; j++) {
        list.push({
          isSummary: true,
          action: 'SUMMARY',
          lastActive: rows[j][0],
          tid: rows[j][1],
          teamName: rows[j][2],
          mission: rows[j][3],
          level: sheetName,
          status: rows[j][4],
          wrongAttempts: parseInt(rows[j][5] || 0),
          tabSwitches: parseInt(rows[j][6] || 0),
          hintUsed: rows[j][7] === 'YES',
          solveTime: rows[j][8],
          nodesPath: rows[j][9],
          l3Path: rows[j][9],
          lastNode: rows[j][10],
          totalScans: parseInt(rows[j][11] || 0)
        });
      }
    });

    return ContentService.createTextOutput(JSON.stringify(list))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: true, message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
