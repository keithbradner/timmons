// PDF.js viewer module - continuous scroll version
let pdfDoc = null
let container = null

export function initPdfViewer() {
    // Set the worker source for PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    container = document.getElementById('pdf-pages-container')
}

async function renderAllPages() {
    // Clear existing pages
    container.innerHTML = ''

    // Account for padding (40px) and scrollbar (20px)
    const containerWidth = container.clientWidth - 60

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i)

        // Calculate scale to fit container width
        const viewport = page.getViewport({ scale: 1 })
        const calculatedScale = containerWidth / viewport.width
        const scaledViewport = page.getViewport({ scale: Math.min(calculatedScale, 1.5) })

        // Create canvas for this page
        const canvas = document.createElement('canvas')
        canvas.className = 'pdf-page'
        canvas.width = scaledViewport.width
        canvas.height = scaledViewport.height

        container.appendChild(canvas)

        const ctx = canvas.getContext('2d')
        await page.render({
            canvasContext: ctx,
            viewport: scaledViewport
        }).promise
    }
}

export function loadPdf(url) {
    pdfDoc = null
    container.innerHTML = '<div class="pdf-loading">Loading document...</div>'

    pdfjsLib.getDocument(url).promise.then(function(pdf) {
        pdfDoc = pdf
        renderAllPages()
    }).catch(function(error) {
        console.error('Error loading PDF:', error)
        container.innerHTML = '<div class="pdf-error">Error loading document</div>'
    })
}

export function closePdf() {
    if (pdfDoc) {
        pdfDoc.destroy()
        pdfDoc = null
    }
    if (container) {
        container.innerHTML = ''
    }
}
