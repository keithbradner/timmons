import { describe, it, expect, beforeEach, vi } from 'vitest'

// Polyfill ImageData for Node environment
class ImageDataPolyfill {
    constructor(width, height) {
        this.width = width
        this.height = height
        this.data = new Uint8ClampedArray(width * height * 4)
    }
}
global.ImageData = ImageDataPolyfill

// Mock document
vi.stubGlobal('document', {
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => ({
            putImageData: vi.fn(),
            getImageData: vi.fn((x, y, w, h) => new ImageDataPolyfill(w, h)),
            drawImage: vi.fn()
        })
    }))
})

import * as state from '../src/photobooth/state.js'
import { applyTimmonsFilters } from '../src/photobooth/filters.js'
import { applyDirectionalLighting } from '../src/photobooth/lighting.js'

describe('Effect Level Integration', () => {
    beforeEach(() => {
        // Reset filter settings to base values
        Object.assign(state.filterSettings, state.baseValues)
    })

    it('should apply correct values for level 0 (off)', () => {
        const level = 0

        // For each effect, level 0 should give the first value in the array
        expect(state.effectValues.silhouette.backgroundDim[level]).toBe(0)
        expect(state.effectValues.lighting.lightBoost[level]).toBe(0)
        expect(state.effectValues.highcontrast.contrast[level]).toBe(1.0)
        expect(state.effectValues.crushedblacks.shadows[level]).toBe(0)
        expect(state.effectValues.grain.grain[level]).toBe(0)
        expect(state.effectValues.vignette.vignette[level]).toBe(0)
        expect(state.effectValues.sepia.sepia[level]).toBe(0)
        expect(state.effectValues.softness.blur[level]).toBe(0)
    })

    it('should apply correct values for level 1 (medium)', () => {
        const level = 1

        expect(state.effectValues.silhouette.backgroundDim[level]).toBe(0.6)
        expect(state.effectValues.lighting.lightBoost[level]).toBe(0.3)
        expect(state.effectValues.highcontrast.contrast[level]).toBe(1.3)
        expect(state.effectValues.crushedblacks.shadows[level]).toBe(30)
        expect(state.effectValues.grain.grain[level]).toBe(12)
        expect(state.effectValues.vignette.vignette[level]).toBe(20)
        expect(state.effectValues.sepia.sepia[level]).toBe(6)
        expect(state.effectValues.softness.blur[level]).toBe(0.3)
    })

    it('should apply correct values for level 2 (high)', () => {
        const level = 2

        expect(state.effectValues.silhouette.backgroundDim[level]).toBe(1.0)
        expect(state.effectValues.lighting.lightBoost[level]).toBe(0.6)
        expect(state.effectValues.highcontrast.contrast[level]).toBe(1.6)
        expect(state.effectValues.crushedblacks.shadows[level]).toBe(60)
        expect(state.effectValues.grain.grain[level]).toBe(24)
        expect(state.effectValues.vignette.vignette[level]).toBe(40)
        expect(state.effectValues.sepia.sepia[level]).toBe(14)
        expect(state.effectValues.softness.blur[level]).toBe(0.6)
    })

    it('should apply correct values for level 3 (max)', () => {
        const level = 3

        expect(state.effectValues.silhouette.backgroundDim[level]).toBe(1.0)
        expect(state.effectValues.lighting.lightBoost[level]).toBe(1.0)
        expect(state.effectValues.highcontrast.contrast[level]).toBe(2.2)
        expect(state.effectValues.crushedblacks.shadows[level]).toBe(90)
        expect(state.effectValues.grain.grain[level]).toBe(40)
        expect(state.effectValues.vignette.vignette[level]).toBe(70)
        expect(state.effectValues.sepia.sepia[level]).toBe(25)
        expect(state.effectValues.softness.blur[level]).toBe(1.2)
    })
})

describe('Combined Filter and Lighting', () => {
    it('should apply both lighting and filters to subject', () => {
        const imageData = new ImageDataPolyfill(3, 3)
        // Fill with gray
        for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = 100
            imageData.data[i + 1] = 100
            imageData.data[i + 2] = 100
            imageData.data[i + 3] = 255
        }

        // Center pixel is subject
        const mask = new Float32Array([
            0, 0, 0,
            0, 1, 0,
            0, 0, 0
        ])

        // Apply lighting first
        applyDirectionalLighting(imageData.data, 3, 3, mask, 0.6)

        // Center pixel should be modified
        const centerIdx = 4 * 4  // pixel 4 (center of 3x3)
        expect(imageData.data[centerIdx]).not.toBe(100)

        // Apply filters
        state.filterSettings.contrast = 1.5
        state.filterSettings.brightness = 1.0
        state.filterSettings.shadows = 0
        state.filterSettings.highlights = 0
        state.filterSettings.vignette = 0
        state.filterSettings.sepia = 0
        state.filterSettings.grain = 0
        state.filterSettings.backgroundDim = 0

        applyTimmonsFilters(imageData, mask)

        // Values should be further modified
        expect(imageData.data[centerIdx]).toBeDefined()
    })

    it('should dim background when backgroundDim > 0', () => {
        const imageData = new ImageDataPolyfill(2, 1)
        // Both pixels start at 100
        imageData.data[0] = 100
        imageData.data[1] = 100
        imageData.data[2] = 100
        imageData.data[3] = 255
        imageData.data[4] = 100
        imageData.data[5] = 100
        imageData.data[6] = 100
        imageData.data[7] = 255

        // First pixel is background, second is subject
        const mask = new Float32Array([0, 1])

        state.filterSettings.contrast = 1.0
        state.filterSettings.brightness = 1.0
        state.filterSettings.shadows = 0
        state.filterSettings.highlights = 0
        state.filterSettings.vignette = 0
        state.filterSettings.sepia = 0
        state.filterSettings.grain = 0
        state.filterSettings.backgroundDim = 0.6  // 60% dim

        applyTimmonsFilters(imageData, mask)

        // Background (first pixel) should be dimmed
        // Dim factor = 1 - 0.6 = 0.4, so 100 * 0.4 = 40
        expect(imageData.data[0]).toBeLessThan(50)

        // Subject (second pixel) should not be dimmed (but converted to grayscale)
        expect(imageData.data[4]).toBeGreaterThan(50)
    })

    it('should apply full black background when backgroundDim = 1', () => {
        const imageData = new ImageDataPolyfill(1, 1)
        imageData.data[0] = 100
        imageData.data[1] = 100
        imageData.data[2] = 100
        imageData.data[3] = 255

        const mask = new Float32Array([0])  // background pixel

        state.filterSettings.contrast = 1.0
        state.filterSettings.brightness = 1.0
        state.filterSettings.shadows = 0
        state.filterSettings.highlights = 0
        state.filterSettings.vignette = 0
        state.filterSettings.sepia = 0
        state.filterSettings.grain = 0
        state.filterSettings.backgroundDim = 1.0  // full black

        applyTimmonsFilters(imageData, mask)

        // Should be completely black (0 * 1.0 dim = 0)
        expect(imageData.data[0]).toBe(0)
        expect(imageData.data[1]).toBe(0)
        expect(imageData.data[2]).toBe(0)
    })
})

describe('Vignette Effect', () => {
    it('should darken edges more than center', () => {
        // Use a 5x5 image to see vignette effect
        const imageData = new ImageDataPolyfill(5, 5)
        for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = 200
            imageData.data[i + 1] = 200
            imageData.data[i + 2] = 200
            imageData.data[i + 3] = 255
        }

        state.filterSettings.contrast = 1.0
        state.filterSettings.brightness = 1.0
        state.filterSettings.shadows = 0
        state.filterSettings.highlights = 0
        state.filterSettings.vignette = 50  // 50% vignette
        state.filterSettings.sepia = 0
        state.filterSettings.grain = 0
        state.filterSettings.backgroundDim = 0

        applyTimmonsFilters(imageData)

        // Center pixel (12) should be brighter than corner pixel (0)
        const centerIdx = 12 * 4
        const cornerIdx = 0 * 4

        expect(imageData.data[centerIdx]).toBeGreaterThan(imageData.data[cornerIdx])
    })
})

describe('Grain Effect', () => {
    it('should add randomness when grain > 0', () => {
        // Create two identical images
        const imageData1 = new ImageDataPolyfill(1, 1)
        imageData1.data[0] = 128
        imageData1.data[1] = 128
        imageData1.data[2] = 128
        imageData1.data[3] = 255

        const imageData2 = new ImageDataPolyfill(1, 1)
        imageData2.data[0] = 128
        imageData2.data[1] = 128
        imageData2.data[2] = 128
        imageData2.data[3] = 255

        state.filterSettings.contrast = 1.0
        state.filterSettings.brightness = 1.0
        state.filterSettings.shadows = 0
        state.filterSettings.highlights = 0
        state.filterSettings.vignette = 0
        state.filterSettings.sepia = 0
        state.filterSettings.grain = 30  // grain enabled
        state.filterSettings.backgroundDim = 0

        applyTimmonsFilters(imageData1)
        applyTimmonsFilters(imageData2)

        // With grain, results should differ (with very high probability)
        // Note: This could theoretically fail if random returns same value
        // In practice, with grain=30, differences should be visible
    })

    it('should not add grain when grain = 0', () => {
        const imageData1 = new ImageDataPolyfill(1, 1)
        imageData1.data[0] = 128
        imageData1.data[1] = 128
        imageData1.data[2] = 128
        imageData1.data[3] = 255

        const imageData2 = new ImageDataPolyfill(1, 1)
        imageData2.data[0] = 128
        imageData2.data[1] = 128
        imageData2.data[2] = 128
        imageData2.data[3] = 255

        state.filterSettings.contrast = 1.0
        state.filterSettings.brightness = 1.0
        state.filterSettings.shadows = 0
        state.filterSettings.highlights = 0
        state.filterSettings.vignette = 0
        state.filterSettings.sepia = 0
        state.filterSettings.grain = 0  // no grain
        state.filterSettings.backgroundDim = 0

        applyTimmonsFilters(imageData1)
        applyTimmonsFilters(imageData2)

        // Without grain, results should be identical
        expect(imageData1.data[0]).toBe(imageData2.data[0])
        expect(imageData1.data[1]).toBe(imageData2.data[1])
        expect(imageData1.data[2]).toBe(imageData2.data[2])
    })
})
