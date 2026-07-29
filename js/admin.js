const CONFIG = {
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyEKrFq9qEqzIajeF7TposZeLWwSArjPO64PbovYkzMxDkdqN2VHlsFE8azgnqCqAvb/exec',
    REFRESH_RATE: 5000,
    MAX_LOGS: 500,
    VERSION: '2.5.1'
};

let state = {
    logs: [],
    isFetching: false,
    autoRefresh: true,
    filter: 'ALL',
    activeTab: 'REG',
    refreshTimer: null,
    usingCachedData: false
};

document.addEventListener('DOMContentLoaded', () => {
    const storedVersion = localStorage.getItem('pykachuVersion');
    if (storedVersion !== CONFIG.VERSION) {
        localStorage.removeItem('pykachuLogs');
        localStorage.setItem('pykachuVersion', CONFIG.VERSION);
        console.log('Cache cleared due to version update');
    }

    const cached = localStorage.getItem('pykachuLogs');
    if (cached) {
        try {
            state.logs = JSON.parse(cached);
            state.usingCachedData = true;
            updateDataSourceIndicator();
            renderLogs();
        } catch (e) {
            console.error('Failed to parse cached logs:', e);
            state.logs = [];
            state.usingCachedData = false;
        }
    }

    fetchData();
    startPolling();

    document.addEventListener('focusin', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
            setTimeout(() => {
                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    });
});

function updateDataSourceIndicator() {
    const indicator = document.getElementById('dataSourceIndicator');
    if (state.usingCachedData) {
        indicator.textContent = '[CACHED]';
        indicator.className = 'text-[10px] text-amber-500 font-mono ml-2 pulse-alert';
    } else {
        indicator.textContent = '[LIVE]';
        indicator.className = 'text-[10px] text-emerald-500 font-mono ml-2';
    }
}

function startPolling() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(fetchData, CONFIG.REFRESH_RATE);
}

async function fetchData() {
    if (state.isFetching || !state.autoRefresh) return;
    state.isFetching = true;

    try {
        const timestamp = new Date().getTime();
        const url = `${CONFIG.SCRIPT_URL}?t=${timestamp}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');

        const rawData = await response.json();
        const newLogs = Array.isArray(rawData) ? rawData : [];

        if (newLogs.length === 0) {
            console.log('Google Sheet returned empty data, clearing cache');
            state.logs = [];
            localStorage.removeItem('pykachuLogs');
            state.usingCachedData = false;
        } else {
            state.logs = newLogs;
            localStorage.setItem('pykachuLogs', JSON.stringify(state.logs));
            state.usingCachedData = false;
        }

        updateDataSourceIndicator();
        renderLogs();

        document.getElementById('lastUpdated').textContent = 'UPDATED: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        document.getElementById('systemStatus').textContent = 'ONLINE';
        document.getElementById('systemStatus').className = 'text-xs font-mono text-green-400';

    } catch (error) {
        console.warn('Fetch error:', error);
        document.getElementById('lastUpdated').textContent = 'RETRYING...';
        document.getElementById('systemStatus').textContent = "OFFLINE";
        document.getElementById('systemStatus').className = 'text-xs font-mono text-pink-500';

        if (state.logs.length === 0) {
            const cached = localStorage.getItem('pykachuLogs');
            if (cached) {
                try {
                    state.logs = JSON.parse(cached);
                    state.usingCachedData = true;
                    updateDataSourceIndicator();
                    renderLogs();
                } catch (e) {
                    console.error('Failed to use cached data:', e);
                }
            }
        }
    } finally {
        state.isFetching = false;
    }
}

function setActiveTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    renderLogs();
}

function setSecurityFilter(filter) {
    state.filter = filter;
    document.querySelectorAll('.security-filter-btn').forEach(btn => {
        btn.className = 'security-filter-btn w-full text-left px-3 py-3 sm:py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 transition-all flex justify-between items-center bg-transparent border border-slate-700/50';
    });

    const activeMap = { 'ALL': 'filterAll', 'HINT': 'filterHint', 'MALPRACTICE': 'filterMalpractice' };
    const activeBtn = document.getElementById(activeMap[filter]);
    activeBtn.className = 'security-filter-btn w-full text-left px-3 py-3 sm:py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white transition-all flex justify-between items-center group';
    renderLogs();
}

function renderLogs() {
    const container = document.getElementById('logsContainer');
    const header = container.previousElementSibling;
    const searchTerm = document.getElementById('teamSearch').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    const levelFilterDropdown = document.getElementById('levelFilter').value;

    if (state.activeTab === 'REG') {
        header.innerHTML = `
            <div class="col-span-1">#</div>
            <div class="col-span-5 text-left pl-4">Team Name</div>
            <div class="col-span-2">Level</div>
            <div class="col-span-2">Type</div>
            <div class="col-span-2">Time</div>
        `;
        header.className = "grid grid-cols-12 gap-1 px-2 py-3 bg-slate-950/80 border-b border-slate-800 text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono text-center";
    } else {
        header.innerHTML = `
            <div class="col-span-1">#</div>
            <div class="col-span-2 text-left pr-2">Team</div>
            <div class="col-span-1 border-r border-slate-800">Scan</div>
            <div class="col-span-1 text-emerald-600">Prev ✓</div>
            <div class="col-span-1 text-red-600 border-r border-slate-800">Prev ✕</div>
            <div class="col-span-1 text-white">Puzzle</div>
            <div class="col-span-1 text-red-600">Curr ✕</div>
            <div class="col-span-1 text-emerald-600 border-r border-slate-800">Curr ✓</div>
            <div class="col-span-1">Hint</div>
            <div class="col-span-1">Tabs</div>
            <div class="col-span-1">Time</div>
        `;
        header.className = "grid grid-cols-12 gap-1 px-2 py-3 bg-slate-950/80 border-b border-slate-800 text-[7px] sm:text-[8px] font-bold text-slate-500 uppercase tracking-widest font-mono text-center";
    }

    const teamMeta = {};
    state.logs.forEach(log => {
        if (log.action === 'REGISTRATION' && log.teamName) {
            teamMeta[log.teamName.toUpperCase()] = log.mission;
        }
    });

    const entries = {};
    const sortedLogs = [...state.logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const lastPuzzleForTeam = {};

    sortedLogs.forEach(log => {
        const teamName = (log.teamName || 'Unknown').toString().trim().toUpperCase();
        if (!teamName) return;

        let pId = log.puzzleId;
        if (pId === 'undefined' || pId === 'null' || pId === '') pId = null;

        if (pId === null && log.action === 'REGISTRATION') pId = 0;
        if (pId === null && lastPuzzleForTeam[teamName]) {
            pId = lastPuzzleForTeam[teamName];
        }
        if (pId === null) return;

        pId = String(pId).trim();
        if (pId === 'undefined' || pId === 'null' || pId === '') return;

        if (pId !== '0') lastPuzzleForTeam[teamName] = pId;

        const entryKey = `${teamName}_${pId}`;

        if (!entries[entryKey]) {
            entries[entryKey] = {
                key: entryKey,
                name: teamName,
                puzzleId: pId,
                mission: teamMeta[teamName] || 'UNKNOWN',
                scanQr: '-',
                lastActive: new Date(log.timestamp),
                unlockSuccesses: 0,
                unlockFails: 0,
                currentFails: 0,
                currentStatus: 'IDLE',
                hintUsed: false,
                tabSwitches: 0,
            };
        }

        const entry = entries[entryKey];
        const logTime = new Date(log.timestamp);
        if (logTime > entry.lastActive) entry.lastActive = logTime;

        if (log.action === 'REGISTRATION') {
            entry.currentStatus = 'READY';
            if (log.mission) entry.mission = log.mission;
        }
        else if (log.action === 'QR_SCANNED') {
            entry.scanQr = log.linkId || ('Link-' + log.puzzleId);
        }
        else if (log.action === 'UNLOCK_FAILED') {
            entry.unlockFails++;
            if (log.attemptedLink && log.attemptedLink !== 'unknown') {
                entry.scanQr = log.attemptedLink;
            }
        }
        else if (log.action === 'PUZZLE_UNLOCKED') {
            entry.unlockSuccesses++;
            entry.scanQr = log.puzzleLink || 'Link-' + log.puzzleId;
            entry.currentStatus = 'SOLVING';
        }
        else if (log.action === 'SOLVED') {
            entry.currentStatus = 'SUCCESS';
        }
        else if (log.action === 'WRONG_ATTEMPT') {
            entry.currentFails++;
            entry.currentStatus = 'RETRYING';
        }
        else if (log.action === 'HINT_USED') {
            entry.hintUsed = true;
        }
        else if (log.action === 'PENALTY') {
            if (typeof log.penaltyCount === 'number') {
                entry.tabSwitches = log.penaltyCount;
            } else {
                entry.tabSwitches++;
            }
        }
    });

    let leaderboard = Object.values(entries);

    if (searchTerm) {
        leaderboard = leaderboard.filter(t => t.name.toLowerCase().includes(searchTerm));
    }

    if (state.activeTab === 'REG') {
        leaderboard = leaderboard.filter(t => t.puzzleId === '0');
    } else {
        leaderboard = leaderboard.filter(t => t.mission && t.mission.includes(state.activeTab));
    }

    if (levelFilterDropdown !== 'ALL') {
        leaderboard = leaderboard.filter(t => t.mission && t.mission.includes(levelFilterDropdown));
    }

    if (typeFilter !== 'ALL') {
        leaderboard = leaderboard.filter(t => t.mission && t.mission.includes(typeFilter));
    }

    if (state.filter === 'HINT') {
        leaderboard = leaderboard.filter(t => t.hintUsed === true);
    }
    if (state.filter === 'MALPRACTICE') {
        leaderboard = leaderboard.filter(t => t.tabSwitches > 0 || t.unlockFails > 5);
    }

    leaderboard.sort((a, b) => b.lastActive - a.lastActive);

    const uniqueTeams = new Set(leaderboard.map(e => e.name)).size;
    document.getElementById('teamCount').textContent = uniqueTeams;
    document.getElementById('badgeCount').textContent = leaderboard.filter(t => t.currentStatus === 'SUCCESS').length;

    if (leaderboard.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-600 opacity-50 fade-in">
                <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <span class="font-mono text-xs">NO DATA AVAILABLE</span>
                ${state.usingCachedData ? '<span class="text-[10px] text-amber-500 mt-1">(Using cached data)</span>' : ''}
            </div>`;
        return;
    }

    container.innerHTML = leaderboard.map((team, index) => {
        const timeStr = team.lastActive.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (state.activeTab === 'REG') {
            const missionParts = (team.mission || "UNKNOWN_UNKNOWN").split('_');
            const levelLabel = missionParts[0] || "N/A";
            const typeLabel = missionParts[1] || "N/A";

            return `
            <div class="grid grid-cols-12 gap-1 px-2 py-3 border-l-2 border-transparent hover:bg-white/5 transition-all items-center text-[10px] sm:text-xs text-center fade-in">
                <div class="col-span-1 text-slate-600 font-mono">${index + 1}</div>
                <div class="col-span-5 text-left pl-4 font-bold text-slate-200 uppercase tracking-tight">${team.name}</div>
                <div class="col-span-2"><span class="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded border border-indigo-500/20 font-bold">${levelLabel}</span></div>
                <div class="col-span-2 text-slate-400 font-medium">${typeLabel}</div>
                <div class="col-span-2 text-slate-500 font-mono text-[10px]">${timeStr}</div>
            </div>`;
        }

        const hintBadge = team.hintUsed ?
            '<span class="text-yellow-500 font-bold text-[7px] sm:text-[8px]">USED</span>' :
            '<span class="text-slate-600 text-[7px] sm:text-[8px]">-</span>';

        let statusBadge = `<span class="text-blue-400 text-[7px] sm:text-[8px]">${team.currentStatus}</span>`;
        if (team.currentStatus === 'SUCCESS') {
            statusBadge = '<span class="text-emerald-400 font-bold text-[7px] sm:text-[8px]">SOLVED</span>';
        }
        if (team.currentStatus === 'RETRYING') {
            statusBadge = '<span class="text-red-400 animate-pulse text-[7px] sm:text-[8px]">RETRYING</span>';
        }
        if (team.currentStatus === 'IDLE' || team.currentStatus === 'READY') {
            statusBadge = `<span class="text-slate-500 text-[7px] sm:text-[8px]">${team.currentStatus}</span>`;
        }

        const puzzleDisplay = team.puzzleId === '0' ? 'REG' : team.puzzleId;

        return `
        <div class="grid grid-cols-12 gap-1 px-2 py-2 sm:py-3 border-l-2 border-transparent transition-all items-center hover:bg-white/5 text-[8px] sm:text-[9px] text-center fade-in">
            <div class="col-span-1 text-slate-500 font-mono">${index + 1}</div>
            <div class="col-span-2 text-left font-bold text-slate-200 truncate" title="${team.name}">${team.name}</div>
            <div class="col-span-1 font-mono text-indigo-400 truncate border-r border-slate-800 pr-1">${team.scanQr.replace('Link-', '').substring(0, 3)}</div>
            <div class="col-span-1 font-bold text-emerald-500">${team.unlockSuccesses}</div>
            <div class="col-span-1 font-bold text-red-500 border-r border-slate-800 pr-1">${team.unlockFails > 0 ? team.unlockFails : '-'}</div>
            <div class="col-span-1 font-bold text-white bg-slate-800 rounded px-1 py-0.5">${puzzleDisplay}</div>
            <div class="col-span-1 font-bold text-red-500">${team.currentFails > 0 ? team.currentFails : '-'}</div>
            <div class="col-span-1 border-r border-slate-800 pr-1">${statusBadge}</div>
            <div class="col-span-1">${hintBadge}</div>
            <div class="col-span-1 font-mono text-pink-500 font-bold">${team.tabSwitches > 0 ? team.tabSwitches : '-'}</div>
            <div class="col-span-1 text-slate-500 font-mono text-[7px] sm:text-[8px]">${timeStr}</div>
        </div>`;
    }).join('');
}

function setFilter(type) {
    state.filter = type;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.className = 'filter-btn w-full text-left px-3 py-3 sm:py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 transition-all flex justify-between items-center bg-transparent border border-slate-700/50';
    });

    const activeId = type === 'ALL' ? 'filterAll' : type === 'CORRECT' ? 'filterCorrect' : 'filterWrong';
    const activeBtn = document.getElementById(activeId);

    if (type === 'ALL') {
        activeBtn.className = 'filter-btn w-full text-left px-3 py-3 sm:py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white transition-all flex justify-between items-center group shadow-lg shadow-indigo-500/20';
    } else if (type === 'CORRECT') {
        activeBtn.className = 'filter-btn w-full text-left px-3 py-3 sm:py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white transition-all flex justify-between items-center group shadow-lg shadow-emerald-500/20';
    } else {
        activeBtn.className = 'filter-btn w-full text-left px-3 py-3 sm:py-2 rounded-lg text-xs font-medium bg-red-600 text-white transition-all flex justify-between items-center group shadow-lg shadow-red-500/20';
    }

    renderLogs();
}

function clearCache() {
    if (confirm('Clear all cached data and force fresh fetch from Google Sheets?')) {
        localStorage.removeItem('pykachuLogs');
        state.logs = [];
        state.usingCachedData = false;
        fetchData();
        updateDataSourceIndicator();
        const status = document.getElementById('systemStatus');
        const lastUpdated = document.getElementById('lastUpdated');
        status.textContent = 'CACHE CLEARED';
        status.className = 'text-xs font-mono text-amber-400 pulse-alert';
        lastUpdated.textContent = 'FETCHING FRESH DATA...';
        setTimeout(() => {
            status.textContent = 'ONLINE';
            status.className = 'text-xs font-mono text-green-400';
        }, 3000);
    }
}

function toggleAutoRefresh() {
    state.autoRefresh = !state.autoRefresh;
    const btn = document.getElementById('refreshBtn');
    const status = document.getElementById('systemStatus');

    if (state.autoRefresh) {
        startPolling();
        btn.classList.remove('bg-slate-700', 'bg-indigo-500');
        btn.classList.add('bg-indigo-600');
        status.textContent = "ONLINE";
        status.className = 'text-xs font-mono text-green-400';
    } else {
        clearInterval(state.refreshTimer);
        btn.classList.remove('bg-indigo-600');
        btn.classList.add('bg-slate-700');
        status.textContent = "SYNC PAUSED";
        status.className = 'text-xs font-mono text-orange-400';
    }
}

function wipeData() {
    if (confirm('Wipe ALL displayed data? This will clear the UI but keep cache. Use "Clear Cache" to remove stored data.')) {
        const container = document.getElementById('logsContainer');
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-600 opacity-50 fade-in">
                <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                <span class="font-mono text-xs">DATA WIPED - REFRESHING...</span>
            </div>`;

        document.getElementById('teamCount').textContent = '0';
        document.getElementById('badgeCount').textContent = '0';

        const status = document.getElementById('systemStatus');
        status.textContent = 'DATA WIPED';
        status.className = 'text-xs font-mono text-amber-400 pulse-alert';

        setTimeout(() => {
            if (state.autoRefresh) {
                fetchData();
            }
        }, 2000);
    }
}
