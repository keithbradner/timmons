import { describe, it, expect } from 'vitest'
import { createGameState } from '../src/game.js'

describe('Game State', () => {
    it('should create initial game state', () => {
        const state = createGameState()

        expect(state.phase).toBe('IDLE')
        expect(state.currentSheetIndex).toBe(0)
        expect(state.inspectionValue).toBe(0)
        expect(state.waterDisturbance).toBe(0)
        expect(state.accumulatedTime).toBe(0)
        expect(state.scoreLog).toEqual([])
    })

    it('should have a valid light target color', () => {
        const state = createGameState()

        expect(state.lightTargetColor.r).toBe(1)
        expect(state.lightTargetColor.g).toBe(1)
        expect(state.lightTargetColor.b).toBe(1)
    })
})
