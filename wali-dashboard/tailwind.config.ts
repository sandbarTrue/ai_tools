import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0d1117',
          secondary: '#161b22',
          tertiary: '#21262d',
          hover: '#30363d',
        },
        border: {
          primary: '#30363d',
          secondary: '#21262d',
        },
        text: {
          primary: '#e6edf3',
          secondary: '#8b949e',
          tertiary: '#6e7681',
        },
        accent: {
          purple: '#a855f7',
          blue: '#3b82f6',
          green: '#22c55e',
          cyan: '#06b6d4',
          red: '#ef4444',
          yellow: '#eab308',
          orange: '#f97316',
        }
      }
    },
  },
  plugins: [],
}
export default config
