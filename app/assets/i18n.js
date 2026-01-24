"use strict";

(function initTSI18n() {
  const SUPPORTED_LANGS = new Set(["ja", "en"]);
  const DEFAULT_LANG = "ja";
  const STORAGE_KEY = "tsi_lang";

  const dictionaries = {
    ja: window.TSI_I18N_JA || {},
    en: window.TSI_I18N_EN || {},
  };

  const canonicalizeLang = (lang) => {
    const value = (lang || "").trim().toLowerCase();
    return SUPPORTED_LANGS.has(value) ? value : "";
  };

  const formatTemplate = (template, params) => {
    if (!params || typeof template !== "string") {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
    );
  };

  const resolveFromDictionary = (lang, key) => {
    const dict = dictionaries[lang] || {};
    return dict[key];
  };

  const translate = (key, params) => {
    const lang = canonicalizeLang(document.documentElement.lang) || DEFAULT_LANG;
    const selected = resolveFromDictionary(lang, key);
    if (selected !== undefined) {
      return formatTemplate(selected, params);
    }

    const fallback = resolveFromDictionary(DEFAULT_LANG, key);
    if (fallback !== undefined) {
      return formatTemplate(fallback, params);
    }

    return "";
  };

  const translateOrText = (key, params, originalText) => {
    const translated = translate(key, params);
    return translated || originalText || "";
  };

  const setUrlLang = (lang) => {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    window.history.replaceState({ lang }, "", url.toString());
  };

  const setStoredLang = (lang) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (error) {
      // ignore storage errors
    }
  };

  const readStoredLang = () => {
    try {
      return canonicalizeLang(window.localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return "";
    }
  };

  const readUrlLang = () => {
    const params = new URLSearchParams(window.location.search);
    return canonicalizeLang(params.get("lang"));
  };

  const resolveInitialLang = () => readUrlLang() || readStoredLang() || DEFAULT_LANG;

  const setDocumentLang = (lang) => {
    document.documentElement.lang = lang;
  };

  const applyTranslations = () => {
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((element) => {
      const key = element.getAttribute("data-i18n");
      if (!key) {
        return;
      }

      const attr = element.getAttribute("data-i18n-attr");
      const originalAttrKey = attr ? `data-i18n-orig-${attr}` : "";
      const originalTextKey = "data-i18n-orig-text";

      if (attr) {
        const originalAttr = element.getAttribute(originalAttrKey);
        const baseline = originalAttr !== null ? originalAttr : element.getAttribute(attr) || "";
        if (originalAttr === null) {
          element.setAttribute(originalAttrKey, baseline);
        }
        const translated = translate(key);
        element.setAttribute(attr, translated || baseline);
        return;
      }

      const originalText = element.getAttribute(originalTextKey);
      const baseline = originalText !== null ? originalText : element.textContent || "";
      if (originalText === null) {
        element.setAttribute(originalTextKey, baseline);
      }
      element.textContent = translateOrText(key, null, baseline);
    });
  };

  const updateToggleState = (lang) => {
    const toggles = document.querySelectorAll("[data-lang-switch]");
    toggles.forEach((toggle) => {
      const toggleLang = canonicalizeLang(toggle.getAttribute("data-lang-switch"));
      const isActive = toggleLang === lang;
      toggle.setAttribute("aria-pressed", isActive ? "true" : "false");
      toggle.setAttribute("data-lang-active", isActive ? "true" : "false");
    });
  };

  const setLanguage = (lang, options = {}) => {
    const { persist = true, updateUrl = true } = options;
    const nextLang = canonicalizeLang(lang) || DEFAULT_LANG;
    setDocumentLang(nextLang);
    applyTranslations();
    updateToggleState(nextLang);

    if (persist) {
      setStoredLang(nextLang);
    }
    if (updateUrl) {
      setUrlLang(nextLang);
    }

    document.dispatchEvent(new CustomEvent("tsi:lang-change", { detail: { lang: nextLang } }));
  };

  const bindToggle = () => {
    document.querySelectorAll("[data-lang-switch]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const nextLang = canonicalizeLang(button.getAttribute("data-lang-switch"));
        if (!nextLang) {
          return;
        }
        setLanguage(nextLang, { persist: true, updateUrl: true });
      });
    });
  };

  const init = () => {
    const initialLang = resolveInitialLang();
    bindToggle();
    setLanguage(initialLang, { persist: true, updateUrl: true });
  };

  window.TSI_I18N = {
    DEFAULT_LANG,
    STORAGE_KEY,
    canonicalizeLang,
    t: translate,
    setLanguage,
    applyTranslations,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
