const PATENTS = [
    {
        number: 'US 2,226,438',
        patentId: 'US2226438A',
        patentNum: '2226438',
        title: 'Film-Developing Tank',
        year: '1940',
        filed: 'May 28, 1938',
        description: 'A transparent tank design allowing observation of film development progress. Features a helical screw circulation system that pumps developer from bottom to top, preventing air bubble accumulation on film surfaces. Includes spring-operated timing device and light-tight cover for use in illuminated rooms.',
        pdfUrl: '/patents/US2226438.pdf'
    },
    {
        number: 'US 2,236,197',
        patentId: 'US2236197A',
        patentNum: '2236197',
        title: 'Photographic Printing Easel',
        year: '1941',
        filed: 'January 16, 1940',
        description: 'A printing easel with hinged glass plate for holding sensitized paper flat during enlargement. Features spring-loaded guide pins for quick paper positioning and an adjustable side pin to accommodate various paper sizes. Simple, affordable design ensures proper alignment with enlarging lenses.',
        pdfUrl: '/patents/US2236197.pdf'
    },
    {
        number: 'US 2,268,457',
        patentId: 'US2268457A',
        patentNum: '2268457',
        title: 'Developing Tray',
        year: '1941',
        filed: 'November 23, 1940',
        description: 'An improved photographic processing tray with slightly convex bottom and small upward-projecting protuberances. Features dual pouring lips at diagonal corners for ambidextrous use, and a convex exterior bottom for easy rocking agitation. Single-piece construction from enameled steel.',
        pdfUrl: '/patents/US2268457.pdf'
    },
    {
        number: 'US 2,268,458',
        patentId: 'US2268458A',
        patentNum: '2268458',
        title: 'Photographic Print Drying Frame',
        year: '1941',
        filed: 'December 29, 1939',
        description: 'A curved metal frame with fine mesh wire screen for holding and drying photographic prints. Grips print edges without damaging the emulsion surface, prevents warping during drying, and allows air circulation for faster drying. Multiple frames can stack in spaced arrangement.',
        pdfUrl: '/patents/US2268458.pdf'
    },
    {
        number: 'US 2,327,733',
        patentId: 'US2327733A',
        patentNum: '2327733',
        title: 'Improved Film Developing Tank',
        year: '1943',
        filed: 'December 14, 1939',
        description: 'An advanced developing unit with interconnected tanks maintaining consistent temperature via water jacket. Developer liquid flows downward through spaced inlet ports for uniform film exposure. System includes five nested tanks for washing, developing, rinsing, fixing, and final washing. Reduced developing time by 25-33%.',
        pdfUrl: '/patents/US2327733.pdf'
    },
    {
        number: 'US 2,344,558',
        patentId: 'US2344558A',
        patentNum: '2344558',
        title: 'Photographic Enlarger',
        year: '1944',
        filed: 'July 22, 1940',
        description: 'A reflector-type photographic enlarger for producing large prints from small negatives. Features adjustable horizontal and vertical positioning, heat protection with air curtain system, rotatable negative holder, and telescoping lens housing for magnification control.',
        pdfUrl: '/patents/US2344558.pdf'
    },
    {
        number: 'US 2,365,485',
        patentId: 'US2365485A',
        patentNum: '2365485',
        title: 'Film Developing Rack',
        year: '1944',
        filed: 'June 21, 1943',
        description: 'A portable rack system for suspending roll film, film packs, and cut film in spaced arrangement during chemical processing. Features rectangular frame with notched pins and spring-latch retention. Enables quick transfer between multiple processing tanks while ensuring uniform chemical distribution.',
        pdfUrl: '/patents/US2365485.pdf'
    }
]

let currentView = 'entry'
let globalBackBtn
let globalBackBtnBottom
let panelEntry
let panelPatents
let panelPatentDetail

export function initPatents() {
    globalBackBtn = document.getElementById('global-back-btn')
    globalBackBtnBottom = document.getElementById('global-back-btn-bottom')
    panelEntry = document.getElementById('panel-entry')
    panelPatents = document.getElementById('panel-patents')
    panelPatentDetail = document.getElementById('panel-patent-detail')
}

export function getCurrentView() {
    return currentView
}

function updateBackButton() {
    if (currentView === 'entry') {
        globalBackBtn.classList.add('hidden')
        globalBackBtnBottom.classList.add('hidden')
    } else {
        globalBackBtn.classList.remove('hidden')
        globalBackBtnBottom.classList.remove('hidden')
    }
}

export function handleBack() {
    if (currentView === 'patent-detail') {
        returnToPatents()
    } else if (currentView === 'patents') {
        returnToEntry()
    }
}

export function enterPatents() {
    panelEntry.classList.add('hidden')
    panelPatents.classList.remove('hidden')
    currentView = 'patents'
    updateBackButton()
}

export function returnToEntry() {
    panelPatents.classList.add('hidden')
    panelPatentDetail.classList.add('hidden')
    panelEntry.classList.remove('hidden')
    currentView = 'entry'
    updateBackButton()
}

export function viewPatent(index) {
    const patent = PATENTS[index]
    if (!patent) return

    document.getElementById('patent-detail-number').innerText = patent.number
    document.getElementById('patent-detail-title').innerText = patent.title
    document.getElementById('patent-detail-year').innerText = patent.year
    document.getElementById('patent-detail-filed').innerText = patent.filed
    document.getElementById('patent-detail-description').innerText = patent.description

    const googleLink = document.getElementById('patent-google-link')
    if (googleLink) {
        googleLink.href = `https://patents.google.com/patent/${patent.patentId}`
    }

    document.getElementById('patent-pdf-iframe').src = patent.pdfUrl

    panelPatents.classList.add('hidden')
    panelPatentDetail.classList.remove('hidden')
    currentView = 'patent-detail'
    updateBackButton()
}

export function returnToPatents() {
    document.getElementById('patent-pdf-iframe').src = ''

    panelPatentDetail.classList.add('hidden')
    panelPatents.classList.remove('hidden')
    currentView = 'patents'
    updateBackButton()
}
