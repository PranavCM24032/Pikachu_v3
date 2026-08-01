/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './index.html',
        './admin.html',
        './html/*.html',
        './js/*.js',
        './service-worker.js'
    ],
    theme: {
        extend: {
            fontFamily: {
                mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
            }
        }
    },
    plugins: []
};
