/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Chrome-like Dark Theme with Light Cards
        vscode: {
          // Backgrounds - Chrome-style grays
          bg: '#202124',           // Main background (Chrome dark)
          bgSidebar: '#292a2d',    // Sidebar (slightly lighter)
          bgHover: '#3c4043',      // Hover state
          bgActive: '#4a4d51',     // Active/selected state
          bgCard: '#ffffff',       // Card background (WHITE for contrast)
          bgCardAlt: '#f8f9fa',    // Alternate card bg (light gray)
          bgInput: '#3c4043',      // Input field background
          bgDropdown: '#35363a',   // Dropdown background

          // Borders
          border: '#3c4043',       // Default border (dark)
          borderLight: '#e0e0e0',  // Light border for white cards
          borderFocus: '#8ab4f8',  // Focus border (Google blue)

          // Text - Chrome-style (for dark backgrounds)
          text: '#e8eaed',         // Primary text
          textSecondary: '#9aa0a6', // Secondary text
          textMuted: '#80868b',    // Muted text

          // Text - For light/white backgrounds
          textDark: '#202124',     // Dark text on white
          textDarkSecondary: '#5f6368', // Secondary dark text
          textDarkMuted: '#80868b', // Muted dark text

          // Accent Colors - Google blue
          blue: '#8ab4f8',         // Google blue (primary)
          blueLight: '#aecbfa',    // Lighter blue
          blueDark: '#669df6',     // Darker blue

          // Semantic Colors - Softer
          success: '#81c995',      // Google green
          warning: '#fdd663',      // Google yellow
          error: '#f28b82',        // Google red/pink
          info: '#8ab4f8',         // Google blue

          // Accent colors
          purple: '#c58af9',       // Purple
          orange: '#fcad70',       // Orange
          green: '#81c995',        // Green
          cyan: '#78d9ec',         // Cyan
        },

        // Keep primary for backwards compatibility
        primary: {
          50: '#e6f3ff',
          100: '#cce7ff',
          200: '#99cfff',
          300: '#66b7ff',
          400: '#339fff',
          500: '#007acc',  // VSCode blue
          600: '#0062a3',
          700: '#004a7a',
          800: '#003152',
          900: '#001929',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'vscode': '0 1px 3px rgba(0, 0, 0, 0.3)',
        'vscode-lg': '0 4px 16px rgba(0, 0, 0, 0.3)',
        'glow': '0 0 15px rgba(99, 102, 241, 0.25)',
        'glow-lg': '0 0 30px rgba(99, 102, 241, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(99, 102, 241, 0.15)' },
          '100%': { boxShadow: '0 0 15px rgba(99, 102, 241, 0.3)' },
        },
      },
    },
  },
  plugins: [],
}
