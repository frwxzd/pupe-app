import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En desarrollo, la API corre aparte (npm run dev:api) en el puerto 3000.
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.API_PORT ?? 3000}` } },
  },
})
