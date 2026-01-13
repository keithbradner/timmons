#!/usr/bin/env node
/**
 * Download RMBG-1.4 model from Hugging Face CDN
 * Used during build on platforms that don't support Git LFS (like Railway)
 */

import { mkdir, writeFile, stat } from 'fs/promises'
import { join } from 'path'
import https from 'https'

const MODEL_DIR = 'public/models/briaai/RMBG-1.4'
const ONNX_DIR = join(MODEL_DIR, 'onnx')

// Hugging Face CDN URLs for RMBG-1.4 (public model, no auth needed)
const FILES = [
  {
    url: 'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx',
    path: join(ONNX_DIR, 'model.onnx'),
    size: 176153355 // ~176MB
  },
  {
    url: 'https://huggingface.co/briaai/RMBG-1.4/resolve/main/config.json',
    path: join(MODEL_DIR, 'config.json')
  },
  {
    url: 'https://huggingface.co/briaai/RMBG-1.4/resolve/main/preprocessor_config.json',
    path: join(MODEL_DIR, 'preprocessor_config.json')
  }
]

async function fileExists(path, expectedSize) {
  try {
    const stats = await stat(path)
    // If we have an expected size, verify it (catches LFS pointer files)
    if (expectedSize && stats.size < expectedSize * 0.9) {
      console.log(`  File exists but too small (${stats.size} bytes), re-downloading...`)
      return false
    }
    return stats.size > 0
  } catch {
    return false
  }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const makeRequest = (requestUrl) => {
      https.get(requestUrl, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          makeRequest(response.headers.location)
          return
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} for ${url}`))
          return
        }

        const chunks = []
        let downloaded = 0
        const totalSize = parseInt(response.headers['content-length'], 10)

        response.on('data', (chunk) => {
          chunks.push(chunk)
          downloaded += chunk.length
          if (totalSize > 1000000) { // Only show progress for large files
            const pct = ((downloaded / totalSize) * 100).toFixed(1)
            process.stdout.write(`\r  Downloading: ${pct}%`)
          }
        })

        response.on('end', () => {
          if (totalSize > 1000000) process.stdout.write('\n')
          const buffer = Buffer.concat(chunks)
          writeFile(destPath, buffer).then(resolve).catch(reject)
        })

        response.on('error', reject)
      }).on('error', reject)
    }

    makeRequest(url)
  })
}

async function main() {
  console.log('Downloading RMBG-1.4 model for background removal...\n')

  // Create directories
  await mkdir(ONNX_DIR, { recursive: true })

  for (const file of FILES) {
    const exists = await fileExists(file.path, file.size)
    if (exists) {
      console.log(`✓ ${file.path} (already exists)`)
    } else {
      console.log(`Downloading ${file.path}...`)
      try {
        await downloadFile(file.url, file.path)
        console.log(`✓ ${file.path}`)
      } catch (err) {
        console.error(`✗ Failed to download ${file.path}: ${err.message}`)
        process.exit(1)
      }
    }
  }

  console.log('\nModel download complete!')
}

main()
