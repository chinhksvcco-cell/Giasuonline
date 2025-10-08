
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // QUAN TRỌNG: Thay 'ten-repository-cua-em' bằng tên repository trên GitHub của em.
  // Ví dụ: nếu repo là https://github.com/username/gia-su-ai, em điền '/gia-su-ai/'
  base: '/Giasuonline/', 
})