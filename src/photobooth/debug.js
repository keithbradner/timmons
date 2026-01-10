/**
 * Debug Panel Module
 * Controls for fine-tuning filter presets
 */

import { filterSettings, presetValues } from './state.js'

let debugPresetName = 'classic'

export function toggleDebugPanel() {
    const panel = document.getElementById('debug-panel')
    if (panel) {
        panel.classList.toggle('hidden')
        if (!panel.classList.contains('hidden')) {
            selectDebugPreset()
        }
    }
}

export function selectDebugPreset() {
    const selector = document.getElementById('debug-preset-selector')
    if (!selector) return

    debugPresetName = selector.value
    const preset = presetValues[debugPresetName]

    if (preset) {
        const fields = ['contrast', 'brightness', 'shadows', 'highlights', 'grain', 'vignette', 'sepia', 'blur']
        fields.forEach(field => {
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

export function updateDebugValue(field) {
    const slider = document.getElementById(`debug-${field}`)
    const valueDisplay = document.getElementById(`debug-val-${field}`)
    if (slider && valueDisplay) {
        valueDisplay.textContent = slider.value
    }
}

export function applyDebugSettings(updatePreviewCallback) {
    const fields = ['contrast', 'brightness', 'shadows', 'highlights', 'grain', 'vignette', 'sepia', 'blur']
    fields.forEach(field => {
        const slider = document.getElementById(`debug-${field}`)
        if (slider) {
            filterSettings[field] = parseFloat(slider.value)
        }
    })

    updatePreviewCallback()
}

export function saveDebugPreset(applyPresetCallback, updatePreviewCallback) {
    const fields = ['contrast', 'brightness', 'shadows', 'highlights', 'grain', 'vignette', 'sepia', 'blur']
    const newValues = {}

    fields.forEach(field => {
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

export function applyPreset(presetName, updatePreviewCallback) {
    const preset = presetValues[presetName]
    if (preset) {
        Object.assign(filterSettings, preset)
        updatePreviewCallback()
    }
}
