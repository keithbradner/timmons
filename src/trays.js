import * as THREE from 'three'

function createLabel(text, subText) {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 160
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, 512, 160)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = "rgba(0,0,0,0.8)"
    ctx.shadowBlur = 10
    ctx.fillStyle = '#ffffff'

    ctx.font = 'bold 50px "Roboto Mono", monospace'
    ctx.fillText(text, 256, 50)

    if (subText) {
        ctx.font = 'italic 36px "Playfair Display", serif'
        ctx.fillStyle = '#cccccc'
        ctx.fillText(subText, 256, 100)
    }

    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
    const geo = new THREE.PlaneGeometry(10, 3)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2.5
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
    // TRAY 1: Desensitizer
    const desensTray = createTray(16, 1.5, 12, "DESENSITIZER", "Pinakryptol Green")
    desensTray.position.set(0, 0, -8)
    desensTray.visible = false
    scene.add(desensTray)

    // TRAY 2: Developer
    const devTray = createTray(16, 1.5, 12, "DEVELOPER", "Metol-Hydroquinone")
    devTray.position.set(0, 0, 0)
    scene.add(devTray)

    const devTrayTarget = new THREE.Vector3(0, 0, 0)
    const devLiquidTarget = new THREE.Vector3(0, -1.0, 0)

    // Liquids
    const liquidGeo = new THREE.PlaneGeometry(15.8, 11.8, 64, 48)

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
        desensTray,
        devTray,
        devTrayTarget,
        devLiquidTarget,
        liquidGeo,
        devLiquid,
        desensLiquid
    }
}
