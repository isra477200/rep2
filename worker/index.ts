/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import MAESTRO_CONTEXT from "./redvitalia-maestro-context.generated.json";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  REDVITALIA_AI_GATEWAY_SECRET?: string;
  REDVITALIA_AI_WEBHOOK_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/redvitalia-ai") {
      const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
      if (request.method !== "POST" && request.method !== "GET") return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405, headers });
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) return Response.json({ ok: false, error: "origin_not_allowed" }, { status: 403, headers });
      if (!env.REDVITALIA_AI_GATEWAY_SECRET) return Response.json({ ok: false, error: "gateway_not_configured" }, { status: 503, headers });

      const webhookUrl = env.REDVITALIA_AI_WEBHOOK_URL || "https://n8n-wmlc.srv1480016.hstgr.cloud/webhook/redvitalia-maestro";
      const requestId = crypto.randomUUID().replaceAll("-", "");
      let body: Record<string, unknown> = { action: "status", requestId };
      if (request.method === "POST") {
        const contentLength = Number(request.headers.get("Content-Length") || 0);
        if (contentLength > 60_000) return Response.json({ ok: false, error: "request_too_large" }, { status: 413, headers });
        try {
          const input = await request.json() as Record<string, unknown>;
          const history = Array.isArray(input.history) ? input.history.slice(-8) : [];
          body = {
            action: "ask",
            requestId,
            conversationId: String(input.conversationId || "").slice(0, 100),
            mode: String(input.mode || "ask").slice(0, 20),
            page: String(input.page || "/").slice(0, 180),
            question: String(input.question || "").slice(0, 8_000),
            pageContext: String(input.pageContext || "").slice(0, 6_000),
            history,
          };
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400, headers });
        }

        body.appContext = JSON.stringify(MAESTRO_CONTEXT).slice(0, 70_000);
      }

      try {
        const upstream = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-RedVitalia-AI": env.REDVITALIA_AI_GATEWAY_SECRET },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(315_000),
        });
        const result = await upstream.json().catch(() => ({ ok: false, error: "invalid_upstream_response" }));
        return Response.json(result, { status: upstream.status, headers });
      } catch {
        return Response.json({ ok: false, error: "assistant_unavailable" }, { status: 503, headers });
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
