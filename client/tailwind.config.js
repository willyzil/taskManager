module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // All values point at the CSS custom properties in index.css (single source of
        // truth) instead of duplicating hardcoded hex here -- the two had drifted out of
        // sync (e.g. this file said background: #0f172a, index.css said #0B0F19).
        background: 'var(--background)',
        sidebar: 'var(--sidebar)',
        card: 'var(--card)',
        'card-hover': 'var(--card-hover)',
        'card-faint': 'var(--card-faint)',
        'card-50': 'var(--card-50)',
        'card-60': 'var(--card-60)',
        border: 'var(--border)',
        'border-subtle': 'var(--border-subtle)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-glow': 'var(--accent-glow)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',
        'text-inverse': 'var(--text-inverse)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
        'sidebar-95': 'var(--sidebar-95)',
        'sidebar-half': 'var(--sidebar-half)',
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      spacing: {
        '2': '8px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
        '16': '64px',
      },
    },
  },
  plugins: [],
}
