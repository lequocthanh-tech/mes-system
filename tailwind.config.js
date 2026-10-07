/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ISA-101 Muted Palette
        industrial: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // Functional ISA-101 state colors ONLY
        status: {
          connected: '#16A34A', // Solid green (ISA-101 normal running/connected)
          connectedBg: '#F0FDF4',
          connectedBorder: '#BBF7D0',
          disconnected: '#64748B', // Neutral muted gray for offline
          disconnectedRed: '#DC2626', // Alarm/Fault/Failed connection
          disconnectedRedBg: '#FEF2F2',
          disconnectedRedBorder: '#FECACA',
          warning: '#D97706', // Abnormal advisory
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
