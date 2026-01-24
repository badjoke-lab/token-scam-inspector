"use strict";

const form = document.getElementById("inspect-form");
const chainInput = document.getElementById("chain");
const addressInput = document.getElementById("address");
const statusLine = document.getElementById("status");
const inspectButton = document.getElementById("inspect-button");

const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const successState = document.getElementById("success-state");
const rawJsonBlock = document.getElementById("raw-json-block");
const resultCode = document.getElementById("result");

const resultError = document.getElementById("result-error");
const cacheHint = document.getElementById("cache-hint");

const overallBadge = document.getElementById("overall-badge");
const overallSummary = document.getElementById("overall-summary");
const topReasons = document.getElementById("top-reasons");
const checksList = document.getElementById("checks-list");
const checkDetails = document.getElementById("check-details");

const copyShareLinkButton = document.getElementById("copy-share-link");
const copyFeedback = document.getElementById("copy-feedback");

const WORKERS_API_BASE = "https://lingering-frog-8773.badjoke-lab.workers.dev";

const MAX_TOP_REASONS = 5;
const CHECK_LIMIT = 7;
const COPY_FEEDBACK_MS = 2000;

const ALLOWED_CHAINS = new Set(["eth", "bsc"]);
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SIGNAL_SLUG_BY_ID = {
  sell_restriction: "sell-restriction",
  owner_privileges: "owner-privileges",
  mint_capability: "mint-capability",
  liquidity_lock: "liquidity-lock",
  holder_concentration: "holder-concentration",
  contract_verification: "contract-verification",
  trading_control: "trading-control",
  trading_enable_control: "trading-control",
};

let isLoading = false;
let copyFeedbackTimerId = null;
let currentInspectParams = null;
let lastResponseData = null;
let lastCacheHeader = "";
let lastState = "empty";
let lastInspectParams = null;

const i18n = window.TSI_I18N;

const t = (key, params, fallback) => (i18n && i18n.t(key, params)) || fallback || "";

const setLoading = (loading) => {
  isLoading = loading;
  inspectButton.disabled = loading;
  chainInput.disabled = loading;
  addressInput.disabled = loading;
  form.setAttribute("aria-busy", loading ? "true" : "false");
};

const updateStatus = (message) => {
  statusLine.textContent = message;
};

const updateStatusKey = (key, params, fallback) => {
  updateStatus(t(key, params, fallback));
};

const renderJson = (data) => {
  resultCode.textContent = JSON.stringify(data, null, 2);
};

const showErrorBox = (message) => {
  if (!message) {
    resultError.hidden = true;
    resultError.textContent = "";
    return;
  }
  resultError.hidden = false;
  resultError.textContent = message;
};

const clearChildren = (element) => {
  element.innerHTML = "";
};

const normalizeBadge = (value) => {
  const normalized = value ? value.toString().toLowerCase() : "unknown";
  if (normalized === "ok" || normalized === "warn" || normalized === "high") {
    return normalized;
  }
  return "unknown";
};

const setBadge = (element, value) => {
  const label = normalizeBadge(value);
  element.textContent = label;
  element.className = `badge badge-${label}`;
};

const updateCacheHint = (cacheHeader, meta) => {
  const hints = [];
  if (cacheHeader) {
    hints.push(t("cache.label", { value: cacheHeader.toLowerCase() }, `cache: ${cacheHeader.toLowerCase()}`));
  }
  if (meta && typeof meta.cached === "boolean") {
    hints.push(t(meta.cached ? "cache.cached" : "cache.notCached", null, meta.cached ? "cached" : "not cached"));
  }
  if (meta && meta.stale === true) {
    hints.push(t("cache.stale", null, "stale"));
  }

  if (hints.length === 0) {
    cacheHint.hidden = true;
    cacheHint.textContent = "";
    return;
  }

  cacheHint.hidden = false;
  cacheHint.textContent = hints.join(t("cache.joiner", null, " · "));
};

const showState = (state) => {
  lastState = state;
  emptyState.hidden = state !== "empty";
  loadingState.hidden = state !== "loading";

  const showSuccess = state === "success" || state === "error";
  successState.hidden = !showSuccess;
  rawJsonBlock.hidden = !showSuccess;
};

const getErrorMessage = (data) => {
  if (!data) {
    return t("error.requestNotOk", null, "Request did not return an ok response.");
  }
  if (data.error && typeof data.error === "object" && data.error.message) {
    return data.error.message;
  }
  if (data.error && typeof data.error === "string") {
    return data.error;
  }
  if (data.message) {
    return data.message;
  }
  if (data.reason) {
    return data.reason;
  }
  return t("error.requestNotOk", null, "Request did not return an ok response.");
};

const getErrorCode = (data) => {
  if (!data || !data.error || typeof data.error !== "object") {
    return "";
  }
  return data.error.code || "";
};

const appendTextList = (listElement, items, emptyMessage) => {
  clearChildren(listElement);
  if (!Array.isArray(items) || items.length === 0) {
    const item = document.createElement("li");
    item.textContent = emptyMessage;
    listElement.appendChild(item);
    return;
  }

  items.forEach((entry) => {
    if (!entry) {
      return;
    }
    const item = document.createElement("li");
    item.textContent = entry;
    listElement.appendChild(item);
  });
};

const renderTopReasons = (reasons) => {
  const safeReasons = Array.isArray(reasons) ? reasons.filter(Boolean).slice(0, MAX_TOP_REASONS) : [];
  appendTextList(topReasons, safeReasons, t("reasons.empty", null, "No top reasons available."));
};

const createSectionTitle = (text) => {
  const title = document.createElement("p");
  title.className = "detail-section-title";
  title.textContent = text;
  return title;
};

const createParagraph = (text) => {
  const paragraph = document.createElement("p");
  paragraph.className = "detail-text";
  paragraph.textContent = text;
  return paragraph;
};

const createList = (items) => {
  const list = document.createElement("ul");
  items.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    list.appendChild(li);
  });
  return list;
};

const getSignalHref = (checkId) => {
  if (!checkId) {
    return "";
  }
  const slug = SIGNAL_SLUG_BY_ID[checkId];
  if (!slug) {
    return "";
  }
  return `./signals/${slug}/`;
};

const renderChecks = (checks) => {
  clearChildren(checksList);
  clearChildren(checkDetails);

  const limitedChecks = Array.isArray(checks) ? checks.slice(0, CHECK_LIMIT) : [];

  if (limitedChecks.length === 0) {
    const row = document.createElement("li");
    row.className = "check-row";
    row.textContent = t("checks.empty", null, "No checks available.");
    checksList.appendChild(row);

    const emptyDetail = document.createElement("p");
    emptyDetail.textContent = t("details.empty", null, "No details available.");
    checkDetails.appendChild(emptyDetail);
    return;
  }

  limitedChecks.forEach((check) => {
    const labelText = check.label || t("checks.label.unnamed", null, "Unnamed check");
    const signalHref = getSignalHref(check.id);

    const row = document.createElement("li");
    row.className = "check-row";

    const label = document.createElement("span");
    label.className = "check-row-label";
    label.textContent = labelText;

    const badge = document.createElement("span");
    setBadge(badge, check.result);

    row.appendChild(label);
    row.appendChild(badge);

    if (check.short) {
      const shortText = document.createElement("p");
      shortText.className = "check-row-short";
      shortText.textContent = check.short;
      row.appendChild(shortText);
    }

    if (signalHref) {
      const links = document.createElement("p");
      links.className = "check-row-links";
      const learnMoreLink = document.createElement("a");
      learnMoreLink.href = signalHref;
      learnMoreLink.className = "learn-more-link";
      learnMoreLink.textContent = t("checks.learnMore", null, "Learn more");
      links.appendChild(learnMoreLink);
      row.appendChild(links);
    }

    checksList.appendChild(row);

    const detailsWrapper = document.createElement("div");
    detailsWrapper.className = "check-detail";

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = labelText;
    details.appendChild(summary);

    if (check.detail) {
      details.appendChild(createSectionTitle(t("details.section.detail", null, "Detail")));
      details.appendChild(createParagraph(check.detail));
    }

    if (Array.isArray(check.evidence) && check.evidence.length > 0) {
      details.appendChild(createSectionTitle(t("details.section.evidence", null, "Evidence")));
      details.appendChild(createList(check.evidence));
    }

    if (Array.isArray(check.howToVerify) && check.howToVerify.length > 0) {
      details.appendChild(createSectionTitle(t("details.section.howToVerify", null, "How to verify")));
      details.appendChild(createList(check.howToVerify));
    }

    if (details.children.length === 1) {
      details.appendChild(createParagraph(t("details.section.none", null, "No additional detail available.")));
    }

    detailsWrapper.appendChild(details);
    checkDetails.appendChild(detailsWrapper);
  });
};

const canonicalizeChain = (chain) => (chain || "").trim().toLowerCase();

const canonicalizeAddress = (address) => (address || "").trim().toLowerCase();

const isValidChain = (chain) => ALLOWED_CHAINS.has(chain);

const isValidAddress = (address) => ADDRESS_REGEX.test(address);

const validateInspectParams = ({ chain, address }) => {
  const errors = [];

  if (!chain) {
    errors.push("chain required");
  } else if (!isValidChain(chain)) {
    errors.push("invalid chain (allowed: eth, bsc)");
  }

  if (!address) {
    errors.push("address required");
  } else if (!isValidAddress(address)) {
    errors.push("invalid address format (expected 0x + 40 hex)");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
};

const getCanonicalParamsFromInputs = () => ({
  chain: canonicalizeChain(chainInput.value),
  address: canonicalizeAddress(addressInput.value),
});

const setFormValues = ({ chain, address }) => {
  if (chain && isValidChain(chain)) {
    chainInput.value = chain;
  }
  addressInput.value = address || "";
};

const getCanonicalShareUrl = (params) => {
  const shareParams = new URLSearchParams({
    chain: params.chain,
    address: params.address,
  });
  const lang = (document.documentElement.lang || "").toLowerCase();
  if (lang) {
    shareParams.set("lang", lang);
  }
  return `${window.location.origin}${window.location.pathname}?${shareParams.toString()}`;
};

const updateUrlFromParams = (params) => {
  const url = new URL(window.location.href);
  url.searchParams.set("chain", params.chain);
  url.searchParams.set("address", params.address);
  const lang = (document.documentElement.lang || "").toLowerCase();
  if (lang) {
    url.searchParams.set("lang", lang);
  }
  window.history.replaceState({ ...params, lang }, "", url.toString());
};

const resetCopyFeedback = () => {
  if (copyFeedbackTimerId) {
    window.clearTimeout(copyFeedbackTimerId);
    copyFeedbackTimerId = null;
  }
  copyFeedback.hidden = true;
  copyFeedback.textContent = "";
};

const showCopyFeedback = (message) => {
  resetCopyFeedback();
  copyFeedback.hidden = false;
  copyFeedback.textContent = message;
  copyFeedbackTimerId = window.setTimeout(() => {
    copyFeedback.hidden = true;
    copyFeedback.textContent = "";
    copyFeedbackTimerId = null;
  }, COPY_FEEDBACK_MS);
};

const setCurrentInspectParams = (params) => {
  currentInspectParams = params ? { ...params } : null;
  lastInspectParams = currentInspectParams ? { ...currentInspectParams } : null;
  if (!currentInspectParams) {
    resetCopyFeedback();
    return;
  }
  resetCopyFeedback();
};

const renderSuccess = (data, cacheHeader, params) => {
  lastResponseData = data;
  lastCacheHeader = cacheHeader || "";
  const result = data.result || {};
  showErrorBox("");
  updateCacheHint(cacheHeader, data.meta);
  setBadge(overallBadge, result.overallRisk);
  overallSummary.textContent = result.summary || t("overall.summary.missing", null, "No summary available.");
  renderTopReasons(result.topReasons);
  renderChecks(data.checks);
  setCurrentInspectParams(params);
};

const renderError = (data, cacheHeader, params) => {
  lastResponseData = data;
  lastCacheHeader = cacheHeader || "";
  const message = getErrorMessage(data);
  const code = getErrorCode(data);
  const suffix = code ? t("error.codeSuffix", { code }, ` (code: ${code})`) : "";
  showErrorBox(`${message}${suffix}`);
  updateCacheHint(cacheHeader, data?.meta);
  setBadge(overallBadge, "unknown");
  overallSummary.textContent = message;
  renderTopReasons([]);
  renderChecks([]);
  setCurrentInspectParams(params);
};

const renderValidationError = (message) => {
  showState("error");
  showErrorBox(message);
  updateCacheHint(null, null);
  setBadge(overallBadge, "unknown");
  overallSummary.textContent = message;
  renderTopReasons([]);
  renderChecks([]);
  renderJson({
    ok: false,
    error: {
      code: "invalid_input",
      message,
    },
  });
  updateStatus(message);
  setCurrentInspectParams(null);
  lastResponseData = null;
  lastCacheHeader = "";
};

const buildUrl = (baseUrl, chain, address) => {
  const params = new URLSearchParams({
    chain,
    address,
  });
  if (!baseUrl) {
    return `/api/inspect?${params.toString()}`;
  }
  return `${baseUrl.replace(/\/$/, "")}/api/inspect?${params.toString()}`;
};

const parseResponse = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      error: {
        code: "invalid_response",
        message: t("error.invalidResponse", null, "Response was not valid JSON."),
      },
      raw: text,
    };
  }
};

const isJsonResponse = (response) => {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json");
};

const fetchInspect = async (baseUrl, chain, address) =>
  fetch(buildUrl(baseUrl, chain, address), {
    headers: {
      Accept: "application/json",
    },
  });

const renderNetworkError = () => {
  const message = t("error.network", null, "Network error. Please try again.");
  showState("error");
  showErrorBox(message);
  updateCacheHint(null, null);
  setBadge(overallBadge, "unknown");
  overallSummary.textContent = message;
  renderTopReasons([]);
  renderChecks([]);
  renderJson({
    ok: false,
    error: {
      code: "network_error",
      message,
    },
  });
  updateStatus(message);
  setCurrentInspectParams(null);
  lastResponseData = null;
  lastCacheHeader = "";
};

const runInspection = async (params, options = {}) => {
  const { updateHistory = true } = options;

  const validation = validateInspectParams(params);
  if (!validation.ok) {
    renderValidationError(validation.errors.join(" / "));
    return;
  }

  if (isLoading) {
    return;
  }

  const canonicalParams = {
    chain: canonicalizeChain(params.chain),
    address: canonicalizeAddress(params.address),
  };

  setFormValues(canonicalParams);

  if (updateHistory) {
    updateUrlFromParams(canonicalParams);
  }

  updateStatusKey("status.loading", null, "Inspecting token… Cached results may be used.");
  showState("loading");
  showErrorBox("");
  updateCacheHint(null, null);
  setLoading(true);

  try {
    let response = await fetchInspect("", canonicalParams.chain, canonicalParams.address);
    if (!isJsonResponse(response)) {
      if (WORKERS_API_BASE.includes("REPLACE_ME")) {
        const message = t(
          "error.missingApiBase",
          null,
          "API route is not connected on pages.dev. Set WORKERS_API_BASE to your deployed workers.dev URL.",
        );
        updateStatus(message);
        showState("error");
        showErrorBox(message);
        renderTopReasons([]);
        renderChecks([]);
        setBadge(overallBadge, "unknown");
        overallSummary.textContent = message;
        renderJson({
          ok: false,
          error: {
            code: "missing_api_base",
            message,
          },
        });
        setCurrentInspectParams(null);
        return;
      }
      response = await fetchInspect(WORKERS_API_BASE, canonicalParams.chain, canonicalParams.address);
    }

    const data = await parseResponse(response);
    const cacheHeader = response.headers.get("x-tsi-cache");

    renderJson(data);

    if (data.ok === true) {
      showState("success");
      renderSuccess(data, cacheHeader, canonicalParams);
      updateStatusKey("status.complete", null, "Inspection complete.");
    } else {
      showState("error");
      renderError(data, cacheHeader, canonicalParams);
      updateStatusKey("status.httpError", { status: response.status }, `Request completed with status ${response.status}.`);
    }
  } catch (error) {
    renderNetworkError();
  } finally {
    setLoading(false);
  }
};

const readParamsFromLocation = () => {
  const params = new URLSearchParams(window.location.search);
  const hasChain = params.has("chain");
  const hasAddress = params.has("address");

  if (!hasChain && !hasAddress) {
    return {
      hasParams: false,
      chain: "",
      address: "",
    };
  }

  return {
    hasParams: true,
    chain: canonicalizeChain(params.get("chain") || ""),
    address: canonicalizeAddress(params.get("address") || ""),
  };
};

const handleLocationChange = () => {
  const locationParams = readParamsFromLocation();
  if (!locationParams.hasParams) {
    return;
  }

  const validation = validateInspectParams(locationParams);
  setFormValues(locationParams);

  if (validation.ok) {
    runInspection(locationParams, { updateHistory: false });
    return;
  }

  renderValidationError(validation.errors.join(" / "));
};

const handleCopyShareLink = async () => {
  if (!currentInspectParams) {
    showCopyFeedback(t("share.feedback.none", null, "共有リンクがありません"));
    return;
  }

  const shareUrl = getCanonicalShareUrl(currentInspectParams);

  try {
    await navigator.clipboard.writeText(shareUrl);
    showCopyFeedback(t("share.feedback.copied", null, "コピーしました"));
  } catch (error) {
    showCopyFeedback(t("share.feedback.failed", null, "コピーできませんでした"));
  }
};

showState("empty");
renderJson({});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const params = getCanonicalParamsFromInputs();
  runInspection(params, { updateHistory: true });
});

window.addEventListener("popstate", () => {
  handleLocationChange();
});

copyShareLinkButton.addEventListener("click", () => {
  handleCopyShareLink();
});

document.addEventListener("DOMContentLoaded", () => {
  updateStatusKey("status.idle", null, "Enter a contract address to begin.");
  handleLocationChange();
});

document.addEventListener("tsi:lang-change", () => {
  const lang = document.documentElement.lang || "";
  const shouldUpdateUrl = lang && !new URLSearchParams(window.location.search).has("chain");
  if (shouldUpdateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    window.history.replaceState({ lang }, "", url.toString());
  }

  if (lastState === "loading") {
    updateStatusKey("status.loading", null, "Inspecting token… Cached results may be used.");
    return;
  }

  if (!lastResponseData) {
    updateCacheHint(null, null);
    updateStatusKey("status.idle", null, "Enter a contract address to begin.");
    return;
  }

  if (lastResponseData.ok === true) {
    renderSuccess(lastResponseData, lastCacheHeader, lastInspectParams);
    updateStatusKey("status.complete", null, "Inspection complete.");
    return;
  }

  renderError(lastResponseData, lastCacheHeader, lastInspectParams);
});
