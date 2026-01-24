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

const WORKERS_API_BASE = "https://lingering-frog-8773.badjoke-lab.workers.dev";

const MAX_TOP_REASONS = 5;
const CHECK_LIMIT = 7;

let isLoading = false;

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
    hints.push(`cache: ${cacheHeader.toLowerCase()}`);
  }
  if (meta && typeof meta.cached === "boolean") {
    hints.push(meta.cached ? "cached" : "not cached");
  }
  if (meta && meta.stale === true) {
    hints.push("stale");
  }

  if (hints.length === 0) {
    cacheHint.hidden = true;
    cacheHint.textContent = "";
    return;
  }

  cacheHint.hidden = false;
  cacheHint.textContent = hints.join(" · ");
};

const showState = (state) => {
  emptyState.hidden = state !== "empty";
  loadingState.hidden = state !== "loading";

  const showSuccess = state === "success" || state === "error";
  successState.hidden = !showSuccess;
  rawJsonBlock.hidden = !showSuccess;
};

const getErrorMessage = (data) => {
  if (!data) {
    return "Request did not return an ok response.";
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
  return "Request did not return an ok response.";
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
  appendTextList(topReasons, safeReasons, "No top reasons available.");
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

const renderChecks = (checks) => {
  clearChildren(checksList);
  clearChildren(checkDetails);

  const limitedChecks = Array.isArray(checks) ? checks.slice(0, CHECK_LIMIT) : [];

  if (limitedChecks.length === 0) {
    const row = document.createElement("li");
    row.className = "check-row";
    row.textContent = "No checks available.";
    checksList.appendChild(row);

    const emptyDetail = document.createElement("p");
    emptyDetail.textContent = "No details available.";
    checkDetails.appendChild(emptyDetail);
    return;
  }

  limitedChecks.forEach((check) => {
    const labelText = check.label || "Unnamed check";

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

    checksList.appendChild(row);

    const detailsWrapper = document.createElement("div");
    detailsWrapper.className = "check-detail";

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = labelText;
    details.appendChild(summary);

    if (check.detail) {
      details.appendChild(createSectionTitle("Detail"));
      details.appendChild(createParagraph(check.detail));
    }

    if (Array.isArray(check.evidence) && check.evidence.length > 0) {
      details.appendChild(createSectionTitle("Evidence"));
      details.appendChild(createList(check.evidence));
    }

    if (Array.isArray(check.howToVerify) && check.howToVerify.length > 0) {
      details.appendChild(createSectionTitle("How to verify"));
      details.appendChild(createList(check.howToVerify));
    }

    if (details.children.length === 1) {
      details.appendChild(createParagraph("No additional detail available."));
    }

    detailsWrapper.appendChild(details);
    checkDetails.appendChild(detailsWrapper);
  });
};

const renderSuccess = (data, cacheHeader) => {
  const result = data.result || {};
  showErrorBox("");
  updateCacheHint(cacheHeader, data.meta);
  setBadge(overallBadge, result.overallRisk);
  overallSummary.textContent = result.summary || "No summary available.";
  renderTopReasons(result.topReasons);
  renderChecks(data.checks);
};

const renderError = (data, cacheHeader) => {
  const message = getErrorMessage(data);
  const code = getErrorCode(data);
  const suffix = code ? ` (code: ${code})` : "";
  showErrorBox(`${message}${suffix}`);
  updateCacheHint(cacheHeader, data?.meta);
  setBadge(overallBadge, "unknown");
  overallSummary.textContent = message;
  renderTopReasons([]);
  renderChecks([]);
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
        message: "Response was not valid JSON.",
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
  const message = "Network error. Please try again.";
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
};

showState("empty");
renderJson({});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isLoading) {
    return;
  }

  const chain = chainInput.value.trim().toLowerCase();
  const address = addressInput.value.trim().toLowerCase();

  updateStatus("Inspecting token… Cached results may be used.");
  showState("loading");
  showErrorBox("");
  updateCacheHint(null, null);
  setLoading(true);

  try {
    let response = await fetchInspect("", chain, address);
    if (!isJsonResponse(response)) {
      if (WORKERS_API_BASE.includes("REPLACE_ME")) {
        const message =
          "API route is not connected on pages.dev. Set WORKERS_API_BASE to your deployed workers.dev URL.";
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
        return;
      }
      response = await fetchInspect(WORKERS_API_BASE, chain, address);
    }

    const data = await parseResponse(response);
    const cacheHeader = response.headers.get("x-tsi-cache");

    renderJson(data);

    if (data.ok === true) {
      showState("success");
      renderSuccess(data, cacheHeader);
      updateStatus("Inspection complete.");
    } else {
      showState("error");
      renderError(data, cacheHeader);
      updateStatus(`Request completed with status ${response.status}.`);
    }
  } catch (error) {
    renderNetworkError();
  } finally {
    setLoading(false);
  }
});
