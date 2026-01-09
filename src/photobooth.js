/**
 * Timmons Photobooth
 * Creates portraits in the style of William "Dever" Timmons
 */

import { setupInactivityTimer } from './inactivity.js'
import { audioManager } from './audio-manager.js'

// Global state
let bodyPixModel = null
let videoStream = null
let capturedImageData = null
let processedImageData = null
let originalWithBackground = null

// Filter settings
const filterSettings = {
    contrast: 1.4,
    brightness: 0.9,
    shadows: 40,
    highlights: 20,
    grain: 20,
    vignette: 30,
    sepia: 10,
    blur: 0.5
}

// DOM Elements
const panels = {
    intro: null,
    camera: null,
    processing: null,
    editor: null,
    success: null
}

const elements = {
    video: null,
    previewCanvas: null,
    editorCanvas: null,
    captureBtn: null,
    cameraLoading: null,
    processingStatus: null
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init)

function init() {
    // Cache DOM elements
    panels.intro = document.getElementById('panel-intro')
    panels.camera = document.getElementById('panel-camera')
    panels.processing = document.getElementById('panel-processing')
    panels.editor = document.getElementById('panel-editor')
    panels.success = document.getElementById('panel-success')

    elements.video = document.getElementById('camera-feed')
    elements.previewCanvas = document.getElementById('preview-canvas')
    elements.editorCanvas = document.getElementById('editor-canvas')
    elements.captureBtn = document.getElementById('capture-btn')
    elements.cameraLoading = document.getElementById('camera-loading')
    elements.processingStatus = document.getElementById('processing-status')

    // Set up control listeners
    setupControlListeners()

    // Set up inactivity timer
    setupInactivityTimer(() => {
        window.location.href = '/'
    })

    // Expose global functions
    window.startPhotobooth = startPhotobooth
    window.capturePhoto = capturePhoto
    window.retakePhoto = retakePhoto
    window.sendToPrint = sendToPrint
    window.startOver = startOver
    window.applyPreset = applyPreset
}

function setupControlListeners() {
    const controls = [
        { id: 'ctrl-contrast', key: 'contrast', format: v => `${Math.round(v * 100)}%` },
        { id: 'ctrl-brightness', key: 'brightness', format: v => `${Math.round(v * 100)}%` },
        { id: 'ctrl-shadows', key: 'shadows', format: v => v },
        { id: 'ctrl-highlights', key: 'highlights', format: v => v },
        { id: 'ctrl-grain', key: 'grain', format: v => v },
        { id: 'ctrl-vignette', key: 'vignette', format: v => `${v}%` },
        { id: 'ctrl-sepia', key: 'sepia', format: v => `${v}%` },
        { id: 'ctrl-blur', key: 'blur', format: v => `${v}px` }
    ]

    controls.forEach(ctrl => {
        const input = document.getElementById(ctrl.id)
        const valueDisplay = document.getElementById(`val-${ctrl.key}`)

        if (input) {
            input.addEventListener('input', () => {
                filterSettings[ctrl.key] = parseFloat(input.value)
                if (valueDisplay) {
                    valueDisplay.textContent = ctrl.format(filterSettings[ctrl.key])
                }
                updatePreview()
            })
        }
    })
}

function showPanel(panelName) {
    Object.values(panels).forEach(panel => {
        if (panel) panel.classList.add('hidden')
    })
    if (panels[panelName]) {
        panels[panelName].classList.remove('hidden')
    }
}

// ==========================================
// CAMERA FUNCTIONS
// ==========================================

async function startPhotobooth() {
    showPanel('camera')
    await initCamera()
    await loadBodyPixModel()
}

async function initCamera() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 960 },
                facingMode: 'user'
            },
            audio: false
        })

        elements.video.srcObject = videoStream
        await elements.video.play()

        elements.cameraLoading.classList.add('hidden')
        elements.captureBtn.disabled = false

    } catch (error) {
        console.error('Camera error:', error)
        elements.cameraLoading.textContent = 'Camera access denied. Please enable camera permissions.'
    }
}

async function loadBodyPixModel() {
    if (bodyPixModel) return

    try {
        // Load BodyPix model with medium accuracy for balance of speed and quality
        bodyPixModel = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        })
        console.log('BodyPix model loaded')
    } catch (error) {
        console.error('Failed to load BodyPix:', error)
        // Continue without background removal
    }
}

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop())
        videoStream = null
    }
}

// ==========================================
// CAPTURE AND PROCESSING
// ==========================================

async function capturePhoto() {
    if (!elements.video.videoWidth) return

    showPanel('processing')
    elements.processingStatus.textContent = 'Capturing image...'

    // Create canvas at video resolution
    const canvas = document.createElement('canvas')
    canvas.width = elements.video.videoWidth
    canvas.height = elements.video.videoHeight
    const ctx = canvas.getContext('2d')

    // Draw video frame (flipped horizontally to match mirror view)
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(elements.video, 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    // Store original with background
    originalWithBackground = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Process with background removal
    elements.processingStatus.textContent = 'Removing background...'

    try {
        if (bodyPixModel) {
            await removeBackground(canvas, ctx)
        }
    } catch (error) {
        console.error('Background removal failed:', error)
        // Continue with original image
    }

    // Store the captured image
    capturedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    elements.processingStatus.textContent = 'Applying Timmons style...'

    // Stop camera
    stopCamera()

    // Initialize editor
    await initEditor()
}

async function removeBackground(canvas, ctx) {
    // Get segmentation mask
    const segmentation = await bodyPixModel.segmentPerson(canvas, {
        flipHorizontal: false,
        internalResolution: 'medium',
        segmentationThreshold: 0.7
    })

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const pixels = imageData.data

    // Apply mask - set background to black
    for (let i = 0; i < segmentation.data.length; i++) {
        const pixelIndex = i * 4
        if (segmentation.data[i] === 0) {
            // Background pixel - set to black
            pixels[pixelIndex] = 0     // R
            pixels[pixelIndex + 1] = 0 // G
            pixels[pixelIndex + 2] = 0 // B
            // Keep alpha at 255
        }
    }

    // Smooth the edges slightly
    smoothEdges(pixels, canvas.width, canvas.height, segmentation.data)

    ctx.putImageData(imageData, 0, 0)
}

function smoothEdges(pixels, width, height, mask) {
    // Simple edge smoothing by checking neighbors
    const edgePixels = []

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x
            if (mask[i] === 1) {
                // Check if this is an edge pixel (has background neighbor)
                const hasBackgroundNeighbor =
                    mask[i - 1] === 0 || mask[i + 1] === 0 ||
                    mask[i - width] === 0 || mask[i + width] === 0

                if (hasBackgroundNeighbor) {
                    edgePixels.push({ x, y, i })
                }
            }
        }
    }

    // Slightly darken edge pixels for softer transition
    edgePixels.forEach(({ i }) => {
        const pixelIndex = i * 4
        pixels[pixelIndex] = Math.floor(pixels[pixelIndex] * 0.7)
        pixels[pixelIndex + 1] = Math.floor(pixels[pixelIndex + 1] * 0.7)
        pixels[pixelIndex + 2] = Math.floor(pixels[pixelIndex + 2] * 0.7)
    })
}

// ==========================================
// EDITOR FUNCTIONS
// ==========================================

async function initEditor() {
    // Set up editor canvas
    elements.editorCanvas.width = capturedImageData.width
    elements.editorCanvas.height = capturedImageData.height

    // Reset controls to default values
    resetControlValues()

    // Apply initial filters
    updatePreview()

    // Show editor
    showPanel('editor')
}

function resetControlValues() {
    filterSettings.contrast = 1.4
    filterSettings.brightness = 0.9
    filterSettings.shadows = 40
    filterSettings.highlights = 20
    filterSettings.grain = 20
    filterSettings.vignette = 30
    filterSettings.sepia = 10
    filterSettings.blur = 0.5

    // Update UI
    const controls = [
        { id: 'ctrl-contrast', key: 'contrast', format: v => `${Math.round(v * 100)}%` },
        { id: 'ctrl-brightness', key: 'brightness', format: v => `${Math.round(v * 100)}%` },
        { id: 'ctrl-shadows', key: 'shadows', format: v => v },
        { id: 'ctrl-highlights', key: 'highlights', format: v => v },
        { id: 'ctrl-grain', key: 'grain', format: v => v },
        { id: 'ctrl-vignette', key: 'vignette', format: v => `${v}%` },
        { id: 'ctrl-sepia', key: 'sepia', format: v => `${v}%` },
        { id: 'ctrl-blur', key: 'blur', format: v => `${v}px` }
    ]

    controls.forEach(ctrl => {
        const input = document.getElementById(ctrl.id)
        const valueDisplay = document.getElementById(`val-${ctrl.key}`)
        if (input) input.value = filterSettings[ctrl.key]
        if (valueDisplay) valueDisplay.textContent = ctrl.format(filterSettings[ctrl.key])
    })
}

function updatePreview() {
    if (!capturedImageData) return

    const ctx = elements.editorCanvas.getContext('2d')

    // Create working copy
    const workingData = new ImageData(
        new Uint8ClampedArray(capturedImageData.data),
        capturedImageData.width,
        capturedImageData.height
    )

    // Apply filter pipeline
    applyTimmonsFilters(workingData)

    // Store processed data
    processedImageData = workingData

    // Draw to canvas
    ctx.putImageData(workingData, 0, 0)

    // Apply CSS-based effects that can't be done per-pixel
    applyCanvasEffects(ctx)
}

function applyTimmonsFilters(imageData) {
    const pixels = imageData.data
    const width = imageData.width
    const height = imageData.height

    // Pre-calculate vignette map
    const vignetteMap = createVignetteMap(width, height, filterSettings.vignette)

    for (let i = 0; i < pixels.length; i += 4) {
        let r = pixels[i]
        let g = pixels[i + 1]
        let b = pixels[i + 2]

        // 1. Convert to grayscale using luminance formula
        let gray = 0.299 * r + 0.587 * g + 0.114 * b

        // 2. Apply brightness
        gray = gray * filterSettings.brightness

        // 3. Apply contrast (S-curve approximation)
        gray = applyContrast(gray, filterSettings.contrast)

        // 4. Crush shadows
        gray = crushShadows(gray, filterSettings.shadows)

        // 5. Lift highlights
        gray = liftHighlights(gray, filterSettings.highlights)

        // 6. Apply vignette
        const pixelIndex = i / 4
        const x = pixelIndex % width
        const y = Math.floor(pixelIndex / width)
        const vignetteValue = vignetteMap[y * width + x]
        gray = gray * vignetteValue

        // 7. Apply sepia toning (subtle warm tone)
        let finalR = gray
        let finalG = gray
        let finalB = gray

        if (filterSettings.sepia > 0) {
            const sepiaAmount = filterSettings.sepia / 100
            finalR = gray + (gray * 0.15 * sepiaAmount)  // Slight red/orange boost
            finalG = gray + (gray * 0.05 * sepiaAmount)  // Slight green boost
            finalB = gray - (gray * 0.1 * sepiaAmount)   // Reduce blue
        }

        // 8. Add film grain
        if (filterSettings.grain > 0) {
            const grainAmount = (Math.random() - 0.5) * filterSettings.grain
            finalR += grainAmount
            finalG += grainAmount
            finalB += grainAmount
        }

        // Clamp values
        pixels[i] = clamp(finalR, 0, 255)
        pixels[i + 1] = clamp(finalG, 0, 255)
        pixels[i + 2] = clamp(finalB, 0, 255)
    }
}

function applyContrast(value, contrast) {
    // Apply contrast around midpoint (128)
    const factor = (259 * (contrast * 255 - 128)) / (255 * (259 - (contrast * 255 - 128)))
    return clamp(factor * (value - 128) + 128, 0, 255)
}

function crushShadows(value, amount) {
    // Crush shadows: values below threshold get pushed toward black
    const threshold = 128
    if (value < threshold) {
        const crushFactor = 1 - (amount / 100)
        return value * crushFactor
    }
    return value
}

function liftHighlights(value, amount) {
    // Lift highlights: values above threshold get pushed toward white
    const threshold = 180
    if (value > threshold) {
        const liftAmount = (amount / 100) * (255 - value) * 0.5
        return value + liftAmount
    }
    return value
}

function createVignetteMap(width, height, intensity) {
    const map = new Float32Array(width * height)
    const centerX = width / 2
    const centerY = height / 2
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY)

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = x - centerX
            const dy = y - centerY
            const distance = Math.sqrt(dx * dx + dy * dy)
            const normalizedDistance = distance / maxDistance

            // Smooth vignette falloff
            const vignette = 1 - (Math.pow(normalizedDistance, 2) * (intensity / 100))
            map[y * width + x] = Math.max(0.3, vignette) // Don't go completely black
        }
    }

    return map
}

function applyCanvasEffects(ctx) {
    // Apply slight blur for that analog softness
    if (filterSettings.blur > 0) {
        ctx.filter = `blur(${filterSettings.blur}px)`
        ctx.drawImage(elements.editorCanvas, 0, 0)
        ctx.filter = 'none'
    }
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
}

// ==========================================
// PRESETS
// ==========================================

function applyPreset(presetName) {
    switch (presetName) {
        case 'silhouette':
            filterSettings.contrast = 2.2
            filterSettings.brightness = 0.7
            filterSettings.shadows = 80
            filterSettings.highlights = 10
            filterSettings.grain = 15
            filterSettings.vignette = 40
            filterSettings.sepia = 5
            filterSettings.blur = 0
            break

        case 'portrait':
            filterSettings.contrast = 1.3
            filterSettings.brightness = 1.0
            filterSettings.shadows = 25
            filterSettings.highlights = 25
            filterSettings.grain = 20
            filterSettings.vignette = 25
            filterSettings.sepia = 12
            filterSettings.blur = 0.5
            break

        case 'foggy':
            filterSettings.contrast = 1.1
            filterSettings.brightness = 1.1
            filterSettings.shadows = 15
            filterSettings.highlights = 35
            filterSettings.grain = 25
            filterSettings.vignette = 20
            filterSettings.sepia = 8
            filterSettings.blur = 1.5
            break

        case 'reset':
        default:
            filterSettings.contrast = 1.4
            filterSettings.brightness = 0.9
            filterSettings.shadows = 40
            filterSettings.highlights = 20
            filterSettings.grain = 20
            filterSettings.vignette = 30
            filterSettings.sepia = 10
            filterSettings.blur = 0.5
            break
    }

    // Update UI controls
    resetControlValues()
    updatePreview()
}

// ==========================================
// ACTIONS
// ==========================================

function retakePhoto() {
    capturedImageData = null
    processedImageData = null
    originalWithBackground = null
    showPanel('camera')
    initCamera()
}

async function sendToPrint() {
    if (!processedImageData) return

    // Get final image as data URL
    const canvas = document.createElement('canvas')
    canvas.width = processedImageData.width
    canvas.height = processedImageData.height
    const ctx = canvas.getContext('2d')
    ctx.putImageData(processedImageData, 0, 0)

    // Apply blur if needed
    if (filterSettings.blur > 0) {
        ctx.filter = `blur(${filterSettings.blur}px)`
        ctx.drawImage(canvas, 0, 0)
        ctx.filter = 'none'
    }

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95)

    try {
        // Send to print queue server
        const response = await fetch('/api/print-queue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: imageDataUrl,
                timestamp: new Date().toISOString(),
                settings: { ...filterSettings }
            })
        })

        if (response.ok) {
            showPanel('success')
        } else {
            // Fallback: download the image
            downloadImage(imageDataUrl)
            showPanel('success')
        }
    } catch (error) {
        console.error('Failed to send to print queue:', error)
        // Fallback: download the image
        downloadImage(imageDataUrl)
        showPanel('success')
    }
}

function downloadImage(dataUrl) {
    const link = document.createElement('a')
    link.download = `timmons-portrait-${Date.now()}.jpg`
    link.href = dataUrl
    link.click()
}

function startOver() {
    capturedImageData = null
    processedImageData = null
    originalWithBackground = null
    showPanel('intro')
}
