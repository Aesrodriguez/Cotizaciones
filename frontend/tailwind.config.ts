import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        display: ['Bebas Neue', 'sans-serif'],
      },
      colors: {
        bg:       '#111111',
        surface:  '#1a1a1a',
        card:     '#1e1e1e',
        border:   '#2a2a2a',
        lime:     '#c8f135',
        'lime-hover': '#b8e020',
        text:     '#e8e4da',
        muted:    '#888888',
        amber:    '#f5a623',
        danger:   '#e84040',
        'danger-hover': '#c93030',
      }
    }
  },
  plugins: []
}

export default config
