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
    createElement: vi.fn((tag) => {
        if (tag === 'canvas') {
            return {
                width: 0,
                height: 0,
                getContext: () => ({
                    putImageData: vi.fn(),
                    getImageData: vi.fn((x, y, w, h) => new ImageDataPolyfill(w, h)),
                    drawImage: vi.fn()
                })
            }
        }
        return {}
    })
})

import * as state from '../src/photobooth/state.js'
import { cropToSubject, cropImageData } from '../src/photobooth/crop.js'

describe('Crop to Subject', () => {
    beforeEach(() => {
        state.resetImageState()
    })

    it('should return early if no segmentation mask', () => {
        const applySettings = vi.fn()
        const updatePreview = vi.fn()

        cropToSubject(applySettings, updatePreview)

        expect(applySettings).not.toHaveBeenCalled()
        expect(updatePreview).not.toHaveBeenCalled()
    })

    it('should toggle crop off if already cropped', () => {
        // Setup cropped state
        state.setIsCropped(true)
        state.setSegmentationMask(new Float32Array([1, 1, 1, 1]))
        state.setImageWithoutBackground(new ImageDataPolyfill(2, 2))

        const applySettings = vi.fn()
        const updatePreview = vi.fn()

        cropToSubject(applySettings, updatePreview)

        expect(state.isCropped).toBe(false)
        expect(applySettings).toHaveBeenCalled()
        expect(updatePreview).toHaveBeenCalled()
    })

    it('should find subject bounds from mask', () => {
        // Create 4x4 mask with subject in center
        const mask = new Float32Array([
            0, 0, 0, 0,
            0, 1, 1, 0,
            0, 1, 1, 0,
            0, 0, 0, 0
        ])
        state.setSegmentationMask(mask)
        state.setImageWithoutBackground(new ImageDataPolyfill(4, 4))

        const applySettings = vi.fn()
        const updatePreview = vi.fn()

        cropToSubject(applySettings, updatePreview)

        expect(state.isCropped).toBe(true)
        expect(state.subjectBounds).toBeDefined()
        // Subject should be found at x:1, y:1 with width:2, height:2 (before padding)
    })

    it('should handle mask with no subject detected', () => {
        // All zeros mask
        const mask = new Float32Array(16).fill(0)
        state.setSegmentationMask(mask)
        state.setImageWithoutBackground(new ImageDataPolyfill(4, 4))

        const applySettings = vi.fn()
        const updatePreview = vi.fn()

        cropToSubject(applySettings, updatePreview)

        expect(state.isCropped).toBe(false)
    })
})

describe('Crop Image Data', () => {
    it('should return cropped image with correct dimensions', () => {
        const source = new ImageDataPolyfill(10, 10)
        const bounds = { x: 2, y: 2, width: 5, height: 5 }

        const result = cropImageData(source, bounds)

        expect(result.width).toBe(5)
        expect(result.height).toBe(5)
    })

    it('should handle crop at image edges', () => {
        const source = new ImageDataPolyfill(10, 10)
        const bounds = { x: 0, y: 0, width: 3, height: 3 }

        const result = cropImageData(source, bounds)

        expect(result.width).toBe(3)
        expect(result.height).toBe(3)
    })

    it('should handle single pixel crop', () => {
        const source = new ImageDataPolyfill(10, 10)
        const bounds = { x: 5, y: 5, width: 1, height: 1 }

        const result = cropImageData(source, bounds)

        expect(result.width).toBe(1)
        expect(result.height).toBe(1)
    })
})

describe('Subject Bounds State', () => {
    beforeEach(() => {
        state.resetImageState()
    })

    it('should set and get subject bounds', () => {
        const bounds = { x: 10, y: 20, width: 100, height: 125 }
        state.setSubjectBounds(bounds)

        expect(state.subjectBounds).toEqual(bounds)
    })

    it('should clear subject bounds on reset', () => {
        state.setSubjectBounds({ x: 10, y: 20, width: 100, height: 125 })
        state.setIsCropped(true)

        state.resetImageState()

        expect(state.subjectBounds).toBeNull()
        expect(state.isCropped).toBe(false)
    })

    it('should maintain 4:5 aspect ratio for bounds', () => {
        // This tests the aspect ratio logic in cropToSubject
        // Create a tall narrow subject
        const mask = new Float32Array(100)  // 10x10
        // Fill a vertical strip
        for (let y = 0; y < 10; y++) {
            mask[y * 10 + 5] = 1  // column 5
        }
        state.setSegmentationMask(mask)
        state.setImageWithoutBackground(new ImageDataPolyfill(10, 10))

        const applySettings = vi.fn()
        const updatePreview = vi.fn()

        cropToSubject(applySettings, updatePreview)

        if (state.subjectBounds) {
            const ratio = state.subjectBounds.width / state.subjectBounds.height
            expect(ratio).toBeCloseTo(4/5, 1)
        }
    })
})
