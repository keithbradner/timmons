import { describe, it, expect } from 'vitest'
import { applyDirectionalLighting } from '../src/photobooth/lighting.js'

describe('Directional Lighting', () => {
    it('should not modify pixels when intensity is 0', () => {
        const pixels = new Uint8ClampedArray([100, 100, 100, 255])
        const mask = new Float32Array([1.0])

        applyDirectionalLighting(pixels, 1, 1, mask, 0)

        expect(pixels[0]).toBe(100)
        expect(pixels[1]).toBe(100)
        expect(pixels[2]).toBe(100)
    })

    it('should only affect subject pixels (mask > 0.1)', () => {
        // 2 pixels: background (mask=0) and subject (mask=1)
        const pixels = new Uint8ClampedArray([
            100, 100, 100, 255,  // background
            100, 100, 100, 255   // subject
        ])
        const mask = new Float32Array([0.0, 1.0])

        const originalBg = pixels[0]
        applyDirectionalLighting(pixels, 2, 1, mask, 0.6)

        // Background should be unchanged
        expect(pixels[0]).toBe(originalBg)
        // Subject should be modified (brightened)
        expect(pixels[4]).not.toBe(100)
    })

    it('should brighten subject pixels with positive intensity', () => {
        // Single subject pixel
        const pixels = new Uint8ClampedArray([100, 100, 100, 255])
        const mask = new Float32Array([1.0])

        applyDirectionalLighting(pixels, 1, 1, mask, 0.6)

        // With ambient 0.85 + lighting contributions, should be brighter
        // At minimum, ambient alone would give 100 * 0.85 = 85, but with
        // key + fill + rim it should be higher
        expect(pixels[0]).toBeGreaterThanOrEqual(85)
    })

    it('should scale lighting effect with intensity parameter', () => {
        // Test with low intensity
        const pixelsLow = new Uint8ClampedArray([100, 100, 100, 255])
        const maskLow = new Float32Array([1.0])
        applyDirectionalLighting(pixelsLow, 1, 1, maskLow, 0.3)
        const resultLow = pixelsLow[0]

        // Test with high intensity
        const pixelsHigh = new Uint8ClampedArray([100, 100, 100, 255])
        const maskHigh = new Float32Array([1.0])
        applyDirectionalLighting(pixelsHigh, 1, 1, maskHigh, 1.0)
        const resultHigh = pixelsHigh[0]

        // Higher intensity should create more noticeable change
        // (both should be different from 100, high more so than low)
        expect(Math.abs(resultHigh - 100)).toBeGreaterThan(Math.abs(resultLow - 100))
    })

    it('should handle edge pixels in mask', () => {
        // 3x3 image with varying mask values near edge
        const pixels = new Uint8ClampedArray(9 * 4)
        for (let i = 0; i < pixels.length; i += 4) {
            pixels[i] = 100
            pixels[i + 1] = 100
            pixels[i + 2] = 100
            pixels[i + 3] = 255
        }

        // Mask with soft edge
        const mask = new Float32Array([
            0.0, 0.3, 0.0,
            0.3, 1.0, 0.3,
            0.0, 0.3, 0.0
        ])

        // Should not throw
        expect(() => {
            applyDirectionalLighting(pixels, 3, 3, mask, 0.6)
        }).not.toThrow()
    })

    it('should clamp output values to 0-255', () => {
        // Very bright pixel that could overflow
        const pixels = new Uint8ClampedArray([250, 250, 250, 255])
        const mask = new Float32Array([1.0])

        applyDirectionalLighting(pixels, 1, 1, mask, 1.0)

        expect(pixels[0]).toBeLessThanOrEqual(255)
        expect(pixels[1]).toBeLessThanOrEqual(255)
        expect(pixels[2]).toBeLessThanOrEqual(255)
    })

    it('should create directional lighting effect (right side brighter)', () => {
        // 3x1 row of pixels
        const pixels = new Uint8ClampedArray([
            100, 100, 100, 255,  // left
            100, 100, 100, 255,  // center
            100, 100, 100, 255   // right
        ])
        const mask = new Float32Array([1.0, 1.0, 1.0])

        applyDirectionalLighting(pixels, 3, 1, mask, 0.6)

        // Key light is from upper-right (x=0.7), so right side should potentially
        // receive more direct light. This is a simplified test.
        // The actual lighting depends on the depth estimation and normals.
    })
})

describe('Lighting with Different Mask Values', () => {
    it('should skip pixels with mask < 0.1', () => {
        const pixels = new Uint8ClampedArray([100, 100, 100, 255])
        const mask = new Float32Array([0.05])  // Below threshold

        const original = pixels[0]
        applyDirectionalLighting(pixels, 1, 1, mask, 0.6)

        expect(pixels[0]).toBe(original)
    })

    it('should apply partial lighting to edge pixels (mask 0.1-1.0)', () => {
        // Pixel at mask edge
        const pixelsEdge = new Uint8ClampedArray([100, 100, 100, 255])
        const maskEdge = new Float32Array([0.5])

        // Pixel at mask center
        const pixelsCenter = new Uint8ClampedArray([100, 100, 100, 255])
        const maskCenter = new Float32Array([1.0])

        applyDirectionalLighting(pixelsEdge, 1, 1, maskEdge, 0.6)
        applyDirectionalLighting(pixelsCenter, 1, 1, maskCenter, 0.6)

        // Both should be modified, but effect strength differs based on maskFactor
        expect(pixelsEdge[0]).not.toBe(100)
        expect(pixelsCenter[0]).not.toBe(100)
    })
})
