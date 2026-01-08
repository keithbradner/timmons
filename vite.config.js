import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        darkroom: resolve(__dirname, 'darkroom.html')
      }
    }
  },
  test: {
    environment: 'happy-dom'
  }
})
