const language = document.getElementById("language");
const status = document.getElementById("status");

const extensionToggle = document.getElementById("extension-enabled");
const redirectToggle = document.getElementById("redirect-pdf-links");
const pdfLinkPermissions = { origins: ["http://*/*", "https://*/*"] };

chrome.storage.sync.get({ targetLanguage: "tr", redirectPdfLinks: false, extensionEnabled: true }).then(({ targetLanguage, redirectPdfLinks, extensionEnabled }) => {
  language.value = targetLanguage;
  redirectToggle.checked = redirectPdfLinks;
  redirectToggle.disabled = !extensionEnabled;
  extensionToggle.checked = extensionEnabled;
  status.textContent = extensionEnabled
    ? "Select text on a web page or in the PDF viewer for immediate translation."
    : "Automatic translation and PDF-link redirection are paused. Manual PDF viewing is still available.";
});

extensionToggle.addEventListener("change", async () => {
  const enabled = extensionToggle.checked;
  await chrome.storage.sync.set({ extensionEnabled: enabled });
  redirectToggle.disabled = !enabled;
  status.textContent = enabled
    ? "Automatic translation is on."
    : "Automatic translation and PDF-link redirection are paused. Manual PDF viewing is still available.";
});

language.addEventListener("change", () => {
  chrome.storage.sync.set({ targetLanguage: language.value });
  status.textContent = "Target language saved.";
});

redirectToggle.addEventListener("change", async () => {
  if (redirectToggle.checked) {
    const granted = await chrome.permissions.request(pdfLinkPermissions);
    if (!granted) {
      redirectToggle.checked = false;
      status.textContent = "Site access was not granted; PDF-link redirection remains off.";
      return;
    }
    await chrome.storage.sync.set({ redirectPdfLinks: true });
    status.textContent = "Direct .pdf links will open in this viewer.";
    return;
  }

  await chrome.storage.sync.set({ redirectPdfLinks: false });
  await chrome.permissions.remove(pdfLinkPermissions);
  status.textContent = "PDF-link redirection is off.";
});

document.getElementById("open-current-pdf").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let pdfUrl = tab?.url;
  try {
    const currentUrl = new URL(pdfUrl);
    pdfUrl = currentUrl.searchParams.get("url") || currentUrl.searchParams.get("src") || currentUrl.searchParams.get("file") || pdfUrl;
  } catch {
    status.textContent = "Could not read the current tab URL.";
    return;
  }

  if (!pdfUrl || (!/^https?:\/\//i.test(pdfUrl) && !/^file:\/\//i.test(pdfUrl))) {
    status.textContent = "Open a web PDF or local PDF tab, then try again.";
    return;
  }
  const viewerUrl = `${chrome.runtime.getURL("viewer.html")}?url=${encodeURIComponent(pdfUrl)}`;
  await chrome.tabs.create({ url: viewerUrl });
});

document.getElementById("open-pdf").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
});

chrome.storage.local.get("lastTranslation").then(({ lastTranslation }) => {
  if (!lastTranslation) return;
  document.getElementById("last-result").hidden = false;
  document.getElementById("original").textContent = `Selected: ${lastTranslation.original}`;
  document.getElementById("translated").textContent = lastTranslation.translatedText || lastTranslation.error;
});
