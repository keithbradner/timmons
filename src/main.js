import * as THREE from 'three'
import './styles.css'
import { createScene, createCamera, createRenderer, createRoom, createTable, createLights, createLamp } from './scene.js'
import { createTraysAndLiquids } from './trays.js'
import { createTimer } from './timer.js'
import { createSheets } from './sheets.js'
import { createGameState, setupUI } from './game.js'
// Setup
const container = document.getElementById('canvas-container')
const scene = createScene()
const camera = createCamera()
const renderer = createRenderer(container)

// Scene objects
createRoom(scene)
createTable(scene)
const { spotLight } = createLights(scene)
// const { lampFilterMat } = createLamp(scene)

// Trays and liquids
const {
    desensTray,
    devTray,
    devTrayTarget,
    devLiquidTarget,
    liquidGeo,
    devLiquid,
    desensLiquid
} = createTraysAndLiquids(scene)

// Timer
const { timerMesh, updateTimerTexture } = createTimer(scene)

// Sheets
const sheets = createSheets(scene)

// Game state
const state = createGameState()

// Setup UI
setupUI(state, {
    sheets,
    desensTray,
    desensLiquid,
    devTray,
    devTrayTarget,
    devLiquidTarget,
    updateTimerTexture
})

// Animation loop
const clock = new THREE.Clock()

function animate() {
    requestAnimationFrame(animate)
    const delta = clock.getDelta()
    const time = clock.getElapsedTime()

    state.waterDisturbance *= 0.96

    // Timer Logic
    if (state.phase === 'BLIND_WAIT' || state.phase === 'P2_DEVELOPING') {
        state.accumulatedTime += delta
        updateTimerTexture(state.accumulatedTime)
    }

    // Liquid Simulation
    const positions = liquidGeo.attributes.position
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        const y = positions.getY(i)
        let z = Math.sin(x * 2.0 + time) * 0.02 + Math.cos(y * 1.5 + time) * 0.02
        if (state.waterDisturbance > 0.01) {
            const dist = Math.sqrt(x * x + y * y)
            z += Math.sin(dist * 6 - time * 12) * state.waterDisturbance * Math.exp(-dist * 0.5)
        }
        positions.setZ(i, z)
    }
    positions.needsUpdate = true
    liquidGeo.computeVertexNormals()

    // Lerp Trays
    devTray.position.lerp(devTrayTarget, 0.05)
    devLiquid.position.lerp(devLiquidTarget, 0.05)
    timerMesh.position.z = devTray.position.z

    // Lerp Sheets
    sheets.forEach(s => {
        s.group.position.lerp(s.targetPos, 0.06)
        s.group.rotation.x = THREE.MathUtils.lerp(s.group.rotation.x, s.targetRot.x, 0.06)
        s.group.rotation.y = THREE.MathUtils.lerp(s.group.rotation.y, s.targetRot.y, 0.06)
        s.group.rotation.z = THREE.MathUtils.lerp(s.group.rotation.z, s.targetRot.z, 0.06)
    })

    // Lights
    spotLight.color.lerp(state.lightTargetColor, 0.05)

    // Development Logic
    if (state.phase === 'P2_DEVELOPING') {
        const s = sheets[state.currentSheetIndex]
        if (s) {
            state.inspectionValue += s.devRate
            s.photoMat.opacity = 0.08
            s.photoMat.color.setHex(0x1a0000)
        }
    } else if (state.phase === 'P2_INSPECTING') {
        const s = sheets[state.currentSheetIndex]
        if (s) {
            if (state.inspectionValue <= 1.0) {
                s.photoMat.opacity = state.inspectionValue
                s.photoMat.color.setHex(0xffffff)
            } else {
                const burn = (state.inspectionValue - 1.0) * 1.5
                const c = Math.max(0, 1 - burn)
                s.photoMat.color.setRGB(c, c, c)
                s.photoMat.opacity = 1.0
            }
        }
    }

    renderer.render(scene, camera)
}

animate()

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
})
