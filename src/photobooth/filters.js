/**
 * Image Filters and Processing
 * Timmons-style vintage photo filters
 */

import { filterSettings } from './state.js'

/**
 * Apply the full Timmons filter pipeline to image data
 * @param {ImageData} imageData - The image to process
 * @param {Float32Array|null} mask - Optional mask for subject-only effects (0-1 values)
 */
export function applyTimmonsFilters(imageData, mask = null) {
    const pixels = imageData.data
    const width = imageData.width
    const height = imageData.height

    // Pre-calculate vignette map
    const vignetteMap = createVignetteMap(width, height, filterSettings.vignette)

    for (let i = 0; i < pixels.length; i += 4) {
        const pixelIndex = i / 4
        const x = pixelIndex % width
        const y = Math.floor(pixelIndex / width)

        // Get mask value for this pixel (1 = subject, 0 = background, smooth values in between)
        const maskValue = mask ? mask[pixelIndex] : 1

        let r = pixels[i]
        let g = pixels[i + 1]
        let b = pixels[i + 2]

        // Handle background dimming with smooth blending
        if (mask && filterSettings.backgroundDim > 0) {
            // Non-linear dimming: push background to black more aggressively
            // At dim=1.0, background goes to pure black
            // Use power curve for more natural falloff
            const dimPower = 1 + filterSettings.backgroundDim * 2 // 1-3 range
            const dimmedR = r * Math.pow(1 - filterSettings.backgroundDim, dimPower)
            const dimmedG = g * Math.pow(1 - filterSettings.backgroundDim, dimPower)
            const dimmedB = b * Math.pow(1 - filterSettings.backgroundDim, dimPower)
            // Smooth blend using mask: 0 = full dim (background), 1 = no dim (subject)
            // Apply slight S-curve to mask for crisper edges
            const edgeMask = smoothstep(0.2, 0.8, maskValue)
            r = lerp(dimmedR, r, edgeMask)
            g = lerp(dimmedG, g, edgeMask)
            b = lerp(dimmedB, b, edgeMask)
        }

        // 1. Convert to grayscale using luminance formula
        let gray = 0.299 * r + 0.587 * g + 0.114 * b

        // 2-5. Apply all tonal effects uniformly (only dimming is mask-dependent)
        gray = gray * filterSettings.brightness
        gray = applyContrast(gray, filterSettings.contrast)
        gray = crushShadows(gray, filterSettings.shadows)
        gray = liftHighlights(gray, filterSettings.highlights)

        // 6. Apply vignette (always applies to full image for period-authentic look)
        const vignetteValue = vignetteMap[y * width + x]
        gray = gray * vignetteValue

        // 7. Apply sepia toning (subtle warm tone)
        let finalR = gray
        let finalG = gray
        let finalB = gray

        if (filterSettings.sepia > 0) {
            const sepiaAmount = filterSettings.sepia / 100
            finalR = gray + (gray * 0.25 * sepiaAmount)
            finalG = gray + (gray * 0.08 * sepiaAmount)
            finalB = gray - (gray * 0.18 * sepiaAmount)
        }

        // 8. Add film grain uniformly
        if (filterSettings.grain > 0) {
            const grainAmount = (Math.random() - 0.5) * filterSettings.grain
            finalR += grainAmount
            finalG += grainAmount
            finalB += grainAmount
        }

        // Clamp values
        pixels[i] = clamp(finalR, 0, 255)
        pixels[i + 1] = clamp(finalG, 0, 255)
        pixels[i + 2] = clamp(finalB, 0, 255)
    }
}

// Linear interpolation helper
function lerp(a, b, t) {
    return a + (b - a) * t
}

// Smoothstep for natural edge transitions
function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
}

function applyContrast(value, contrast) {
    // Simple contrast adjustment around midpoint (128)
    // contrast: 1.0 = no change, >1.0 = more contrast, <1.0 = less contrast
    return clamp(128 + (value - 128) * contrast, 0, 255)
}

function crushShadows(value, amount) {
    const threshold = 128
    if (value < threshold) {
        const crushFactor = 1 - (amount / 100)
        return value * crushFactor
    }
    return value
}

function liftHighlights(value, amount) {
    const threshold = 180
    if (value > threshold) {
        const liftAmount = (amount / 100) * (255 - value) * 0.5
        return value + liftAmount
    }
    return value
}

function createVignetteMap(width, height, intensity) {
    const map = new Float32Array(width * height)
    const centerX = width / 2
    const centerY = height / 2
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY)

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = x - centerX
            const dy = y - centerY
            const distance = Math.sqrt(dx * dx + dy * dy)
            const normalizedDistance = distance / maxDistance

            const vignette = 1 - (Math.pow(normalizedDistance, 2) * (intensity / 100))
            map[y * width + x] = Math.max(0.3, vignette)
        }
    }

    return map
}

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
}
