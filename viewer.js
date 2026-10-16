import { getDocument, GlobalWorkerOptions, TextLayer } from "./vendor/pdfjs/pdf.min.mjs";

const PDFJS_BASE = chrome.runtime.getURL("vendor/pdfjs/");
GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}pdf.worker.min.mjs`;

const status = document.getElementById("status");
const documentViewer = document.getElementById("document-viewer");
const toolbarToggle = document.getElementById("toolbar-toggle");
const pageContainer = document.getElementById("page-container");
const canvas = document.getElementById("page-canvas");
const textLayerElement = document.getElementById("text-layer");
const pageNumberInput = document.getElementById("page-number");
const bubble = document.getElementById("translation-bubble");
let pdfDocument;
let pageNumber = 1;
let scale = 1.25;
let renderTask;
let renderId = 0;
let lastSelection = "";
let translationId = 0;
let extensionEnabled = true;
let manuallyHideToolbar = false;

chrome.storage.sync.get({ extensionEnabled: true }).then(({ extensionEnabled: enabled }) => {
  extensionEnabled = enabled;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.extensionEnabled) {
    extensionEnabled = changes.extensionEnabled.newValue === true;
    if (!extensionEnabled) {
      translationId++;
      hideBubble();
    }
  }
});

documentViewer.addEventListener("scroll", updateToolbarVisibility, { passive: true });
toolbarToggle.addEventListener("click", () => {
  const hidden = document.body.classList.contains("toolbar-hidden");
  manuallyHideToolbar = !hidden;
  if (hidden) documentViewer.scrollTop = 0;
  updateToolbarVisibility();
});
updateToolbarVisibility();

const documentUrl = new URLSearchParams(location.search).get("url");
if (documentUrl) loadDocument({ url: documentUrl }, documentUrl.split("/").pop());

document.getElementById("file-input").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await loadDocument({ data: bytes }, file.name);
  } catch (error) {
    showError(error);
  }
});

document.getElementById("previous").addEventListener("click", () => goToPage(pageNumber - 1));
document.getElementById("next").addEventListener("click", () => goToPage(pageNumber + 1));
document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  if (event.target instanceof Element && event.target.closest("input, button, select, textarea")) return;
  if (!window.getSelection()?.isCollapsed) return;

  event.preventDefault();
  goToPage(pageNumber + (event.key === "ArrowLeft" ? -1 : 1));
});
document.getElementById("zoom-in").addEventListener("click", () => changeZoom(0.2));
document.getElementById("zoom-out").addEventListener("click", () => changeZoom(-0.2));
pageNumberInput.addEventListener("change", () => goToPage(Number(pageNumberInput.value)));

window.addEventListener("resize", () => {
  if (pdfDocument) renderPage();
});

document.addEventListener("mouseup", translateSelection);

document.addEventListener("mousedown", (event) => {
  if (!bubble.contains(event.target)) hideBubble();
});

function updateToolbarVisibility() {
  const hidden = manuallyHideToolbar || documentViewer.scrollTop > 2;
  document.body.classList.toggle("toolbar-hidden", hidden);
  toolbarToggle.textContent = hidden ? "⌄" : "⌃";
  toolbarToggle.setAttribute("aria-expanded", String(!hidden));
  toolbarToggle.setAttribute("aria-label", hidden ? "Show PDF toolbar" : "Hide PDF toolbar");
  toolbarToggle.title = hidden ? "Show PDF toolbar" : "Hide PDF toolbar";
}

async function loadDocument(source, name = "PDF") {
  status.textContent = "Loading PDF…";
  try {
    const loadingTask = getDocument({
      ...source,
      cMapUrl: `${PDFJS_BASE}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDFJS_BASE}standard_fonts/`,
      withCredentials: true
    });
    const loadedDocument = await loadingTask.promise;
    if (pdfDocument) await pdfDocument.destroy();
    pdfDocument = loadedDocument;
    pageNumber = 1;
    scale = 1.25;
    documentViewer.scrollTop = 0;
    manuallyHideToolbar = false;
    updateToolbarVisibility();
    pageNumberInput.max = String(pdfDocument.numPages);
    document.getElementById("page-count").textContent = `of ${pdfDocument.numPages}`;
    pageContainer.hidden = false;
    document.title = `${name || "PDF"} - PDF Translator`;
    status.textContent = name || "PDF loaded";
    await renderPage();
  } catch (error) {
    showError(error);
  }
}

async function renderPage() {
  const currentRenderId = ++renderId;
  if (renderTask) renderTask.cancel();
  textLayerElement.replaceChildren();
  try {
    const page = await pdfDocument.getPage(pageNumber);
    if (currentRenderId !== renderId) return;
    const viewport = page.getViewport({ scale });
    const outputScale = window.devicePixelRatio || 1;
    const context = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    pageContainer.style.width = `${Math.floor(viewport.width)}px`;
    pageContainer.style.height = `${Math.floor(viewport.height)}px`;
    textLayerElement.style.width = `${Math.floor(viewport.width)}px`;
    textLayerElement.style.height = `${Math.floor(viewport.height)}px`;
    textLayerElement.style.setProperty("--scale-factor", scale);

    const currentTask = page.render({
      canvasContext: context,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
      viewport
    });
    renderTask = currentTask;
    await currentTask.promise;
    if (renderTask === currentTask) renderTask = undefined;
    if (currentRenderId !== renderId) return;

    const textLayer = new TextLayer({
      textContentSource: page.streamTextContent({ includeMarkedContent: true }),
      container: textLayerElement,
      viewport
    });
    await textLayer.render();
    pageNumberInput.value = String(pageNumber);
    status.textContent = `Page ${pageNumber} of ${pdfDocument.numPages} · Select text to translate · ←/→ pages`;
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") showError(error);
  }
}

function goToPage(value) {
  if (!pdfDocument) return;
  pageNumber = Math.max(1, Math.min(pdfDocument.numPages, Number(value) || 1));
  documentViewer.scrollTop = 0;
  updateToolbarVisibility();
  renderPage();
}

function changeZoom(delta) {
  if (!pdfDocument) return;
  scale = Math.max(0.5, Math.min(3, Math.round((scale + delta) * 10) / 10));
  renderPage();
}

async function translateSelection() {
  if (!extensionEnabled) return;
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  if (!text || text.length > 5000 || text === lastSelection) return;
  if (!selection.anchorNode || !textLayerElement.contains(selection.anchorNode)) return;

  lastSelection = text;
  const currentTranslationId = ++translationId;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  showBubble("Translating…", rect);
  try {
    const result = await chrome.runtime.sendMessage({ type: "translate", text });
    if (currentTranslationId === translationId) showBubble(result?.error || result?.translatedText || "Translation failed.", rect);
  } catch {
    if (currentTranslationId === translationId) showBubble("Translation failed. Try again.", rect);
  }
}

function showBubble(text, rect) {
  bubble.textContent = text;
  bubble.hidden = false;
  bubble.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 396))}px`;
  bubble.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 100)}px`;
}

function hideBubble() {
  bubble.hidden = true;
  lastSelection = "";
}

function showError(error) {
  const localFileHint = documentUrl?.startsWith("file:")
    ? " Enable ‘Allow access to file URLs’ in this extension’s details, or open it with the file picker."
    : "";
  status.textContent = `Could not open PDF: ${error?.message || error}.${localFileHint}`;
}
