/**
 * Directional Lighting Simulation
 * Simulates studio portrait lighting in the style of Timmons' dramatic portraits
 * Key light from upper-right creates the classic Rembrandt lighting pattern
 */

import { clamp } from './filters.js'


/**
 * Apply dramatic Rembrandt-style portrait lighting
 * @param {Uint8ClampedArray} pixels - Pixel data to modify
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Float32Array} mask - Segmentation mask
 * @param {number} intensity - Lighting intensity (0-1.2)
 */
export function applyDirectionalLighting(pixels, width, height, mask, intensity = 0.6) {
    if (intensity <= 0) return

    // Key light position: upper-right, classic portrait position
    const keyLightX = 0.85
    const keyLightY = 0.1

    // Fill light position: left side, lower
    const fillLightX = 0.15
    const fillLightY = 0.4

    // Apply lighting to each pixel
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x
            const pixelIndex = i * 4
            const maskVal = mask[i]

            if (maskVal < 0.05) continue

            const normX = x / width
            const normY = y / height

            // Distance from key light (creates falloff)
            const toKeyX = keyLightX - normX
            const toKeyY = keyLightY - normY
            const keyDist = Math.sqrt(toKeyX * toKeyX + toKeyY * toKeyY)

            // Key light intensity - stronger falloff for more drama
            const keyIntensity = 1.0 / (1.0 + keyDist * 2.5)

            // Directional component - face the light to be brighter
            const keyDirection = Math.max(0, toKeyX * 0.7 + toKeyY * 0.3)

            // Combined key light contribution
            const keyLight = (keyIntensity * 0.6 + keyDirection * 0.4)

            // Fill light - softer, from opposite side
            const toFillX = fillLightX - normX
            const toFillY = fillLightY - normY
            const fillDist = Math.sqrt(toFillX * toFillX + toFillY * toFillY)
            const fillLight = 0.3 / (1.0 + fillDist * 2.0)

            // Rim/edge lighting - brightens edges of subject for separation
            const edgeFactor = maskVal * (1.0 - maskVal) * 4.0
            const rimLight = edgeFactor * 0.4

            // Combine lights - key is dominant, fill softens shadows, rim adds pop
            const totalLight = keyLight * 1.4 + fillLight + rimLight

            // Create more dramatic range: ~0.4 (deep shadow) to ~1.5 (bright highlight)
            const adjusted = 0.4 + totalLight * 1.1

            // Apply boost intensity
            const lightEffect = 1.0 + (adjusted - 1.0) * intensity * 1.3

            // Blend based on mask value
            const lightFactor = 1.0 + (lightEffect - 1.0) * maskVal

            pixels[pixelIndex] = clamp(pixels[pixelIndex] * lightFactor, 0, 255)
            pixels[pixelIndex + 1] = clamp(pixels[pixelIndex + 1] * lightFactor, 0, 255)
            pixels[pixelIndex + 2] = clamp(pixels[pixelIndex + 2] * lightFactor, 0, 255)
        }
    }
}
