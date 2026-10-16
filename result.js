const names = {
  tr: "Turkish", en: "English", es: "Spanish", fr: "French", de: "German",
  it: "Italian", pt: "Portuguese", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese (Simplified)",
  ru: "Russian", ar: "Arabic"
};

chrome.storage.local.get("lastTranslation").then(({ lastTranslation }) => {
  if (!lastTranslation) {
    document.querySelector("main").textContent = "No translation is available.";
    return;
  }
  document.getElementById("target-label").textContent = `${names[lastTranslation.targetLanguage] || lastTranslation.targetLanguage} translation`;
  document.getElementById("original").textContent = lastTranslation.original;
  document.getElementById("translated").textContent = lastTranslation.translatedText || lastTranslation.error;
});
