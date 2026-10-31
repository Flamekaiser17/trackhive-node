import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:5000'),
      'process.env.VITE_NODE_URL': JSON.stringify(env.VITE_NODE_URL || 'http://localhost:5000'),
      'process.env.VITE_WS_URL': JSON.stringify(env.VITE_WS_URL || 'ws://localhost:5000'),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/demo': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:5000',
          ws: true,
        }
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    }
  }
})
