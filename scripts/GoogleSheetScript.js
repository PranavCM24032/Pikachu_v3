// ==========================================
// PIKACHU 4-PAGE ARCHITECTURE (v4.0)
// ==========================================
/**
 * Routing:
 * 1. REGISTRATION     -> "Registration"
 * 2. Mission L1_*     -> "L1"
 * 3. Mission L2_*     -> "L2"
 * 4. Mission L3_*     -> "L3"
 *
 * Each log includes ServerTime, Action, TeamName, PuzzleID,
 * Language, UnixTS, and a full JSON payload in the last column.
 */

function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
}

function getTargetSheet(missionStr) {
    if (missionStr.indexOf('L1') === 0) return 'L1';
    if (missionStr.indexOf('L2') === 0) return 'L2';
    if (missionStr.indexOf('L3') === 0) return 'L3';
    return 'L1';
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
    lock.tryLock(15000);

    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var now = new Date();
        var serverTime = Utilities.formatDate(now, "GMT+5:30", "yyyy-MM-dd HH:mm:ss");
        var unixTs = Math.floor(now.getTime() / 1000);

        // ────── POST ──────
        if (e.postData) {
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
                var regSheet = ensureSheet(ss, 'Registration', regHeaders);
                regSheet.appendRow([serverTime, data.teamName, data.tid || '', level, type, language, unixTs, JSON.stringify(data)]);
                return respond({ status: 'success', sheet: 'Registration' });
            }

            // ── SESSION_BATCH ──
            if (data.action === 'SESSION_BATCH' && data.events) {
                var batchHeaders = ['ServerTime', 'Action', 'TeamName', 'PuzzleID', 'Language', 'UnixTS', 'FullDataJSON'];
                for (var bi = 0; bi < data.events.length; bi++) {
                    var evt = data.events[bi];
                    var evtMission = evt.mission || '';
                    var evtLang = evt.language || 'N/A';
                    var evtTarget = getTargetSheet(evtMission);
                    var evtSheet = ensureSheet(ss, evtTarget, batchHeaders);
                    evtSheet.appendRow([serverTime, evt.action, evt.teamName, evt.puzzleId || '', evtLang, unixTs, JSON.stringify(evt)]);
                }
                return respond({ status: 'success', batch: data.events.length });
            }

            // ── SINGLE EVENT ──
            var target = getTargetSheet(missionStr);
            var headers = ['ServerTime', 'Action', 'TeamName', 'PuzzleID', 'Language', 'UnixTS', 'FullDataJSON'];
            var sheet = ensureSheet(ss, target, headers);
            sheet.appendRow([serverTime, data.action, data.teamName, data.puzzleId || '', language, unixTs, JSON.stringify(data)]);
            return respond({ status: 'success', sheet: target });
        }

        // ────── GET ──────
        var sheetNames = ['Registration', 'L1', 'L2', 'L3'];
        var consolidatedData = [];

        sheetNames.forEach(function (name) {
            var s = ss.getSheetByName(name);
            if (!s) return;
            var rows = s.getDataRange().getValues();
            if (rows.length <= 1) return;
            var startIdx = Math.max(1, rows.length - 500);
            for (var i = startIdx; i < rows.length; i++) {
                try {
                    var log = JSON.parse(rows[i][rows[i].length - 1]);
                    log.serverTimestamp = rows[i][0];
                    consolidatedData.push(log);
                } catch (err) { }
            }
        });

        consolidatedData.sort(function (a, b) {
            return new Date(b.serverTimestamp.replace(/-/g, "/")) - new Date(a.serverTimestamp.replace(/-/g, "/"));
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
        { name: 'Registration', cols: ['Time', 'Team Name', 'TID', 'Level', 'Type', 'Language', 'UnixTS', 'Raw Data'] },
        { name: 'L1', cols: ['ServerTime', 'Action', 'TeamName', 'PuzzleID', 'Language', 'UnixTS', 'FullDataJSON'] },
        { name: 'L2', cols: ['ServerTime', 'Action', 'TeamName', 'PuzzleID', 'Language', 'UnixTS', 'FullDataJSON'] },
        { name: 'L3', cols: ['ServerTime', 'Action', 'TeamName', 'PuzzleID', 'Language', 'UnixTS', 'FullDataJSON'] }
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
