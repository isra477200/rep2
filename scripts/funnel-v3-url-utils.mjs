export function safePublicUrl(value) {
  try {
    let raw = String(value ?? "").trim();
    if (!raw || raw.endsWith("\\") || /\[\[[^\]]+\]\]/.test(raw)) return null;
    if (/^https?:\/\/ss\.ge\/ka\/home\/help\?index=0\)$/i.test(raw)) raw = raw.slice(0, -1);

    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (/^(?:l|lm)\.facebook\.com$/i.test(url.hostname) && url.pathname === "/l.php") {
      const destination = url.searchParams.get("u");
      return destination ? safePublicUrl(destination) : null;
    }
    if (/(?:^|\.)notion\.(?:com|so)$/i.test(url.hostname) || /\.notion\.site$/i.test(url.hostname)) return null;
    if (/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname)) return null;
    if (/(?:^|\.)validate\.perfdrive\.com$/i.test(url.hostname)) return null;
    if ([...url.searchParams.keys()].some((key) => /^(?:token|signature|x-amz-|x-goog-)/i.test(key))) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|fbclid|gclid|msclkid|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    if (/^request\.angi\.com$/i.test(url.hostname) && /^\/service-request\//i.test(url.pathname)) url.search = "";
    return url.href;
  } catch {
    return null;
  }
}
