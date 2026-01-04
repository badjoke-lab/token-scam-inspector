"use strict";

const form = document.getElementById("inspect-form");
const chainInput = document.getElementById("chain");
const addressInput = document.getElementById("address");
const statusLine = document.getElementById("status");
const resultCode = document.getElementById("result");
const inspectButton = document.getElementById("inspect-button");

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

const buildUrl = (chain, address) => {
  const params = new URLSearchParams({
    chain,
    address,
  });
  return `/api/inspect?${params.toString()}`;
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
    const response = await fetch(buildUrl(chain, address), {
      headers: {
        Accept: "application/json",
      },
    });

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
