let PUZZLES = [];
let TEAMS = [];
let MEMES = [];

// ==============================
// GAME STATE
// ==============================
let currentPuzzle = null;
let currentTeam = "";
let currentTeamTid = "";
let sessionId = "";
let urlLockedPuzzle = null;
let currentStep = 1;
let currentMissionLevel = "";
let currentLanguage = "PYTHON";
let isPuzzleActive = false;
let tabSwitchCount = 0;

// Tab switching penalty system
let penaltyActive = false;
let penaltyTimer = null;
let penaltySeconds = 15;
let gameStartTime = null;

// 2-second grace period system
let penaltyDelayTimeout = null;
let graceCountdownInterval = null;

// Puzzle Timer System
let puzzleTimerInterval = null;

// QR Scanner State
let qrScannerActive = false;
let videoStream = null;
let flashActive = false;
let qrScanInterval = null;

// Hint System State
let hintPenaltyActive = false;
let hintPenaltySeconds = 0;
let hintPenaltyTimer = null;
let hintRequestConfirmed = false;
let hintRequestTimeout = null;
let hintTabSwitchDuringPenalty = false;
let hintDisplayed = false;
let currentPuzzleHint = null;

// Grace period variables
let blurTimeout = null;

// ==============================
// SAVE & LOAD GAME STATE
// ==============================
function saveGameState() {
    const gameState = {
        currentTeam,
        currentTeamTid,
        currentStep,
        currentPuzzleId: currentPuzzle?.id,
        tabSwitchCount,
        urlLockedPuzzleId: urlLockedPuzzle?.id,
        sessionId,
        currentLanguage
    };
    localStorage.setItem(CONFIG.STORAGE_KEYS.gameState, JSON.stringify(gameState));
}

function generateSessionId() {
    return 'SESSION_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function standardizeString(str) {
    return (str || '').toString().replace(/\s+/g, '').toUpperCase();
}
