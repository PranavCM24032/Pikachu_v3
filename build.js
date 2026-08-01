// ==============================
// PYkachu HUNT - BUILD SCRIPT
// Concats + minifies JS and CSS into single bundles.
// Usage: node build.js   (then deploy the repo root as-is)
// ==============================
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = __dirname;

const JS_ORDER = [
    'config.js',
    'state.js',
    'audio.js',
    'data-loader.js',
    'google-sheets.js',
    'ui.js',
    'screens.js',
    'scanner.js',
    'meme.js',
    'penalty.js',
    'hint.js',
    'game.js',
    'main.js',
    'security.js'
];

const CSS_ORDER = [
    'tailwind.css',
    'base.css',
    'shell.css',
    'buttons.css',
    'components.css',
    'terminal.css',
    'overlays.css',
    'animations.css',
    'success.css',
    'responsive.css',
    'security.css',
    'meme.css'
];

function concat(dir, files) {
    return files
        .map(f => {
            const p = path.join(dir, f);
            if (!fs.existsSync(p)) {
                console.warn(`[build] MISSING ${f}`);
                return '';
            }
            return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
        })
        .join('\n');
}

function minifySingle(tmpPath, outPath) {
    esbuild.buildSync({
        entryPoints: [tmpPath],
        outfile: outPath,
        minify: true,
        bundle: false,
        logLevel: 'warning'
    });
    fs.unlinkSync(tmpPath);
    console.log(`[build] Wrote ${path.basename(outPath)} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

const jsDir = path.join(ROOT, 'js');
const jsTmp = path.join(jsDir, '.bundle.tmp.js');
fs.writeFileSync(jsTmp, concat(jsDir, JS_ORDER));
minifySingle(jsTmp, path.join(jsDir, 'bundle.min.js'));

const cssDir = path.join(ROOT, 'css');
const cssTmp = path.join(cssDir, '.bundle.tmp.css');
fs.writeFileSync(cssTmp, concat(cssDir, CSS_ORDER));
minifySingle(cssTmp, path.join(cssDir, 'bundle.min.css'));

console.log('[build] Done.');
