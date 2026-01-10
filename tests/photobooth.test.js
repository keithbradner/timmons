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

// Mock DOM elements
const mockCanvas = {
    width: 100,
    height: 100,
    getContext: () => ({
        putImageData: vi.fn(),
        getImageData: vi.fn(() => new ImageData(100, 100)),
        drawImage: vi.fn(),
        filter: ''
    })
}

// Create mock document elements before importing modules
vi.stubGlobal('document', {
    getElementById: vi.fn((id) => {
        if (id === 'editor-canvas') return mockCanvas
        if (id === 'crop-overlay') return { classList: { add: vi.fn(), remove: vi.fn() } }
        if (id === 'crop-box') return { style: {}, addEventListener: vi.fn() }
        return null
    }),
    querySelector: vi.fn(() => ({ getBoundingClientRect: () => ({ width: 500, height: 625 }) })),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    createElement: vi.fn((tag) => {
        if (tag === 'canvas') {
            let canvasData = null
            return {
                width: 0,
                height: 0,
                getContext: () => ({
                    putImageData: vi.fn((data) => { canvasData = data }),
                    getImageData: vi.fn((x, y, w, h) => new ImageDataPolyfill(w, h)),
                    drawImage: vi.fn()
                })
            }
        }
        return {}
    })
})

// Import state module
import * as state from '../src/photobooth/state.js'
import { applyTimmonsFilters, clamp } from '../src/photobooth/filters.js'
import { createSoftMask, erodeMask, dilateMask, gaussianBlurMask } from '../src/photobooth/mask.js'
import { cropImageData } from '../src/photobooth/crop.js'

describe('Photobooth State', () => {
    beforeEach(() => {
        // Reset state
        state.resetImageState()
    })

    it('should have correct initial effect levels', () => {
        expect(state.effectLevels.silhouette).toBe(2)
        expect(state.effectLevels.lighting).toBe(2)
        expect(state.effectLevels.highcontrast).toBe(2)
        expect(state.effectLevels.crushedblacks).toBe(2)
        expect(state.effectLevels.grain).toBe(2)
        expect(state.effectLevels.vignette).toBe(2)
        expect(state.effectLevels.sepia).toBe(2)
        expect(state.effectLevels.softness).toBe(2)
    })

    it('should have effect values with 4 levels (off, medium, high, max)', () => {
        expect(state.effectValues.silhouette.backgroundDim).toHaveLength(4)
        expect(state.effectValues.lighting.lightBoost).toHaveLength(4)
        expect(state.effectValues.highcontrast.contrast).toHaveLength(4)
        expect(state.effectValues.crushedblacks.shadows).toHaveLength(4)
        expect(state.effectValues.grain.grain).toHaveLength(4)
        expect(state.effectValues.vignette.vignette).toHaveLength(4)
        expect(state.effectValues.sepia.sepia).toHaveLength(4)
        expect(state.effectValues.softness.blur).toHaveLength(4)
    })

    it('should have off value of 0 for all effects', () => {
        expect(state.effectValues.silhouette.backgroundDim[0]).toBe(0)
        expect(state.effectValues.lighting.lightBoost[0]).toBe(0)
        expect(state.effectValues.highcontrast.contrast[0]).toBe(1.0)
        expect(state.effectValues.crushedblacks.shadows[0]).toBe(0)
        expect(state.effectValues.grain.grain[0]).toBe(0)
        expect(state.effectValues.vignette.vignette[0]).toBe(0)
        expect(state.effectValues.sepia.sepia[0]).toBe(0)
        expect(state.effectValues.softness.blur[0]).toBe(0)
    })

    it('should have medium background dim at 0.6 (not full black)', () => {
        expect(state.effectValues.silhouette.backgroundDim[1]).toBe(0.6)
        expect(state.effectValues.silhouette.backgroundDim[2]).toBe(1.0)
    })

    it('should have graduated lighting values', () => {
        const lightBoost = state.effectValues.lighting.lightBoost
        expect(lightBoost[0]).toBe(0)
        expect(lightBoost[1]).toBe(0.3)
        expect(lightBoost[2]).toBe(0.6)
        expect(lightBoost[3]).toBe(1.0)
    })

    it('should reset image state correctly', () => {
        state.setCapturedImageData(new ImageData(10, 10))
        state.setIsCropped(true)
        state.setSubjectBounds({ x: 0, y: 0, width: 10, height: 10 })

        state.resetImageState()

        expect(state.capturedImageData).toBeNull()
        expect(state.isCropped).toBe(false)
        expect(state.subjectBounds).toBeNull()
    })

    it('should toggle debug mode', () => {
        expect(state.debugMode).toBe(false)
        state.setDebugMode(true)
        expect(state.debugMode).toBe(true)
    })
})

describe('Filter Functions', () => {
    it('should clamp values correctly', () => {
        expect(clamp(150, 0, 255)).toBe(150)
        expect(clamp(-10, 0, 255)).toBe(0)
        expect(clamp(300, 0, 255)).toBe(255)
        expect(clamp(0.5, 0, 1)).toBe(0.5)
    })

    it('should convert to grayscale', () => {
        const imageData = new ImageData(2, 2)
        // Set a red pixel
        imageData.data[0] = 255  // R
        imageData.data[1] = 0    // G
        imageData.data[2] = 0    // B
        imageData.data[3] = 255  // A

        // Set filter settings to minimal
        state.filterSettings.contrast = 1.0
        state.filterSettings.brightness = 1.0
        state.filterSettings.shadows = 0
        state.filterSettings.highlights = 0
        state.filterSettings.vignette = 0
        state.filterSettings.sepia = 0
        state.filterSettings.grain = 0
        state.filterSettings.backgroundDim = 0

        applyTimmonsFilters(imageData)

        // Red (255,0,0) should become gray based on luminance formula
        // Gray = 0.299*255 + 0.587*0 + 0.114*0 = 76.245
        expect(imageData.data[0]).toBeCloseTo(76, 0)
        expect(imageData.data[1]).toBeCloseTo(76, 0)
        expect(imageData.data[2]).toBeCloseTo(76, 0)
    })

    it('should apply contrast correctly', () => {
        const imageData = new ImageData(1, 1)
        imageData.data[0] = 100
        imageData.data[1] = 100
        imageData.data[2] = 100
        imageData.data[3] = 255

        state.filterSettings.contrast = 2.0
        state.filterSettings.brightness = 1.0
        state.filterSettings.shadows = 0
        state.filterSettings.highlights = 0
        state.filterSettings.vignette = 0
        state.filterSettings.sepia = 0
        state.filterSettings.grain = 0
        state.filterSettings.backgroundDim = 0

        applyTimmonsFilters(imageData)

        // Contrast formula: 128 + (value - 128) * contrast
        // 128 + (100 - 128) * 2 = 128 + (-28 * 2) = 128 - 56 = 72
        expect(imageData.data[0]).toBeCloseTo(72, 0)
    })

    it('should apply background dim only to background pixels', () => {
        const imageData = new ImageData(2, 1)
        // Pixel 0: will be background
        imageData.data[0] = 100
        imageData.data[1] = 100
        imageData.data[2] = 100
        imageData.data[3] = 255
        // Pixel 1: will be subject
        imageData.data[4] = 100
        imageData.data[5] = 100
        imageData.data[6] = 100
        imageData.data[7] = 255

        // Create mask: pixel 0 = background (0), pixel 1 = subject (1)
        const mask = new Float32Array([0.0, 1.0])

        state.filterSettings.contrast = 1.0
        state.filterSettings.brightness = 1.0
        state.filterSettings.shadows = 0
        state.filterSettings.highlights = 0
        state.filterSettings.vignette = 0
        state.filterSettings.sepia = 0
        state.filterSettings.grain = 0
        state.filterSettings.backgroundDim = 0.6  // 60% dim

        applyTimmonsFilters(imageData, mask)

        // Background pixel should be dimmed (100 * 0.4 = 40)
        expect(imageData.data[0]).toBeLessThan(imageData.data[4])
    })

    it('should apply sepia toning', () => {
        const imageData = new ImageData(1, 1)
        imageData.data[0] = 128
        imageData.data[1] = 128
        imageData.data[2] = 128
        imageData.data[3] = 255

        state.filterSettings.contrast = 1.0
        state.filterSettings.brightness = 1.0
        state.filterSettings.shadows = 0
        state.filterSettings.highlights = 0
        state.filterSettings.vignette = 0
        state.filterSettings.sepia = 50  // 50%
        state.filterSettings.grain = 0
        state.filterSettings.backgroundDim = 0

        applyTimmonsFilters(imageData)

        // Sepia should make R > G > B
        expect(imageData.data[0]).toBeGreaterThan(imageData.data[2])
    })
})

describe('Mask Functions', () => {
    it('should create soft mask from binary data', () => {
        const binaryData = new Uint8Array([0, 0, 1, 1, 1, 1, 0, 0, 0])
        const mask = createSoftMask(binaryData, 3, 3)

        expect(mask).toBeInstanceOf(Float32Array)
        expect(mask.length).toBe(9)
    })

    it('should erode mask correctly', () => {
        // 3x3 mask with center pixel = 1
        const mask = new Float32Array([0, 0, 0, 0, 1, 0, 0, 0, 0])
        const eroded = erodeMask(mask, 3, 3, 1)

        // After erosion with radius 1, center should be 0 (no neighbors)
        expect(eroded[4]).toBe(0)
    })

    it('should dilate mask correctly', () => {
        // 3x3 mask with center pixel = 1
        const mask = new Float32Array([0, 0, 0, 0, 1, 0, 0, 0, 0])
        const dilated = dilateMask(mask, 3, 3, 1)

        // After dilation, neighbors should become 1
        expect(dilated[1]).toBe(1)  // top
        expect(dilated[3]).toBe(1)  // left
        expect(dilated[4]).toBe(1)  // center
        expect(dilated[5]).toBe(1)  // right
        expect(dilated[7]).toBe(1)  // bottom
    })

    it('should blur mask', () => {
        // 5x5 mask with single bright pixel in center
        const mask = new Float32Array(25).fill(0)
        mask[12] = 1  // center

        const blurred = gaussianBlurMask(mask, 5, 5, 1)

        // Blurred center should be less than 1
        expect(blurred[12]).toBeLessThan(1)
        // Neighbors should be > 0
        expect(blurred[11]).toBeGreaterThan(0)
        expect(blurred[13]).toBeGreaterThan(0)
    })
})

describe('Crop Functions', () => {
    it('should crop image data correctly', () => {
        // Create 4x4 image
        const sourceImage = new ImageData(4, 4)
        for (let i = 0; i < sourceImage.data.length; i += 4) {
            const pixelIndex = i / 4
            sourceImage.data[i] = pixelIndex * 10     // R
            sourceImage.data[i + 1] = pixelIndex * 10 // G
            sourceImage.data[i + 2] = pixelIndex * 10 // B
            sourceImage.data[i + 3] = 255             // A
        }

        const bounds = { x: 1, y: 1, width: 2, height: 2 }
        const cropped = cropImageData(sourceImage, bounds)

        expect(cropped.width).toBe(2)
        expect(cropped.height).toBe(2)
    })
})

describe('Effect Level Values', () => {
    it('should have increasing values for contrast levels', () => {
        const contrast = state.effectValues.highcontrast.contrast
        expect(contrast[0]).toBeLessThan(contrast[1])
        expect(contrast[1]).toBeLessThan(contrast[2])
        expect(contrast[2]).toBeLessThan(contrast[3])
    })

    it('should have increasing values for shadows levels', () => {
        const shadows = state.effectValues.crushedblacks.shadows
        expect(shadows[0]).toBeLessThan(shadows[1])
        expect(shadows[1]).toBeLessThan(shadows[2])
        expect(shadows[2]).toBeLessThan(shadows[3])
    })

    it('should have increasing values for grain levels', () => {
        const grain = state.effectValues.grain.grain
        expect(grain[0]).toBeLessThan(grain[1])
        expect(grain[1]).toBeLessThan(grain[2])
        expect(grain[2]).toBeLessThan(grain[3])
    })

    it('should have increasing values for vignette levels', () => {
        const vignette = state.effectValues.vignette.vignette
        expect(vignette[0]).toBeLessThan(vignette[1])
        expect(vignette[1]).toBeLessThan(vignette[2])
        expect(vignette[2]).toBeLessThan(vignette[3])
    })

    it('should have increasing values for sepia levels', () => {
        const sepia = state.effectValues.sepia.sepia
        expect(sepia[0]).toBeLessThan(sepia[1])
        expect(sepia[1]).toBeLessThan(sepia[2])
        expect(sepia[2]).toBeLessThan(sepia[3])
    })

    it('should have increasing values for blur levels', () => {
        const blur = state.effectValues.softness.blur
        expect(blur[0]).toBeLessThan(blur[1])
        expect(blur[1]).toBeLessThan(blur[2])
        expect(blur[2]).toBeLessThan(blur[3])
    })
})

describe('Preset Values', () => {
    it('should have classic preset', () => {
        expect(state.presetValues.classic).toBeDefined()
        expect(state.presetValues.classic.contrast).toBeDefined()
        expect(state.presetValues.classic.brightness).toBeDefined()
    })

    it('should have silhouette preset with higher contrast', () => {
        expect(state.presetValues.silhouette).toBeDefined()
        expect(state.presetValues.silhouette.contrast).toBeGreaterThan(state.presetValues.classic.contrast)
    })

    it('should have foggy preset with lower contrast', () => {
        expect(state.presetValues.foggy).toBeDefined()
        expect(state.presetValues.foggy.contrast).toBeLessThan(state.presetValues.classic.contrast)
    })
})

describe('Filter Settings', () => {
    it('should have all required filter settings', () => {
        expect(state.filterSettings.contrast).toBeDefined()
        expect(state.filterSettings.brightness).toBeDefined()
        expect(state.filterSettings.shadows).toBeDefined()
        expect(state.filterSettings.highlights).toBeDefined()
        expect(state.filterSettings.grain).toBeDefined()
        expect(state.filterSettings.vignette).toBeDefined()
        expect(state.filterSettings.sepia).toBeDefined()
        expect(state.filterSettings.blur).toBeDefined()
        expect(state.filterSettings.backgroundDim).toBeDefined()
        expect(state.filterSettings.lightBoost).toBeDefined()
    })

    it('should have base values for all settings', () => {
        expect(state.baseValues.contrast).toBe(1.0)
        expect(state.baseValues.brightness).toBe(0.95)
        expect(state.baseValues.shadows).toBe(0)
        expect(state.baseValues.highlights).toBe(20)
        expect(state.baseValues.grain).toBe(0)
        expect(state.baseValues.vignette).toBe(0)
        expect(state.baseValues.sepia).toBe(0)
        expect(state.baseValues.blur).toBe(0)
        expect(state.baseValues.backgroundDim).toBe(0)
        expect(state.baseValues.lightBoost).toBe(0)
    })
})
