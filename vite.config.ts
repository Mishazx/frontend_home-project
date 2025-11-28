import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Files endpoints are served by core_service on port 11000
      '/api/files': {
        target: 'http://localhost:11000',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'https://localhost:10000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/ws': {
        target: 'https://localhost:10000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      // Отдельный проксируемый путь для административного интерфейса.
      '/admin/ws': {
        target: 'https://localhost:10000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    }
  },
})
