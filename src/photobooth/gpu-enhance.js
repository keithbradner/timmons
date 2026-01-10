/**
 * Smart Auto-Enhancement using WebGPU
 * Applies automatic image improvements:
 * - Auto white balance / color correction
 * - Adaptive local contrast
 * - Skin smoothing (using segmentation mask)
 * - Detail sharpening
 */

let device = null
let enhancePipeline = null
let initialized = false

/**
 * Initialize WebGPU for enhancement
 */
export async function initEnhanceGPU(existingDevice = null) {
    if (initialized) return true

    if (existingDevice) {
        device = existingDevice
    } else {
        if (!navigator.gpu) {
            console.warn('WebGPU not supported for enhancement')
            return false
        }

        try {
            const adapter = await navigator.gpu.requestAdapter()
            if (!adapter) return false
            device = await adapter.requestDevice()
        } catch (e) {
            console.error('Failed to init WebGPU for enhancement:', e)
            return false
        }
    }

    try {
        const shaderModule = device.createShaderModule({
            code: enhanceShaderCode
        })

        enhancePipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            }
        })

        initialized = true
        console.log('WebGPU enhancement initialized')
        return true
    } catch (e) {
        console.error('Failed to create enhancement pipeline:', e)
        return false
    }
}

/**
 * Apply smart auto-enhancement to an image
 * @param {ImageData} imageData - Source image
 * @param {Float32Array} mask - Segmentation mask (optional, for skin smoothing)
 * @param {Object} settings - Enhancement settings
 * @returns {Promise<ImageData>} - Enhanced image
 */
export async function applyEnhancement(imageData, mask, settings = {}) {
    const {
        autoWhiteBalance = 0.5,   // 0-1 strength
        localContrast = 0.4,      // 0-1 strength
        skinSmoothing = 0.3,      // 0-1 strength
        detailSharpening = 0.3    // 0-1 strength
    } = settings

    if (!initialized) {
        const success = await initEnhanceGPU()
        if (!success) {
            return applyEnhancementCPU(imageData, mask, settings)
        }
    }

    const width = imageData.width
    const height = imageData.height
    const pixelCount = width * height

    // Calculate image statistics for auto white balance
    let sumR = 0, sumG = 0, sumB = 0
    for (let i = 0; i < pixelCount; i++) {
        sumR += imageData.data[i * 4]
        sumG += imageData.data[i * 4 + 1]
        sumB += imageData.data[i * 4 + 2]
    }
    const avgR = sumR / pixelCount
    const avgG = sumG / pixelCount
    const avgB = sumB / pixelCount
    const avgGray = (avgR + avgG + avgB) / 3

    // Gray world white balance multipliers
    const wbR = avgGray / Math.max(avgR, 1)
    const wbG = avgGray / Math.max(avgG, 1)
    const wbB = avgGray / Math.max(avgB, 1)

    // Create input buffer
    const inputData = new Float32Array(pixelCount * 4)
    for (let i = 0; i < pixelCount; i++) {
        inputData[i * 4] = imageData.data[i * 4] / 255
        inputData[i * 4 + 1] = imageData.data[i * 4 + 1] / 255
        inputData[i * 4 + 2] = imageData.data[i * 4 + 2] / 255
        inputData[i * 4 + 3] = imageData.data[i * 4 + 3] / 255
    }

    const inputBuffer = device.createBuffer({
        size: inputData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(inputBuffer, 0, inputData)

    // Create output buffer
    const outputBuffer = device.createBuffer({
        size: inputData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    })

    // Create mask buffer
    let maskData
    if (mask && mask.length === pixelCount) {
        maskData = mask
    } else {
        maskData = new Float32Array(pixelCount).fill(1)
    }
    const maskBuffer = device.createBuffer({
        size: maskData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(maskBuffer, 0, maskData)

    // Create uniforms
    const uniforms = new Float32Array([
        width,
        height,
        autoWhiteBalance,
        localContrast,
        skinSmoothing,
        detailSharpening,
        wbR, wbG, wbB,
        0 // padding
    ])
    const uniformBuffer = device.createBuffer({
        size: uniforms.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(uniformBuffer, 0, uniforms)

    // Create bind group
    const bindGroup = device.createBindGroup({
        layout: enhancePipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: inputBuffer } },
            { binding: 1, resource: { buffer: outputBuffer } },
            { binding: 2, resource: { buffer: maskBuffer } },
            { binding: 3, resource: { buffer: uniformBuffer } }
        ]
    })

    // Run compute shader
    const commandEncoder = device.createCommandEncoder()
    const passEncoder = commandEncoder.beginComputePass()
    passEncoder.setPipeline(enhancePipeline)
    passEncoder.setBindGroup(0, bindGroup)
    passEncoder.dispatchWorkgroups(
        Math.ceil(width / 8),
        Math.ceil(height / 8)
    )
    passEncoder.end()

    // Read back results
    const readBuffer = device.createBuffer({
        size: inputData.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })
    commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, inputData.byteLength)

    device.queue.submit([commandEncoder.finish()])

    await readBuffer.mapAsync(GPUMapMode.READ)
    const resultData = new Float32Array(readBuffer.getMappedRange().slice(0))
    readBuffer.unmap()

    // Convert back to ImageData
    const result = new ImageData(width, height)
    for (let i = 0; i < pixelCount; i++) {
        result.data[i * 4] = Math.round(Math.min(255, Math.max(0, resultData[i * 4] * 255)))
        result.data[i * 4 + 1] = Math.round(Math.min(255, Math.max(0, resultData[i * 4 + 1] * 255)))
        result.data[i * 4 + 2] = Math.round(Math.min(255, Math.max(0, resultData[i * 4 + 2] * 255)))
        result.data[i * 4 + 3] = Math.round(resultData[i * 4 + 3] * 255)
    }

    // Cleanup
    inputBuffer.destroy()
    outputBuffer.destroy()
    maskBuffer.destroy()
    uniformBuffer.destroy()
    readBuffer.destroy()

    return result
}

/**
 * CPU fallback for enhancement
 */
function applyEnhancementCPU(imageData, mask, settings) {
    const {
        autoWhiteBalance = 0.5,
        localContrast = 0.4,
        skinSmoothing = 0.3,
        detailSharpening = 0.3
    } = settings

    const width = imageData.width
    const height = imageData.height
    const pixels = new Uint8ClampedArray(imageData.data)
    const pixelCount = width * height

    // Calculate white balance
    let sumR = 0, sumG = 0, sumB = 0
    for (let i = 0; i < pixelCount; i++) {
        sumR += pixels[i * 4]
        sumG += pixels[i * 4 + 1]
        sumB += pixels[i * 4 + 2]
    }
    const avgR = sumR / pixelCount
    const avgG = sumG / pixelCount
    const avgB = sumB / pixelCount
    const avgGray = (avgR + avgG + avgB) / 3

    const wbR = avgGray / Math.max(avgR, 1)
    const wbG = avgGray / Math.max(avgG, 1)
    const wbB = avgGray / Math.max(avgB, 1)

    // Apply effects
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x
            const idx = i * 4

            let r = pixels[idx] / 255
            let g = pixels[idx + 1] / 255
            let b = pixels[idx + 2] / 255

            // Auto white balance
            if (autoWhiteBalance > 0) {
                const newR = r * (1 + (wbR - 1) * autoWhiteBalance)
                const newG = g * (1 + (wbG - 1) * autoWhiteBalance)
                const newB = b * (1 + (wbB - 1) * autoWhiteBalance)
                r = newR
                g = newG
                b = newB
            }

            // Simple local contrast (approximate)
            if (localContrast > 0) {
                const lum = 0.299 * r + 0.587 * g + 0.114 * b
                const boost = 1.0 + localContrast * 0.5
                r = lum + (r - lum) * boost
                g = lum + (g - lum) * boost
                b = lum + (b - lum) * boost
            }

            // Clamp
            r = Math.min(1, Math.max(0, r))
            g = Math.min(1, Math.max(0, g))
            b = Math.min(1, Math.max(0, b))

            pixels[idx] = Math.round(r * 255)
            pixels[idx + 1] = Math.round(g * 255)
            pixels[idx + 2] = Math.round(b * 255)
        }
    }

    return new ImageData(pixels, width, height)
}

// WebGPU shader for enhancement
const enhanceShaderCode = `
struct Uniforms {
    width: f32,
    height: f32,
    autoWhiteBalance: f32,
    localContrast: f32,
    skinSmoothing: f32,
    detailSharpening: f32,
    wbR: f32,
    wbG: f32,
    wbB: f32,
    padding: f32,
}

@group(0) @binding(0) var<storage, read> input: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> output: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mask: array<f32>;
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

fn getPixel(x: i32, y: i32) -> vec4<f32> {
    let cx = clamp(x, 0, i32(uniforms.width) - 1);
    let cy = clamp(y, 0, i32(uniforms.height) - 1);
    return input[cy * i32(uniforms.width) + cx];
}

fn getMask(x: i32, y: i32) -> f32 {
    let cx = clamp(x, 0, i32(uniforms.width) - 1);
    let cy = clamp(y, 0, i32(uniforms.height) - 1);
    return mask[cy * i32(uniforms.width) + cx];
}

fn luminance(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(0.299, 0.587, 0.114));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = i32(global_id.x);
    let y = i32(global_id.y);

    if (x >= i32(uniforms.width) || y >= i32(uniforms.height)) {
        return;
    }

    let idx = y * i32(uniforms.width) + x;
    var pixel = input[idx];
    let maskVal = mask[idx];

    // ===== AUTO WHITE BALANCE =====
    if (uniforms.autoWhiteBalance > 0.0) {
        let wbStrength = uniforms.autoWhiteBalance;
        pixel.r = pixel.r * (1.0 + (uniforms.wbR - 1.0) * wbStrength);
        pixel.g = pixel.g * (1.0 + (uniforms.wbG - 1.0) * wbStrength);
        pixel.b = pixel.b * (1.0 + (uniforms.wbB - 1.0) * wbStrength);
    }

    // ===== ADAPTIVE LOCAL CONTRAST =====
    if (uniforms.localContrast > 0.0) {
        // Sample neighborhood for local average
        var localSum = vec3<f32>(0.0);
        let radius = 2;
        var count = 0.0;
        for (var dy = -radius; dy <= radius; dy++) {
            for (var dx = -radius; dx <= radius; dx++) {
                let neighbor = getPixel(x + dx, y + dy);
                localSum += neighbor.rgb;
                count += 1.0;
            }
        }
        let localAvg = localSum / count;

        // Enhance difference from local average
        let diff = pixel.rgb - localAvg;
        let boost = 1.0 + uniforms.localContrast * 0.8;
        pixel.r = localAvg.r + diff.r * boost;
        pixel.g = localAvg.g + diff.g * boost;
        pixel.b = localAvg.b + diff.b * boost;
    }

    // ===== SKIN SMOOTHING (on masked areas) =====
    if (uniforms.skinSmoothing > 0.0 && maskVal > 0.3) {
        // Bilateral-like smoothing
        var smoothSum = vec3<f32>(0.0);
        var weightSum = 0.0;
        let radius = 3;
        let centerLum = luminance(pixel.rgb);

        for (var dy = -radius; dy <= radius; dy++) {
            for (var dx = -radius; dx <= radius; dx++) {
                let neighbor = getPixel(x + dx, y + dy);
                let neighborMask = getMask(x + dx, y + dy);
                let neighborLum = luminance(neighbor.rgb);

                // Spatial weight
                let spatialDist = f32(dx * dx + dy * dy);
                let spatialWeight = exp(-spatialDist / 8.0);

                // Range weight (preserve edges)
                let lumDiff = abs(centerLum - neighborLum);
                let rangeWeight = exp(-lumDiff * lumDiff * 50.0);

                // Mask weight (only smooth skin areas)
                let maskWeight = neighborMask;

                let weight = spatialWeight * rangeWeight * maskWeight;
                smoothSum += neighbor.rgb * weight;
                weightSum += weight;
            }
        }

        if (weightSum > 0.0) {
            let smoothed = smoothSum / weightSum;
            let smoothStrength = uniforms.skinSmoothing * maskVal;
            pixel.r = mix(pixel.r, smoothed.r, smoothStrength);
            pixel.g = mix(pixel.g, smoothed.g, smoothStrength);
            pixel.b = mix(pixel.b, smoothed.b, smoothStrength);
        }
    }

    // ===== DETAIL SHARPENING =====
    if (uniforms.detailSharpening > 0.0) {
        // Unsharp mask
        var blurSum = vec3<f32>(0.0);
        let radius = 1;
        var count = 0.0;
        for (var dy = -radius; dy <= radius; dy++) {
            for (var dx = -radius; dx <= radius; dx++) {
                blurSum += getPixel(x + dx, y + dy).rgb;
                count += 1.0;
            }
        }
        let blurred = blurSum / count;

        // Sharpen = original + (original - blurred) * amount
        let detail = pixel.rgb - blurred;
        let sharpAmount = uniforms.detailSharpening * 1.5;

        // Apply less sharpening on skin areas to avoid enhancing pores
        let skinFactor = 1.0 - maskVal * 0.7;
        pixel.r = pixel.r + detail.r * sharpAmount * skinFactor;
        pixel.g = pixel.g + detail.g * sharpAmount * skinFactor;
        pixel.b = pixel.b + detail.b * sharpAmount * skinFactor;
    }

    // Clamp output
    pixel.r = clamp(pixel.r, 0.0, 1.0);
    pixel.g = clamp(pixel.g, 0.0, 1.0);
    pixel.b = clamp(pixel.b, 0.0, 1.0);

    output[idx] = pixel;
}
`
