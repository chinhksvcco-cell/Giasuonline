
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Tải các biến môi trường từ file .env
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    base: '/Giasuonline/', 
    define: {
      // Thay thế process.env.API_KEY bằng giá trị thật trong quá trình build
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
  }
})
