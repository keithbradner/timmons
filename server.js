/**
 * Timmons Museum Display Server
 * Handles print queue for photobooth and proxies to Vite dev server
 */

import express from 'express'
import { createServer as createViteServer } from 'vite'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { writeFileSync, readFileSync, existsSync, mkdirSync, statSync, createWriteStream } from 'fs'
import https from 'https'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const isDev = process.env.NODE_ENV !== 'production'

// ==========================================
// RMBG-1.4 MODEL ON-DEMAND DOWNLOAD
// ==========================================

const MODEL_DIR = join(__dirname, isDev ? 'public' : 'dist', 'models', 'briaai', 'RMBG-1.4')
const ONNX_PATH = join(MODEL_DIR, 'onnx', 'model.onnx')
const MODEL_URL = 'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx'
const MIN_MODEL_SIZE = 100000000 // 100MB - real model is ~176MB

let modelDownloadPromise = null

function isModelValid() {
    if (!existsSync(ONNX_PATH)) return false
    try {
        const stats = statSync(ONNX_PATH)
        return stats.size > MIN_MODEL_SIZE
    } catch {
        return false
    }
}

async function downloadModel() {
    // If already downloading, wait for that
    if (modelDownloadPromise) return modelDownloadPromise

    if (isModelValid()) return Promise.resolve()

    console.log('Downloading RMBG-1.4 model from Hugging Face...')
    mkdirSync(join(MODEL_DIR, 'onnx'), { recursive: true })

    modelDownloadPromise = new Promise((resolve, reject) => {
        const makeRequest = (url) => {
            https.get(url, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    makeRequest(response.headers.location)
                    return
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`))
                    return
                }

                const totalSize = parseInt(response.headers['content-length'], 10)
                let downloaded = 0
                const file = createWriteStream(ONNX_PATH)

                response.on('data', (chunk) => {
                    downloaded += chunk.length
                    const pct = ((downloaded / totalSize) * 100).toFixed(1)
                    process.stdout.write(`\rDownloading RMBG-1.4: ${pct}%`)
                })

                response.pipe(file)

                file.on('finish', () => {
                    file.close()
                    console.log('\nRMBG-1.4 model download complete!')
                    modelDownloadPromise = null
                    resolve()
                })

                file.on('error', (err) => {
                    modelDownloadPromise = null
                    reject(err)
                })
            }).on('error', (err) => {
                modelDownloadPromise = null
                reject(err)
            })
        }
        makeRequest(MODEL_URL)
    })

    return modelDownloadPromise
}

// Intercept model.onnx requests - download if needed, then serve
app.get('/models/briaai/RMBG-1.4/onnx/model.onnx', async (req, res) => {
    try {
        if (!isModelValid()) {
            await downloadModel()
        }
        res.sendFile(ONNX_PATH)
    } catch (error) {
        console.error('Failed to serve model:', error)
        res.status(500).json({ error: 'Failed to download model' })
    }
})

// Print queue storage
const QUEUE_FILE = join(__dirname, 'data', 'print-queue.json')
let printQueue = []

// Ensure data directory exists
const dataDir = join(__dirname, 'data')
if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
}

// Load existing queue from file
function loadQueue() {
    try {
        if (existsSync(QUEUE_FILE)) {
            const data = readFileSync(QUEUE_FILE, 'utf-8')
            printQueue = JSON.parse(data)
            console.log(`Loaded ${printQueue.length} items from print queue`)
        }
    } catch (error) {
        console.error('Error loading print queue:', error)
        printQueue = []
    }
}

// Save queue to file
function saveQueue() {
    try {
        writeFileSync(QUEUE_FILE, JSON.stringify(printQueue, null, 2))
    } catch (error) {
        console.error('Error saving print queue:', error)
    }
}

// Initialize queue
loadQueue()

// Middleware for JSON parsing
app.use(express.json({ limit: '50mb' }))

// ==========================================
// PRINT QUEUE API
// ==========================================

// Add item to print queue
app.post('/api/print-queue', (req, res) => {
    try {
        const { image, timestamp, settings } = req.body

        if (!image) {
            return res.status(400).json({ error: 'No image provided' })
        }

        const queueItem = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            image,
            timestamp: timestamp || new Date().toISOString(),
            settings: settings || {},
            status: 'pending',
            createdAt: new Date().toISOString()
        }

        printQueue.push(queueItem)
        saveQueue()

        console.log(`Added print job ${queueItem.id} to queue. Total: ${printQueue.length}`)

        res.json({
            success: true,
            id: queueItem.id,
            position: printQueue.filter(item => item.status === 'pending').length
        })
    } catch (error) {
        console.error('Error adding to print queue:', error)
        res.status(500).json({ error: 'Failed to add to print queue' })
    }
})

// Get print queue (for front desk)
app.get('/api/print-queue', (req, res) => {
    const status = req.query.status
    let items = printQueue

    if (status) {
        items = printQueue.filter(item => item.status === status)
    }

    // Sort by creation time, newest first
    items = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.json({
        total: printQueue.length,
        pending: printQueue.filter(item => item.status === 'pending').length,
        items: items.map(item => ({
            id: item.id,
            timestamp: item.timestamp,
            status: item.status,
            createdAt: item.createdAt,
            // Include image for pending items
            image: item.status === 'pending' ? item.image : undefined
        }))
    })
})

// Get single print job
app.get('/api/print-queue/:id', (req, res) => {
    const item = printQueue.find(i => i.id === req.params.id)

    if (!item) {
        return res.status(404).json({ error: 'Print job not found' })
    }

    res.json(item)
})

// Update print job status
app.patch('/api/print-queue/:id', (req, res) => {
    const item = printQueue.find(i => i.id === req.params.id)

    if (!item) {
        return res.status(404).json({ error: 'Print job not found' })
    }

    const { status } = req.body

    if (status && ['pending', 'printing', 'completed', 'cancelled'].includes(status)) {
        item.status = status
        item.updatedAt = new Date().toISOString()
        saveQueue()

        console.log(`Updated print job ${item.id} status to ${status}`)
    }

    res.json({ success: true, item })
})

// Delete print job
app.delete('/api/print-queue/:id', (req, res) => {
    const index = printQueue.findIndex(i => i.id === req.params.id)

    if (index === -1) {
        return res.status(404).json({ error: 'Print job not found' })
    }

    const removed = printQueue.splice(index, 1)[0]
    saveQueue()

    console.log(`Deleted print job ${removed.id}`)

    res.json({ success: true })
})

// Clear completed/cancelled jobs
app.post('/api/print-queue/clear-completed', (req, res) => {
    const before = printQueue.length
    printQueue = printQueue.filter(item => item.status === 'pending' || item.status === 'printing')
    saveQueue()

    console.log(`Cleared ${before - printQueue.length} completed/cancelled jobs`)

    res.json({
        success: true,
        removed: before - printQueue.length,
        remaining: printQueue.length
    })
})

// ==========================================
// SERVER SETUP
// ==========================================

async function startServer() {
    if (isDev) {
        // Create Vite server in middleware mode
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'mpa'
        })

        // Use Vite's connect instance as middleware
        app.use(vite.middlewares)

        console.log('Vite dev server integrated')
    } else {
        // In production, serve built files
        app.use(express.static(join(__dirname, 'dist')))

        // Handle SPA fallback for specific pages
        const pages = ['index.html', 'darkroom.html', 'photobooth.html', 'printqueue.html']
        pages.forEach(page => {
            const route = page === 'index.html' ? '/' : `/${page.replace('.html', '')}`
            app.get(route, (req, res) => {
                res.sendFile(join(__dirname, 'dist', page))
            })
        })
    }

    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   Timmons Museum Display Server                            ║
║   Running on http://localhost:${PORT}                         ║
║                                                            ║
║   Pages:                                                   ║
║   - Main Gallery:    http://localhost:${PORT}/                ║
║   - Darkroom:        http://localhost:${PORT}/darkroom        ║
║   - Photobooth:      http://localhost:${PORT}/photobooth      ║
║   - Print Queue:     http://localhost:${PORT}/printqueue      ║
║                                                            ║
║   Mode: ${isDev ? 'Development (Vite HMR)' : 'Production'}                          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
        `)
    })
}

startServer().catch(console.error)
