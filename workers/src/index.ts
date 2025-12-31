const jsonResponse = (body: unknown, init?: ResponseInit): Response => {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
};

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/hello") {
      return jsonResponse({ ok: true, message: "hello" });
    }

    return jsonResponse(
      { ok: false, error: { code: "not_found", message: "Not found" } },
      { status: 404 }
    );
  },
};
