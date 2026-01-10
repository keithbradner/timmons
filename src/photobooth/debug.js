/**
 * Debug Panel Module
 * Controls for fine-tuning filter presets
 */

import { filterSettings, presetValues, baseValues } from './state.js'

let debugPresetName = 'classic'
let updatePreviewFn = null  // Store reference for live updates

// Neutral values - essentially no effect
const neutralValues = {
    backgroundDim: 0,
    lightBoost: 0,
    contrast: 1.0,
    brightness: 1.0,
    shadows: 0,
    highlights: 0,
    grain: 0,
    vignette: 0,
    sepia: 0,
    blur: 0
}

// Default values for the classic look
const defaultValues = {
    backgroundDim: 1.0,
    lightBoost: 0.6,
    contrast: 1.6,
    brightness: 0.95,
    shadows: 35,
    highlights: 20,
    grain: 24,
    vignette: 40,
    sepia: 14,
    blur: 0.6
}

// All adjustable fields
const allFields = ['backgroundDim', 'lightBoost', 'contrast', 'brightness', 'shadows', 'highlights', 'grain', 'vignette', 'sepia', 'blur']

export function toggleDebugPanel() {
    const panel = document.getElementById('debug-panel')
    if (panel) {
        panel.classList.toggle('hidden')
        if (!panel.classList.contains('hidden')) {
            // Sync sliders with current filter settings
            syncSlidersToCurrentSettings()
        }
    }
}

// Sync debug sliders to current filterSettings values
function syncSlidersToCurrentSettings() {
    allFields.forEach(field => {
        const slider = document.getElementById(`debug-${field}`)
        const valueDisplay = document.getElementById(`debug-val-${field}`)
        if (slider && filterSettings[field] !== undefined) {
            slider.value = filterSettings[field]
            if (valueDisplay) {
                valueDisplay.textContent = filterSettings[field]
            }
        }
    })
}

export function selectDebugPreset() {
    const selector = document.getElementById('debug-preset-selector')
    if (!selector) return

    debugPresetName = selector.value
    const preset = presetValues[debugPresetName]

    if (preset) {
        allFields.forEach(field => {
            const slider = document.getElementById(`debug-${field}`)
            const valueDisplay = document.getElementById(`debug-val-${field}`)
            if (slider && preset[field] !== undefined) {
                slider.value = preset[field]
                if (valueDisplay) {
                    valueDisplay.textContent = preset[field]
                }
            }
        })
    }
}

export async function updateDebugValue(field) {
    const slider = document.getElementById(`debug-${field}`)
    const valueDisplay = document.getElementById(`debug-val-${field}`)
    if (slider && valueDisplay) {
        valueDisplay.textContent = slider.value
        // Apply immediately
        filterSettings[field] = parseFloat(slider.value)
        if (updatePreviewFn) {
            await updatePreviewFn()
        }
    }
}

export async function applyDebugSettings(updatePreviewCallback) {
    // Store reference for live updates
    updatePreviewFn = updatePreviewCallback

    allFields.forEach(field => {
        const slider = document.getElementById(`debug-${field}`)
        if (slider) {
            filterSettings[field] = parseFloat(slider.value)
        }
    })

    await updatePreviewCallback()
}

// Set the update preview callback (called when debug panel opens)
export function setUpdatePreviewCallback(callback) {
    updatePreviewFn = callback
}

// Reset sliders to default values
export async function resetToDefault() {
    allFields.forEach(field => {
        const slider = document.getElementById(`debug-${field}`)
        const valueDisplay = document.getElementById(`debug-val-${field}`)
        if (slider && defaultValues[field] !== undefined) {
            slider.value = defaultValues[field]
            if (valueDisplay) {
                valueDisplay.textContent = defaultValues[field]
            }
            filterSettings[field] = defaultValues[field]
        }
    })

    if (updatePreviewFn) {
        await updatePreviewFn()
    }
}

// Set all effects to neutral (no change)
export async function setToNeutral() {
    allFields.forEach(field => {
        const slider = document.getElementById(`debug-${field}`)
        const valueDisplay = document.getElementById(`debug-val-${field}`)
        if (slider && neutralValues[field] !== undefined) {
            slider.value = neutralValues[field]
            if (valueDisplay) {
                valueDisplay.textContent = neutralValues[field]
            }
            filterSettings[field] = neutralValues[field]
        }
    })

    if (updatePreviewFn) {
        await updatePreviewFn()
    }
}

export function saveDebugPreset(applyPresetCallback, updatePreviewCallback) {
    const newValues = {}

    allFields.forEach(field => {
        const slider = document.getElementById(`debug-${field}`)
        if (slider) {
            newValues[field] = parseFloat(slider.value)
        }
    })

    presetValues[debugPresetName] = newValues
    console.log(`Saved preset '${debugPresetName}':`, newValues)

    applyPresetCallback(debugPresetName)
    exportPresets()
}

export function exportPresets() {
    const exportText = document.getElementById('debug-export-text')
    if (exportText) {
        const output = JSON.stringify(presetValues, null, 2)
        exportText.value = output
        console.log('Preset Export:\n', output)
    }
}

export async function applyPreset(presetName, updatePreviewCallback) {
    const preset = presetValues[presetName]
    if (preset) {
        Object.assign(filterSettings, preset)
        await updatePreviewCallback()
    }
}
