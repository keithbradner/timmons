/**
 * Directional Lighting Simulation
 * Simulates studio portrait lighting in the style of Timmons' dramatic portraits
 * Key light from upper-right creates the classic Rembrandt lighting pattern
 */

import { gaussianBlurMask } from './mask.js'
import { clamp } from './filters.js'

/**
 * Apply directional lighting to pixels based on estimated surface normals
 * @param {Uint8ClampedArray} pixels - Pixel data to modify
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Float32Array} mask - Segmentation mask
 * @param {number} intensity - Lighting intensity (0-1)
 */
export function applyDirectionalLighting(pixels, width, height, mask, intensity = 0.6) {
    if (intensity <= 0) return

    // Light source position (normalized coordinates)
    // Classic portrait lighting setup - key light from upper right
    const keyLight = {
        x: 0.7,   // Right of center
        y: 0.15,  // Above the subject
        z: 1.2    // In front of subject
    }

    // Fill light from opposite side (softer)
    const fillLight = {
        x: 0.2,
        y: 0.3,
        z: 1.0
    }

    const keyIntensity = 1.3 * intensity
    const fillIntensity = 0.4 * intensity
    const ambientLight = 0.85  // Higher ambient so we're adding light, not removing it
    const rimBoost = 0.3 * intensity  // Rim/edge lighting for drama

    // Estimate depth map from the mask
    const depthMap = estimateDepthFromMask(mask, width, height)

    // Apply lighting to each pixel
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x
            const pixelIndex = i * 4

            if (mask[i] < 0.1) continue

            const px = x / width
            const py = y / height
            const pz = depthMap[i]

            const normal = estimateSurfaceNormal(depthMap, x, y, width, height)

            // Key light calculation
            const toKeyX = keyLight.x - px
            const toKeyY = keyLight.y - py
            const toKeyZ = keyLight.z - pz
            const keyDist = Math.sqrt(toKeyX * toKeyX + toKeyY * toKeyY + toKeyZ * toKeyZ)
            const keyDirX = toKeyX / keyDist
            const keyDirY = toKeyY / keyDist
            const keyDirZ = toKeyZ / keyDist
            const keyNDotL = Math.max(0, normal.x * keyDirX + normal.y * keyDirY + normal.z * keyDirZ)
            const keyContrib = keyNDotL * keyIntensity

            // Fill light calculation
            const toFillX = fillLight.x - px
            const toFillY = fillLight.y - py
            const toFillZ = fillLight.z - pz
            const fillDist = Math.sqrt(toFillX * toFillX + toFillY * toFillY + toFillZ * toFillZ)
            const fillDirX = toFillX / fillDist
            const fillDirY = toFillY / fillDist
            const fillDirZ = toFillZ / fillDist
            const fillNDotL = Math.max(0, normal.x * fillDirX + normal.y * fillDirY + normal.z * fillDirZ)
            const fillContrib = fillNDotL * fillIntensity

            // Rim lighting - brighten edges of the subject
            const edgeFactor = 1 - mask[i]  // Stronger near edges
            const rimContrib = edgeFactor * rimBoost * 2

            // Total light - starts at ambient and adds light contributions
            const totalLight = ambientLight + keyContrib + fillContrib + rimContrib

            const maskFactor = mask[i]
            const lightFactor = 1 + (totalLight - 1) * maskFactor

            pixels[pixelIndex] = clamp(pixels[pixelIndex] * lightFactor, 0, 255)
            pixels[pixelIndex + 1] = clamp(pixels[pixelIndex + 1] * lightFactor, 0, 255)
            pixels[pixelIndex + 2] = clamp(pixels[pixelIndex + 2] * lightFactor, 0, 255)
        }
    }
}

/**
 * Estimate depth from mask - pixels deep inside mask are "closer"
 */
function estimateDepthFromMask(mask, width, height) {
    const depth = new Float32Array(mask.length)
    const maxDist = Math.min(width, height) / 4

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x

            if (mask[i] < 0.5) {
                depth[i] = 0
                continue
            }

            let minDist = maxDist
            const searchRadius = Math.floor(maxDist)

            for (let dy = -searchRadius; dy <= searchRadius; dy += 2) {
                for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
                    const nx = x + dx
                    const ny = y + dy
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                        const dist = Math.sqrt(dx * dx + dy * dy)
                        minDist = Math.min(minDist, dist)
                        continue
                    }
                    const ni = ny * width + nx
                    if (mask[ni] < 0.5) {
                        const dist = Math.sqrt(dx * dx + dy * dy)
                        minDist = Math.min(minDist, dist)
                    }
                }
            }

            depth[i] = Math.min(1, minDist / maxDist)
        }
    }

    return gaussianBlurMask(depth, width, height, 4)
}

/**
 * Estimate surface normal from depth map gradients
 */
function estimateSurfaceNormal(depthMap, x, y, width, height) {
    const i = y * width + x

    const left = x > 0 ? depthMap[i - 1] : depthMap[i]
    const right = x < width - 1 ? depthMap[i + 1] : depthMap[i]
    const up = y > 0 ? depthMap[i - width] : depthMap[i]
    const down = y < height - 1 ? depthMap[i + width] : depthMap[i]

    const dzdx = (right - left) * 2
    const dzdy = (down - up) * 2

    const nx = -dzdx
    const ny = -dzdy
    const nz = 0.5

    const mag = Math.sqrt(nx * nx + ny * ny + nz * nz)
    return {
        x: nx / mag,
        y: ny / mag,
        z: nz / mag
    }
}
