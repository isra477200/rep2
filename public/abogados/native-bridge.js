/* RedVitalia / GHL native bridge. Classic script; no dependency on a complete DOM.
 * Provider contracts observed 2026-09-13:
 * https://stcdn.leadconnectorhq.com/_preview/B4o12YCY.js (handshake)
 * https://stcdn.leadconnectorhq.com/_preview/DDJgUbKy.js (successful submit)
 * https://stcdn.leadconnectorhq.com/_preview/Dujl-FSt.js (host consent schema)
 * https://storage.googleapis.com/builder-preview/iframe/iframeResizer.contentWindow.min.js (v4.1.1)
 */
(function (root) {
  'use strict';
  const ORIGIN = 'https://api.leadconnectorhq.com';
  const DEFAULT_PAGE = 'https://redvitalia.srv1480016.hstgr.cloud/abogados/redvitalia.html';
  const ID = /^[A-Za-z0-9]{15,40}$/;
  const CHANNELS = new Set(['phone', 'whatsapp']);
  const PRIORITIES = Object.freeze({
    demand: 'Conseguir más consultas', quality: 'Mejorar la calidad de las consultas',
    followup: 'Convertir consultas en citas', measure: 'Saber qué termina en cliente'
  });
  const PAGE_ORIGINS = new Set([
    'https://redvitalia.srv1480016.hstgr.cloud', 'https://redvitalia.com',
    'https://www.redvitalia.com', 'http://localhost:3000', 'http://127.0.0.1:3000'
  ]);
  const NON_RESIZE_TYPES = new Set(['close', 'message', 'scrollTo', 'scrollToOffset', 'inPageLink', 'pageInfo', 'autoResize']);
  let bridgeSequence = 0;

  function safeParams(search, channel, priority) {
    if (!CHANNELS.has(channel)) throw new TypeError('Unsupported contact channel');
    const query = new URLSearchParams(typeof search === 'string' ? search : '');
    const params = {};
    const source = query.get('utm_source'), medium = query.get('utm_medium');
    const paid = query.get('utm_campaign') === 'sistema_redvitalia_abogados' &&
      ((source === 'meta' && medium === 'paid_social') || (source === 'google' && medium === 'cpc'));
    let campaign = 'direct';
    if (paid) {
      params.utm_source = source; params.utm_medium = medium;
      params.utm_campaign = 'sistema_redvitalia_abogados';
      campaign = source === 'meta' ? 'meta_campaign' : 'pmax_campaign';
      const content = (query.get('utm_content') || '').toLowerCase();
      const pattern = source === 'meta' ? /^e[1-5]_meta_(feed|square|story)$/ : /^e[1-5]_pmax_(wide|square|portrait)$/;
      if (pattern.test(content)) { params.utm_content = content; campaign = content; }
    }
    params.source = 'Sistema RedVitalia | Abogados | ' + campaign + ' | ' +
      (channel === 'phone' ? 'Llamada' : 'WhatsApp') +
      (Object.hasOwn(PRIORITIES, priority) ? ' | ' + PRIORITIES[priority] : '');
    return params;
  }

  function safePage(input, params) {
    const page = new URL(input || DEFAULT_PAGE);
    if (!PAGE_ORIGINS.has(page.origin) || page.username || page.password) throw new TypeError('Unsupported public page origin');
    // Arbitrary path segments can contain personal information; only known site pages survive.
    if (!/^\/abogados\/(?:index|redvitalia|segunda-oportunidad|herencias|divorcios|manual|anuncios|medicion|privacidad)\.html$/.test(page.pathname)) page.pathname = '/abogados/redvitalia.html';
    page.search = ''; page.hash = '';
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
      if (params[key]) page.searchParams.set(key, params[key]);
    }
    return page.href;
  }

  function safeConsent(value) {
    // Optional. Shape verified in Dujl-FSt.js. Never infer advertising permission from analytics.
    if (!value || typeof value.hasResponded !== 'boolean' || typeof value.analytics !== 'boolean') return undefined;
    return {
      consent: {
        provider: 'redvitalia', hasResponded: value.hasResponded,
        categories: { necessary: true, analytics: value.hasResponded && value.analytics, marketing: false, advertising: false, advertisement: false }
      },
      isConsentExpected: true
    };
  }

  function create(options) {
    if (!options || !ID.test(options.locationId || '')) throw new TypeError('A valid native location ID is required');
    const forms = { phone: options.forms?.phone, whatsapp: options.forms?.whatsapp };
    if (!ID.test(forms.phone || '') || !ID.test(forms.whatsapp || '') || forms.phone === forms.whatsapp) throw new TypeError('Two distinct native form IDs are required');
    const target = options.eventTarget || root;
    if (typeof target.addEventListener !== 'function' || typeof target.removeEventListener !== 'function') throw new TypeError('An event target is required');
    const entries = new Map(), instanceId = ++bridgeSequence;
    const locationId = options.locationId;
    let sequence = 0, disposed = false;

    function validFrame(entry) {
      if (!entry || entry.frame.id !== entry.id) return false;
      try {
        const url = new URL(entry.frame.getAttribute('src') || entry.frame.src);
        return url.origin === ORIGIN && !url.username && !url.password && url.pathname === '/widget/form/' + entry.formId;
      } catch { return false; }
    }

    function post(entry, data) {
      if (!validFrame(entry) || !entry.frame.contentWindow) return false;
      try { entry.frame.contentWindow.postMessage(data, ORIGIN); return true; } catch { return false; }
    }

    function handshake(entry) {
      const payload = ['query-params', { ...entry.params }, entry.pageURL, '', entry.id];
      let consent;
      try { consent = safeConsent(typeof options.getConsent === 'function' ? options.getConsent() : options.consent); } catch { /* Omit an unavailable optional consent value. */ }
      if (consent) payload.push(consent);
      if (post(entry, payload)) { entry.handshaken = true; return true; }
      return false;
    }

    function initResize(entry) {
      // The observed v4.1.1 child parses these first five fields. Remaining defaults stay intact:
      // iframe ID, margin 0, width calculation false, logging false, interval 32 ms.
      // No wildcard target, scrolling, navigation, parent cookie or style payload is sent.
      if (!entry.resizeInitialized && post(entry, '[iFrameSizer]' + entry.id + ':0:false:false:32')) entry.resizeInitialized = true;
    }

    function receive(event) {
      if (disposed || !event || event.origin !== ORIGIN || !event.source) return 'ignored';
      const entry = [...entries.values()].find(candidate => candidate.frame.contentWindow === event.source);
      if (!validFrame(entry)) return 'ignored';
      const data = event.data;
      if (Array.isArray(data)) {
        if (data[0] === 'iframeLoaded' && data.length === 1) {
          if(typeof options.onReady === 'function') options.onReady({frameId:entry.id});
          return handshake(entry) ? 'handshake' : 'ignored';
        }
        if (data[0] === 'fetch-query-params') {
          // This provider event carries additional IDs; do not use the embedded style JSON.
          if (data[1] !== entry.id || data[2] !== locationId || data[3] !== entry.formId) return 'ignored';
          if(typeof options.onReady === 'function') options.onReady({frameId:entry.id});
          return handshake(entry) ? 'handshake' : 'ignored';
        }
        if (data[0] !== 'set-sticky-contacts' || !entry.handshaken ||
            data[1] !== 'embedded_iframe_' + entry.id || data[2] !== entry.id || data[3] !== locationId) return 'ignored';
        // In particular, ignore _ud and never access index 4 (native contact fingerprint).
        if (entry.acknowledged) return 'duplicate';
        entry.acknowledged = true;
        if (typeof options.onAck === 'function') options.onAck(Object.freeze({
          frameId: entry.id, formId: entry.formId, locationId, channel: entry.channel
        }));
        return 'ack';
      }
      if (data === '[iFrameResizerChild]Ready') { initResize(entry); return 'resize-init'; }
      if (typeof data !== 'string' || data.length > 150 || !data.startsWith('[iFrameSizer]')) return 'ignored';
      const fields = data.slice(13).split(':');
      if (fields.length !== 4 || fields[0] !== entry.id || !/^\d{1,5}(?:\.\d{1,3})?$/.test(fields[1]) ||
          !/^\d{1,5}(?:\.\d{1,3})?$/.test(fields[2]) || !/^[A-Za-z][A-Za-z0-9 _.-]{0,48}$/.test(fields[3]) || NON_RESIZE_TYPES.has(fields[3])) return 'ignored';
      const measured = Number(fields[1]);
      if (!Number.isFinite(measured) || measured <= 0 || measured > 10000) return 'ignored';
      const height = Math.max(360, Math.min(2200, Math.ceil(measured)));
      entry.frame.style.height = height + 'px';
      entry.frame.style.minHeight = height + 'px';
      if (typeof options.onResize === 'function') options.onResize(Object.freeze({ frameId: entry.id, channel: entry.channel, height }));
      return 'resize';
    }

    function register(frame, values) {
      if (disposed) throw new Error('The native bridge has been disposed');
      if (!frame || !values || !CHANNELS.has(values.channel) || entries.has(frame)) throw new TypeError('A new native iframe and known channel are required');
      const params = safeParams(values.search || '', values.channel, values.priority);
      const entry = { frame, channel: values.channel, formId: forms[values.channel], params,
        id: 'rv-native-' + instanceId + '-' + values.channel + '-' + (++sequence),
        pageURL: safePage(values.pageURL || options.pageURL, params), handshaken: false, acknowledged: false, resizeInitialized: false };
      // Register before appending/navigating the frame so the native readiness event cannot be missed.
      frame.id = entry.id; frame.name = entry.id;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      const url = new URL(ORIGIN + '/widget/form/' + entry.formId);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      frame.src = url.href;
      entry.onLoad = () => { handshake(entry); initResize(entry); };
      frame.addEventListener?.('load', entry.onLoad);
      entries.set(frame, entry);
      return Object.freeze({ frameId: entry.id, formId: entry.formId, url: url.href, channel: entry.channel });
    }

    function unregister(frame) {
      const entry = entries.get(frame);
      if (entry) frame.removeEventListener?.('load', entry.onLoad);
      entries.delete(frame);
    }

    function dispose() {
      target.removeEventListener('message', receive);
      for (const frame of [...entries.keys()]) unregister(frame);
      disposed = true;
    }

    target.addEventListener('message', receive);
    return Object.freeze({ register, unregister, dispose, receive,
      refreshConsent() { for (const entry of entries.values()) handshake(entry); }
    });
  }

  root.RedVitaliaNativeBridge = Object.freeze({ create, safeParams, safePage, safeConsent });
})(globalThis);
