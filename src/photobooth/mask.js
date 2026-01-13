/**
 * Mask Processing
 * Morphological operations and mask utilities
 */

/**
 * Create a soft mask with feathered edges from binary segmentation data
 * (Legacy function for BodyPix)
 */
export function createSoftMask(segmentationData, width, height) {
    // Convert binary mask to float mask
    const mask = new Float32Array(segmentationData.length)
    for (let i = 0; i < segmentationData.length; i++) {
        mask[i] = segmentationData[i]
    }

    // Apply morphological operations to clean up the mask
    const eroded = erodeMask(mask, width, height, 1)
    const dilated = dilateMask(eroded, width, height, 2)
    const blurred = gaussianBlurMask(dilated, width, height, 8)

    return blurred
}

/**
 * Create a soft mask from MediaPipe/RMBG confidence values
 * Processes the mask to have smooth, natural-looking edges
 */
export function createSoftMaskFromConfidence(confidenceData, width, height) {
    // Copy to a new array since the original may be freed
    const mask = new Float32Array(confidenceData.length)
    for (let i = 0; i < confidenceData.length; i++) {
        mask[i] = confidenceData[i]
    }

    // Count soft pixels (gradient values at edges)
    let softCount = 0
    for (let i = 0; i < mask.length; i++) {
        if (mask[i] > 0.05 && mask[i] < 0.95) softCount++
    }
    const softPercent = (softCount / mask.length) * 100

    // If model provides edge gradients (even small %), preserve them with light processing
    // Typical segmentation models have 0.5-2% soft pixels at edges
    if (softPercent > 0.1) {
        console.log(`Mask has ${softPercent.toFixed(1)}% soft edge pixels - preserving gradients`)
        // Light blur to smooth edges without destroying gradients
        return gaussianBlurMask(mask, width, height, 2)
    } else {
        // Truly binary mask - need to create soft edges
        console.log('Mask is fully binary - creating soft edges')
        const dilated = dilateMask(mask, width, height, 2)
        return gaussianBlurMask(dilated, width, height, 6)
    }
}

/**
 * Apply contrast curve to mask for sharper foreground/background separation
 * strength > 1 makes edges more decisive, < 1 makes them softer
 */
export function contrastMask(mask, strength) {
    const result = new Float32Array(mask.length)
    for (let i = 0; i < mask.length; i++) {
        // S-curve contrast: pushes values toward 0 or 1
        const v = mask[i]
        const curved = 0.5 + (v - 0.5) * strength
        result[i] = Math.max(0, Math.min(1, curved))
    }
    return result
}

/**
 * Erode mask - shrink foreground regions
 */
export function erodeMask(mask, width, height, radius) {
    const result = new Float32Array(mask.length)

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x
            let minVal = mask[i]

            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const ny = y + dy
                    const nx = x + dx
                    if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                        const ni = ny * width + nx
                        minVal = Math.min(minVal, mask[ni])
                    }
                }
            }
            result[i] = minVal
        }
    }
    return result
}

/**
 * Dilate mask - expand foreground regions
 */
export function dilateMask(mask, width, height, radius) {
    const result = new Float32Array(mask.length)

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x
            let maxVal = mask[i]

            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const ny = y + dy
                    const nx = x + dx
                    if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                        const ni = ny * width + nx
                        maxVal = Math.max(maxVal, mask[ni])
                    }
                }
            }
            result[i] = maxVal
        }
    }
    return result
}

/**
 * Apply Gaussian blur to a mask
 */
export function gaussianBlurMask(mask, width, height, radius) {
    // Create Gaussian kernel
    const kernelSize = radius * 2 + 1
    const kernel = new Float32Array(kernelSize)
    const sigma = radius / 3
    let kernelSum = 0

    for (let i = 0; i < kernelSize; i++) {
        const x = i - radius
        kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma))
        kernelSum += kernel[i]
    }

    // Normalize kernel
    for (let i = 0; i < kernelSize; i++) {
        kernel[i] /= kernelSum
    }

    // Horizontal pass
    const temp = new Float32Array(mask.length)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0
            for (let k = -radius; k <= radius; k++) {
                const nx = Math.min(Math.max(x + k, 0), width - 1)
                sum += mask[y * width + nx] * kernel[k + radius]
            }
            temp[y * width + x] = sum
        }
    }

    // Vertical pass
    const result = new Float32Array(mask.length)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0
            for (let k = -radius; k <= radius; k++) {
                const ny = Math.min(Math.max(y + k, 0), height - 1)
                sum += temp[ny * width + x] * kernel[k + radius]
            }
            result[y * width + x] = sum
        }
    }

    return result
}

