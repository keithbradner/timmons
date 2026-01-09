import * as THREE from 'three'

function createLabel(text, subText) {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 180
    const ctx = canvas.getContext('2d')

    // Wood backing
    ctx.fillStyle = '#5c4033'
    ctx.beginPath()
    ctx.roundRect(4, 4, 504, 172, 6)
    ctx.fill()

    // Wood grain effect
    ctx.strokeStyle = 'rgba(40, 25, 15, 0.4)'
    ctx.lineWidth = 1
    for (let i = 0; i < 20; i++) {
        const y = 10 + i * 8 + Math.random() * 4
        ctx.beginPath()
        ctx.moveTo(8, y)
        ctx.lineTo(504, y + (Math.random() - 0.5) * 6)
        ctx.stroke()
    }

    // Cream/ivory paper label inset
    ctx.fillStyle = '#f5f0e1'
    ctx.beginPath()
    ctx.roundRect(20, 16, 472, 148, 4)
    ctx.fill()

    // Subtle aged border on paper
    ctx.strokeStyle = '#c4b89e'
    ctx.lineWidth = 2
    ctx.stroke()

    // Main text - bold black with thick uniform strokes
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 54px Arial Black, Arial, sans-serif'
    ctx.fillText(text, 256, 60)

    // Subtext (chemical name)
    if (subText) {
        ctx.font = 'bold 26px Arial, sans-serif'
        ctx.fillStyle = '#000000'
        ctx.fillText(subText, 256, 115)
    }

    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false, side: THREE.DoubleSide })
    const geo = new THREE.PlaneGeometry(12, 4)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 3
    return mesh
}

export function createTray(width, height, depth, labelText, chemText) {
    const grp = new THREE.Group()
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 })

    const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), trayMat)
    base.position.y = -2.0
    base.receiveShadow = true
    grp.add(base)

    const thick = 0.2
    const h = 1.5
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(width + thick * 2, h, thick), trayMat)
    w1.position.set(0, -1.35, -depth / 2 - thick / 2)
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(width + thick * 2, h, thick), trayMat)
    w2.position.set(0, -1.35, depth / 2 + thick / 2)
    const w3 = new THREE.Mesh(new THREE.BoxGeometry(thick, h, depth), trayMat)
    w3.position.set(width / 2 + thick / 2, -1.35, 0)
    const w4 = new THREE.Mesh(new THREE.BoxGeometry(thick, h, depth), trayMat)
    w4.position.set(-width / 2 - thick / 2, -1.35, 0)

    ;[w1, w2, w3, w4].forEach(w => { w.castShadow = true; w.receiveShadow = true; grp.add(w) })

    if (labelText) {
        const lbl = createLabel(labelText, chemText)
        lbl.position.set(0, -1.5, -depth / 2 - 2)
        grp.add(lbl)
    }

    return grp
}

export function createTraysAndLiquids(scene) {
    // Big tray for Phase 1
    const bigTray = createTray(16, 1.5, 12, "DEVELOPER", "Metol-Hydroquinone")
    bigTray.position.set(0, 0, 0)
    scene.add(bigTray)

    const bigLiquidGeo = new THREE.PlaneGeometry(15.8, 11.8, 64, 48)
    const bigLiquidMat = new THREE.MeshPhysicalMaterial({
        color: 0x221105,
        roughness: 0.05,
        transmission: 0.9,
        opacity: 0.95,
        transparent: true
    })
    const bigLiquid = new THREE.Mesh(bigLiquidGeo, bigLiquidMat)
    bigLiquid.rotation.x = -Math.PI / 2
    bigLiquid.position.set(0, -1.0, 0)
    scene.add(bigLiquid)

    // Small trays for Phase 2
    const desensTray = createTray(12, 1.5, 9, "DESENSITIZER", "Pinakryptol Green")
    desensTray.position.set(0, 0, -8)
    desensTray.visible = false
    scene.add(desensTray)

    const devTray = createTray(12, 1.5, 9, "DEVELOPER", "Metol-Hydroquinone")
    devTray.position.set(0, 0, 0)
    devTray.visible = false
    scene.add(devTray)

    const devTrayTarget = new THREE.Vector3(0, 0, 0)
    const devLiquidTarget = new THREE.Vector3(0, -1.0, 0)

    const liquidGeo = new THREE.PlaneGeometry(11.8, 8.8, 64, 48)

    const devLiquidMat = new THREE.MeshPhysicalMaterial({
        color: 0x221105,
        roughness: 0.05,
        transmission: 0.9,
        opacity: 0.95,
        transparent: true
    })
    const devLiquid = new THREE.Mesh(liquidGeo, devLiquidMat)
    devLiquid.rotation.x = -Math.PI / 2
    devLiquid.position.set(0, -1.0, 0)
    devLiquid.visible = false
    scene.add(devLiquid)

    const desensLiquidMat = new THREE.MeshPhysicalMaterial({
        color: 0x051105,
        roughness: 0.05,
        transmission: 0.9,
        opacity: 0.85,
        transparent: true
    })
    const desensLiquid = new THREE.Mesh(liquidGeo, desensLiquidMat)
    desensLiquid.rotation.x = -Math.PI / 2
    desensLiquid.position.set(0, -1.0, -8)
    desensLiquid.visible = false
    scene.add(desensLiquid)

    return {
        bigTray,
        bigLiquid,
        desensTray,
        devTray,
        devTrayTarget,
        devLiquidTarget,
        liquidGeo,
        devLiquid,
        desensLiquid
    }
}
