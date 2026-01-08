import * as THREE from 'three'

const photoData = [
    { src: 'images/photo1.jpg', devRate: 0.0006, idealTime: 1.0 },
    { src: 'images/photo2.jpg', devRate: 0.0012, idealTime: 0.85 },
    { src: 'images/photo3.jpg', devRate: 0.0004, idealTime: 1.15 },
    { src: 'images/photo4.jpg', devRate: 0.0010, idealTime: 0.9 },
    { src: 'images/photo5.jpg', devRate: 0.0005, idealTime: 1.1 }
]

export function createSheets(scene) {
    const loader = new THREE.TextureLoader()
    const sheets = []
    const paperW = 5
    const paperH = 6

    for (let i = 0; i < 5; i++) {
        const sheetGroup = new THREE.Group()

        const paperGeo = new THREE.BoxGeometry(paperW, 0.02, paperH)
        const paperMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.9 })
        const paper = new THREE.Mesh(paperGeo, paperMat)
        paper.castShadow = true
        paper.receiveShadow = true
        sheetGroup.add(paper)

        const tex = loader.load(photoData[i].src)
        tex.encoding = THREE.sRGBEncoding
        const photoMat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0,
            color: 0xffffff,
            polygonOffset: true,
            polygonOffsetFactor: -2
        })
        const photoGeo = new THREE.PlaneGeometry(paperW - 0.2, paperH - 0.2)
        const photo = new THREE.Mesh(photoGeo, photoMat)
        photo.rotation.x = -Math.PI / 2
        photo.position.y = 0.02
        sheetGroup.add(photo)

        const sheetObj = {
            group: sheetGroup,
            photoMat: photoMat,
            targetPos: new THREE.Vector3((Math.random() - 0.5) * 0.5, 5 - (i * 0.1), -20),
            targetRot: new THREE.Vector3(0, 0, 0),
            developed: 0,
            devRate: photoData[i].devRate,
            idealTime: photoData[i].idealTime
        }

        sheetGroup.position.copy(sheetObj.targetPos)
        sheets.push(sheetObj)
        scene.add(sheetGroup)
    }

    return sheets
}
