const TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single";
const DEFAULT_LANGUAGE = "tr";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "translate-selection",
      title: "Translate selected text",
      contexts: ["selection"]
    }, updateTranslateMenuVisibility);
  });
});

chrome.runtime.onStartup.addListener(updateTranslateMenuVisibility);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.extensionEnabled) updateTranslateMenuVisibility();
});

function updateTranslateMenuVisibility() {
  chrome.storage.sync.get({ extensionEnabled: true }).then(({ extensionEnabled }) => {
    chrome.contextMenus.update("translate-selection", { visible: extensionEnabled }, () => void chrome.runtime.lastError);
  });
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "translate-selection" || !info.selectionText) return;
  const { extensionEnabled = true } = await chrome.storage.sync.get({ extensionEnabled: true });
  if (!extensionEnabled) return;

  let result;
  try {
    result = await translate(info.selectionText);
  } catch (error) {
    result = { original: info.selectionText, error: error.message };
  }
  await chrome.storage.local.set({ lastTranslation: result });
  await chrome.tabs.create({ url: chrome.runtime.getURL("result.html") });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "open-pdf-link") {
    let pdfUrl;
    try {
      pdfUrl = new URL(message.url);
    } catch {
      sendResponse({ opened: false });
      return;
    }

    if (!/^https?:$/.test(pdfUrl.protocol) || !/\.pdf$/i.test(pdfUrl.pathname)) {
      sendResponse({ opened: false });
      return;
    }

    chrome.storage.sync.get({ extensionEnabled: true }).then(({ extensionEnabled }) => {
      if (!extensionEnabled) {
        sendResponse({ opened: false });
        return;
      }
      const viewerUrl = `${chrome.runtime.getURL("viewer.html")}?url=${encodeURIComponent(pdfUrl.href)}`;
      chrome.tabs.create({ url: viewerUrl }, () => sendResponse({ opened: !chrome.runtime.lastError }));
    }).catch(() => sendResponse({ opened: false }));
    return true;
  }

  if (message.type !== "translate") return;
  translate(message.text)
    .then(sendResponse)
    .catch((error) => sendResponse({ error: error.message }));
  return true;
});

async function translate(text) {
  const { targetLanguage = DEFAULT_LANGUAGE, extensionEnabled = true } = await chrome.storage.sync.get({
    targetLanguage: DEFAULT_LANGUAGE,
    extensionEnabled: true
  });
  if (!extensionEnabled) throw new Error("Automatic translation is turned off.");
  const translationText = normalizeTranslationText(text);
  if (!translationText) throw new Error("Select some text to translate.");
  const query = new URLSearchParams({
    client: "gtx",
    sl: "auto",
    tl: targetLanguage,
    dt: "t",
    q: translationText.slice(0, 5000)
  });
  const response = await fetch(`${TRANSLATE_URL}?${query}`);
  if (!response.ok) throw new Error(`Translation service returned ${response.status}.`);

  const data = await response.json();
  const translatedText = data[0]?.map((part) => part[0]).join("");
  if (!translatedText) throw new Error("No translation was returned.");
  return { original: text, translatedText, targetLanguage };
}

function normalizeTranslationText(text) {
  return String(text)
    .replace(/\u00a0/g, " ")
    .replace(/\u00ad|\u200b/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/-[ \t]*\n[ \t]*/g, "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]*\n[ \t]*/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}
