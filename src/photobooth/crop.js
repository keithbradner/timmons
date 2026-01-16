/**
 * Crop to Subject Module
 * Simple portrait auto-framing: zoom in on head/shoulders
 */

import * as state from './state.js'

/**
 * Toggle crop to subject on/off
 * Creates a tight portrait crop focused on head and shoulders
 */
export async function cropToSubject(applySettingsCallback, updatePreviewCallback) {
    console.log('cropToSubject called:', {
        hasMask: !!state.segmentationMask,
        hasImage: !!state.imageOriginal,
        maskLength: state.segmentationMask?.length,
        imageSize: state.imageOriginal ? `${state.imageOriginal.width}x${state.imageOriginal.height}` : null
    })

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

    const width = state.imageOriginal.width
    const height = state.imageOriginal.height
    const mask = state.segmentationMask

    // Find bounding box of person
    let minX = width, maxX = 0, minY = height, maxY = 0

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (mask[y * width + x] > 0.5) {
                minX = Math.min(minX, x)
                maxX = Math.max(maxX, x)
                minY = Math.min(minY, y)
                maxY = Math.max(maxY, y)
            }
        }
    }

    if (minX >= maxX) {
        console.warn('No subject detected in mask - bounds:', { minX, maxX, minY, maxY })
        return
    }

    console.log('Subject detected:', { minX, maxX, minY, maxY, subjectWidth: maxX - minX, subjectHeight: maxY - minY })

    const subjectWidth = maxX - minX
    const subjectHeight = maxY - minY
    const subjectCenterX = minX + subjectWidth / 2

    // For portrait: crop should show head + shoulders
    // Head is at the TOP of the bounding box
    // We want to include from slightly above head to mid-chest area

    // Portrait height: from top of head down about 50-60% of subject height
    // This gives us head + shoulders, not full body
    const portraitTop = minY
    const portraitBottom = minY + subjectHeight * 0.55
    const portraitHeight = portraitBottom - portraitTop

    // Add some headroom (10% above head)
    const headroom = portraitHeight * 0.12

    // Final crop dimensions (4:5 aspect ratio)
    const targetRatio = 4 / 5
    let cropHeight = portraitHeight + headroom
    let cropWidth = cropHeight * targetRatio

    // If subject is wider than our crop, expand to fit
    const neededWidth = subjectWidth * 1.15  // 15% padding on sides
    if (cropWidth < neededWidth) {
        cropWidth = neededWidth
        cropHeight = cropWidth / targetRatio
    }

    // Position crop
    let cropX = subjectCenterX - cropWidth / 2
    let cropY = minY - headroom

    // Clamp to image bounds
    if (cropX < 0) cropX = 0
    if (cropX + cropWidth > width) cropX = width - cropWidth
    if (cropY < 0) cropY = 0
    if (cropY + cropHeight > height) cropY = height - cropHeight

    // If crop is larger than image, scale down
    if (cropWidth > width) {
        cropWidth = width
        cropHeight = cropWidth / targetRatio
        cropX = 0
    }
    if (cropHeight > height) {
        cropHeight = height
        cropWidth = cropHeight * targetRatio
        cropX = Math.max(0, subjectCenterX - cropWidth / 2)
        if (cropX + cropWidth > width) cropX = width - cropWidth
        cropY = 0
    }

    console.log('Auto-frame:', {
        subject: { minX, maxX, minY, maxY, width: subjectWidth, height: subjectHeight },
        crop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
    })

    state.setSubjectBounds({
        x: Math.round(Math.max(0, cropX)),
        y: Math.round(Math.max(0, cropY)),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight)
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
