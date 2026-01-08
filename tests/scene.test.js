import { describe, it, expect } from 'vitest'
import { createScene, createCamera } from '../src/scene.js'

describe('Scene', () => {
    it('should create a scene with fog', () => {
        const scene = createScene()

        expect(scene).toBeDefined()
        expect(scene.fog).toBeDefined()
        expect(scene.fog.color.getHex()).toBe(0x050505)
    })
})

describe('Camera', () => {
    it('should create camera with correct position', () => {
        const camera = createCamera()

        expect(camera).toBeDefined()
        expect(camera.position.x).toBe(3)
        expect(camera.position.y).toBe(46)
        expect(camera.position.z).toBe(22)
    })

    it('should have correct field of view', () => {
        const camera = createCamera()

        expect(camera.fov).toBe(50)
    })
})
