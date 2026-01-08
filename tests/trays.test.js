import { describe, it, expect } from 'vitest'
import { createTray } from '../src/trays.js'

describe('Trays', () => {
    it('should create a tray without label', () => {
        const tray = createTray(10, 1, 8, null, null)

        expect(tray).toBeDefined()
        // Base + 4 walls = 5 children (no label)
        expect(tray.children.length).toBe(5)
    })

    it('should create tray with correct structure', () => {
        const tray = createTray(16, 1.5, 12, null, null)

        expect(tray).toBeDefined()
        // Check base is positioned correctly
        const base = tray.children[0]
        expect(base.position.y).toBe(-2.0)
    })
})
