/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}', './public/scripts/**/*.js'],
    theme: {
        extend: {
            colors: {
                primary: 'var(--color-primary)',
                'primary-hover': 'var(--color-primary-hover)',
                background: 'var(--color-background)',
                text: 'var(--color-text)',
                card: 'var(--color-card)',
            },
        },
    },
    plugins: [],
    darkMode: 'class',
}
