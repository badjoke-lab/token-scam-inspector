"use strict";

const form = document.getElementById("inspect-form");
const chainInput = document.getElementById("chain");
const addressInput = document.getElementById("address");
const statusLine = document.getElementById("status");
const resultCode = document.getElementById("result");
const inspectButton = document.getElementById("inspect-button");

const WORKERS_API_BASE = "https://REPLACE_ME.workers.dev";

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
    renderJson(data);

    if (response.ok) {
      updateStatus("Inspection complete.");
    } else {
      updateStatus(`Request completed with status ${response.status}.`);
    }
  } catch (error) {
    updateStatus("Network error. Please try again.");
    renderJson({ error: "Network error. Please try again." });
  } finally {
    setLoading(false);
  }
});
