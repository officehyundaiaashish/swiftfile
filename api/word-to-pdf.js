function handleWordSelect() {
    const wordToPdfInput = document.getElementById('word-to-pdf-input');
    const wordToPdfFilename = document.getElementById('word-to-pdf-filename');
    const wordToPdfDropZone = document.getElementById('word-to-pdf-drop-zone');
    const wordToPdfPreviewContainer = document.getElementById('word-to-pdf-preview-container');
    const wordToPdfPreview = document.getElementById('word-to-pdf-preview');

    if (!wordToPdfInput) return;

    const file = wordToPdfInput.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
        notify("File exceeds the 50MB limit.", 'error');
        return;
    }

    wordFile = file;
    if (wordToPdfFilename) wordToPdfFilename.textContent = file.name;
    if (wordToPdfDropZone) wordToPdfDropZone.classList.add('hidden');
    if (wordToPdfPreviewContainer) wordToPdfPreviewContainer.classList.remove('hidden');

    showStatus('Reading Word document...');

    const reader = new FileReader();
    reader.onload = function (loadEvent) {
        const arrayBuffer = loadEvent.target.result;
        mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
            .then(function (result) {
                if (wordToPdfPreview) wordToPdfPreview.innerHTML = result.value || "<p style='color: var(--text-secondary); text-align: center;'>Empty Document</p>";
                hideStatus();
                notify("Word document loaded successfully.", "success");
            })
            .catch(function (err) {
                console.error(err);
                hideStatus();
                notify("Error reading Word file. Make sure it's a valid .docx file.", 'error');
                resetWordToPdf();
            });
    };
    reader.readAsArrayBuffer(file);
}

function resetWordToPdf() {
    const wordToPdfInput = document.getElementById('word-to-pdf-input');
    const wordToPdfPreview = document.getElementById('word-to-pdf-preview');
    const wordToPdfDropZone = document.getElementById('word-to-pdf-drop-zone');
    const wordToPdfPreviewContainer = document.getElementById('word-to-pdf-preview-container');

    wordFile = null;
    if (wordToPdfInput) wordToPdfInput.value = '';
    if (wordToPdfPreview) wordToPdfPreview.innerHTML = '';
    if (wordToPdfDropZone) wordToPdfDropZone.classList.remove('hidden');
    if (wordToPdfPreviewContainer) wordToPdfPreviewContainer.classList.add('hidden');
}

function initWordToPdfUI() {
    const wordToPdfInput = document.getElementById('word-to-pdf-input');
    const wordToPdfDropZone = document.getElementById('word-to-pdf-drop-zone');
    const clearWordToPdfBtn = document.getElementById('clear-word-to-pdf');
    const convertWordToPdfBtn = document.getElementById('convert-word-to-pdf-btn');
    const wordToPdfPreview = document.getElementById('word-to-pdf-preview');

    if (wordToPdfInput) {
        if (wordToPdfDropZone) wordToPdfDropZone.addEventListener('click', () => wordToPdfInput.click());
        wordToPdfInput.addEventListener('change', handleWordSelect);
    }
    if (wordToPdfDropZone) {
        wordToPdfDropZone.addEventListener('dragover', (e) => { e.preventDefault(); wordToPdfDropZone.classList.add('drag-over'); });
        wordToPdfDropZone.addEventListener('dragleave', () => wordToPdfDropZone.classList.remove('drag-over'));
        wordToPdfDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            wordToPdfDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && wordToPdfInput) {
                wordToPdfInput.files = e.dataTransfer.files;
                handleWordSelect();
            }
        });
    }

    if (clearWordToPdfBtn) clearWordToPdfBtn.addEventListener('click', resetWordToPdf);

    if (convertWordToPdfBtn) {
        convertWordToPdfBtn.addEventListener('click', async () => {
            if (!wordFile) return;

            showStatus('Converting Word to PDF...');
            try {
                const outName = wordFile.name.replace(/\.[^/.]+$/, "") + ".pdf";
                if (typeof convertHtmlToPdf === 'function' && wordToPdfPreview) {
                    await convertHtmlToPdf(wordToPdfPreview, outName);
                    showStatus('Success!', 2000);
                    notify('Document converted to PDF successfully.', 'success');
                } else {
                    throw new Error("convertHtmlToPdf function not found.");
                }
            } catch (error) {
                console.error(error);
                notify('Failed to generate PDF.', 'error');
                hideStatus();
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', initWordToPdfUI);
