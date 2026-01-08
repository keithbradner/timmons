import * as THREE from 'three'

export function createScene() {
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x050505, 20, 70)
    return scene
}

export function createCamera() {
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(3, 46, 22)
    camera.lookAt(3, 0, 4)
    return camera
}

export function createRenderer(container) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.outputEncoding = THREE.sRGBEncoding
    container.appendChild(renderer.domElement)
    return renderer
}

export function createRoom(scene) {
    const roomGeo = new THREE.BoxGeometry(40, 50, 80)
    const roomMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8, side: THREE.BackSide })
    const room = new THREE.Mesh(roomGeo, roomMat)
    room.position.y = 10
    scene.add(room)
    return room
}

export function createTable(scene) {
    const tableGeo = new THREE.PlaneGeometry(45, 70)
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x2a1d15, roughness: 0.9, metalness: 0.1 })
    const table = new THREE.Mesh(tableGeo, tableMat)
    table.rotation.x = -Math.PI / 2
    table.position.y = -2.1
    table.receiveShadow = true
    scene.add(table)
    return table
}

export function createLights(scene) {
    const ambientLight = new THREE.HemisphereLight(0x111111, 0x000000, 0.6)
    scene.add(ambientLight)

    const spotLight = new THREE.SpotLight(0xffffff, 4)
    spotLight.position.set(3, 35, 0)
    spotLight.angle = Math.PI / 2.5
    spotLight.penumbra = 0.5
    spotLight.castShadow = true

    // Higher resolution shadow map for sharper shadows
    spotLight.shadow.mapSize.width = 2048
    spotLight.shadow.mapSize.height = 2048

    // Configure shadow camera for tighter bounds = better shadow quality
    spotLight.shadow.camera.near = 10
    spotLight.shadow.camera.far = 60

    // Prevent shadow acne and peter-panning
    spotLight.shadow.bias = -0.0005
    spotLight.shadow.normalBias = 0.02

    // Softer shadow edges
    spotLight.shadow.radius = 2

    scene.add(spotLight)

    return { ambientLight, spotLight }
}

export function createLamp(scene) {
    const lampGroup = new THREE.Group()
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.7 })

    const housing = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 2), lampMat)
    housing.castShadow = true
    lampGroup.add(housing)

    const lampFilterMat = new THREE.MeshBasicMaterial({ color: 0xffaa44 })
    const filter = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.5), lampFilterMat)
    filter.rotation.x = -Math.PI / 2
    filter.position.y = -0.76
    lampGroup.add(filter)

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), lampMat)
    pole.position.set(0, 2.75, 0)
    lampGroup.add(pole)

    lampGroup.position.set(-10, 3, -10)
    scene.add(lampGroup)

    return { lampGroup, lampFilterMat }
}
