/**
 * WebGPU Image Upscaler
 * High-quality bicubic upscaling using GPU compute shaders
 */

let device = null
let upscalePipeline = null

/**
 * Initialize WebGPU for upscaling
 */
export async function initUpscaleGPU() {
    if (device) return true

    if (!navigator.gpu) {
        console.warn('WebGPU not supported for upscaling')
        return false
    }

    try {
        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter) return false

        device = await adapter.requestDevice()

        // Create compute shader for bicubic upscaling
        const shaderModule = device.createShaderModule({
            code: upscaleShaderCode
        })

        upscalePipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            }
        })

        console.log('WebGPU upscaler initialized')
        return true
    } catch (e) {
        console.error('Failed to init WebGPU upscaler:', e)
        return false
    }
}

/**
 * Upscale an image using WebGPU bicubic interpolation
 * @param {ImageData} imageData - Source image
 * @param {number} scale - Scale factor (e.g., 2 for 2x)
 * @returns {Promise<ImageData>} - Upscaled image
 */
export async function upscaleImageGPU(imageData, scale = 2) {
    if (!device || !upscalePipeline) {
        const initialized = await initUpscaleGPU()
        if (!initialized) {
            return upscaleCPU(imageData, scale)
        }
    }

    const srcWidth = imageData.width
    const srcHeight = imageData.height
    const dstWidth = Math.round(srcWidth * scale)
    const dstHeight = Math.round(srcHeight * scale)

    // Create input buffer
    const inputData = new Float32Array(srcWidth * srcHeight * 4)
    for (let i = 0; i < srcWidth * srcHeight; i++) {
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
    const outputData = new Float32Array(dstWidth * dstHeight * 4)
    const outputBuffer = device.createBuffer({
        size: outputData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    })

    // Create uniforms
    const uniforms = new Float32Array([srcWidth, srcHeight, dstWidth, dstHeight])
    const uniformBuffer = device.createBuffer({
        size: uniforms.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(uniformBuffer, 0, uniforms)

    // Create bind group
    const bindGroup = device.createBindGroup({
        layout: upscalePipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: inputBuffer } },
            { binding: 1, resource: { buffer: outputBuffer } },
            { binding: 2, resource: { buffer: uniformBuffer } }
        ]
    })

    // Run compute shader
    const commandEncoder = device.createCommandEncoder()
    const passEncoder = commandEncoder.beginComputePass()
    passEncoder.setPipeline(upscalePipeline)
    passEncoder.setBindGroup(0, bindGroup)
    passEncoder.dispatchWorkgroups(
        Math.ceil(dstWidth / 8),
        Math.ceil(dstHeight / 8)
    )
    passEncoder.end()

    // Read back results
    const readBuffer = device.createBuffer({
        size: outputData.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })
    commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, outputData.byteLength)

    device.queue.submit([commandEncoder.finish()])

    await readBuffer.mapAsync(GPUMapMode.READ)
    const resultData = new Float32Array(readBuffer.getMappedRange())

    // Convert back to ImageData
    const result = new ImageData(dstWidth, dstHeight)
    for (let i = 0; i < dstWidth * dstHeight; i++) {
        result.data[i * 4] = Math.round(resultData[i * 4] * 255)
        result.data[i * 4 + 1] = Math.round(resultData[i * 4 + 1] * 255)
        result.data[i * 4 + 2] = Math.round(resultData[i * 4 + 2] * 255)
        result.data[i * 4 + 3] = Math.round(resultData[i * 4 + 3] * 255)
    }

    readBuffer.unmap()

    // Clean up
    inputBuffer.destroy()
    outputBuffer.destroy()
    uniformBuffer.destroy()
    readBuffer.destroy()

    console.log(`Upscaled: ${srcWidth}x${srcHeight} -> ${dstWidth}x${dstHeight}`)
    return result
}

/**
 * Upscale a mask using WebGPU
 */
export async function upscaleMaskGPU(mask, srcWidth, srcHeight, scale = 2) {
    if (!device) {
        return upscaleMaskCPU(mask, srcWidth, srcHeight, scale)
    }

    const dstWidth = Math.round(srcWidth * scale)
    const dstHeight = Math.round(srcHeight * scale)

    // Simple bilinear upscale for mask (doesn't need bicubic)
    const result = new Float32Array(dstWidth * dstHeight)

    for (let y = 0; y < dstHeight; y++) {
        for (let x = 0; x < dstWidth; x++) {
            const srcX = (x / dstWidth) * srcWidth
            const srcY = (y / dstHeight) * srcHeight

            const x0 = Math.floor(srcX)
            const y0 = Math.floor(srcY)
            const x1 = Math.min(x0 + 1, srcWidth - 1)
            const y1 = Math.min(y0 + 1, srcHeight - 1)

            const fx = srcX - x0
            const fy = srcY - y0

            const v00 = mask[y0 * srcWidth + x0]
            const v10 = mask[y0 * srcWidth + x1]
            const v01 = mask[y1 * srcWidth + x0]
            const v11 = mask[y1 * srcWidth + x1]

            const v = v00 * (1 - fx) * (1 - fy) +
                      v10 * fx * (1 - fy) +
                      v01 * (1 - fx) * fy +
                      v11 * fx * fy

            result[y * dstWidth + x] = v
        }
    }

    return result
}

/**
 * CPU fallback for upscaling
 */
function upscaleCPU(imageData, scale) {
    const srcWidth = imageData.width
    const srcHeight = imageData.height
    const dstWidth = Math.round(srcWidth * scale)
    const dstHeight = Math.round(srcHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = dstWidth
    canvas.height = dstHeight
    const ctx = canvas.getContext('2d')

    // Use browser's built-in high-quality scaling
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = srcWidth
    srcCanvas.height = srcHeight
    const srcCtx = srcCanvas.getContext('2d')
    srcCtx.putImageData(imageData, 0, 0)

    ctx.drawImage(srcCanvas, 0, 0, dstWidth, dstHeight)

    console.log(`CPU upscaled: ${srcWidth}x${srcHeight} -> ${dstWidth}x${dstHeight}`)
    return ctx.getImageData(0, 0, dstWidth, dstHeight)
}

/**
 * CPU fallback for mask upscaling
 */
function upscaleMaskCPU(mask, srcWidth, srcHeight, scale) {
    const dstWidth = Math.round(srcWidth * scale)
    const dstHeight = Math.round(srcHeight * scale)
    const result = new Float32Array(dstWidth * dstHeight)

    for (let y = 0; y < dstHeight; y++) {
        for (let x = 0; x < dstWidth; x++) {
            const srcX = (x / dstWidth) * srcWidth
            const srcY = (y / dstHeight) * srcHeight

            const x0 = Math.floor(srcX)
            const y0 = Math.floor(srcY)
            const x1 = Math.min(x0 + 1, srcWidth - 1)
            const y1 = Math.min(y0 + 1, srcHeight - 1)

            const fx = srcX - x0
            const fy = srcY - y0

            const v00 = mask[y0 * srcWidth + x0]
            const v10 = mask[y0 * srcWidth + x1]
            const v01 = mask[y1 * srcWidth + x0]
            const v11 = mask[y1 * srcWidth + x1]

            result[y * dstWidth + x] = v00 * (1 - fx) * (1 - fy) +
                                       v10 * fx * (1 - fy) +
                                       v01 * (1 - fx) * fy +
                                       v11 * fx * fy
        }
    }

    return result
}

/**
 * Calculate optimal scale factor to reach target resolution
 */
export function calculateScale(width, height, targetMinDimension = 1600) {
    const minDim = Math.min(width, height)
    if (minDim >= targetMinDimension) {
        return 1 // Already big enough
    }
    return targetMinDimension / minDim
}

// WebGPU shader for bicubic upscaling
const upscaleShaderCode = `
struct Uniforms {
    srcWidth: f32,
    srcHeight: f32,
    dstWidth: f32,
    dstHeight: f32,
}

@group(0) @binding(0) var<storage, read> input: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> output: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

// Cubic interpolation kernel (Catmull-Rom)
fn cubic(t: f32) -> vec4<f32> {
    let t2 = t * t;
    let t3 = t2 * t;

    let w0 = -0.5 * t3 + t2 - 0.5 * t;
    let w1 = 1.5 * t3 - 2.5 * t2 + 1.0;
    let w2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
    let w3 = 0.5 * t3 - 0.5 * t2;

    return vec4<f32>(w0, w1, w2, w3);
}

fn sampleInput(x: i32, y: i32) -> vec4<f32> {
    let cx = clamp(x, 0, i32(uniforms.srcWidth) - 1);
    let cy = clamp(y, 0, i32(uniforms.srcHeight) - 1);
    return input[cy * i32(uniforms.srcWidth) + cx];
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dstX = global_id.x;
    let dstY = global_id.y;

    if (dstX >= u32(uniforms.dstWidth) || dstY >= u32(uniforms.dstHeight)) {
        return;
    }

    // Map destination pixel to source coordinates
    let srcX = (f32(dstX) + 0.5) * uniforms.srcWidth / uniforms.dstWidth - 0.5;
    let srcY = (f32(dstY) + 0.5) * uniforms.srcHeight / uniforms.dstHeight - 0.5;

    let ix = i32(floor(srcX));
    let iy = i32(floor(srcY));
    let fx = srcX - f32(ix);
    let fy = srcY - f32(iy);

    // Get cubic weights
    let wx = cubic(fx);
    let wy = cubic(fy);

    // Sample 4x4 neighborhood and apply bicubic filter
    var result = vec4<f32>(0.0);

    for (var j = -1; j <= 2; j++) {
        let weightY = select(select(select(wy.w, wy.z, j == 1), wy.y, j == 0), wy.x, j == -1);
        for (var i = -1; i <= 2; i++) {
            let weightX = select(select(select(wx.w, wx.z, i == 1), wx.y, i == 0), wx.x, i == -1);
            let sample = sampleInput(ix + i, iy + j);
            result = result + sample * weightX * weightY;
        }
    }

    // Clamp result
    result = clamp(result, vec4<f32>(0.0), vec4<f32>(1.0));

    let dstIdx = dstY * u32(uniforms.dstWidth) + dstX;
    output[dstIdx] = result;
}
`
