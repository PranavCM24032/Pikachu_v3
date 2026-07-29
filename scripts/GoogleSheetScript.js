// ==========================================
// PIKACHU 4-PAGE ARCHITECTURE (v4.2)
// ==========================================
/**
 * Routing:
 * 1. REGISTRATION     -> "registration"
 * 2. Mission L1_*     -> "level_1"
 * 3. Mission L2_*     -> "level_2"
 * 4. Mission L3_*     -> "level_3"
 *
 * Each log includes ServerTime, Action, TeamName, PuzzleID,
 * UnixTS, and a full JSON payload in the last column.
 */

function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
}

function getTargetSheet(missionStr) {
    if (!missionStr) return 'level_1';
    if (missionStr.indexOf('L1') === 0) return 'level_1';
    if (missionStr.indexOf('L2') === 0) return 'level_2';
    if (missionStr.indexOf('L3') === 0) return 'level_3';
    return 'level_1';
}

function ensureSheet(ss, name, headers) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
        sheet = ss.insertSheet(name);
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length)
            .setFontWeight("bold").setBackground("#333333").setFontColor("white");
    }
    return sheet;
}

function handleRequest(e) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(15000);
    } catch (lErr) {
        return respond({ status: 'error', message: 'Server busy, lock timeout.' });
    }

    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var now = new Date();
        var serverTime = Utilities.formatDate(now, "GMT+5:30", "yyyy-MM-dd HH:mm:ss");
        var unixTs = Math.floor(now.getTime() / 1000);

        // ────── POST ──────
        if (e && e.postData && e.postData.contents) {
            var rawContent = e.postData.contents;
            var data = JSON.parse(rawContent);

            var missionStr = data.mission || '';
            var language = data.language || 'N/A';
            var level = 'N/A';
            var type = 'N/A';

            if (missionStr.indexOf('_') > -1) {
                var parts = missionStr.split('_');
                level = parts[0];
                type = parts[1];
            }

            // ── REGISTRATION ──
            if (data.action === 'REGISTRATION') {
                var regHeaders = ['Time', 'Team Name', 'TID', 'Level', 'Type', 'Language', 'UnixTS', 'Raw Data'];
                var regSheet = ensureSheet(ss, 'registration', regHeaders);
                regSheet.appendRow([serverTime, data.teamName || '', data.tid || '', level, type, language, unixTs, JSON.stringify(data)]);
                return respond({ status: 'success', sheet: 'registration' });
            }

            // ── SESSION_BATCH (Optimized Bulk Insert) ──
            if (data.action === 'SESSION_BATCH' && Array.isArray(data.events)) {
                var batchHeaders = ['ServerTime', 'Action', 'TeamName', 'PuzzleID', 'UnixTS', 'FullDataJSON'];
                var sheetBatches = { 'level_1': [], 'level_2': [], 'level_3': [] };

                for (var bi = 0; bi < data.events.length; bi++) {
                    var evt = data.events[bi];
                    var evtMission = evt.mission || '';
                    var evtTarget = getTargetSheet(evtMission);

                    sheetBatches[evtTarget].push([
                        serverTime,
                        evt.action || '',
                        evt.teamName || '',
                        evt.puzzleId || '',
                        unixTs,
                        JSON.stringify(evt)
                    ]);
                }

                Object.keys(sheetBatches).forEach(function (sName) {
                    var rowsToInsert = sheetBatches[sName];
                    if (rowsToInsert.length > 0) {
                        var targetSh = ensureSheet(ss, sName, batchHeaders);
                        var startRow = targetSh.getLastRow() + 1;
                        targetSh.getRange(startRow, 1, rowsToInsert.length, batchHeaders.length)
                            .setValues(rowsToInsert);
                    }
                });

                return respond({ status: 'success', batch: data.events.length });
            }

            // ── SINGLE EVENT ──
            var target = getTargetSheet(missionStr);
            var headers = ['ServerTime', 'Action', 'TeamName', 'PuzzleID', 'UnixTS', 'FullDataJSON'];
            var sheet = ensureSheet(ss, target, headers);
            sheet.appendRow([serverTime, data.action || '', data.teamName || '', data.puzzleId || '', unixTs, JSON.stringify(data)]);
            return respond({ status: 'success', sheet: target });
        }

        // ────── GET ──────
        var sheetNames = ['registration', 'level_1', 'level_2', 'level_3'];
        var consolidatedData = [];

        sheetNames.forEach(function (name) {
            var s = ss.getSheetByName(name);
            if (!s) return;
            var rows = s.getDataRange().getDisplayValues();
            if (rows.length <= 1) return;
            var startIdx = 1;
            for (var i = startIdx; i < rows.length; i++) {
                try {
                    var rawJson = rows[i][rows[i].length - 1];
                    var log = JSON.parse(rawJson);
                    log.serverTimestamp = rows[i][0];
                    consolidatedData.push(log);
                } catch (err) { }
            }
        });

        consolidatedData.sort(function (a, b) {
            var dateA = new Date(String(a.serverTimestamp).replace(/-/g, "/"));
            var dateB = new Date(String(b.serverTimestamp).replace(/-/g, "/"));
            return dateB - dateA;
        });

        return respond(consolidatedData);

    } catch (err) {
        return ContentService.createTextOutput(
            JSON.stringify({ status: 'error', message: err.toString() })
        ).setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

function respond(payload) {
    return ContentService.createTextOutput(JSON.stringify(payload))
        .setMimeType(ContentService.MimeType.JSON);
}

function setup() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = [
        { name: 'registration', cols: ['Time', 'Team Name', 'TID', 'Level', 'Type', 'Language', 'UnixTS', 'Raw Data'] },
        { name: 'level_1', cols: ['ServerTime', 'Action', 'TeamName', 'PuzzleID', 'UnixTS', 'FullDataJSON'] },
        { name: 'level_2', cols: ['ServerTime', 'Action', 'TeamName', 'PuzzleID', 'UnixTS', 'FullDataJSON'] },
        { name: 'level_3', cols: ['ServerTime', 'Action', 'TeamName', 'PuzzleID', 'UnixTS', 'FullDataJSON'] }
    ];

    sheets.forEach(function (sh) {
        var s = ss.getSheetByName(sh.name);
        if (!s) s = ss.insertSheet(sh.name);
        s.clear();
        s.appendRow(sh.cols);
        s.getRange(1, 1, 1, sh.cols.length)
            .setFontWeight("bold").setBackground("#333333").setFontColor("white");
    });
}
