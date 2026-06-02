// --- Navigation & Search Management ---

let lastActiveTabId = 'swift-assistant';

function switchTab(tabId) {
    // Close mobile menu if open
    toggleMobileMenu(false);
    const searchWrap = document.getElementById('mobile-search-wrap');
    if (searchWrap) searchWrap.classList.remove('active');

    if (tabId !== 'swift-assistant') {
        lastActiveTabId = tabId;
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });

    // Sync Mobile Dropdown Label if needed
    const toolLabels = {
        'img-to-pdf': 'Image to PDF',
        'pdf-to-img': 'PDF to Image',
        'merge-pdf': 'Merge PDF',
        'split-pdf': 'Split PDF',
        'compress-pdf': 'Compress PDF',
        'compress-image': 'Compress Image',
        'unlock-pdf': 'Unlock PDF',
        'protect-pdf': 'Protect PDF',
        'bg-remover': 'Remove BG',
        'collage-maker': 'Collage Maker',
        'word-to-pdf': 'Word to PDF',
        'scanner': 'Scanner',
        'webpage-to-pdf': 'Webpage to PDF',
        'redact-pdf': 'Redact PDF',
        'watermark-tool': 'Watermark',
        'video-compressor': 'Video Compressor',
        'swift-assistant': 'Swift Assistant'
    };
    const toolIcons = {
        'img-to-pdf': 'image',
        'pdf-to-img': 'file-image',
        'merge-pdf': 'copy',
        'split-pdf': 'scissors',
        'compress-pdf': 'shrink',
        'compress-image': 'image-plus',
        'unlock-pdf': 'unlock',
        'protect-pdf': 'lock',
        'bg-remover': 'eraser',
        'collage-maker': 'layout',
        'word-to-pdf': 'file-up',
        'scanner': 'scan',
        'webpage-to-pdf': 'globe',
        'redact-pdf': 'eye-off',
        'watermark-tool': 'stamp',
        'video-compressor': 'video',
        'swift-assistant': 'message-square'
    };

    const label = document.getElementById('current-tool-label');
    const icon = document.getElementById('current-tool-icon');
    if (label && toolLabels[tabId]) {
        label.textContent = toolLabels[tabId];
        if (icon) {
            icon.setAttribute('data-lucide', toolIcons[tabId]);
        }
    }

    if (tabId === 'swift-assistant') {
        if (window.innerWidth <= 1024) {
            document.getElementById('swift-assistant').classList.add('mobile-fullscreen');
            if (window.history.state?.panel !== 'assistant') {
                window.history.pushState({ panel: 'assistant' }, '');
            }
        }
        setTimeout(() => {
            const inputField = document.getElementById('assistant-input');
            if (inputField) {
                if (window.innerWidth <= 1024) {
                    inputField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                inputField.focus();
            }
        }, 100);
    } else {
        if (window.innerWidth <= 1024) {
            document.getElementById('swift-assistant').classList.remove('mobile-fullscreen');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // Sync bottom navigation active class
    document.querySelectorAll('#mobile-bottom-nav .nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
}

function handleMobileToolSelect(tabId, labelText, iconName) {
    switchTab(tabId);
}

function toggleMobileMenu(open) {
    const sidebar = document.getElementById('app-sidebar-panel');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
        sidebar.classList.toggle('open', open);
    }
    if (backdrop) {
        backdrop.classList.toggle('visible', open);
    }
    if (open) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

function toggleMobileSearch() {
    const searchWrap = document.getElementById('mobile-search-wrap');
    if (searchWrap) {
        const isActive = searchWrap.classList.toggle('active');
        if (isActive) {
            const input = document.getElementById('mobile-search-input');
            if (input) input.focus();
        }
    }
}

// Bind tabs click handlers
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(target).classList.add('active');

        if (target === 'swift-assistant') {
            setTimeout(() => {
                const inputField = document.getElementById('assistant-input');
                if (inputField) {
                    inputField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    inputField.focus();
                }
            }, 100);
        }
    });
});


// Desktop Resizable Sidebar Layout logic references
const sidebar = document.getElementById('app-sidebar-panel');
const toggleBtn = document.getElementById('sidebar-toggle-btn');
let isSidebarCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';

function updateSidebarCollapseState() {
    if (!sidebar) return;
    if (isSidebarCollapsed) {
        sidebar.classList.add('collapsed');
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i data-lucide="sidebar" style="transform: scaleX(-1); width: 14px; height: 14px;"></i>';
        }
    } else {
        sidebar.classList.remove('collapsed');
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i data-lucide="sidebar" style="width: 14px; height: 14px;"></i>';
        }
    }
    lucide.createIcons({ root: toggleBtn });
}

if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        isSidebarCollapsed = !isSidebarCollapsed;
        localStorage.setItem('sidebar-collapsed', isSidebarCollapsed);
        updateSidebarCollapseState();
    });
    updateSidebarCollapseState();
}


// Synonyms map for search
const toolSynonymsShared = {
    'swift-assistant': ['assistant', 'chat', 'ai', 'question', 'help', 'ask', 'prompt', 'gpt', 'search web', 'bot', 'llm', 'message', 'talk', 'write'],
    'img-to-pdf': ['image to pdf', 'jpg to pdf', 'png to pdf', 'photo to pdf', 'pictures to pdf', 'convert', 'compile', 'format', 'jpeg to pdf', 'webp to pdf', 'heic to pdf', 'tiff to pdf'],
    'pdf-to-img': ['pdf to image', 'pdf to jpg', 'pdf to png', 'extract pages', 'convert', 'render', 'pdf to jpeg', 'pdf to picture', 'pdf to photo'],
    'merge-pdf': ['merge pdf', 'combine pdf', 'join pdf', 'concatenate pdf', 'multiple files', 'append', 'put together', 'union', 'attach pdf'],
    'split-pdf': ['split pdf', 'cut pdf', 'extract pages', 'divide pdf', 'separate pdf', 'crop pdf pages', 'break pdf', 'segment pdf'],
    'compress-pdf': ['compress pdf', 'shrink pdf size', 'reduce pdf size', 'optimize pdf', 'make smaller', 'lightweight', 'compressor', 'downsize pdf'],
    'compress-image': ['compress image', 'optimize photo', 'shrink photo', 'reduce image size', 'webp quality', 'jpg compress', 'quality adjust', 'resize image'],
    'unlock-pdf': ['unlock pdf', 'decrypt pdf', 'remove password', 'crack pdf', 'access locked pdf', 'open secured pdf', 'bypass restriction', 'unprotect pdf'],
    'protect-pdf': ['protect pdf', 'encrypt pdf', 'add password to pdf', 'lock pdf', 'secure document', 'restrict editing', 'password protect', 'censor access'],
    'bg-remover': ['remove bg', 'background remover', 'transparent image', 'erase background', 'cutout', 'ai remover', 'swift removal', 'bg erase', 'png cutout', 'remove backdrop', 'mask background'],
    'collage-maker': ['collage maker', 'photo grid', 'combine images', 'layout grid', 'moodboard', 'photomontage', 'grid layout', 'arrange photos', 'stitch pictures'],
    'word-to-pdf': ['word to pdf', 'docx to pdf', 'doc to pdf', 'office convert', 'microsoft word to pdf', 'convert docx', 'convert doc'],
    'scanner': ['scanner', 'camera scan', 'scan document', 'crop scanner', 'scan page', 'ocr', 'extract text from image', 'digitize', 'image ocr', 'read text'],
    'webpage-to-pdf': ['webpage to pdf', 'url to pdf', 'website scan', 'save website', 'html to pdf', 'convert url', 'link to pdf', 'download site'],
    'redact-pdf': ['redact pdf', 'censor pdf', 'blackout text', 'hide sensitive info', 'erase text from pdf', 'cover up content', 'blur information', 'whiteout text', 'privacy tool'],
    'watermark-tool': ['watermark', 'stamp pdf', 'add logo to pdf', 'add text overlay', 'signature', 'brand pdf', 'sign document', 'watermark image', 'overlay brand']
};

function applyToolSearch(query) {
    const tabButtons = document.querySelectorAll('.converter-tabs .tab-btn');
    tabButtons.forEach(btn => {
        const tabId = btn.getAttribute('data-tab');
        const labelText = btn.textContent.toLowerCase();
        const keywords = toolSynonymsShared[tabId] || [];
        const matchesKeyword = keywords.some(k => k.includes(query) || query.includes(k));
        const matchesLabel = labelText.includes(query);
        btn.style.display = (query === '' || matchesLabel || matchesKeyword) ? '' : 'none';
    });
}

// Desktop search
const searchInput = document.getElementById('sidebar-search-input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        applyToolSearch(e.target.value.toLowerCase().trim());
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const visibleButtons = Array.from(document.querySelectorAll('.converter-tabs .tab-btn')).filter(btn => btn.style.display !== 'none');
            if (visibleButtons.length > 0) {
                visibleButtons[0].click();
                searchInput.blur();
            }
        }
    });
}

// Mobile dropdown search
const mobileSearchInput = document.getElementById('mobile-search-input');
if (mobileSearchInput) {
    const mobileDropdown = document.getElementById('mobile-search-dropdown');
    const mobileSearchWrap = document.getElementById('mobile-search-wrap');
    const mobileSearchClear = document.getElementById('mobile-search-clear');

    const mobileToolMeta = [
        { id: 'swift-assistant', label: 'Swift Assistant', icon: 'message-square' },
        { id: 'scanner', label: 'Scanner', icon: 'scan' },
        { id: 'img-to-pdf', label: 'Image to PDF', icon: 'image' },
        { id: 'pdf-to-img', label: 'PDF to Image', icon: 'file-text' },
        { id: 'merge-pdf', label: 'Merge PDF', icon: 'copy' },
        { id: 'split-pdf', label: 'Split PDF', icon: 'scissors' },
        { id: 'compress-pdf', label: 'Compress PDF', icon: 'minimize-2' },
        { id: 'compress-image', label: 'Compress Image', icon: 'image' },
        { id: 'unlock-pdf', label: 'Unlock PDF', icon: 'unlock' },
        { id: 'protect-pdf', label: 'Protect PDF', icon: 'lock' },
        { id: 'bg-remover', label: 'Remove BG', icon: 'eraser' },
        { id: 'collage-maker', label: 'Collage Maker', icon: 'layout' },
        { id: 'word-to-pdf', label: 'Word to PDF', icon: 'file-up' },
        { id: 'webpage-to-pdf', label: 'Webpage to PDF', icon: 'globe' },
        { id: 'redact-pdf', label: 'Redact PDF', icon: 'eye-off' },
        { id: 'watermark-tool', label: 'Watermark', icon: 'stamp' },
    ];

    function getLucideIconSVG(name) {
        const tmp = document.createElement('i');
        tmp.setAttribute('data-lucide', name);
        document.body.appendChild(tmp);
        lucide.createIcons({ root: tmp });
        const svg = tmp.querySelector('svg');
        const svgHtml = svg ? svg.outerHTML : '';
        document.body.removeChild(tmp);
        return svgHtml;
    }

    function buildDropdownResults(query) {
        if (!mobileDropdown) return;
        const q = query.toLowerCase().trim();

        if (q === '') {
            mobileDropdown.classList.remove('open');
            mobileDropdown.innerHTML = '';
            return;
        }

        const matches = mobileToolMeta.filter(tool => {
            const label = tool.label.toLowerCase();
            const keywords = toolSynonymsShared[tool.id] || [];
            return label.includes(q) || keywords.some(k => k.includes(q) || q.includes(k));
        });

        if (matches.length === 0) {
            mobileDropdown.innerHTML = `<div class="mobile-search-no-results-msg">No tools found for "${q}"</div>`;
        } else {
            mobileDropdown.innerHTML = matches.map(tool => {
                return `<div class="mobile-search-result-item" data-tab="${tool.id}">
                    <div class="mobile-search-result-icon"><i data-lucide="${tool.icon}"></i></div>
                    <span>${tool.label}</span>
                </div>`;
            }).join('');
            
            lucide.createIcons({ root: mobileDropdown });

            mobileDropdown.querySelectorAll('.mobile-search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const tabId = item.getAttribute('data-tab');
                    switchTab(tabId);
                    mobileSearchInput.value = '';
                    if (mobileSearchWrap) mobileSearchWrap.classList.remove('has-value');
                    mobileDropdown.classList.remove('open');
                    mobileDropdown.innerHTML = '';
                    mobileSearchInput.blur();
                });
            });
        }

        mobileDropdown.classList.add('open');
    }

    mobileSearchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        if (mobileSearchWrap) {
            mobileSearchWrap.classList.toggle('has-value', query.length > 0);
        }
        buildDropdownResults(query);
    });

    mobileSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const firstItem = mobileDropdown && mobileDropdown.querySelector('.mobile-search-result-item');
            if (firstItem) firstItem.click();
        }
        if (e.key === 'Escape') {
            mobileSearchInput.value = '';
            if (mobileSearchWrap) mobileSearchWrap.classList.remove('has-value');
            if (mobileDropdown) { mobileDropdown.classList.remove('open'); mobileDropdown.innerHTML = ''; }
            mobileSearchInput.blur();
        }
    });

    if (mobileSearchClear) {
        mobileSearchClear.addEventListener('click', () => {
            mobileSearchInput.value = '';
            if (mobileSearchWrap) mobileSearchWrap.classList.remove('has-value');
            if (mobileDropdown) { mobileDropdown.classList.remove('open'); mobileDropdown.innerHTML = ''; }
            mobileSearchInput.focus();
        });
    }

    document.addEventListener('click', (e) => {
        if (mobileSearchWrap && !mobileSearchWrap.contains(e.target)) {
            if (mobileDropdown) mobileDropdown.classList.remove('open');
        }
    }, { passive: true });
}
