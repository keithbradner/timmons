/**
 * Timmons Photobooth
 * Creates portraits in the style of William "Dever" Timmons
 */

import '@tensorflow/tfjs'
import * as bodyPix from '@tensorflow-models/body-pix'

import { setupInactivityTimer } from './inactivity.js'
import { audioManager } from './audio-manager.js'

// Import modules
import * as state from './photobooth/state.js'
import { applyTimmonsFilters } from './photobooth/filters.js'
import { createSoftMask } from './photobooth/mask.js'
import { applyDirectionalLighting } from './photobooth/lighting.js'
import { upscaleImage } from './photobooth/upscale.js'
import { cropToSubject as doCropToSubject, cropImageData } from './photobooth/crop.js'
import * as debug from './photobooth/debug.js'

// Initialize on load
document.addEventListener('DOMContentLoaded', init)

function init() {
    state.initElements()
    setupLevelButtons()
    setupInactivityTimer(() => {
        window.location.href = '/'
    })
}

function setupLevelButtons() {
    // Set up click handlers for all level buttons
    document.querySelectorAll('.level-buttons').forEach(container => {
        const effect = container.dataset.effect
        container.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const level = parseInt(btn.dataset.level)
                setEffectLevel(effect, level)
            })
        })
    })
}

async function setEffectLevel(effectName, level) {
    state.effectLevels[effectName] = level

    // Update button states
    const container = document.querySelector(`.level-buttons[data-effect="${effectName}"]`)
    if (container) {
        container.querySelectorAll('.level-btn').forEach(btn => {
            const btnLevel = parseInt(btn.dataset.level)
            btn.classList.toggle('active', btnLevel === level)
        })
    }

    // Show spinner for heavy operations
    const heavyEffects = ['silhouette', 'lighting']
    if (heavyEffects.includes(effectName)) {
        showEditorProcessing('Applying effect...')
        await yieldToMain()
    }

    applyLevelSettings()
    updatePreview()

    hideEditorProcessing()
}

function syncLevelButtons() {
    Object.keys(state.effectLevels).forEach(effect => {
        const container = document.querySelector(`.level-buttons[data-effect="${effect}"]`)
        if (container) {
            const level = state.effectLevels[effect]
            container.querySelectorAll('.level-btn').forEach(btn => {
                const btnLevel = parseInt(btn.dataset.level)
                btn.classList.toggle('active', btnLevel === level)
            })
        }
    })
}

function enableDebugMode() {
    state.setDebugMode(true)
    // Show all max buttons
    document.querySelectorAll('.level-max').forEach(btn => {
        btn.classList.remove('hidden')
    })
}

// ==========================================
// CAMERA FUNCTIONS
// ==========================================

async function startPhotobooth() {
    state.showPanel('camera')
    await initCamera()
    await loadBodyPixModel()
}

async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 768 },
                height: { ideal: 960 },
                aspectRatio: { ideal: 4/5 },
                facingMode: 'user'
            },
            audio: false
        })

        state.setVideoStream(stream)
        state.elements.video.srcObject = stream
        await state.elements.video.play()

        state.elements.cameraLoading.classList.add('hidden')
        state.elements.captureBtn.disabled = false
    } catch (error) {
        console.error('Camera error:', error)
        state.elements.cameraLoading.textContent = 'Camera access denied. Please enable camera permissions.'
    }
}

async function loadBodyPixModel() {
    if (state.bodyPixModel) return

    try {
        const model = await bodyPix.load({
            architecture: 'ResNet50',
            outputStride: 16,
            quantBytes: 4
        })
        state.setBodyPixModel(model)
        console.log('BodyPix model loaded')
    } catch (error) {
        console.error('Failed to load BodyPix:', error)
    }
}

function stopCamera() {
    if (state.videoStream) {
        state.videoStream.getTracks().forEach(track => track.stop())
        state.setVideoStream(null)
    }
}

// ==========================================
// COUNTDOWN AND CAPTURE
// ==========================================

function startCountdown() {
    if (!state.elements.video.videoWidth) return

    state.elements.captureBtn.classList.add('counting')
    state.elements.countdownOverlay.classList.remove('hidden')

    let count = 3
    state.elements.countdownNumber.textContent = count
    state.elements.captureBtnText.textContent = count

    const countdownInterval = setInterval(() => {
        count--

        if (count > 0) {
            state.elements.countdownNumber.textContent = count
            state.elements.captureBtnText.textContent = count
            state.elements.countdownNumber.style.animation = 'none'
            void state.elements.countdownNumber.offsetWidth
            state.elements.countdownNumber.style.animation = 'countdownPop 1s ease-out'
        } else {
            clearInterval(countdownInterval)
            state.elements.countdownOverlay.classList.add('hidden')
            state.elements.captureBtn.classList.remove('counting')
            state.elements.captureBtnText.textContent = '3'

            state.elements.video.pause()
            showCaptureProcessing('Hold still...')

            setTimeout(() => capturePhoto(), 50)
        }
    }, 1000)
}

// ==========================================
// CAPTURE AND PROCESSING
// ==========================================

async function capturePhoto() {
    if (!state.elements.video.videoWidth) return

    // Disable button and show processing
    state.elements.captureBtn.disabled = true
    showCaptureProcessing('Capturing...')

    const canvas = document.createElement('canvas')
    canvas.width = state.elements.video.videoWidth
    canvas.height = state.elements.video.videoHeight
    const ctx = canvas.getContext('2d')

    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(state.elements.video, 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    const width = canvas.width
    const height = canvas.height
    const originalImage = ctx.getImageData(0, 0, width, height)

    // Run segmentation
    let segMask = null
    try {
        if (state.bodyPixModel) {
            showCaptureProcessing('Detecting subject...')
            await yieldToMain()
            const segmentation = await state.bodyPixModel.segmentPerson(canvas, {
                flipHorizontal: false,
                internalResolution: 'medium',
                segmentationThreshold: 0.6
            })

            showCaptureProcessing('Refining edges...')
            await yieldToMain()
            segMask = createSoftMask(segmentation.data, width, height)
        }
    } catch (error) {
        console.error('Segmentation failed:', error)
    }
    state.setSegmentationMask(segMask)

    // Store the original
    state.setOriginalWithBackground(originalImage)
    state.setImageOriginal(new ImageData(
        new Uint8ClampedArray(originalImage.data),
        width,
        height
    ))

    // Store the base image - all effects are applied dynamically now
    state.setCapturedImageData(state.imageOriginal)
    showCaptureProcessing('Applying style...')

    stopCamera()
    hideCaptureProcessing()
    await initEditor()
}

function showCaptureProcessing(message) {
    if (state.elements.captureProcessingOverlay) {
        state.elements.captureProcessingOverlay.classList.remove('hidden')
    }
    if (state.elements.captureProcessingText) {
        state.elements.captureProcessingText.textContent = message
    }
}

function hideCaptureProcessing() {
    if (state.elements.captureProcessingOverlay) {
        state.elements.captureProcessingOverlay.classList.add('hidden')
    }
}

function showEditorProcessing(message) {
    const overlay = document.getElementById('editor-processing')
    const text = document.getElementById('editor-processing-text')
    if (overlay) overlay.classList.remove('hidden')
    if (text) text.textContent = message || 'Applying...'
}

function hideEditorProcessing() {
    const overlay = document.getElementById('editor-processing')
    if (overlay) overlay.classList.add('hidden')
}

function yieldToMain() {
    return new Promise(resolve => setTimeout(resolve, 0))
}

// ==========================================
// EDITOR FUNCTIONS
// ==========================================

async function initEditor() {
    state.elements.editorCanvas.width = state.capturedImageData.width
    state.elements.editorCanvas.height = state.capturedImageData.height

    syncLevelButtons()
    applyLevelSettings()
    updatePreview()
    state.showPanel('editor')
}

function updatePreview() {
    if (!state.imageOriginal) return

    // Get the source image (cropped or full)
    let sourceImage = state.imageOriginal
    let sourceMask = state.segmentationMask

    if (state.isCropped && state.subjectBounds) {
        sourceImage = cropImageData(state.imageOriginal, state.subjectBounds)
        // Also crop the mask
        if (state.segmentationMask) {
            sourceMask = cropMask(state.segmentationMask, state.imageOriginal.width, state.subjectBounds)
        }
    }

    // Update canvas size if needed
    if (state.elements.editorCanvas.width !== sourceImage.width ||
        state.elements.editorCanvas.height !== sourceImage.height) {
        state.elements.editorCanvas.width = sourceImage.width
        state.elements.editorCanvas.height = sourceImage.height
    }

    const ctx = state.elements.editorCanvas.getContext('2d')
    const workingData = new ImageData(
        new Uint8ClampedArray(sourceImage.data),
        sourceImage.width,
        sourceImage.height
    )

    // Apply lighting if enabled (before other filters)
    if (state.filterSettings.lightBoost > 0 && sourceMask) {
        applyDirectionalLighting(
            workingData.data,
            workingData.width,
            workingData.height,
            sourceMask,
            state.filterSettings.lightBoost
        )
    }

    // Apply filters (with mask for subject-only effects when background is being handled)
    const useMaskForFilters = state.filterSettings.backgroundDim > 0 && sourceMask
    applyTimmonsFilters(workingData, useMaskForFilters ? sourceMask : null)

    state.setProcessedImageData(workingData)
    ctx.putImageData(workingData, 0, 0)

    if (state.filterSettings.blur > 0) {
        ctx.filter = `blur(${state.filterSettings.blur}px)`
        ctx.drawImage(state.elements.editorCanvas, 0, 0)
        ctx.filter = 'none'
    }
}

// Helper to crop mask to match cropped image
function cropMask(mask, originalWidth, bounds) {
    const croppedMask = new Float32Array(bounds.width * bounds.height)
    for (let y = 0; y < bounds.height; y++) {
        for (let x = 0; x < bounds.width; x++) {
            const srcX = bounds.x + x
            const srcY = bounds.y + y
            const srcIndex = srcY * originalWidth + srcX
            const dstIndex = y * bounds.width + x
            croppedMask[dstIndex] = mask[srcIndex] || 0
        }
    }
    return croppedMask
}

// ==========================================
// LEVEL-BASED EFFECTS
// ==========================================

function applyLevelSettings() {
    // Start with base values
    Object.assign(state.filterSettings, state.baseValues)

    // Apply ALL effect values based on levels (including silhouette and lighting)
    const effects = ['silhouette', 'lighting', 'highcontrast', 'crushedblacks', 'grain', 'vignette', 'sepia', 'softness']
    effects.forEach(effect => {
        const level = state.effectLevels[effect]
        if (level > 0 && state.effectValues[effect]) {
            Object.keys(state.effectValues[effect]).forEach(param => {
                const values = state.effectValues[effect][param]
                state.filterSettings[param] = values[level]
            })
        }
    })
}

// ==========================================
// ACTIONS
// ==========================================

function retakePhoto() {
    state.resetImageState()
    state.showPanel('camera')
    initCamera()
}

async function sendToPrint() {
    if (!state.processedImageData) return

    // Show processing overlay
    state.showPanel('processing')
    const processingStatus = document.getElementById('processing-status')

    const canvas = document.createElement('canvas')
    canvas.width = state.processedImageData.width
    canvas.height = state.processedImageData.height
    const ctx = canvas.getContext('2d')
    ctx.putImageData(state.processedImageData, 0, 0)

    if (state.filterSettings.blur > 0) {
        ctx.filter = `blur(${state.filterSettings.blur}px)`
        ctx.drawImage(canvas, 0, 0)
        ctx.filter = 'none'
    }

    // Get the current image data for upscaling
    let finalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Upscale for print quality
    if (processingStatus) processingStatus.textContent = 'Upscaling for print...'
    const upscaledImage = await upscaleImage(finalImageData, (progress) => {
        if (processingStatus) {
            processingStatus.textContent = `Upscaling... ${Math.round(progress * 100)}%`
        }
    })

    if (upscaledImage) {
        // Create new canvas with upscaled dimensions
        canvas.width = upscaledImage.width
        canvas.height = upscaledImage.height
        ctx.putImageData(upscaledImage, 0, 0)
        console.log(`Upscaled for print: ${finalImageData.width}x${finalImageData.height} -> ${upscaledImage.width}x${upscaledImage.height}`)
    }

    if (processingStatus) processingStatus.textContent = 'Sending to print...'

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95)

    try {
        const response = await fetch('/api/print-queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: imageDataUrl,
                timestamp: new Date().toISOString(),
                settings: { ...state.filterSettings }
            })
        })

        if (response.ok) {
            state.showPanel('success')
        } else {
            downloadImage(imageDataUrl)
            state.showPanel('success')
        }
    } catch (error) {
        console.error('Failed to send to print queue:', error)
        downloadImage(imageDataUrl)
        state.showPanel('success')
    }
}

function downloadImage(dataUrl) {
    const link = document.createElement('a')
    link.download = `timmons-portrait-${Date.now()}.jpg`
    link.href = dataUrl
    link.click()
}

function startOver() {
    state.resetImageState()
    state.showPanel('intro')
}

async function cropToSubject() {
    showEditorProcessing('Framing subject...')
    await yieldToMain()
    doCropToSubject(applyLevelSettings, updatePreview)
    hideEditorProcessing()
}

async function applyPreset(presetName) {
    showEditorProcessing('Applying preset...')
    await yieldToMain()
    debug.applyPreset(presetName, updatePreview)
    hideEditorProcessing()
}

// ==========================================
// MANUAL CROP
// ==========================================

let manualCropState = {
    active: false,
    dragging: false,
    dragType: null, // 'move' or 'nw', 'ne', 'sw', 'se'
    startX: 0,
    startY: 0,
    box: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } // Normalized 0-1
}

function openManualCrop() {
    const overlay = document.getElementById('crop-overlay')
    if (!overlay) return

    // Reset to uncropped state first
    if (state.isCropped) {
        state.setIsCropped(false)
        state.setSubjectBounds(null)
        updatePreview()
    }

    manualCropState.active = true
    manualCropState.box = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }
    overlay.classList.remove('hidden')
    updateCropOverlay()
    setupCropListeners()
}

function updateCropOverlay() {
    const preview = document.querySelector('.editor-preview')
    const cropBox = document.getElementById('crop-box')
    if (!preview || !cropBox) return

    const rect = preview.getBoundingClientRect()
    const box = manualCropState.box

    // Calculate pixel positions
    const left = box.x * rect.width
    const top = box.y * rect.height
    const width = box.width * rect.width
    const height = box.height * rect.height

    cropBox.style.left = `${left}px`
    cropBox.style.top = `${top}px`
    cropBox.style.width = `${width}px`
    cropBox.style.height = `${height}px`

    // Update darkened regions
    document.querySelector('.crop-top').style.height = `${top}px`
    document.querySelector('.crop-bottom').style.height = `${rect.height - top - height}px`
    document.querySelector('.crop-bottom').style.top = `${top + height}px`
    document.querySelector('.crop-left').style.top = `${top}px`
    document.querySelector('.crop-left').style.width = `${left}px`
    document.querySelector('.crop-left').style.height = `${height}px`
    document.querySelector('.crop-right').style.top = `${top}px`
    document.querySelector('.crop-right').style.left = `${left + width}px`
    document.querySelector('.crop-right').style.width = `${rect.width - left - width}px`
    document.querySelector('.crop-right').style.height = `${height}px`
}

function setupCropListeners() {
    const overlay = document.getElementById('crop-overlay')
    const cropBox = document.getElementById('crop-box')
    if (!overlay || !cropBox) return

    const onMouseDown = (e) => {
        e.preventDefault()
        const handle = e.target.dataset.handle
        manualCropState.dragging = true
        manualCropState.dragType = handle || 'move'
        manualCropState.startX = e.clientX
        manualCropState.startY = e.clientY
    }

    const onMouseMove = (e) => {
        if (!manualCropState.dragging) return

        const preview = document.querySelector('.editor-preview')
        const rect = preview.getBoundingClientRect()

        const dx = (e.clientX - manualCropState.startX) / rect.width
        const dy = (e.clientY - manualCropState.startY) / rect.height

        const box = manualCropState.box

        if (manualCropState.dragType === 'move') {
            box.x = Math.max(0, Math.min(1 - box.width, box.x + dx))
            box.y = Math.max(0, Math.min(1 - box.height, box.y + dy))
        } else {
            // Handle resize with aspect ratio constraint (4:5)
            const aspect = 4 / 5

            if (manualCropState.dragType.includes('e')) {
                const newWidth = Math.max(0.1, Math.min(1 - box.x, box.width + dx))
                box.width = newWidth
                box.height = newWidth / aspect
            }
            if (manualCropState.dragType.includes('w')) {
                const newWidth = Math.max(0.1, box.width - dx)
                const newX = box.x + (box.width - newWidth)
                if (newX >= 0) {
                    box.x = newX
                    box.width = newWidth
                    box.height = newWidth / aspect
                }
            }
            if (manualCropState.dragType.includes('s')) {
                const newHeight = Math.max(0.1, Math.min(1 - box.y, box.height + dy))
                box.height = newHeight
                box.width = newHeight * aspect
            }
            if (manualCropState.dragType.includes('n')) {
                const newHeight = Math.max(0.1, box.height - dy)
                const newY = box.y + (box.height - newHeight)
                if (newY >= 0) {
                    box.y = newY
                    box.height = newHeight
                    box.width = newHeight * aspect
                }
            }

            // Clamp to bounds
            if (box.x + box.width > 1) box.width = 1 - box.x
            if (box.y + box.height > 1) box.height = 1 - box.y
        }

        manualCropState.startX = e.clientX
        manualCropState.startY = e.clientY
        updateCropOverlay()
    }

    const onMouseUp = () => {
        manualCropState.dragging = false
    }

    cropBox.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    // Store cleanup function
    overlay._cleanup = () => {
        cropBox.removeEventListener('mousedown', onMouseDown)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
    }
}

async function applyCrop() {
    const overlay = document.getElementById('crop-overlay')
    if (overlay._cleanup) overlay._cleanup()
    overlay.classList.add('hidden')

    showEditorProcessing('Applying crop...')
    await yieldToMain()

    const box = manualCropState.box
    const imgWidth = state.imageOriginal.width
    const imgHeight = state.imageOriginal.height

    state.setSubjectBounds({
        x: Math.round(box.x * imgWidth),
        y: Math.round(box.y * imgHeight),
        width: Math.round(box.width * imgWidth),
        height: Math.round(box.height * imgHeight)
    })
    state.setIsCropped(true)

    manualCropState.active = false
    updatePreview()
    hideEditorProcessing()
}

function cancelCrop() {
    const overlay = document.getElementById('crop-overlay')
    if (overlay._cleanup) overlay._cleanup()
    overlay.classList.add('hidden')
    manualCropState.active = false
}

// ==========================================
// WINDOW EXPORTS
// ==========================================

window.startPhotobooth = startPhotobooth
window.startCountdown = startCountdown
window.capturePhoto = capturePhoto
window.retakePhoto = retakePhoto
window.sendToPrint = sendToPrint
window.startOver = startOver
window.applyPreset = applyPreset
window.enableDebugMode = enableDebugMode
window.cropToSubject = cropToSubject
window.openManualCrop = openManualCrop
window.applyCrop = applyCrop
window.cancelCrop = cancelCrop
window.toggleDebugPanel = debug.toggleDebugPanel
window.selectDebugPreset = debug.selectDebugPreset
window.updateDebugValue = debug.updateDebugValue
window.applyDebugSettings = () => debug.applyDebugSettings(updatePreview)
window.saveDebugPreset = () => debug.saveDebugPreset(applyPreset, updatePreview)
window.exportPresets = debug.exportPresets
