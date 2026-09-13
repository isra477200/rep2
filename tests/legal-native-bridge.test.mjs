import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/abogados/native-bridge.js', import.meta.url), 'utf8');
const ORIGIN = 'https://api.leadconnectorhq.com';
const LOCATION = 'KdwdmsNodpCq6RYicQ1N';
const FORMS = { phone: 'cxXcdVJAXp9MBbRpm29d', whatsapp: 'XMLHrXNBUMUlHOsFUvJH' };
const PAID = '?utm_source=meta&utm_medium=paid_social&utm_campaign=sistema_redvitalia_abogados&utm_content=E1_meta_feed';
const plain = value => JSON.parse(JSON.stringify(value));

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); }
  };
}

function frame() {
  return { ...eventTarget(), id: '', name: '', src: '', style: {},
    contentWindow: { sent: [], postMessage(data, origin) { this.sent.push({ data, origin }); } },
    getAttribute(name) { return this[name] || null; }
  };
}

function setup(extra = {}) {
  const context = vm.createContext({ URL, URLSearchParams });
  vm.runInContext(source, context, { filename: 'native-bridge.js' });
  const target = eventTarget(), acks = [], resizes = [];
  const api = context.RedVitaliaNativeBridge;
  const bridge = api.create({ forms: FORMS, locationId: LOCATION, eventTarget: target,
    onAck: ack => acks.push(ack), onResize: value => resizes.push(value), ...extra });
  const whatsapp = frame();
  const registered = bridge.register(whatsapp, { channel: 'whatsapp', search: PAID,
    pageURL: 'http://localhost:3000/abogados/redvitalia.html?email=must-not-forward@example.invalid#private-fragment' });
  const emit = data => bridge.receive({ origin: ORIGIN, source: whatsapp.contentWindow, data });
  const success = () => ['set-sticky-contacts', 'embedded_iframe_' + registered.frameId, registered.frameId, LOCATION, 'MUST_NOT_FORWARD'];
  return { api, target, bridge, acks, resizes, whatsapp, registered, emit, success };
}

test('registration owns both iframe IDs and constructs a known provider URL', () => {
  const { whatsapp, registered } = setup();
  assert.equal(whatsapp.id, registered.frameId);
  assert.equal(whatsapp.name, registered.frameId);
  const url = new URL(whatsapp.src);
  assert.equal(url.origin, ORIGIN);
  assert.equal(url.pathname, '/widget/form/' + FORMS.whatsapp);
  assert.equal(url.searchParams.get('utm_content'), 'e1_meta_feed');
  assert.equal(url.searchParams.has('email'), false);
});

test('native readiness receives an OBJECT query payload and exact explicit target origin', () => {
  const { emit, whatsapp, registered } = setup();
  assert.equal(emit(['iframeLoaded']), 'handshake');
  const { data, origin } = whatsapp.contentWindow.sent[0];
  assert.equal(origin, ORIGIN);
  assert.equal(data[0], 'query-params');
  assert.equal(typeof data[1], 'object');
  assert.equal(Array.isArray(data[1]), false);
  assert.equal(data[1].source, 'Sistema RedVitalia | Abogados | e1_meta_feed | WhatsApp');
  assert.equal(data[3], '');
  assert.equal(data[4], registered.frameId);
  assert.equal(data.length, 5, 'consent is omitted when no explicit value is supplied');
  assert.equal(data[2].includes('email'), false);
  assert.equal(data[2].includes('#'), false);
});

test('valid known native success acknowledges exactly once without copying fingerprint', () => {
  const { emit, success, acks } = setup();
  emit(['iframeLoaded']);
  assert.equal(emit(success()), 'ack');
  assert.equal(emit(success()), 'duplicate');
  assert.equal(acks.length, 1);
  assert.deepEqual(Object.keys(acks[0]).sort(), ['channel', 'formId', 'frameId', 'locationId']);
  assert.equal(acks[0].channel, 'whatsapp');
});

test('acknowledgment is rejected before native handshake', () => {
  const { emit, success, acks } = setup();
  assert.equal(emit(success()), 'ignored');
  assert.equal(acks.length, 0);
});

test('fingerprint and sticky personal payload are never read', () => {
  const { emit, success, acks } = setup();
  emit(['iframeLoaded']);
  const privateCookie = ['set-sticky-contacts', '_ud'];
  Object.defineProperty(privateCookie, '2', { get() { throw new Error('Private cookie read'); } });
  assert.equal(emit(privateCookie), 'ignored');
  const confirmed = success();
  Object.defineProperty(confirmed, '4', { get() { throw new Error('Fingerprint read'); } });
  assert.equal(emit(confirmed), 'ack');
  assert.equal(acks.length, 1);
});

test('reject spoofed origin, protocol, port and missing/unrelated source', () => {
  const { bridge, emit, success, whatsapp, acks } = setup();
  emit(['iframeLoaded']);
  for (const origin of [ORIGIN + '.example.invalid', 'http://api.leadconnectorhq.com', ORIGIN + ':444', 'null']) {
    assert.equal(bridge.receive({ origin, source: whatsapp.contentWindow, data: success() }), 'ignored');
  }
  for (const source of [null, {}, undefined]) assert.equal(bridge.receive({ origin: ORIGIN, source, data: success() }), 'ignored');
  assert.equal(acks.length, 0);
});

test('reject crossed IDs, malformed marker, wrong location and missing native ID', () => {
  const { emit, success, acks } = setup();
  emit(['iframeLoaded']);
  const badId = success(); badId[2] = 'other-frame';
  const badMarker = success(); badMarker[1] = 'embedded_iframe_other-frame';
  const badLocation = success(); badLocation[3] = 'another-location';
  const missing = ['set-sticky-contacts', 'embedded_iframe_undefined', undefined, LOCATION];
  for (const data of [badId, badMarker, badLocation, missing, 'set-sticky-contacts', {}, null]) assert.equal(emit(data), 'ignored');
  assert.equal(acks.length, 0);
});

test('channel comes from the registered iframe, never from message claims', () => {
  const { bridge, acks } = setup();
  const phone = frame(), registered = bridge.register(phone, { channel: 'phone', search: PAID });
  bridge.receive({ origin: ORIGIN, source: phone.contentWindow, data: ['iframeLoaded'] });
  bridge.receive({ origin: ORIGIN, source: phone.contentWindow,
    data: ['set-sticky-contacts', 'embedded_iframe_' + registered.frameId, registered.frameId, LOCATION, { channel: 'whatsapp' }] });
  assert.equal(acks[0].channel, 'phone');
  assert.equal(acks[0].formId, FORMS.phone);
});

test('fetch-query-params must match iframe name, location AND actual configured form', () => {
  const { emit, registered, whatsapp } = setup();
  assert.equal(emit(['fetch-query-params', registered.frameId, LOCATION, FORMS.phone, 'ignored-style']), 'ignored');
  assert.equal(emit(['fetch-query-params', 'other', LOCATION, FORMS.whatsapp]), 'ignored');
  assert.equal(emit(['fetch-query-params', registered.frameId, LOCATION, FORMS.whatsapp, 'ignored-style']), 'handshake');
  assert.equal(whatsapp.contentWindow.sent.length, 1);
});

test('mutating iframe src or id invalidates future messages', () => {
  const { emit, whatsapp, success, acks } = setup();
  emit(['iframeLoaded']);
  whatsapp.src = ORIGIN + '/widget/form/' + FORMS.phone;
  assert.equal(emit(success()), 'ignored');
  whatsapp.src = ORIGIN + '/widget/form/' + FORMS.whatsapp;
  whatsapp.id = 'spoofed';
  assert.equal(emit(success()), 'ignored');
  assert.equal(acks.length, 0);
});

test('query allowlist strips personal fields, arbitrary source, cross-platform content and fragment', () => {
  const { api } = setup();
  const params = api.safeParams(PAID + '&email=x@example.invalid&phone=999&contact_id=secret&source=PRIVATE', 'phone', 'quality');
  assert.deepEqual(Object.keys(params).sort(), ['source', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source']);
  assert.match(params.source, /Llamada \| Mejorar la calidad/);
  assert.equal(JSON.stringify(params).includes('PRIVATE'), false);
  const wrongPlatform = api.safeParams(PAID.replace('E1_meta_feed', 'e1_pmax_wide'), 'phone');
  assert.equal(wrongPlatform.utm_content, undefined);
  assert.equal(api.safeParams(PAID.replace('paid_social', 'email'), 'phone').utm_source, undefined);
  const url = api.safePage('http://localhost:3000/private-personal-path?secret=1#secret', params);
  assert.equal(new URL(url).pathname, '/abogados/redvitalia.html');
  assert.equal(url.includes('secret'), false);
  assert.throws(() => api.safePage('https://unknown.example.invalid/', params));
});

test('explicit consent uses verified provider envelope, never grants advertising', () => {
  const { emit, whatsapp } = setup({ consent: { hasResponded: true, analytics: true, email: 'DO_NOT_FORWARD', advertising: true } });
  emit(['iframeLoaded']);
  const envelope = plain(whatsapp.contentWindow.sent[0].data[5]);
  assert.deepEqual(envelope, { consent: { provider: 'redvitalia', hasResponded: true,
    categories: { necessary: true, analytics: true, marketing: false, advertising: false, advertisement: false } }, isConsentExpected: true });
});

test('invalid/unavailable consent is omitted; unknown consent does not grant analytics', () => {
  const first = setup({ getConsent() { throw new Error('Unavailable'); } });
  first.emit(['iframeLoaded']);
  assert.equal(first.whatsapp.contentWindow.sent[0].data.length, 5);
  const second = setup({ consent: { hasResponded: false, analytics: true } });
  second.emit(['iframeLoaded']);
  assert.equal(second.whatsapp.contentWindow.sent[0].data[5].consent.categories.analytics, false);
});

test('resizer initialization has known minimal v4.1.1 fields and no wildcard target', () => {
  const { emit, whatsapp, registered } = setup();
  emit('[iFrameResizerChild]Ready');
  emit('[iFrameResizerChild]Ready');
  assert.equal(whatsapp.contentWindow.sent.length, 1);
  assert.equal(whatsapp.contentWindow.sent[0].data, '[iFrameSizer]' + registered.frameId + ':0:false:false:32');
  assert.equal(whatsapp.contentWindow.sent[0].origin, ORIGIN);
});

test('resize accepts known frame numeric height and clamps the rendered dimensions', () => {
  const { emit, whatsapp, registered, resizes } = setup();
  assert.equal(emit('[iFrameSizer]' + registered.frameId + ':744.25:305:init'), 'resize');
  assert.equal(whatsapp.style.height, '745px');
  assert.equal(emit('[iFrameSizer]' + registered.frameId + ':9000:305:mutationObserver'), 'resize');
  assert.equal(whatsapp.style.height, '2200px');
  assert.equal(emit('[iFrameSizer]' + registered.frameId + ':10:305:resize'), 'resize');
  assert.equal(whatsapp.style.height, '360px');
  assert.equal(resizes.length, 3);
});

test('resize rejects spoofed IDs, negative/nonfinite/oversized values and commands', () => {
  const { emit, registered, resizes } = setup();
  for (const tail of ['-10:305:resize', 'NaN:305:resize', 'Infinity:305:resize', '0:305:resize', '10001:305:resize', '700:305:scrollTo', '700:305:close', '700:305:message:PRIVATE']) {
    assert.equal(emit('[iFrameSizer]' + registered.frameId + ':' + tail), 'ignored');
  }
  assert.equal(emit('[iFrameSizer]other:700:305:init'), 'ignored');
  assert.equal(resizes.length, 0);
});

test('unregister and disposal remove handlers and reject stale window references', () => {
  const { bridge, emit, whatsapp, target, success, acks } = setup();
  emit(['iframeLoaded']);
  bridge.unregister(whatsapp);
  assert.equal(emit(success()), 'ignored');
  assert.equal(whatsapp.listeners.size, 0);
  bridge.dispose();
  assert.equal(target.listeners.size, 0);
  assert.throws(() => bridge.register(frame(), { channel: 'phone' }));
  assert.equal(acks.length, 0);
});

test('provider-style receive assigns iframe ID and controlled Source before successful acknowledgment', () => {
  const { emit, whatsapp, acks, registered } = setup();
  emit(['iframeLoaded']);
  const received = whatsapp.contentWindow.sent[0].data;
  // Equivalent field extraction observed in the public GHL route, not a DOM simulation.
  const nativeState = { urlParams: received[1], url: received[2], referrer: received[3], iFrameId: received[4] };
  assert.equal(nativeState.iFrameId, registered.frameId);
  assert.equal(nativeState.urlParams.source, 'Sistema RedVitalia | Abogados | e1_meta_feed | WhatsApp');
  emit(['set-sticky-contacts', 'embedded_iframe_' + nativeState.iFrameId, nativeState.iFrameId, LOCATION, 'DO_NOT_READ']);
  assert.equal(acks.length, 1);
});
