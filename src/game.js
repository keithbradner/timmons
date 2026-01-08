import * as THREE from 'three'

export function createGameState() {
    return {
        phase: 'IDLE',
        currentSheetIndex: 0,
        inspectionValue: 0,
        lightTargetColor: new THREE.Color(1, 1, 1),
        waterDisturbance: 0,
        accumulatedTime: 0,
        scoreLog: []
    }
}

export function setupUI(state, deps) {
    const {
        sheets,
        desensTray,
        desensLiquid,
        devTray,
        devTrayTarget,
        devLiquidTarget,
        updateTimerTexture
    } = deps

    const modeText = document.getElementById('mode-indicator')
    const actionBar = document.getElementById('action-bar')
    const p1Btn = document.getElementById('p1-drop-btn')
    const p2StartBtn = document.getElementById('p2-start-btn')
    const p2InspectBtn = document.getElementById('p2-inspect-btn')
    const p2ResumeBtn = document.getElementById('p2-resume-btn')
    const p2FinishBtn = document.getElementById('p2-finish-btn')

    window.startGame = function() {
        document.getElementById('panel-intro').classList.add('hidden')
        document.getElementById('panel-phase1').classList.remove('hidden')
        modeText.innerText = "PHASE 1: BLIND PROCESSING"
        state.lightTargetColor.setRGB(1, 1, 1)
    }

    window.preparePhase1 = function() {
        document.getElementById('panel-phase1').classList.add('hidden')
        actionBar.classList.remove('hidden')
        p1Btn.classList.remove('hidden')

        devTrayTarget.set(0, 0, 0)
        devLiquidTarget.set(0, -1.0, 0)
        desensTray.visible = false
        desensLiquid.visible = false

        sheets.forEach((s, i) => {
            s.targetPos.set(0, 5 + (i * 0.2), -20)
            s.targetRot.set(0, 0, 0)
        })
    }

    window.triggerPhase1Action = function() {
        if (state.phase !== 'IDLE') return
        p1Btn.disabled = true
        p1Btn.innerText = "DEVELOPING IN DARKNESS..."
        state.phase = 'BLIND_WAIT'
        state.accumulatedTime = 0
        updateTimerTexture(0)

        state.lightTargetColor.setRGB(0.08, 0.08, 0.08)

        sheets.forEach(s => {
            const rx = (Math.random() - 0.5) * 6
            const rz = (Math.random() - 0.5) * 4
            const ry = Math.random() * 3.14 * 2
            s.targetPos.set(rx, -1.9, rz)
            s.targetRot.set(0, ry, 0)
        })

        state.waterDisturbance = 1.0

        setTimeout(() => {
            state.lightTargetColor.setRGB(1, 1, 1)
            state.phase = 'BLIND_DONE'
            actionBar.classList.add('hidden')

            sheets.forEach((s, i) => {
                const xOffset = (i % 2 === 0) ? -3.5 : 3.5
                const zOffset = -5 + (i * 3.5)

                s.targetPos.set(xOffset, 4, zOffset)
                s.targetRot.set(0.5, 0, (i % 2 === 0 ? -0.2 : 0.2))

                const r = Math.random()
                if (r < 0.3) { s.photoMat.opacity = 0.3 }
                else if (r > 0.7) { s.photoMat.opacity = 1.0; s.photoMat.color.setHex(0x333333) }
                else { s.photoMat.opacity = 0.8 }
            })

            setTimeout(() => {
                document.getElementById('panel-result1').classList.remove('hidden')
            }, 1000)
        }, 5000)
    }

    window.setupPhase2 = function() {
        document.getElementById('panel-result1').classList.add('hidden')
        document.getElementById('panel-phase2').classList.remove('hidden')

        devTrayTarget.set(0, 0, 8)
        devLiquidTarget.set(0, -1.0, 8)
        desensTray.visible = true
        desensLiquid.visible = true

        sheets.forEach((s, i) => {
            s.targetPos.set((Math.random() - 0.5), 5 - (i * 0.1), -20)
            s.targetRot.set(0, 0, 0)
            s.photoMat.opacity = 0
            s.photoMat.color.setHex(0xffffff)
        })

        modeText.innerText = "PHASE 2: INSPECTION"
        state.accumulatedTime = 0
        updateTimerTexture(0)
    }

    window.startPhase2 = function() {
        document.getElementById('panel-phase2').classList.add('hidden')
        actionBar.classList.remove('hidden')
        p1Btn.classList.add('hidden')
        p2StartBtn.classList.remove('hidden')

        state.currentSheetIndex = 0
        state.phase = 'P2_IDLE'
        p2StartBtn.innerText = "START SHEET 1"
    }

    window.triggerP2Start = function() {
        p2StartBtn.classList.add('hidden')
        modeText.innerText = "STEP 1: DESENSITIZING"
        state.accumulatedTime = 0
        updateTimerTexture(0)

        state.lightTargetColor.setRGB(0.08, 0.08, 0.08)

        const s = sheets[state.currentSheetIndex]

        s.targetPos.set(0, 5, -14)

        setTimeout(() => {
            s.targetPos.set(0, -1.9, -8)
            state.waterDisturbance = 0.6

            setTimeout(() => {
                s.targetPos.set(0, 5, -8)
                modeText.innerText = "MOVING TO DEVELOPER..."

                setTimeout(() => {
                    s.targetPos.set(0, 5, 8)

                    setTimeout(() => {
                        modeText.innerText = "STEP 2: DEVELOPING (DARKNESS)"
                        s.targetPos.set(0, -1.9, 8)
                        state.waterDisturbance = 0.8

                        state.phase = 'P2_DEVELOPING'
                        state.inspectionValue = 0

                        p2InspectBtn.classList.remove('hidden')
                    }, 700)
                }, 700)
            }, 1500)
        }, 700)
    }

    window.triggerP2Inspect = function() {
        p2InspectBtn.classList.add('hidden')
        state.phase = 'P2_INSPECTING'
        modeText.innerText = "INSPECTING (GREEN SAFE-LIGHT)"

        const s = sheets[state.currentSheetIndex]
        s.targetPos.set(0, 8, 0)
        s.targetRot.set(0.5, 0, 0)

        state.lightTargetColor.setRGB(0.1, 0.8, 0.2)

        p2ResumeBtn.classList.remove('hidden')
        p2FinishBtn.classList.remove('hidden')
    }

    window.triggerP2Resume = function() {
        p2ResumeBtn.classList.add('hidden')
        p2FinishBtn.classList.add('hidden')

        state.phase = 'P2_DEVELOPING'
        modeText.innerText = "RESUMING DEVELOPMENT..."

        const s = sheets[state.currentSheetIndex]
        s.targetPos.set(0, -1.9, 8)
        s.targetRot.set(0, 0, 0)

        state.waterDisturbance = 0.5
        state.lightTargetColor.setRGB(0.08, 0.08, 0.08)

        p2InspectBtn.classList.remove('hidden')
    }

    window.triggerP2Finish = function() {
        p2ResumeBtn.classList.add('hidden')
        p2FinishBtn.classList.add('hidden')

        const s = sheets[state.currentSheetIndex]
        let score = 0
        const dist = Math.abs(s.idealTime - state.inspectionValue)
        if (dist < 0.15) score = 100
        else if (dist < 0.3) score = 70
        else score = 30
        state.scoreLog.push(score)

        s.targetPos.set((Math.random() - 0.5), -2 + (state.currentSheetIndex * 0.1), 20)
        s.targetRot.set(0, 0, 0)

        s.photoMat.color.setHex(0xffffff)
        if (state.inspectionValue > 1.2) s.photoMat.color.setHex(0x555555)
        s.photoMat.opacity = Math.min(state.inspectionValue, 1.0)

        state.currentSheetIndex++
        if (state.currentSheetIndex >= 5) {
            endPhase2()
        } else {
            state.phase = 'P2_IDLE'
            modeText.innerText = "READY FOR NEXT"
            p2StartBtn.innerText = `START SHEET ${state.currentSheetIndex + 1}`
            p2StartBtn.classList.remove('hidden')

            state.lightTargetColor.setRGB(1, 1, 1)
        }
    }

    function endPhase2() {
        state.phase = 'REVIEW'
        actionBar.classList.add('hidden')

        sheets.forEach((s, i) => {
            const xOffset = (i % 2 === 0) ? -3.5 : 3.5
            const zOffset = -5 + (i * 3.5)
            s.targetPos.set(xOffset, 4, zOffset)
            s.targetRot.set(0.5, 0, (i % 2 === 0 ? 0.1 : -0.1))
        })

        const total = state.scoreLog.reduce((a, b) => a + b, 0)
        const avg = Math.round(total / 5)
        let verdict = avg >= 90 ? "Master Pictorialist" : (avg >= 70 ? "Skilled Printer" : "Novice")

        document.getElementById('final-score-val').innerText = avg + "%"
        document.getElementById('verdict-text').innerText = verdict

        modeText.innerText = "SESSION COMPLETE"

        setTimeout(() => {
            document.getElementById('panel-final').classList.remove('hidden')
        }, 1000)
    }
}
