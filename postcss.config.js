import { fileURLToPath } from 'node:url'

// Point Tailwind at its config explicitly so styles work no matter which folder the dev server is started from.
export default {
  plugins: {
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
}
