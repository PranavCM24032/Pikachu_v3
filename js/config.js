// ==============================
// GAME CONFIGURATION
// ==============================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwGWidAlGFLH-182G93vuyqvujdRV1bSWW07f8RkZOKtuVoBsBdRJ3z-xD7aLwfjc5t/exec';
const GOOGLE_SCRIPT_TOKEN = 'pyk2026@secGX42';

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
        teamInfo: 'pykachuTeam',
        scoreState: 'pykachuScoreState'
    }
};
