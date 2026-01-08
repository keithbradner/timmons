import * as THREE from 'three'

export function createTimer(scene) {
    const timerCanvas = document.createElement('canvas')
    timerCanvas.width = 256
    timerCanvas.height = 128
    const timerCtx = timerCanvas.getContext('2d')
    const timerTex = new THREE.CanvasTexture(timerCanvas)

    function updateTimerTexture(seconds) {
        timerCtx.fillStyle = '#111'
        timerCtx.fillRect(0, 0, 256, 128)
        timerCtx.strokeStyle = '#333'
        timerCtx.lineWidth = 5
        timerCtx.strokeRect(0, 0, 256, 128)

        const min = Math.floor(seconds / 60)
        const sec = Math.floor(seconds % 60)
        const text = `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`

        timerCtx.font = 'bold 80px "Roboto Mono", monospace'
        timerCtx.fillStyle = '#ffaa55'
        timerCtx.textAlign = 'center'
        timerCtx.textBaseline = 'middle'
        timerCtx.shadowColor = "#ff8800"
        timerCtx.shadowBlur = 15
        timerCtx.fillText(text, 128, 64)

        timerTex.needsUpdate = true
    }

    updateTimerTexture(0)

    // Timer Mesh
    const timerGeo = new THREE.BoxGeometry(6, 1.5, 3)
    const timerMat = new THREE.MeshStandardMaterial({ color: 0x222222 })
    const timerMesh = new THREE.Mesh(timerGeo, timerMat)
    timerMesh.position.set(12, -1.2, 5)
    timerMesh.castShadow = true
    scene.add(timerMesh)

    // The face of the timer
    const timerFaceGeo = new THREE.PlaneGeometry(5.5, 2.5)
    const timerFaceMat = new THREE.MeshBasicMaterial({ map: timerTex })
    const timerFace = new THREE.Mesh(timerFaceGeo, timerFaceMat)
    timerFace.rotation.x = -Math.PI / 2
    timerFace.position.y = 0.76
    timerMesh.add(timerFace)

    return { timerMesh, updateTimerTexture }
}
