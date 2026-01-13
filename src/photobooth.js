/**
 * Timmons Photobooth
 * Creates portraits in the style of William "Dever" Timmons
 */

import { pipeline, env } from '@huggingface/transformers'

import { setupInactivityTimer } from './inactivity.js'
import { audioManager } from './audio-manager.js'

// Import modules
import * as state from './photobooth/state.js'
import { applyTimmonsFilters } from './photobooth/filters.js'
import { createSoftMask, createSoftMaskFromConfidence } from './photobooth/mask.js'

// Configure Transformers.js - use local models (RMBG-1.4 ONNX files in /models/)
env.allowLocalModels = true
env.allowRemoteModels = false
env.localModelPath = '/models/'

// RMBG segmenter pipeline
let segmenter = null
import { applyDirectionalLighting } from './photobooth/lighting.js'
import { cropToSubject as doCropToSubject, cropImageData } from './photobooth/crop.js'
import * as debug from './photobooth/debug.js'
import { isWebGPUSupported, initWebGPU, applyFiltersGPU } from './photobooth/gpu-filters.js'
import { initUpscaleGPU, upscaleImageGPU, upscaleMaskGPU, calculateScale } from './photobooth/gpu-upscale.js'
import { initEnhanceGPU, applyEnhancement } from './photobooth/gpu-enhance.js'

// GPU acceleration state
let useGPU = false

// Initialize on load
document.addEventListener('DOMContentLoaded', init)

async function init() {
    state.initElements()

    // Disable right-click context menu (and long-press on touch)
    document.addEventListener('contextmenu', e => e.preventDefault())

    // Disable pinch zoom
    document.addEventListener('touchstart', e => {
        if (e.touches.length > 1) e.preventDefault()
    }, { passive: false })
    document.addEventListener('touchmove', e => {
        if (e.touches.length > 1) e.preventDefault()
    }, { passive: false })

    setupLevelButtons()
    setupInactivityTimer(() => {
        window.location.href = '/'
    })

    // Initialize WebGPU for accelerated filters
    if (await isWebGPUSupported()) {
        useGPU = await initWebGPU()
        if (useGPU) {
            console.log('Using WebGPU for accelerated image processing')
            // Also init upscaler and enhancer
            await initUpscaleGPU()
            await initEnhanceGPU()
        }
    } else {
        console.log('WebGPU not supported, using CPU filters')
    }
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

    // Show brief processing indicator
    showEditorProcessing('Applying...')
    await yieldToMain()

    applyLevelSettings()
    await updatePreview()

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
    await loadSegmentationModel()
}

async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 3840 },
                height: { ideal: 2160 },
                aspectRatio: { ideal: 4/5 },
                facingMode: 'user',
                resizeMode: 'none',
                focusMode: 'continuous',
                exposureMode: 'continuous',
                whiteBalanceMode: 'continuous'
            },
            audio: false
        })

        state.setVideoStream(stream)
        state.elements.video.srcObject = stream
        await state.elements.video.play()

        // Log actual camera settings and capabilities
        const track = stream.getVideoTracks()[0]
        const settings = track.getSettings()
        const capabilities = track.getCapabilities()
        console.log('=== CAMERA INFO ===')
        console.log('Actual resolution:', `${settings.width}x${settings.height}`)
        console.log('Max supported:', `${capabilities.width?.max}x${capabilities.height?.max}`)
        console.log('All settings:', settings)
        console.log('All capabilities:', capabilities)

        state.elements.cameraLoading.classList.add('hidden')
        state.elements.captureBtn.disabled = false
    } catch (error) {
        console.error('Camera error:', error)
        state.elements.cameraLoading.textContent = 'Camera access denied. Please enable camera permissions.'
    }
}

async function loadSegmentationModel() {
    if (segmenter) return

    try {
        showCaptureProcessing('Loading filters...')

        // Use RMBG-1.4 with image-segmentation pipeline (proven working)
        // RMBG-2.0 has known issues: https://github.com/huggingface/transformers.js/issues/1107
        // Load from local path to avoid HF Hub API returning wrong model_type
        segmenter = await pipeline('image-segmentation', '/models/briaai/RMBG-1.4', {
            device: 'webgpu',  // Fast on M-series Macs
            local_files_only: true,
        })

        console.log('RMBG-1.4 segmenter loaded successfully')
        hideCaptureProcessing()
    } catch (error) {
        console.error('Failed to load segmentation model:', error)
        hideCaptureProcessing()
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

            // Capture frame BEFORE pausing (webcam streams may not draw correctly when paused)
            // Crop to 4:5 aspect ratio at full resolution
            const videoWidth = state.elements.video.videoWidth
            const videoHeight = state.elements.video.videoHeight
            const targetAspect = 4 / 5
            const videoAspect = videoWidth / videoHeight

            let cropWidth, cropHeight, cropX, cropY
            if (videoAspect > targetAspect) {
                // Video is wider than 4:5 - crop sides
                cropHeight = videoHeight
                cropWidth = Math.round(videoHeight * targetAspect)
                cropX = Math.round((videoWidth - cropWidth) / 2)
                cropY = 0
            } else {
                // Video is taller than 4:5 - crop top/bottom
                cropWidth = videoWidth
                cropHeight = Math.round(videoWidth / targetAspect)
                cropX = 0
                cropY = Math.round((videoHeight - cropHeight) / 2)
            }

            const captureCanvas = document.createElement('canvas')
            captureCanvas.width = cropWidth
            captureCanvas.height = cropHeight
            const captureCtx = captureCanvas.getContext('2d')
            captureCtx.translate(captureCanvas.width, 0)
            captureCtx.scale(-1, 1)
            // Draw cropped region from video
            captureCtx.drawImage(
                state.elements.video,
                cropX, cropY, cropWidth, cropHeight,  // Source rectangle
                0, 0, cropWidth, cropHeight            // Destination rectangle
            )
            console.log(`Captured ${cropWidth}x${cropHeight} (4:5 crop from ${videoWidth}x${videoHeight})`)

            state.elements.video.pause()
            showCaptureProcessing('Hold still...')

            setTimeout(() => capturePhoto(captureCanvas), 50)
        }
    }, 1000)
}

// ==========================================
// CAPTURE AND PROCESSING
// ==========================================

async function capturePhoto(preCapuredCanvas) {
    // Disable button and show processing
    state.elements.captureBtn.disabled = true
    showCaptureProcessing('Capturing...')

    // Use pre-captured canvas (captured before video was paused)
    const canvas = preCapuredCanvas
    const ctx = canvas.getContext('2d')

    const width = canvas.width
    const height = canvas.height
    const originalImage = ctx.getImageData(0, 0, width, height)

    // Run segmentation with BiRefNet (RMBG-2.0)
    let segMask = null
    try {
        if (segmenter) {
            showCaptureProcessing('Detecting subject...')
            await yieldToMain()

            // Convert canvas to data URL for pipeline input
            const imageDataUrl = canvas.toDataURL('image/png')

            showCaptureProcessing('Running BiRefNet...')
            await yieldToMain()

            // Run the segmentation pipeline
            const results = await segmenter(imageDataUrl)

            showCaptureProcessing('Processing mask...')
            await yieldToMain()

            // Pipeline returns array of segments, get the mask
            // For background removal, we typically get one result with the foreground mask
            if (results && results.length > 0) {
                const result = results[0]

                // The mask might be in result.mask (RawImage) or we need to extract it
                if (result.mask) {
                    const maskImage = result.mask
                    const maskData = maskImage.data

                    // Resize mask to original image dimensions
                    const resizedMask = new Float32Array(width * height)
                    const maskWidth = maskImage.width
                    const maskHeight = maskImage.height
                    const scaleX = maskWidth / width
                    const scaleY = maskHeight / height

                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const srcX = Math.floor(x * scaleX)
                            const srcY = Math.floor(y * scaleY)
                            const srcIdx = (srcY * maskWidth + srcX) * maskImage.channels
                            // Normalize to 0-1 range
                            resizedMask[y * width + x] = maskData[srcIdx] / 255
                        }
                    }

                    // Check if any subject was detected
                    let subjectPixels = 0
                    for (let i = 0; i < resizedMask.length; i++) {
                        if (resizedMask[i] > 0.5) subjectPixels++
                    }
                    const subjectRatio = subjectPixels / resizedMask.length

                    if (subjectRatio > 0.01) {
                        segMask = createSoftMaskFromConfidence(resizedMask, width, height)
                        console.log(`BiRefNet: Subject detected (${(subjectRatio * 100).toFixed(1)}% of frame)`)
                    } else {
                        console.log('No subject detected, skipping background effects')
                    }
                } else {
                    console.log('Pipeline result:', result)
                }
            }
        }
    } catch (error) {
        console.error('BiRefNet segmentation failed:', error)
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
    await updatePreview()
    state.showPanel('editor')
}

async function updatePreview() {
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

        // Upscale cropped image for higher quality output
        const scale = calculateScale(sourceImage.width, sourceImage.height, 1400)
        if (scale > 1) {
            // Store pre-upscale dimensions for mask
            const preUpscaleWidth = sourceImage.width
            const preUpscaleHeight = sourceImage.height

            console.log(`Upscaling cropped image by ${scale.toFixed(2)}x...`)
            sourceImage = await upscaleImageGPU(sourceImage, scale)

            if (sourceMask) {
                sourceMask = await upscaleMaskGPU(sourceMask, preUpscaleWidth, preUpscaleHeight, scale)
            }

            // Verify dimensions match
            const expectedMaskSize = sourceImage.width * sourceImage.height
            if (sourceMask && sourceMask.length !== expectedMaskSize) {
                console.warn(`Mask size mismatch: ${sourceMask.length} vs expected ${expectedMaskSize}, creating fallback mask`)
                sourceMask = new Float32Array(expectedMaskSize).fill(1)
            }
        }

        console.log(`Applying effects to CROPPED image: ${sourceImage.width}x${sourceImage.height} (original: ${state.imageOriginal.width}x${state.imageOriginal.height})`)
    } else {
        console.log(`Applying effects to FULL image: ${sourceImage.width}x${sourceImage.height}`)
    }

    // Update canvas size if needed
    if (state.elements.editorCanvas.width !== sourceImage.width ||
        state.elements.editorCanvas.height !== sourceImage.height) {
        state.elements.editorCanvas.width = sourceImage.width
        state.elements.editorCanvas.height = sourceImage.height
    }

    const ctx = state.elements.editorCanvas.getContext('2d')
    let workingData = sourceImage
    let workingMask = sourceMask

    // Apply enhancement BEFORE filters if enabled and set to 'before'
    if (state.enhanceSettings.enabled && state.enhanceSettings.order === 'before') {
        try {
            workingData = await applyEnhancement(workingData, workingMask, state.enhanceSettings)
            console.log('Applied enhancement (before filters)')
        } catch (e) {
            console.warn('Enhancement failed:', e)
        }
    }

    // Use GPU-accelerated filters if available
    if (useGPU) {
        try {
            workingData = await applyFiltersGPU(workingData, workingMask, state.filterSettings)
        } catch (e) {
            console.warn('GPU filter failed, falling back to CPU:', e)
            workingData = applyCPUFilters(workingData, workingMask)
        }
    } else {
        workingData = applyCPUFilters(workingData, workingMask)
    }

    // Apply enhancement AFTER filters if enabled and set to 'after'
    if (state.enhanceSettings.enabled && state.enhanceSettings.order === 'after') {
        try {
            workingData = await applyEnhancement(workingData, workingMask, state.enhanceSettings)
            console.log('Applied enhancement (after filters)')
        } catch (e) {
            console.warn('Enhancement failed:', e)
        }
    }

    state.setProcessedImageData(workingData)
    ctx.putImageData(workingData, 0, 0)

    if (state.filterSettings.blur > 0) {
        ctx.filter = `blur(${state.filterSettings.blur}px)`
        ctx.drawImage(state.elements.editorCanvas, 0, 0)
        ctx.filter = 'none'
    }
}

// CPU fallback for filters
function applyCPUFilters(sourceImage, sourceMask) {
    const workingData = new ImageData(
        new Uint8ClampedArray(sourceImage.data),
        sourceImage.width,
        sourceImage.height
    )

    // Validate mask dimensions
    const expectedMaskSize = sourceImage.width * sourceImage.height
    let validMask = sourceMask
    if (sourceMask && sourceMask.length !== expectedMaskSize) {
        console.warn(`CPU filters: Mask size mismatch (${sourceMask.length} vs ${expectedMaskSize}), using fallback`)
        validMask = null
    }

    // Apply lighting if enabled (before other filters)
    if (state.filterSettings.lightBoost > 0 && validMask) {
        applyDirectionalLighting(
            workingData.data,
            workingData.width,
            workingData.height,
            validMask,
            state.filterSettings.lightBoost
        )
    }

    // Apply filters (with mask for subject-only effects when background is being handled)
    const useMaskForFilters = state.filterSettings.backgroundDim > 0 && validMask
    applyTimmonsFilters(workingData, useMaskForFilters ? validMask : null)

    return workingData
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

    // Get the current image data
    let finalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Upscale for print quality (target 2400px for 8" at 300dpi)
    const printScale = calculateScale(finalImageData.width, finalImageData.height, 2400)
    if (printScale > 1) {
        if (processingStatus) processingStatus.textContent = 'Enhancing for print...'
        const upscaledImage = await upscaleImageGPU(finalImageData, printScale)
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

function goBack() {
    // Navigate back based on current panel
    // Flow: intro -> camera -> editor -> success
    switch (state.currentPanel) {
        case 'intro':
            // Go back to main index
            window.location.href = '/'
            break
        case 'camera':
            // Stop video stream and go back to intro
            if (state.videoStream) {
                state.videoStream.getTracks().forEach(track => track.stop())
                state.setVideoStream(null)
            }
            state.showPanel('intro')
            break
        case 'editor':
            // Go back to camera (retake)
            retakePhoto()
            break
        case 'success':
            // Start completely over
            startOver()
            break
        case 'processing':
            // Don't allow back during processing
            break
        default:
            state.showPanel('intro')
    }
}

async function cropToSubject() {
    showEditorProcessing('Framing subject...')
    await yieldToMain()
    await doCropToSubject(applyLevelSettings, updatePreview)
    hideEditorProcessing()
}

async function applyPreset(presetName) {
    showEditorProcessing('Applying preset...')
    await yieldToMain()
    await debug.applyPreset(presetName, updatePreview)
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

async function openManualCrop() {
    const overlay = document.getElementById('crop-overlay')
    if (!overlay) return

    // Reset to uncropped state first
    if (state.isCropped) {
        state.setIsCropped(false)
        state.setSubjectBounds(null)
        await updatePreview()
    }

    manualCropState.active = true
    // Initialize with 4:5 aspect ratio
    // Since container is also 4:5, normalized width = height for same aspect
    const initialSize = 0.8
    manualCropState.box = {
        x: (1 - initialSize) / 2,  // Center horizontally
        y: 0.1,
        width: initialSize,
        height: initialSize
    }
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

    // Helper to get coordinates from mouse or touch event
    const getCoords = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY }
        }
        return { x: e.clientX, y: e.clientY }
    }

    const onStart = (e) => {
        e.preventDefault()
        const handle = e.target.dataset.handle
        manualCropState.dragging = true
        manualCropState.dragType = handle || 'move'
        const coords = getCoords(e)
        manualCropState.startX = coords.x
        manualCropState.startY = coords.y
    }

    const onMove = (e) => {
        if (!manualCropState.dragging) return

        const preview = document.querySelector('.editor-preview')
        const rect = preview.getBoundingClientRect()

        const coords = getCoords(e)
        const dx = (coords.x - manualCropState.startX) / rect.width
        const dy = (coords.y - manualCropState.startY) / rect.height

        const box = manualCropState.box

        if (manualCropState.dragType === 'move') {
            box.x = Math.max(0, Math.min(1 - box.width, box.x + dx))
            box.y = Math.max(0, Math.min(1 - box.height, box.y + dy))
        } else {
            // Handle resize with aspect ratio constraint (4:5)
            // Since container is 4:5 and target is 4:5, normalized width = height

            if (manualCropState.dragType.includes('e')) {
                const newSize = Math.max(0.1, Math.min(1 - box.x, box.width + dx))
                box.width = newSize
                box.height = newSize
            }
            if (manualCropState.dragType.includes('w')) {
                const newSize = Math.max(0.1, box.width - dx)
                const newX = box.x + (box.width - newSize)
                if (newX >= 0) {
                    box.x = newX
                    box.width = newSize
                    box.height = newSize
                }
            }
            if (manualCropState.dragType.includes('s')) {
                const newSize = Math.max(0.1, Math.min(1 - box.y, box.height + dy))
                box.height = newSize
                box.width = newSize
            }
            if (manualCropState.dragType.includes('n')) {
                const newSize = Math.max(0.1, box.height - dy)
                const newY = box.y + (box.height - newSize)
                if (newY >= 0) {
                    box.y = newY
                    box.height = newSize
                    box.width = newSize
                }
            }

            // Clamp to bounds while maintaining aspect ratio
            if (box.x + box.width > 1) {
                box.width = 1 - box.x
                box.height = box.width
            }
            if (box.y + box.height > 1) {
                box.height = 1 - box.y
                box.width = box.height
            }
            // Make sure x doesn't go negative after width adjustment
            if (box.x < 0) {
                box.x = 0
            }
        }

        manualCropState.startX = coords.x
        manualCropState.startY = coords.y
        updateCropOverlay()
    }

    const onEnd = () => {
        manualCropState.dragging = false
    }

    // Mouse events
    cropBox.addEventListener('mousedown', onStart)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)

    // Touch events
    cropBox.addEventListener('touchstart', onStart, { passive: false })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)

    // Store cleanup function
    overlay._cleanup = () => {
        cropBox.removeEventListener('mousedown', onStart)
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onEnd)
        cropBox.removeEventListener('touchstart', onStart)
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('touchend', onEnd)
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
    await updatePreview()
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
window.goBack = goBack
window.applyPreset = applyPreset
window.enableDebugMode = enableDebugMode
window.cropToSubject = cropToSubject
window.openManualCrop = openManualCrop
window.applyCrop = applyCrop
window.cancelCrop = cancelCrop
window.toggleDebugPanel = () => {
    debug.setUpdatePreviewCallback(updatePreview)  // Enable live updates
    debug.toggleDebugPanel()
}
window.selectDebugPreset = debug.selectDebugPreset
window.updateDebugValue = debug.updateDebugValue
window.applyDebugSettings = () => debug.applyDebugSettings(updatePreview)
window.saveDebugPreset = () => debug.saveDebugPreset(applyPreset, updatePreview)
window.exportPresets = debug.exportPresets
window.resetToDefault = debug.resetToDefault
window.setToNeutral = debug.setToNeutral

// Enhancement controls
async function setEnhanceEnabled(enabled) {
    state.enhanceSettings.enabled = enabled
    // Update button states
    document.getElementById('enhance-off-btn')?.classList.toggle('active', !enabled)
    document.getElementById('enhance-on-btn')?.classList.toggle('active', enabled)
    await updatePreview()
}

async function setEnhanceOrder(order) {
    state.enhanceSettings.order = order
    // Update button states
    document.getElementById('enhance-before-btn')?.classList.toggle('active', order === 'before')
    document.getElementById('enhance-after-btn')?.classList.toggle('active', order === 'after')
    if (state.enhanceSettings.enabled) {
        await updatePreview()
    }
}

async function updateEnhanceValue(field) {
    const slider = document.getElementById(`debug-${field}`)
    const valueDisplay = document.getElementById(`debug-val-${field}`)
    if (slider && valueDisplay) {
        const value = parseFloat(slider.value)
        valueDisplay.textContent = value
        state.enhanceSettings[field] = value
        if (state.enhanceSettings.enabled) {
            await updatePreview()
        }
    }
}

window.setEnhanceEnabled = setEnhanceEnabled
window.setEnhanceOrder = setEnhanceOrder
window.updateEnhanceValue = updateEnhanceValue

// Technique info modal
const techniqueInfo = {
    isolate: {
        title: 'Isolate Subject',
        text: 'In the 1930s, portrait photographers like Timmons hung heavy black velvet curtains behind their subjects. The velvet\'s deep pile absorbed nearly all light, creating a perfectly dark background that made the subject seem to float in space. This technique drew all attention to the face and eliminated distracting backgrounds.'
    },
    lighting: {
        title: 'Portrait Lighting',
        text: 'Timmons used a single powerful tungsten lamp, positioned high and to one side of the subject—a technique called "Rembrandt lighting" after the Dutch master painter. A white reflector on the opposite side would gently fill the shadows. This created dramatic dimension and sculpted the face with light and shadow.'
    },
    contrast: {
        title: 'High Contrast',
        text: 'In the darkroom, photographers controlled contrast by choosing different paper "grades." Higher grades produced more dramatic separation between light and dark. Timmons was known for his striking tonal range, using techniques like "dodging" (blocking light to brighten areas) and "burning" (adding light to darken areas) during printing.'
    },
    blacks: {
        title: 'Crushed Blacks',
        text: 'By slightly underexposing the negative in-camera and then printing on "hard" paper, photographers could push shadow details into pure black. This created the bold silhouette effect Timmons was famous for—faces emerging dramatically from darkness, with shadow areas becoming inky black rather than gray.'
    },
    grain: {
        title: 'Film Grain',
        text: 'The "grain" you see in vintage photos comes from clumps of silver halide crystals in the film emulsion. 1930s photographers used large 4×5 inch sheet film, which had finer grain than smaller formats. The subtle texture adds authenticity and a handmade quality that digital images lack.'
    },
    vignette: {
        title: 'Vignette',
        text: 'Large-format portrait lenses naturally produced darker corners because light had to travel farther to reach the edges of the film. Photographers often enhanced this effect in the darkroom by shading the print\'s edges during exposure. The darkened corners draw the viewer\'s eye toward the center and the subject\'s face.'
    },
    tone: {
        title: 'Warm Tone',
        text: 'After developing and fixing a print, photographers would bathe it in selenium or gold toner solutions. These chemical baths shifted the image color from cool neutral gray toward warm brown tones, while also making the print more archival and resistant to fading. The warm tone gives portraits a timeless, elegant quality.'
    },
    softfocus: {
        title: 'Soft Focus',
        text: 'Early portrait lenses were "uncoated," meaning light scattered slightly as it passed through the glass elements. Some photographers deliberately used older brass lenses or even smeared petroleum jelly on lens edges to create a dreamy glow around highlights. This "Pictorialist" style was considered artistic and flattering for portraits.'
    }
}

window.showTechniqueInfo = function(technique) {
    const info = techniqueInfo[technique]
    if (!info) return

    document.getElementById('technique-modal-title').textContent = info.title
    document.getElementById('technique-modal-text').textContent = info.text
    document.getElementById('technique-modal').classList.remove('hidden')
}

window.closeTechniqueInfo = function() {
    document.getElementById('technique-modal').classList.add('hidden')
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('technique-modal')
    if (e.target === modal) {
        modal.classList.add('hidden')
    }
})
