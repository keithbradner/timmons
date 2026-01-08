import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()

export function loadModel(url) {
    return new Promise((resolve, reject) => {
        loader.load(
            url,
            (gltf) => resolve(gltf),
            (progress) => {
                console.log(`Loading: ${(progress.loaded / progress.total * 100).toFixed(1)}%`)
            },
            (error) => reject(error)
        )
    })
}

export async function loadLamp(scene, fallbackCreate) {
    try {
        const gltf = await loadModel('/models/lamp.glb')
        const lamp = gltf.scene
        lamp.position.set(-10, -2, -10)
        lamp.scale.set(2, 2, 2)

        // Find and store the emissive material for animation
        let lampFilterMat = null
        lamp.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true
                child.receiveShadow = true
                // Look for emissive/light material
                if (child.material && child.material.emissive) {
                    lampFilterMat = child.material
                }
            }
        })

        scene.add(lamp)
        return { lampGroup: lamp, lampFilterMat: lampFilterMat || new THREE.MeshBasicMaterial({ color: 0xffaa44 }) }
    } catch (error) {
        console.log('Lamp model not found, using fallback primitives')
        return fallbackCreate(scene)
    }
}
