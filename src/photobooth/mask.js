/**
 * Mask Processing
 * Morphological operations and mask utilities
 */

/**
 * Create a soft mask with feathered edges from binary segmentation data
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

