/**
 * Crop to Subject Module
 * Automatically crops image to focus on the detected subject
 * Uses rule of thirds for better portrait composition
 */

import * as state from './state.js'

/**
 * Toggle crop to subject on/off
 * Uses rule of thirds to position subject's head at upper third line
 */
export async function cropToSubject(applySettingsCallback, updatePreviewCallback) {
    if (!state.segmentationMask || !state.imageOriginal) {
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
    const width = state.imageOriginal.width
    const height = state.imageOriginal.height

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

    // Subject dimensions
    const subjectWidth = maxX - minX
    const subjectHeight = maxY - minY
    const subjectCenterX = minX + subjectWidth / 2

    // Estimate head position (top 25% of subject is typically the head/face)
    const headY = minY + subjectHeight * 0.15  // Slightly below top of head (eye level)

    // Target aspect ratio 4:5 (portrait)
    const targetRatio = 4 / 5

    // Calculate crop size to fit subject with padding
    // Add generous padding (20% on sides, 10% on top, 25% on bottom for headroom)
    const paddedWidth = subjectWidth * 1.4
    const paddedHeight = subjectHeight * 1.35

    // Determine final crop dimensions maintaining aspect ratio
    let cropWidth, cropHeight

    if (paddedWidth / paddedHeight > targetRatio) {
        // Subject is wider than target ratio - fit to width
        cropWidth = paddedWidth
        cropHeight = cropWidth / targetRatio
    } else {
        // Subject is taller than target ratio - fit to height
        cropHeight = paddedHeight
        cropWidth = cropHeight * targetRatio
    }

    // Rule of thirds: position the head at the upper third line
    // Upper third line is at 1/3 from top, so head should be at cropHeight * (1/3)
    const upperThirdY = cropHeight / 3

    // Calculate crop origin to place head at upper third
    // headY (in original image) should map to upperThirdY (in crop)
    let cropY = headY - upperThirdY

    // Center horizontally on subject
    let cropX = subjectCenterX - cropWidth / 2

    // Clamp to image bounds and adjust if needed
    if (cropX < 0) {
        cropX = 0
    }
    if (cropX + cropWidth > width) {
        cropX = width - cropWidth
        if (cropX < 0) {
            cropX = 0
            cropWidth = width
            cropHeight = cropWidth / targetRatio
        }
    }

    if (cropY < 0) {
        cropY = 0
    }
    if (cropY + cropHeight > height) {
        cropY = height - cropHeight
        if (cropY < 0) {
            cropY = 0
            cropHeight = height
            cropWidth = cropHeight * targetRatio
            // Re-center horizontally
            cropX = subjectCenterX - cropWidth / 2
            if (cropX < 0) cropX = 0
            if (cropX + cropWidth > width) cropX = width - cropWidth
        }
    }

    // Ensure we don't cut off the subject
    const finalMinX = Math.max(0, minX - subjectWidth * 0.1)
    const finalMaxX = Math.min(width, maxX + subjectWidth * 0.1)
    const finalMinY = Math.max(0, minY - subjectHeight * 0.05)
    const finalMaxY = Math.min(height, maxY + subjectHeight * 0.15)

    // Adjust crop if it would cut off the subject
    if (cropX > finalMinX) {
        const shift = cropX - finalMinX + 10
        cropX = Math.max(0, cropX - shift)
    }
    if (cropX + cropWidth < finalMaxX) {
        const shift = finalMaxX - (cropX + cropWidth) + 10
        cropX = Math.min(width - cropWidth, cropX + shift)
    }
    if (cropY > finalMinY) {
        cropY = Math.max(0, finalMinY - 10)
    }
    if (cropY + cropHeight < finalMaxY) {
        // Need to include more at bottom - shift crop down or expand
        const needed = finalMaxY - (cropY + cropHeight) + 10
        if (cropY + cropHeight + needed <= height) {
            // Can shift down
            cropY = Math.min(height - cropHeight, cropY + needed)
        }
    }

    state.setSubjectBounds({
        x: Math.round(Math.max(0, cropX)),
        y: Math.round(Math.max(0, cropY)),
        width: Math.round(Math.min(cropWidth, width - cropX)),
        height: Math.round(Math.min(cropHeight, height - cropY))
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
