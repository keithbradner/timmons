import * as THREE from 'three'

// Photo data with actual aspect ratios from the images
const photoData = [
    { src: '/images/photo1.jpg', width: 509, height: 640, devRate: 0.0012, idealTime: 1.0 },
    { src: '/images/photo2.jpg', width: 450, height: 640, devRate: 0.0018, idealTime: 0.85 },
    { src: '/images/photo3.jpg', width: 509, height: 640, devRate: 0.0010, idealTime: 1.1 },
    { src: '/images/photo4.jpg', width: 461, height: 640, devRate: 0.0014, idealTime: 0.9 },
    { src: '/images/photo5.jpg', width: 430, height: 640, devRate: 0.0011, idealTime: 1.05 }
]

export function createSheets(scene) {
    const loader = new THREE.TextureLoader()
    const sheets = []
    const baseHeight = 6 // Standard height for all sheets
    const border = 0.2 // Border around the photo

    for (let i = 0; i < photoData.length; i++) {
        const sheetGroup = new THREE.Group()
        const data = photoData[i]

        // Calculate width based on actual aspect ratio
        const aspectRatio = data.width / data.height
        const paperH = baseHeight
        const paperW = paperH * aspectRatio

        const paperGeo = new THREE.BoxGeometry(paperW, 0.02, paperH)
        const paperMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.9 })
        const paper = new THREE.Mesh(paperGeo, paperMat)
        paper.castShadow = true
        paper.receiveShadow = true
        sheetGroup.add(paper)

        const tex = loader.load(data.src)
        tex.encoding = THREE.sRGBEncoding
        const photoMat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0,
            color: 0xffffff,
            polygonOffset: true,
            polygonOffsetFactor: -2
        })
        const photoGeo = new THREE.PlaneGeometry(paperW - border, paperH - border)
        const photo = new THREE.Mesh(photoGeo, photoMat)
        photo.rotation.x = -Math.PI / 2
        photo.position.y = 0.02
        sheetGroup.add(photo)

        // Arrange in two rows: top row of 3, bottom row of 2
        let initX, initZ
        if (i < 3) {
            // Top row: 3 images
            initX = (i - 1) * 4  // -4, 0, 4
            initZ = -22
        } else {
            // Bottom row: 2 images
            initX = (i - 3.5) * 4  // -2, 2
            initZ = -17
        }

        const sheetObj = {
            group: sheetGroup,
            photoMat: photoMat,
            targetPos: new THREE.Vector3(initX, 8, initZ),
            targetRot: new THREE.Vector3(0, 0, 0),
            developed: 0,
            devRate: data.devRate,
            idealTime: data.idealTime
        }

        sheetGroup.position.copy(sheetObj.targetPos)
        sheets.push(sheetObj)
        scene.add(sheetGroup)
    }

    return sheets
}
