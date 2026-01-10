/**
 * Photobooth State Management
 * Centralized state for the photobooth application
 */

// Models
export let bodyPixModel = null
export let upscaler = null

// Video stream
export let videoStream = null

// Image data versions
export let capturedImageData = null
export let processedImageData = null
export let originalWithBackground = null
export let segmentationMask = null
export let imageWithBackground = null
export let imageWithoutBackground = null
export let imageOriginal = null
export let imageNoLightingWithBg = null
export let imageNoLightingNoBg = null

// Crop state
export let subjectBounds = null
export let isCropped = false

// Filter settings
export const filterSettings = {
    contrast: 1.4,
    brightness: 0.9,
    shadows: 40,
    highlights: 20,
    grain: 20,
    vignette: 30,
    sepia: 10,
    blur: 0.5,
    backgroundDim: 1.0,
    lightBoost: 0.6
}

// Effect levels: 0 = off, 1 = medium, 2 = high, 3 = max (debug only)
export const effectLevels = {
    silhouette: 2,
    lighting: 2,
    highcontrast: 2,
    crushedblacks: 2,
    grain: 2,
    vignette: 2,
    sepia: 2,
    softness: 2
}

// Debug mode flag
export let debugMode = false
export function setDebugMode(enabled) { debugMode = enabled }

// Enhancement settings (debug only)
export const enhanceSettings = {
    enabled: false,
    order: 'before',  // 'before' or 'after' other filters
    autoWhiteBalance: 0.5,
    localContrast: 0.4,
    skinSmoothing: 0.3,
    detailSharpening: 0.3
}

// Preset values for debug panel
export const presetValues = {
    classic: {
        contrast: 1.4,
        brightness: 0.9,
        shadows: 40,
        highlights: 20,
        grain: 20,
        vignette: 30,
        sepia: 10,
        blur: 0.5
    },
    silhouette: {
        contrast: 1.8,
        brightness: 0.7,
        shadows: 80,
        highlights: 10,
        grain: 15,
        vignette: 50,
        sepia: 5,
        blur: 0
    },
    foggy: {
        contrast: 1.1,
        brightness: 1.1,
        shadows: 10,
        highlights: 40,
        grain: 25,
        vignette: 20,
        sepia: 15,
        blur: 1.5
    }
}

// Effect values for each level: [off, medium, high, max]
export const effectValues = {
    silhouette: { backgroundDim: [0, 0.6, 1.0, 1.0] },  // 0=none, 0.6=dim, 1.0=black
    lighting: { lightBoost: [0, 0.5, 0.85, 1.2] },  // lighting intensity - more pronounced
    highcontrast: { contrast: [1.0, 1.3, 1.6, 2.2] },
    crushedblacks: { shadows: [0, 8, 18, 35] },
    grain: { grain: [0, 12, 24, 40] },
    vignette: { vignette: [0, 30, 55, 85] },
    sepia: { sepia: [0, 6, 14, 25] },
    softness: { blur: [0, 0.3, 0.6, 1.2] }
}

// Base values (applied first, then effects modify them)
export const baseValues = {
    contrast: 1.0,
    brightness: 0.95,
    shadows: 0,
    highlights: 20,
    grain: 0,
    vignette: 0,
    sepia: 0,
    blur: 0,
    backgroundDim: 0,
    lightBoost: 0
}

// DOM Elements cache
export const panels = {
    intro: null,
    camera: null,
    processing: null,
    editor: null,
    success: null
}

export const elements = {
    video: null,
    previewCanvas: null,
    editorCanvas: null,
    captureBtn: null,
    cameraLoading: null,
    processingStatus: null,
    countdownOverlay: null,
    countdownNumber: null,
    captureBtnText: null,
    captureProcessingOverlay: null,
    captureProcessingText: null
}

// Setters for mutable state
export function setBodyPixModel(model) { bodyPixModel = model }
export function setUpscaler(u) { upscaler = u }
export function setVideoStream(stream) { videoStream = stream }
export function setCapturedImageData(data) { capturedImageData = data }
export function setProcessedImageData(data) { processedImageData = data }
export function setOriginalWithBackground(data) { originalWithBackground = data }
export function setSegmentationMask(mask) { segmentationMask = mask }
export function setImageWithBackground(data) { imageWithBackground = data }
export function setImageWithoutBackground(data) { imageWithoutBackground = data }
export function setImageOriginal(data) { imageOriginal = data }
export function setImageNoLightingWithBg(data) { imageNoLightingWithBg = data }
export function setImageNoLightingNoBg(data) { imageNoLightingNoBg = data }
export function setSubjectBounds(bounds) { subjectBounds = bounds }
export function setIsCropped(cropped) { isCropped = cropped }

// Reset all image state
export function resetImageState() {
    capturedImageData = null
    processedImageData = null
    originalWithBackground = null
    imageWithBackground = null
    imageWithoutBackground = null
    imageOriginal = null
    imageNoLightingWithBg = null
    imageNoLightingNoBg = null
    segmentationMask = null
    subjectBounds = null
    isCropped = false
}

// Initialize DOM element cache
export function initElements() {
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
    elements.countdownOverlay = document.getElementById('countdown-overlay')
    elements.countdownNumber = document.getElementById('countdown-number')
    elements.captureBtnText = document.querySelector('.capture-btn-text')
    elements.captureProcessingOverlay = document.getElementById('capture-processing-overlay')
    elements.captureProcessingText = document.getElementById('capture-processing-text')
}

// Show/hide panels
export function showPanel(panelName) {
    Object.values(panels).forEach(panel => {
        if (panel) panel.classList.add('hidden')
    })
    if (panels[panelName]) {
        panels[panelName].classList.remove('hidden')
    }
}
