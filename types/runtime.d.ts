/// <reference types="@cloudflare/workers-types" />

declare module "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url" {
  const workerUrl: string;
  export default workerUrl;
}

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
  }
}
