import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Our unit tests cover pure math/logic, so no browser DOM is needed.
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
