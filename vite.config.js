import { defineConfig } from 'vite'
import { resolve } from 'path'
import commonjs from 'vite-plugin-commonjs'

export default defineConfig({
  base: './',
  plugins: [
    commonjs()
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        darkroom: resolve(__dirname, 'darkroom.html'),
        photobooth: resolve(__dirname, 'photobooth.html'),
        printqueue: resolve(__dirname, 'printqueue.html')
      }
    }
  },
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow-models/body-pix',
      'upscaler',
      '@upscalerjs/esrgan-medium'
    ]
  },
  test: {
    environment: 'happy-dom'
  }
})
