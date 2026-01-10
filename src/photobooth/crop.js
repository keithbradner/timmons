/**
 * Crop to Subject Module
 * Automatically crops image to focus on the detected subject
 */

import * as state from './state.js'

/**
 * Toggle crop to subject on/off
 */
export async function cropToSubject(applySettingsCallback, updatePreviewCallback) {
    if (!state.segmentationMask || !state.imageWithoutBackground) {
        console.warn('No segmentation data available for cropping')
        return
    }

    const btn = document.querySelector('.crop-btn')

    if (state.isCropped) {
        // Toggle off - restore full image
        state.setIsCropped(false)
        if (btn) btn.classList.remove('cropped')
        applySettingsCallback()
        await updatePreviewCallback()
        return
    }

    // Calculate subject bounding box from segmentation mask
    const width = state.imageWithoutBackground.width
    const height = state.imageWithoutBackground.height

    let minX = width, maxX = 0, minY = height, maxY = 0
    let hasSubject = false

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x
            if (state.segmentationMask[i] > 0.5) {
                hasSubject = true
                minX = Math.min(minX, x)
                maxX = Math.max(maxX, x)
                minY = Math.min(minY, y)
                maxY = Math.max(maxY, y)
            }
        }
    }

    if (!hasSubject) {
        console.warn('No subject detected in image')
        return
    }

    // Add padding around the subject (15% of subject size)
    const subjectWidth = maxX - minX
    const subjectHeight = maxY - minY
    const paddingX = Math.round(subjectWidth * 0.15)
    const paddingY = Math.round(subjectHeight * 0.15)

    minX = Math.max(0, minX - paddingX)
    maxX = Math.min(width - 1, maxX + paddingX)
    minY = Math.max(0, minY - paddingY)
    maxY = Math.min(height - 1, maxY + paddingY)

    // Calculate crop dimensions maintaining 4:5 aspect ratio
    let cropWidth = maxX - minX
    let cropHeight = maxY - minY
    const targetRatio = 4 / 5

    const currentRatio = cropWidth / cropHeight

    if (currentRatio > targetRatio) {
        const newHeight = cropWidth / targetRatio
        const extraHeight = newHeight - cropHeight
        minY = Math.max(0, minY - extraHeight / 2)
        maxY = Math.min(height - 1, maxY + extraHeight / 2)
        cropHeight = maxY - minY
        if (cropHeight < newHeight) {
            cropWidth = cropHeight * targetRatio
            const extraWidth = (maxX - minX) - cropWidth
            minX += extraWidth / 2
        }
    } else {
        const newWidth = cropHeight * targetRatio
        const extraWidth = newWidth - cropWidth
        minX = Math.max(0, minX - extraWidth / 2)
        maxX = Math.min(width - 1, maxX + extraWidth / 2)
        cropWidth = maxX - minX
        if (cropWidth < newWidth) {
            cropHeight = cropWidth / targetRatio
            const extraHeight = (maxY - minY) - cropHeight
            minY += extraHeight / 2
        }
    }

    state.setSubjectBounds({
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(maxX - minX),
        height: Math.round(maxY - minY)
    })

    state.setIsCropped(true)
    if (btn) btn.classList.add('cropped')

    applySettingsCallback()
    await updatePreviewCallback()
}

/**
 * Crop an ImageData object to specified bounds
 */
export function cropImageData(sourceImage, bounds) {
    const canvas = document.createElement('canvas')
    canvas.width = bounds.width
    canvas.height = bounds.height
    const ctx = canvas.getContext('2d')

    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = sourceImage.width
    srcCanvas.height = sourceImage.height
    const srcCtx = srcCanvas.getContext('2d')
    srcCtx.putImageData(sourceImage, 0, 0)

    ctx.drawImage(
        srcCanvas,
        bounds.x, bounds.y, bounds.width, bounds.height,
        0, 0, bounds.width, bounds.height
    )

    return ctx.getImageData(0, 0, bounds.width, bounds.height)
}
