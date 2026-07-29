// ==============================
// GAME CONFIGURATION
// ==============================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz-QywPm7vj2OAPuNt3xTTtpV0IbSsQcPiYkV3Ck22DuNDTMFZwRUvsusU3S0IOlGmB/exec';

const CONFIG = {
    HINT_SETTINGS: {
        defaultPenalty: 60,
        hintRequestTimeout: 30,
        tabSwitchResetsPenalty: true
    },
    FEATURES: {
        hintSystem: true
    },
    STORAGE_KEYS: {
        hintState: 'pykachuHintState',
        gameState: 'pykachuGameState',
        teamInfo: 'pykachuTeam'
    }
};
