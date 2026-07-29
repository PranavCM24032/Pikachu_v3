const CONFIG = {
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyVekaNXe7WZ3bJafKehIJkIQ2NZal-CHCAxo5SNPO2Zuyv2BimgZg0MNb2_SY6YunO/exec',
    REFRESH_RATE: 5000,
    VERSION: '2.6.0'
};

const KEYS = {
    L1_DATA: 'pykachuAdminL1'
};

let state = {
    logs: [],
    teams: [],
    activeTab: 'LEADERBOARD',
    l1Data: {},
    autoRefresh: true,
    filter: 'ALL',
    levelFilter: 'ALL',
    searchTerm: '',
    refreshTimer: null,
    isFetching: false,
    usingCachedData: false
};

document.addEventListener('DOMContentLoaded', () => {
    const ver = localStorage.getItem('pykachuVersion');
    if (ver !== CONFIG.VERSION) {
        localStorage.removeItem('pykachuLogs');
        localStorage.setItem('pykachuVersion', CONFIG.VERSION);
    }

    const cached = localStorage.getItem('pykachuLogs');
    if (cached) {
        try {
            state.logs = JSON.parse(cached);
            state.usingCachedData = true;
        } catch (e) { state.logs = []; }
    }

    const l1 = localStorage.getItem(KEYS.L1_DATA);
    if (l1) {
        try { state.l1Data = JSON.parse(l1); } catch (e) { state.l1Data = {}; }
    }

    loadTeams().then(() => {
        updateDataSourceIndicator();
        fetchData();
        startPolling();
    });
});

async function loadTeams() {
    try {
        const res = await fetch('data/teams.json');
        if (res.ok) {
            state.teams = await res.json();
        }
    } catch (e) {
        console.warn('Failed to load teams:', e);
        state.teams = [];
    }
}

function updateDataSourceIndicator() {
    const el = document.getElementById('dataSourceIndicator');
    if (!el) return;
    el.textContent = state.usingCachedData ? '[CACHED]' : '[LIVE]';
    el.className = 'text-[10px] font-mono ml-2 ' + (state.usingCachedData ? 'text-amber-500 pulse-alert' : 'text-emerald-500');
}

function startPolling() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(fetchData, CONFIG.REFRESH_RATE);
}

async function fetchData() {
    if (state.isFetching || !state.autoRefresh) return;
    state.isFetching = true;

    try {
        const ts = new Date().getTime();
        const res = await fetch(`${CONFIG.SCRIPT_URL}?t=${ts}`);
        if (!res.ok) throw new Error('Network error');

        const raw = await res.json();
        const newLogs = Array.isArray(raw) ? raw : [];

        if (newLogs.length === 0) {
            state.logs = [];
            localStorage.removeItem('pykachuLogs');
            state.usingCachedData = false;
        } else {
            state.logs = newLogs;
            localStorage.setItem('pykachuLogs', JSON.stringify(state.logs));
            state.usingCachedData = false;
        }

        updateDataSourceIndicator();
        renderCurrentView();

        document.getElementById('lastUpdated').textContent = 'UPDATED: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        document.getElementById('systemStatus').textContent = 'ONLINE';
        document.getElementById('systemStatus').className = 'text-xs font-mono text-green-400';
    } catch (error) {
        console.warn('Fetch error:', error);
        document.getElementById('lastUpdated').textContent = 'RETRYING...';
        document.getElementById('systemStatus').textContent = 'OFFLINE';
        document.getElementById('systemStatus').className = 'text-xs font-mono text-pink-500';

        if (state.logs.length === 0) {
            const cached = localStorage.getItem('pykachuLogs');
            if (cached) {
                try {
                    state.logs = JSON.parse(cached);
                    state.usingCachedData = true;
                    updateDataSourceIndicator();
                    renderCurrentView();
                } catch (e) { }
            }
        }
    } finally {
        state.isFetching = false;
    }
}

function setActiveTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const tabBtn = document.getElementById('tab-' + tab);
    if (tabBtn) tabBtn.classList.add('active');

    const titles = {
        'LEADERBOARD': 'LEADERBOARD RANKINGS',
        'L1': 'LEVEL 1 - TIMESTAMP ENTRY',
        'L2': 'LEVEL 2 - PUZZLE STATUS',
        'L3': 'LEVEL 3 - PATH TRACKING',
        'ROSTER': 'TEAM ROSTER'
    };
    document.getElementById('viewTitle').textContent = titles[tab] || tab;

    renderCurrentView();
}

function setSecurityFilter(filter) {
    state.filter = filter;
    document.querySelectorAll('.security-filter-btn').forEach(btn => {
        btn.className = 'security-filter-btn w-full text-left px-3 py-3 sm:py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 transition-all flex justify-between items-center bg-transparent border border-slate-700/50';
    });
    const m = { 'ALL': 'filterAll', 'HINT': 'filterHint', 'MALPRACTICE': 'filterMalpractice' };
    const b = document.getElementById(m[filter]);
    if (b) b.className = 'security-filter-btn w-full text-left px-3 py-3 sm:py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white transition-all flex justify-between items-center group';
    renderCurrentView();
}

function escapeHTML(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// Build per-team stats from logs
function buildTeamStats() {
    const stats = {};

    // Init all teams
    state.teams.forEach(t => {
        const name = t.team.toUpperCase();
        stats[name] = {
            team: t.team,
            name: name,
            tid: t.tid,
            password: t.password,
            registered: false,
            mission: '',
            lastActive: null,
            l1Timestamp: state.l1Data[name] || null,
            l2Success: false,
            l2Fails: 0,
            l2Time: null,
            l3Scans: [],
            l3Nodes: [],
            l3Marks: 0,
            hintUsed: false,
            tabSwitches: 0,
            puzzles: {}
        };
    });

    const sortedLogs = [...state.logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const lastPuzzle = {};

    sortedLogs.forEach(log => {
        const name = (log.teamName || '').toString().trim().toUpperCase();
        if (!name || !stats[name]) return;

        const s = stats[name];
        const t = new Date(log.timestamp);
        if (!s.lastActive || t > s.lastActive) s.lastActive = t;

        let pId = log.puzzleId;
        if (pId === 'undefined' || pId === 'null' || pId === '') pId = null;
        if (pId === null && log.action === 'REGISTRATION') pId = '0';
        if (pId === null && lastPuzzle[name]) pId = lastPuzzle[name];
        if (pId === null) return;
        pId = String(pId).trim();
        if (pId === 'undefined' || pId === 'null') return;
        if (pId !== '0') lastPuzzle[name] = pId;

        if (log.action === 'REGISTRATION') {
            s.registered = true;
            s.mission = log.mission || s.mission;
        } else if (log.action === 'QR_SCANNED') {
            const link = log.linkId || ('LINK-' + pId);
            if (!s.l3Nodes.includes(link)) s.l3Nodes.push(link);
            s.l3Scans.push({ link, time: t, type: 'QR' });
        } else if (log.action === 'PUZZLE_UNLOCKED') {
            const link = log.puzzleLink || ('LINK-' + pId);
            if (!s.l3Nodes.includes(link)) s.l3Nodes.push(link);
            s.l3Scans.push({ link, time: t, type: 'UNLOCK' });
        } else if (log.action === 'SOLVED') {
            s.l2Success = true;
            s.l2Time = t;
        } else if (log.action === 'WRONG_ATTEMPT') {
            s.l2Fails++;
        } else if (log.action === 'HINT_USED') {
            s.hintUsed = true;
        } else if (log.action === 'PENALTY') {
            if (typeof log.penaltyCount === 'number') s.tabSwitches = log.penaltyCount;
            else s.tabSwitches++;
        } else if (log.action === 'UNLOCK_FAILED') {
            // track but don't count as L2 fail
        }
    });

    return stats;
}

function computeLeaderboard(stats) {
    const list = Object.values(stats);
    return list.map(s => {
        const l1Score = s.l1Timestamp ? 10 : 0;
        let l2Score = 0;
        if (s.l2Success) {
            l2Score = Math.max(0, 10 - (s.l2Fails * 2));
        }
        const l3Marks = s.l3Marks || s.l3Scans.length;
        const l3Score = Math.min(l3Marks, 20);

        const phase = s.l2Success ? 3 : (s.l1Timestamp ? 2 : 1);
        const sortScore = phase * 1000 + l3Score * 10 + l2Score;

        return { ...s, l1Score, l2Score, l3Score, sortScore };
    }).sort((a, b) => b.sortScore - a.sortScore);
}

function renderCurrentView() {
    const container = document.getElementById('viewContainer');
    const search = (document.getElementById('teamSearch').value || '').toLowerCase();
    const levelFilter = document.getElementById('levelFilter').value;

    const stats = buildTeamStats();
    const leaderboard = computeLeaderboard(stats);

    // Filter stats by search
    let filtered = Object.values(stats).filter(s => {
        if (search && !s.name.includes(search.toUpperCase()) && !s.team.toLowerCase().includes(search)) return false;
        return true;
    });

    // Update sidebar
    const uniqueTeams = new Set(state.logs.filter(l => l.teamName).map(l => l.teamName.toString().trim().toUpperCase())).size;
    document.getElementById('teamCount').textContent = uniqueTeams || '0';
    document.getElementById('badgeCount').textContent = leaderboard.filter(s => s.l2Success).length;

    const tab = state.activeTab;

    const header = (cols, ...titles) => `
        <div class="sticky top-0 z-10 grid gap-1 sm:gap-2 items-center px-2 sm:px-4 py-2 sm:py-3 bg-slate-950/90 border-b border-slate-700 text-[7px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono" style="grid-template-columns: ${cols}">
            ${titles.map(t => `<div class="text-center ${t.includes('text-left') ? 'text-left' : ''}">${t.replace('text-left', '').trim()}</div>`).join('')}
        </div>
    `;

    const row = (cols, content) => `
        <div class="grid gap-1 sm:gap-2 items-center px-2 sm:px-4 py-2 sm:py-3 border-b border-slate-800 hover:bg-white/5 transition-all text-[9px] sm:text-xs" style="grid-template-columns: ${cols}">
            ${content}
        </div>
    `;

    const wrapper = (html) => `<div style="min-width: 700px;">${html}</div>`;

    const empty = (msg) => `
        <div class="flex flex-col items-center justify-center h-full text-slate-600 opacity-50 p-12">
            <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span class="font-mono text-xs">${msg}</span>
        </div>`;

    if (tab === 'LEADERBOARD') {
        if (leaderboard.length === 0) { container.innerHTML = empty('NO TEAM DATA'); return; }

        const cols = '0.4fr 2fr 1fr 1fr 1fr 1fr 1.2fr';
        let html = wrapper(header(cols, '#', 'TEAM', 'LEVEL 1', 'LEVEL 2', 'LEVEL 3', 'TOTAL', 'STATUS'));

        leaderboard.forEach((s, i) => {
            const rankCls = i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-600';
            let statusText = 'ACTIVE';
            let statusCls = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            if (s.l2Success) { statusText = 'FINISHER'; statusCls = 'bg-orange-500/20 text-orange-400 border-orange-500/30'; }
            else if (s.l1Timestamp) { statusText = 'LEVEL 2'; statusCls = 'bg-purple-500/20 text-purple-400 border-purple-500/30'; }

            html += row(cols, `
                <div class="font-mono font-bold ${rankCls} text-center">#${i + 1}</div>
                <div><div class="font-bold text-white truncate">${escapeHTML(s.team)}</div><div class="text-[8px] text-blue-400 font-mono">${s.tid || ''}</div></div>
                <div class="text-center font-mono font-bold ${s.l1Timestamp ? 'text-green-400' : 'text-slate-600'}">${s.l1Timestamp ? '10' : '-'}</div>
                <div class="text-center font-mono font-bold ${s.l2Score > 0 ? 'text-green-400' : 'text-slate-600'}">${s.l2Score > 0 ? s.l2Score : '-'}</div>
                <div class="text-center font-mono font-bold ${s.l3Score > 0 ? 'text-cyan-400' : 'text-slate-600'}">${s.l3Score > 0 ? s.l3Score : '-'}</div>
                <div class="text-center font-mono font-bold text-white">${s.l1Score + s.l2Score + s.l3Score}</div>
                <div class="text-center"><span class="px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold border ${statusCls}">${statusText}</span></div>
            `);
        });
        html += '</div>';
        container.innerHTML = html;

    } else if (tab === 'L1') {
        if (filtered.length === 0) { container.innerHTML = empty('NO TEAMS LOADED'); return; }

        const cols = '0.4fr 2fr 1.5fr 1.5fr 1fr';
        let html = wrapper(header(cols, '#', 'TEAM', 'TIMESTAMP', 'MARKS', 'ACTION'));

        filtered.forEach((s, i) => {
            const tsId = 'ts_' + s.name;
            const val = state.l1Data[s.name] || '';
            html += row(cols, `
                <div class="font-mono text-slate-600 text-center">${i + 1}</div>
                <div><div class="font-bold text-white truncate">${escapeHTML(s.team)}</div><div class="text-[8px] text-slate-500 font-mono">${s.tid || ''}</div></div>
                <input type="text" id="${tsId}" value="${val}" placeholder="HH:MM" onblur="formatL1Time(this)" class="bg-slate-900 border border-slate-700 rounded text-xs px-2 py-1.5 text-white w-full font-mono text-center focus:border-indigo-500 outline-none">
                <div class="text-center font-mono font-bold ${val ? 'text-green-400' : 'text-slate-600'}">${val ? '10' : '0'}</div>
                <div class="text-center"><button onclick="saveL1('${s.name}')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-3 py-1.5 rounded font-bold transition-all">SAVE</button></div>
            `);
        });
        html += '</div>';
        container.innerHTML = html;

    } else if (tab === 'L2') {
        if (filtered.length === 0) { container.innerHTML = empty('NO TEAMS LOADED'); return; }

        const cols = '0.4fr 2fr 1.2fr 1fr 1fr 1fr';
        let html = wrapper(header(cols, '#', 'TEAM', 'STATUS', 'SCORE', 'FAILS', 'TIME'));

        filtered.forEach((s, i) => {
            const timeStr = s.l2Time ? s.l2Time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
            const statusHtml = s.l2Success
                ? '<span class="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-[9px] font-bold border border-green-500/30">SOLVED</span>'
                : '<span class="bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[9px] border border-slate-700">PENDING</span>';
            const score = s.l2Success ? Math.max(0, 10 - (s.l2Fails * 2)) : '-';

            html += row(cols, `
                <div class="font-mono text-slate-600 text-center">${i + 1}</div>
                <div><div class="font-bold text-white truncate">${escapeHTML(s.team)}</div><div class="text-[8px] text-slate-500 font-mono">${s.tid || ''}</div></div>
                <div class="text-center">${statusHtml}</div>
                <div class="text-center font-mono font-bold ${s.l2Success ? 'text-green-400' : 'text-slate-600'}">${score}</div>
                <div class="text-center font-mono ${s.l2Fails > 0 ? 'text-red-400 font-bold' : 'text-slate-600'}">${s.l2Fails > 0 ? s.l2Fails : '-'}</div>
                <div class="text-center font-mono text-slate-500 text-[8px]">${timeStr}</div>
            `);
        });
        html += '</div>';
        container.innerHTML = html;

    } else if (tab === 'L3') {
        if (filtered.length === 0) { container.innerHTML = empty('NO TEAMS LOADED'); return; }

        const cols = '0.4fr 2fr 1.5fr 1.2fr 0.8fr 1fr';
        let html = wrapper(header(cols, '#', 'TEAM', 'PATH', 'LAST NODE', 'SCANS', 'MARKS'));

        filtered.forEach((s, i) => {
            const path = s.l3Nodes.length > 0 ? s.l3Nodes.join(' -> ') : '-';
            const lastNode = s.l3Nodes.length > 0 ? s.l3Nodes[s.l3Nodes.length - 1] : '-';
            const scans = s.l3Scans.length || 0;
            const marks = s.l3Marks || scans;

            html += row(cols, `
                <div class="font-mono text-slate-600 text-center">${i + 1}</div>
                <div><div class="font-bold text-white truncate">${escapeHTML(s.team)}</div><div class="text-[8px] text-slate-500 font-mono">${s.tid || ''}</div></div>
                <div class="text-slate-300 text-[8px] sm:text-[10px] truncate" title="${escapeHTML(path)}">${escapeHTML(path)}</div>
                <div class="text-center font-mono font-bold text-cyan-400">${escapeHTML(lastNode)}</div>
                <div class="text-center font-mono text-slate-400">${scans}</div>
                <div class="text-center font-mono font-bold text-green-400">${marks}</div>
            `);
        });
        html += '</div>';
        container.innerHTML = html;

    } else if (tab === 'ROSTER') {
        if (state.teams.length === 0) { container.innerHTML = empty('NO TEAMS IN ROSTER'); return; }

        const cols = '1fr 2fr 1.5fr 0.8fr 1.2fr';
        let html = wrapper(header(cols, 'TID', 'TEAM NAME', 'PASSWORD', 'STATUS', 'LAST ACTIVE'));

        state.teams.forEach(t => {
            const name = t.team.toUpperCase();
            const s = stats[name];
            const online = s && s.lastActive ? true : false;
            const activeStr = online ? s.lastActive.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
            const statusHtml = online
                ? '<span class="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-[9px] font-bold border border-green-500/30">ONLINE</span>'
                : '<span class="bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[9px] border border-slate-700">OFFLINE</span>';

            html += row(cols, `
                <div class="font-mono text-blue-400 font-bold">${t.tid || '-'}</div>
                <div class="text-white font-bold truncate">${escapeHTML(t.team)}</div>
                <div class="font-mono text-red-400 text-[8px] sm:text-[10px]">${escapeHTML(t.password)}</div>
                <div class="text-center">${statusHtml}</div>
                <div class="text-center font-mono text-slate-500 text-[8px]">${activeStr}</div>
            `);
        });
        html += '</div>';
        container.innerHTML = html;
    }
}

// --- L1 TIMESTAMP HELPERS ---
function formatL1Time(input) {
    let val = input.value.trim();
    if (!val) return;
    const digits = val.replace(/[^0-9]/g, '');
    let h = 0, m = 0;

    if (val.includes(':') || val.includes('.') || val.includes(' ')) {
        const parts = val.split(/[:. ]/);
        h = parseInt(parts[0] || '0');
        m = parseInt(parts[1] || '0');
    } else if (digits.length === 4) {
        h = parseInt(digits.substring(0, 2));
        m = parseInt(digits.substring(2, 4));
    } else if (digits.length === 3) {
        h = parseInt(digits.substring(0, 1));
        m = parseInt(digits.substring(1, 3));
    } else if (digits.length <= 2) {
        h = parseInt(digits);
        m = 0;
    }

    if (isNaN(h) || h < 0 || h > 23) { input.style.borderColor = 'red'; return; }
    if (isNaN(m) || m < 0 || m > 59) m = 0;

    input.value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    input.style.borderColor = '';
}

window.saveL1 = (name) => {
    const val = document.getElementById('ts_' + name).value.trim();
    if (val) state.l1Data[name] = val;
    else delete state.l1Data[name];
    localStorage.setItem(KEYS.L1_DATA, JSON.stringify(state.l1Data));
    renderCurrentView();
};

// --- UTILITIES ---
function clearCache() {
    if (confirm('Clear all cached data and force fresh fetch?')) {
        localStorage.removeItem('pykachuLogs');
        state.logs = [];
        state.usingCachedData = false;
        fetchData();
        updateDataSourceIndicator();
        document.getElementById('systemStatus').textContent = 'CACHE CLEARED';
        document.getElementById('systemStatus').className = 'text-xs font-mono text-amber-400 pulse-alert';
        document.getElementById('lastUpdated').textContent = 'FETCHING...';
        setTimeout(() => {
            document.getElementById('systemStatus').textContent = 'ONLINE';
            document.getElementById('systemStatus').className = 'text-xs font-mono text-green-400';
        }, 3000);
    }
}

function toggleAutoRefresh() {
    state.autoRefresh = !state.autoRefresh;
    const btns = ['refreshBtn', 'refreshBtnDesktop'];
    if (state.autoRefresh) {
        startPolling();
        btns.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('bg-slate-700'); el.classList.add('bg-indigo-600'); }
        });
        document.getElementById('systemStatus').textContent = 'ONLINE';
        document.getElementById('systemStatus').className = 'text-xs font-mono text-green-400';
    } else {
        clearInterval(state.refreshTimer);
        btns.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('bg-indigo-600'); el.classList.add('bg-slate-700'); }
        });
        document.getElementById('systemStatus').textContent = 'SYNC PAUSED';
        document.getElementById('systemStatus').className = 'text-xs font-mono text-orange-400';
    }
}

function wipeData() {
    if (confirm('Wipe ALL displayed data? Cache will remain.')) {
        document.getElementById('viewContainer').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-600 opacity-50 fade-in">
                <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                <span class="font-mono text-xs">DATA WIPED</span>
            </div>`;
        document.getElementById('teamCount').textContent = '0';
        document.getElementById('badgeCount').textContent = '0';
        document.getElementById('systemStatus').textContent = 'DATA WIPED';
        document.getElementById('systemStatus').className = 'text-xs font-mono text-amber-400 pulse-alert';
        setTimeout(() => { if (state.autoRefresh) fetchData(); }, 2000);
    }
}
