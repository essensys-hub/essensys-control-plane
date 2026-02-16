import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BASE_PATH = '/controle_plane'

export default defineConfig({
  plugins: [react()],
  base: `${BASE_PATH}/`,
  server: {
    proxy: {
      [`${BASE_PATH}/api`]: {
        target: 'http://127.0.0.1:9100',
        changeOrigin: true,
        rewrite: (path) => path.replace(new RegExp(`^${BASE_PATH}`), ''),
      },
      '/health': {
        target: 'http://127.0.0.1:9100',
        changeOrigin: true,
      },
      '/metrics': {
        target: 'http://127.0.0.1:9100',
        changeOrigin: true,
      },
    },
  },
})
