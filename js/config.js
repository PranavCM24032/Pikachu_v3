// ==============================
// GAME CONFIGURATION
// ==============================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyVXolSPaqgooiB1JvMwj_rM_Vq0KqwvvEupEgHIgXcCpO_cw0gKYJBHg31AHaEqwPs/exec';

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
