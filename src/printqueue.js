/**
 * Print Queue Management Interface
 * For front desk staff to manage photobooth print jobs
 */

let currentJobId = null
let autoRefreshInterval = null

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    refreshQueue()
    toggleAutoRefresh()

    // Expose functions globally
    window.refreshQueue = refreshQueue
    window.clearCompleted = clearCompleted
    window.toggleAutoRefresh = toggleAutoRefresh
    window.closePreview = closePreview
    window.printImage = printImage
    window.markCompleted = markCompleted
    window.cancelJob = cancelJob
})

async function refreshQueue() {
    try {
        const response = await fetch('/api/print-queue')
        const data = await response.json()

        updateStats(data)
        renderQueue(data.items)
    } catch (error) {
        console.error('Failed to refresh queue:', error)
    }
}

function updateStats(data) {
    document.getElementById('pending-count').textContent = data.pending
    document.getElementById('total-count').textContent = data.total
}

function renderQueue(items) {
    const container = document.getElementById('queue-list')

    if (items.length === 0) {
        container.innerHTML = `
            <div class="queue-empty">
                <p>No print jobs in queue</p>
                <p class="hint">Photos sent from the Photobooth will appear here</p>
            </div>
        `
        return
    }

    container.innerHTML = items.map(item => `
        <div class="queue-item ${item.status}" onclick="openPreview('${item.id}')" data-id="${item.id}">
            <div class="queue-item-preview">
                ${item.image ? `<img src="${item.image}" alt="Photo preview">` : '<span>No preview</span>'}
            </div>
            <div class="queue-item-info">
                <span class="queue-item-status">${item.status}</span>
                <div class="queue-item-id">ID: ${item.id}</div>
                <div class="queue-item-time">${formatTime(item.createdAt)}</div>
            </div>
        </div>
    `).join('')
}

function formatTime(isoString) {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    })
}

async function openPreview(jobId) {
    currentJobId = jobId

    try {
        const response = await fetch(`/api/print-queue/${jobId}`)
        const job = await response.json()

        document.getElementById('preview-image').src = job.image || ''
        document.getElementById('preview-job-id').textContent = job.id
        document.getElementById('preview-time').textContent = formatTime(job.createdAt)

        document.getElementById('preview-modal').classList.remove('hidden')
    } catch (error) {
        console.error('Failed to load job:', error)
    }
}

function closePreview() {
    document.getElementById('preview-modal').classList.add('hidden')
    currentJobId = null
}

function printImage() {
    const img = document.getElementById('preview-image')
    if (!img.src) return

    // Open print dialog with just the image
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Photo</title>
            <style>
                body {
                    margin: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    background: #fff;
                }
                img {
                    max-width: 100%;
                    max-height: 100vh;
                    object-fit: contain;
                }
                @media print {
                    body { margin: 0; }
                    img { max-height: none; width: 100%; }
                }
            </style>
        </head>
        <body>
            <img src="${img.src}" onload="window.print(); setTimeout(() => window.close(), 500);">
        </body>
        </html>
    `)
    printWindow.document.close()
}

async function markCompleted() {
    if (!currentJobId) return

    try {
        await fetch(`/api/print-queue/${currentJobId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
        })

        closePreview()
        refreshQueue()
    } catch (error) {
        console.error('Failed to mark as completed:', error)
    }
}

async function cancelJob() {
    if (!currentJobId) return

    if (!confirm('Are you sure you want to cancel this print job?')) return

    try {
        await fetch(`/api/print-queue/${currentJobId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
        })

        closePreview()
        refreshQueue()
    } catch (error) {
        console.error('Failed to cancel job:', error)
    }
}

async function clearCompleted() {
    try {
        await fetch('/api/print-queue/clear-completed', { method: 'POST' })
        refreshQueue()
    } catch (error) {
        console.error('Failed to clear completed:', error)
    }
}

function toggleAutoRefresh() {
    const checkbox = document.getElementById('auto-refresh')

    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval)
        autoRefreshInterval = null
    }

    if (checkbox.checked) {
        autoRefreshInterval = setInterval(refreshQueue, 10000) // 10 seconds
    }
}

// Handle escape key to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePreview()
    }
})

// Handle click outside modal to close
document.getElementById('preview-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'preview-modal') {
        closePreview()
    }
})
