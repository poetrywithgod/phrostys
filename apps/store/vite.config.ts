import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The admin app uses 5173; the storefront uses 5174 so both can run together.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
})
