/**
 * AI Upscaling Module
 * Uses ESRGAN for high-quality image upscaling
 */

import Upscaler from 'upscaler'
import x2 from '@upscalerjs/esrgan-medium/2x'

let upscalerInstance = null

/**
 * Initialize the upscaler model
 */
export async function initUpscaler() {
    if (upscalerInstance) return upscalerInstance

    try {
        console.log('Initializing AI upscaler...')
        upscalerInstance = new Upscaler({
            model: x2
        })

        // Warm up the model
        const warmupCanvas = document.createElement('canvas')
        warmupCanvas.width = 16
        warmupCanvas.height = 16
        await upscalerInstance.upscale(warmupCanvas)

        console.log('AI upscaler ready')
        return upscalerInstance
    } catch (error) {
        console.error('Failed to initialize upscaler:', error)
        return null
    }
}

/**
 * Upscale a single ImageData object
 * @param {ImageData} imageData - The image to upscale
 * @param {Function} progressCallback - Optional progress callback (0-1)
 * @returns {Promise<ImageData|null>} - Upscaled image or null if failed
 */
export async function upscaleImage(imageData, progressCallback) {
    const upscaler = await initUpscaler()

    if (!upscaler) {
        console.warn('Upscaler not available, skipping')
        return null
    }

    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')
    ctx.putImageData(imageData, 0, 0)

    try {
        const upscaledSrc = await upscaler.upscale(canvas, {
            output: 'base64',
            patchSize: 64,
            padding: 4,
            progress: progressCallback
        })

        const img = new Image()
        await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
            img.src = upscaledSrc
        })

        const outputCanvas = document.createElement('canvas')
        outputCanvas.width = img.width
        outputCanvas.height = img.height
        const outputCtx = outputCanvas.getContext('2d')
        outputCtx.drawImage(img, 0, 0)

        console.log(`Upscaled: ${imageData.width}x${imageData.height} -> ${img.width}x${img.height}`)
        return outputCtx.getImageData(0, 0, img.width, img.height)
    } catch (error) {
        console.error('Upscale failed:', error)
        return null
    }
}
