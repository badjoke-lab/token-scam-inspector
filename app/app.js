"use strict";

const form = document.getElementById("inspect-form");
const chainInput = document.getElementById("chain");
const addressInput = document.getElementById("address");
const statusLine = document.getElementById("status");
const summaryOverallRisk = document.getElementById("summary-overall-risk");
const summaryText = document.getElementById("summary-text");
const summaryTopReasons = document.getElementById("summary-top-reasons");
const cacheStatus = document.getElementById("cache-status");
const checksList = document.getElementById("checks-list");
const resultCode = document.getElementById("result");
const inspectButton = document.getElementById("inspect-button");

const WORKERS_API_BASE = "https://lingering-frog-8773.badjoke-lab.workers.dev";

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

const setText = (element, value) => {
  element.textContent = value;
};

const clearChildren = (element) => {
  element.innerHTML = "";
};

const renderList = (listElement, items, emptyMessage) => {
  clearChildren(listElement);
  if (!Array.isArray(items) || items.length === 0) {
    const item = document.createElement("li");
    item.textContent = emptyMessage;
    listElement.appendChild(item);
    return;
  }

  items.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    listElement.appendChild(item);
  });
};

const renderCacheStatus = (headerValue, metaCached) => {
  const headerText = headerValue ? headerValue.toUpperCase() : "unknown";
  const metaText =
    typeof metaCached === "boolean" ? String(metaCached) : "unknown";
  setText(cacheStatus, `Cache: ${headerText} (meta.cached=${metaText})`);
};

const renderChecks = (checks) => {
  clearChildren(checksList);
  if (!Array.isArray(checks) || checks.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No checks available.";
    checksList.appendChild(item);
    return;
  }

  checks.forEach((check) => {
    const item = document.createElement("li");

    const header = document.createElement("div");
    const label = document.createElement("strong");
    label.textContent = check.label || "Unnamed check";
    const result = document.createElement("span");
    result.textContent = ` — ${check.result || "unknown"}`;
    header.appendChild(label);
    header.appendChild(result);
    item.appendChild(header);

    if (check.short) {
      const shortText = document.createElement("p");
      shortText.textContent = check.short;
      item.appendChild(shortText);
    }

    if (check.detail || check.evidence || check.howToVerify) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Details";
      details.appendChild(summary);

      if (check.detail) {
        const detailText = document.createElement("p");
        detailText.textContent = check.detail;
        details.appendChild(detailText);
      }

      if (Array.isArray(check.evidence) && check.evidence.length > 0) {
        const evidenceTitle = document.createElement("p");
        evidenceTitle.textContent = "Evidence";
        details.appendChild(evidenceTitle);

        const evidenceList = document.createElement("ul");
        check.evidence.forEach((entry) => {
          const li = document.createElement("li");
          li.textContent = entry;
          evidenceList.appendChild(li);
        });
        details.appendChild(evidenceList);
      }

      if (Array.isArray(check.howToVerify) && check.howToVerify.length > 0) {
        const verifyTitle = document.createElement("p");
        verifyTitle.textContent = "How to verify";
        details.appendChild(verifyTitle);

        const verifyList = document.createElement("ul");
        check.howToVerify.forEach((entry) => {
          const li = document.createElement("li");
          li.textContent = entry;
          verifyList.appendChild(li);
        });
        details.appendChild(verifyList);
      }

      item.appendChild(details);
    }

    checksList.appendChild(item);
  });
};

const renderErrorSummary = (data, cacheHeader) => {
  const message =
    data && (data.error || data.message || data.reason)
      ? data.error || data.message || data.reason
      : "Request did not return an ok response.";
  setText(summaryOverallRisk, "unknown");
  setText(summaryText, message);
  renderList(summaryTopReasons, [], "No top reasons available.");
  renderChecks([]);
  renderCacheStatus(cacheHeader, data?.meta?.cached);
};

const renderOkSummary = (data, cacheHeader) => {
  const result = data.result || {};
  setText(summaryOverallRisk, result.overallRisk || "unknown");
  setText(summaryText, result.summary || "No summary available.");
  renderList(
    summaryTopReasons,
    result.topReasons,
    "No top reasons available."
  );
  renderCacheStatus(cacheHeader, data?.meta?.cached);
  renderChecks(data.checks);
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
      error: "Response was not valid JSON.",
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isLoading) {
    return;
  }

  const chain = chainInput.value.trim().toLowerCase();
  const address = addressInput.value.trim().toLowerCase();

  updateStatus("Inspecting token… Cached results may be used.");
  setLoading(true);

  try {
    let response = await fetchInspect("", chain, address);
    if (!isJsonResponse(response)) {
      if (WORKERS_API_BASE.includes("REPLACE_ME")) {
        const message =
          "API route is not connected on pages.dev. Set WORKERS_API_BASE to your deployed workers.dev URL.";
        updateStatus(message);
        renderJson({ error: message });
        return;
      }
      response = await fetchInspect(WORKERS_API_BASE, chain, address);
    }

    const data = await parseResponse(response);
    const cacheHeader = response.headers.get("x-tsi-cache");
    renderJson(data);

    if (data.ok === true) {
      renderOkSummary(data, cacheHeader);
      updateStatus("Inspection complete.");
    } else {
      renderErrorSummary(data, cacheHeader);
      updateStatus(`Request completed with status ${response.status}.`);
    }
  } catch (error) {
    updateStatus("Network error. Please try again.");
    renderJson({ error: "Network error. Please try again." });
    setText(summaryOverallRisk, "unknown");
    setText(summaryText, "Network error. Please try again.");
    renderList(summaryTopReasons, [], "No top reasons available.");
    renderChecks([]);
    renderCacheStatus(null, null);
  } finally {
    setLoading(false);
  }
});
