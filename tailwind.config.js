/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          50: '#EEF3F8', 100: '#D6E1EC', 200: '#AEC3D9', 300: '#7F9FBF',
          400: '#4F7AA3', 500: '#2D5A85', 600: '#1A3C5E', 700: '#15314D',
          800: '#10253A', 900: '#0B1A29', 950: '#07111B',
        },
        teal: {
          50: '#E8F7F1', 100: '#C6ECDD', 200: '#8FD9BC', 300: '#55C49A',
          400: '#2BB083', 500: '#1D9E75', 600: '#178262', 700: '#12664D',
          800: '#0D4A38', 900: '#082E23',
        },
        surface: 'rgb(var(--surface) / <alpha-value>)',
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
      },
      boxShadow: {
        card: '0 1px 2px rgb(16 37 58 / 0.04), 0 4px 16px rgb(16 37 58 / 0.06)',
        lift: '0 2px 4px rgb(16 37 58 / 0.06), 0 12px 32px rgb(16 37 58 / 0.10)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem' },
    },
  },
  plugins: [],
}
