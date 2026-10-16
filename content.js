let lastSelection = "";
let requestId = 0;
let bubble;
let extensionEnabled = true;
let redirectPdfLinks = false;

chrome.storage.sync.get({ extensionEnabled: true, redirectPdfLinks: false }).then((settings) => {
  extensionEnabled = settings.extensionEnabled;
  redirectPdfLinks = settings.redirectPdfLinks;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.extensionEnabled) {
    extensionEnabled = changes.extensionEnabled.newValue === true;
    if (!extensionEnabled) {
      requestId++;
      hideBubble();
    }
  }
  if (changes.redirectPdfLinks) redirectPdfLinks = changes.redirectPdfLinks.newValue === true;
});

document.addEventListener("click", (event) => {
  if (!extensionEnabled || !redirectPdfLinks || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!link || link.hasAttribute("download")) return;

  const url = new URL(link.href, location.href);
  if (!/^https?:$/.test(url.protocol) || !/\.pdf$/i.test(url.pathname)) return;
  event.preventDefault();
  chrome.runtime.sendMessage({ type: "open-pdf-link", url: url.href })
    .then((result) => {
      if (!result?.opened) location.assign(url.href);
    })
    .catch(() => location.assign(url.href));
}, true);

document.addEventListener("mouseup", translateSelection);

document.addEventListener("keyup", (event) => {
  if (event.key === "Shift" || event.key.startsWith("Arrow")) translateSelection();
});

document.addEventListener("mousedown", (event) => {
  if (bubble && !bubble.contains(event.target)) hideBubble();
});

async function translateSelection() {
  if (!extensionEnabled) return;
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  if (!text || text.length > 5000 || text === lastSelection) return;
  if (selection?.anchorNode?.parentElement?.closest("input, textarea, select, [contenteditable='true']")) return;

  lastSelection = text;
  const currentRequestId = ++requestId;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  showBubble("Translating…", rect);
  try {
    const result = await chrome.runtime.sendMessage({ type: "translate", text });
    if (currentRequestId === requestId) showBubble(result.error || result.translatedText, rect);
  } catch {
    if (currentRequestId === requestId) showBubble("Translation failed. Try again.", rect);
  }
}

function showBubble(text, rect) {
  if (!bubble) {
    bubble = document.createElement("div");
    bubble.id = "quick-selection-translator-bubble";
    bubble.setAttribute("role", "status");
    bubble.style.cssText = "position:fixed;z-index:2147483647;box-sizing:border-box;max-width:min(380px,calc(100vw - 16px));max-height:40vh;overflow:auto;padding:11px 14px;border:1px solid rgb(255 255 255 / 28%);border-radius:12px;background:linear-gradient(125deg,#302c83,#137e9f);color:#fff;box-shadow:0 8px 24px rgb(27 34 86 / 28%);font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;";
    document.documentElement.appendChild(bubble);
  }
  bubble.textContent = text;
  bubble.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 396))}px`;
  bubble.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 100)}px`;
}

function hideBubble() {
  bubble?.remove();
  bubble = undefined;
  lastSelection = "";
}
