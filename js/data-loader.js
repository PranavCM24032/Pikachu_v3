// ==============================
// 0. ASSET PRELOADER (FOR SPEED)
// ==============================
const AssetPreloader = {
    cached: new Set(),
    preload(puzzles) {
        console.log("🚀 [Assets] Fast-tracking Pokemon & Badge sprites...");
        puzzles.forEach(p => {
            if (p.pokemonId) {
                const img = new Image();
                img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.pokemonId}.png`;
                // Pre-cache cry URL hint
                fetch(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/cries/latest/${p.pokemonId}.ogg`, { mode: 'no-cors' }).catch(() => { });
            }
            if (p.id) {
                const img = new Image();
                img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/${p.id}.png`;
            }
        });
    }
};

async function loadPuzzles() {
    try {
        const response = await fetch('data/puzzle.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        PUZZLES = await response.json();
        console.log(`Loaded ${PUZZLES.length} puzzles from puzzle.json`);

        // Speed up UI by pre-caching all sprites
        AssetPreloader.preload(PUZZLES);

        // Validate puzzles have required fields
        PUZZLES.forEach((puzzle, index) => {
            if (!puzzle.id || (!puzzle.questionPython && !puzzle.questionCpp) || !puzzle.answers) {
                console.error(`Puzzle ${index + 1} is missing required fields`);
            }
        });

        return true;
    } catch (error) {
        console.error('FATAL: Could not load puzzle data:', error);
        showToast('Cannot load puzzle data. Please refresh or contact administrator.', 'error');
        return false;
    }
}
async function loadTeams() {
    try {
        const response = await fetch('data/teams.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        TEAMS = await response.json();
        console.log(`Loaded ${TEAMS.length} teams from teams.json`);
        console.log('Teams:', TEAMS); // Debug log to verify

        // Validate that we have teams
        if (TEAMS.length === 0) {
            throw new Error('No teams found in teams.json');
        }
        return true;
    } catch (error) {
        console.error('FATAL: Could not load team data:', error);
        showToast('Cannot load team data. Please refresh or contact administrator.', 'error');
        return false;
    }
}

async function loadMemes() {
    try {
        const response = await fetch('data/meme.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        MEMES = await response.json();
        console.log(`Loaded ${MEMES.length} memes from meme.json`);
        return true;
    } catch (error) {
        console.warn('Could not load meme data:', error);
        MEMES = [];
        return false;
    }
}
