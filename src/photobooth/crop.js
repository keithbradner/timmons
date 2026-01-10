/**
 * Crop to Subject Module
 * Smart auto-framing for portrait photography
 * Features:
 * - Head detection via mask shape analysis
 * - Center of mass for accurate subject positioning
 * - Adaptive framing based on subject coverage
 * - Rule of thirds composition
 */

import * as state from './state.js'

/**
 * Analyze the segmentation mask to extract subject information
 */
function analyzeSubject(mask, width, height) {
    let minX = width, maxX = 0, minY = height, maxY = 0
    let totalMass = 0
    let centerOfMassX = 0
    let centerOfMassY = 0

    // First pass: bounding box and center of mass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x
            const val = mask[i]
            if (val > 0.5) {
                minX = Math.min(minX, x)
                maxX = Math.max(maxX, x)
                minY = Math.min(minY, y)
                maxY = Math.max(maxY, y)
                totalMass += val
                centerOfMassX += x * val
                centerOfMassY += y * val
            }
        }
    }

    if (totalMass === 0) return null

    centerOfMassX /= totalMass
    centerOfMassY /= totalMass

    const subjectWidth = maxX - minX
    const subjectHeight = maxY - minY

    // Analyze upper portion to find head region
    const headRegion = findHeadRegion(mask, width, height, minX, maxX, minY, subjectHeight)

    // Calculate subject coverage (how much of frame the subject fills)
    const coverage = (subjectWidth * subjectHeight) / (width * height)

    // Detect if this is likely a headshot, bust, or full body
    const aspectRatio = subjectHeight / subjectWidth
    let frameType = 'bust' // default
    if (aspectRatio > 2.5) {
        frameType = 'full'  // tall and thin = full body
    } else if (aspectRatio < 1.5 && coverage > 0.15) {
        frameType = 'headshot'  // wide and takes up space = close headshot
    }

    return {
        bounds: { minX, maxX, minY, maxY },
        width: subjectWidth,
        height: subjectHeight,
        centerOfMass: { x: centerOfMassX, y: centerOfMassY },
        head: headRegion,
        coverage,
        frameType
    }
}

/**
 * Find the head region by analyzing the upper portion of the mask
 * Looks for the widest horizontal extent in the top portion (head is usually widest near eyes)
 */
function findHeadRegion(mask, width, height, minX, maxX, minY, subjectHeight) {
    const headSearchHeight = Math.min(subjectHeight * 0.4, 200) // Search top 40% or 200px
    const searchEndY = minY + headSearchHeight

    let bestY = minY
    let bestWidth = 0
    let headCenterX = (minX + maxX) / 2

    // Scan horizontal slices to find the widest part (likely eye level)
    for (let y = minY; y < searchEndY; y++) {
        let sliceMinX = width, sliceMaxX = 0
        let sliceMass = 0
        let sliceCenterX = 0

        for (let x = minX; x <= maxX; x++) {
            const i = y * width + x
            if (mask[i] > 0.5) {
                sliceMinX = Math.min(sliceMinX, x)
                sliceMaxX = Math.max(sliceMaxX, x)
                sliceMass += mask[i]
                sliceCenterX += x * mask[i]
            }
        }

        const sliceWidth = sliceMaxX - sliceMinX

        // Look for widest slice in middle portion of head search area
        // (not at very top which is top of head, not at bottom which might be shoulders)
        const relativeY = (y - minY) / headSearchHeight
        if (relativeY > 0.15 && relativeY < 0.7 && sliceWidth > bestWidth) {
            bestWidth = sliceWidth
            bestY = y
            if (sliceMass > 0) {
                headCenterX = sliceCenterX / sliceMass
            }
        }
    }

    // Estimate eye level slightly below the widest point
    const eyeY = bestY + bestWidth * 0.1

    // Find the top of the head more precisely
    let headTop = minY
    for (let y = minY; y < bestY; y++) {
        let hasPixel = false
        for (let x = headCenterX - bestWidth/2; x < headCenterX + bestWidth/2; x++) {
            const i = y * width + Math.round(x)
            if (i >= 0 && i < mask.length && mask[i] > 0.5) {
                hasPixel = true
                break
            }
        }
        if (hasPixel) {
            headTop = y
            break
        }
    }

    return {
        eyeY,
        headTop,
        centerX: headCenterX,
        width: bestWidth
    }
}

/**
 * Toggle crop to subject on/off
 * Uses smart analysis for optimal portrait framing
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

    const width = state.imageOriginal.width
    const height = state.imageOriginal.height

    // Analyze the subject
    const subject = analyzeSubject(state.segmentationMask, width, height)

    if (!subject) {
        console.warn('No subject detected in image')
        return
    }

    console.log('Subject analysis:', {
        frameType: subject.frameType,
        coverage: (subject.coverage * 100).toFixed(1) + '%',
        headWidth: subject.head.width,
        eyeY: subject.head.eyeY,
        headCenterX: subject.head.centerX
    })

    // Target aspect ratio 4:5 (portrait)
    const targetRatio = 4 / 5

    // BASE THE CROP ON HEAD SIZE, not full body
    // A good portrait crop is about 3-4x the head width
    const headWidth = subject.head.width
    const portraitWidth = headWidth * 3.2

    // Calculate crop dimensions from head-based width
    let cropWidth = portraitWidth
    let cropHeight = cropWidth / targetRatio

    // Ensure we don't crop larger than the image
    if (cropWidth > width) {
        cropWidth = width
        cropHeight = cropWidth / targetRatio
    }
    if (cropHeight > height) {
        cropHeight = height
        cropWidth = cropHeight * targetRatio
    }

    // Position: eyes at upper third, centered on head
    const targetEyePosition = cropHeight * 0.35  // Eyes slightly above 1/3 mark

    let cropY = subject.head.eyeY - targetEyePosition
    let cropX = subject.head.centerX - cropWidth / 2

    // Clamp to image bounds
    cropX = Math.max(0, Math.min(width - cropWidth, cropX))
    cropY = Math.max(0, Math.min(height - cropHeight, cropY))

    // Handle case where crop is larger than image
    if (cropWidth > width) {
        cropWidth = width
        cropHeight = cropWidth / targetRatio
        cropX = 0
    }
    if (cropHeight > height) {
        cropHeight = height
        cropWidth = cropHeight * targetRatio
        cropX = (width - cropWidth) / 2
        cropY = 0
    }

    // Final safety check: ensure subject is not cut off
    const margin = 10
    const safeMinX = Math.max(0, subject.bounds.minX - margin)
    const safeMaxX = Math.min(width, subject.bounds.maxX + margin)
    const safeMinY = Math.max(0, subject.head.headTop - margin)
    const safeMaxY = Math.min(height, subject.bounds.maxY + margin)

    // Adjust if we're cutting off the subject
    if (cropX > safeMinX) {
        cropX = Math.max(0, safeMinX)
    }
    if (cropX + cropWidth < safeMaxX) {
        cropX = Math.min(width - cropWidth, safeMaxX - cropWidth)
    }
    if (cropY > safeMinY) {
        cropY = Math.max(0, safeMinY)
    }
    if (cropY + cropHeight < safeMaxY && cropY + cropHeight < height) {
        // Try to include more at bottom without going past image bounds
        const needed = safeMaxY - (cropY + cropHeight)
        cropY = Math.min(height - cropHeight, cropY + needed)
    }

    state.setSubjectBounds({
        x: Math.round(Math.max(0, cropX)),
        y: Math.round(Math.max(0, cropY)),
        width: Math.round(Math.min(cropWidth, width - Math.max(0, cropX))),
        height: Math.round(Math.min(cropHeight, height - Math.max(0, cropY)))
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
