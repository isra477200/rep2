"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import CompanyLogo from "./CompanyLogo";
import type { Company, Country, CountryGeo, LogoManifest, Takeaway } from "./data-types";

setWorkerUrl(workerUrl);

const SPECIAL_MARKETS: CountryGeo[] = [
  { name: "Kosovo", code: "XK", code3: "XKX", latitude: 42.6, longitude: 20.9, region: "Europe", subregion: "Southeast Europe", flag: "🇽🇰", precision: "country_centroid", locationLabel: "Punto representativo del territorio; no indica una sede exacta", source: "centroide territorial público" },
  { name: "Hong Kong", code: "HK", code3: "HKG", latitude: 22.32, longitude: 114.17, region: "Asia", subregion: "Eastern Asia", flag: "🇭🇰", precision: "country_centroid", locationLabel: "Punto representativo del mercado; no indica una sede exacta", source: "centroide territorial público" },
  { name: "Taiwán", code: "TW", code3: "TWN", latitude: 23.7, longitude: 121, region: "Asia", subregion: "Eastern Asia", flag: "🇹🇼", precision: "country_centroid", locationLabel: "Punto representativo del mercado; no indica una sede exacta", source: "centroide territorial público" },
];

const precisionLabel = {
  exacta_publicada: "Punto publicado",
  centro_ciudad: "Centro de ciudad",
  centro_pais_mercado: "País / mercado",
  sin_punto: "Sin punto inventado",
} as const;

/** Zoom a partir del cual aparecen logos individuales, sin ensuciar la vista mundial. */
const LOGO_ZOOM = 4.15;
/** Límite visual deliberado: el mapa debe seguir siendo legible al acercarse. */
const MAX_LOGO_MARKERS = 42;
/** Pasos cortos para que teclado y botones nunca desplacen medio planeta de golpe. */
const PAN_STEP_X = 12;
const PAN_STEP_Y = 8;
const ZOOM_STEP = 0.35;

type MapStatus = "loading" | "ready" | "fallback";

function viewLevelForZoom(zoom: number): string {
  if (zoom < 2.25) return "Mundo";
  if (zoom < 3.45) return "Región";
  if (zoom < 5.15) return "País";
  if (zoom < 6.5) return "Ciudad";
  return "Detalle";
}

function companyZoom(company: Company): number {
  if (company.location?.precision === "exacta_publicada") return 6.7;
  if (company.location?.precision === "centro_ciudad") return 5.7;
  return 4.45;
}

function calmEasing(value: number): number {
  return value * value * (3 - 2 * value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));
}

function companyPosition(company: Company): [number, number] | null {
  const location = company.location;
  if (!location || location.latitude === null || location.longitude === null) return null;
  return [location.longitude, location.latitude];
}

function worldZoomForViewport(): number {
  if (window.innerWidth <= 620) return 1.15;
  if (window.innerWidth <= 900) return 1.5;
  return 1.85;
}

export default function WorldMap({
  companies,
  geo,
  logos,
  takeaways,
  focusCountry,
  focusCompanyId,
  onOpen,
  onExit,
}: {
  companies: Company[];
  countries: Country[];
  geo: CountryGeo[];
  logos: LogoManifest;
  takeaways?: Record<string, Takeaway>;
  focusCountry: string | null;
  focusCompanyId: string | null;
  onOpen: (company: Company) => void;
  onExit: () => void;
}) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const hoverPopupRef = useRef<Popup | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [selectedCountry, setSelectedCountry] = useState(focusCountry || "España");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [wheelZoomEnabled, setWheelZoomEnabled] = useState(true);
  const [viewLevel, setViewLevel] = useState("Mundo");
  const selectedCompanyIdRef = useRef<string | null>(null);

  const countryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const company of companies) {
      const name = company.location?.canonicalMarket || company.primaryCountry;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return counts;
  }, [companies]);
  const allGeo = useMemo(() => [...geo, ...SPECIAL_MARKETS], [geo]);
  const geoByName = useMemo(() => new Map(allGeo.map((country) => [country.name, country])), [allGeo]);
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const specialCount = useCallback(
    (name: string) => companies.filter((company) => (company.location?.canonicalMarket || company.primaryCountry) === name).length,
    [companies],
  );
  const visibleGeo = useMemo(
    () => allGeo.filter((country) => (countryCounts.get(country.name) || specialCount(country.name)) > 0),
    [allGeo, countryCounts, specialCount],
  );
  const mapCompanies = useMemo(
    () => companies.filter((company) => company.location != null && company.location.latitude !== null && company.location.longitude !== null),
    [companies],
  );

  const unlocatedCompanies = useMemo(
    () => companies.filter((company) => !company.location || company.location.precision === "sin_punto"),
    [companies],
  );
  const selectedCompanies = useMemo(
    () => companies
      .filter((company) => (company.location?.canonicalMarket || company.primaryCountry) === selectedCountry)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es")),
    [companies, selectedCountry],
  );
  const filteredCompanies = useMemo(() => {
    const query = listQuery.trim().toLowerCase();
    const source = query ? companies : selectedCompanies;
    return source
      .filter((company) => {
        if (!query) return true;
        return [
          company.name,
          company.primaryCountry,
          company.location?.canonicalMarket,
          company.agencyType,
        ].some((value) => value?.toLowerCase().includes(query));
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"));
  }, [companies, selectedCompanies, listQuery]);
  const selectedCompany = selectedCompanyId ? companyById.get(selectedCompanyId) || null : null;

  const reducedMotion = useCallback(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const resetWorld = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setSelectedCompanyId(null);
    map.stop();
    map.easeTo({
      center: [2, 18],
      zoom: worldZoomForViewport(),
      pitch: 0,
      bearing: 0,
      duration: reducedMotion() ? 0 : 650,
      easing: calmEasing,
      essential: false,
    });
    map.getCanvas().focus({ preventScroll: true });
  }, [reducedMotion]);

  const nudgeMap = useCallback((longitudeDelta: number, latitudeDelta: number, immediate = false) => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const longitude = ((center.lng + longitudeDelta + 540) % 360) - 180;
    const latitude = Math.max(-68, Math.min(76, center.lat + latitudeDelta));
    map.stop();
    map.easeTo({
      center: [longitude, latitude],
      duration: reducedMotion() || immediate ? 0 : 220,
      easing: calmEasing,
      essential: false,
    });
    map.getCanvas().focus({ preventScroll: true });
  }, [reducedMotion]);

  const zoomMap = useCallback((delta: number, immediate = false) => {
    const map = mapRef.current;
    if (!map) return;
    map.stop();
    map.easeTo({
      zoom: Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta)),
      duration: reducedMotion() || immediate ? 0 : 280,
      easing: calmEasing,
      essential: false,
    });
    map.getCanvas().focus({ preventScroll: true });
  }, [reducedMotion]);

  const goToCountry = useCallback((name: string) => {
    const place = geoByName.get(name);
    if (!place) return;
    setSelectedCountry(name);
    setSelectedCompanyId(null);
    setListQuery("");
    const reduced = reducedMotion();
    mapRef.current?.stop();
    mapRef.current?.easeTo({
      center: [place.longitude, place.latitude],
      zoom: 3.35,
      pitch: 0,
      bearing: 0,
      duration: reduced ? 0 : 740,
      easing: calmEasing,
      essential: false,
    });
  }, [geoByName, reducedMotion]);

  const goToCompany = useCallback((company: Company) => {
    setSelectedCountry(company.location?.canonicalMarket || company.primaryCountry);
    setSelectedCompanyId(company.id);
    const location = company.location;
    if (!location || location.latitude === null || location.longitude === null) return;
    const position = companyPosition(company);
    const reduced = reducedMotion();
    mapRef.current?.stop();
    mapRef.current?.easeTo({
      center: position || [location.longitude, location.latitude],
      zoom: companyZoom(company),
      offset: window.innerWidth <= 620 ? [0, -135] : [0, 0],
      pitch: 0,
      bearing: 0,
      duration: reduced ? 0 : 820,
      easing: calmEasing,
      essential: false,
    });
  }, [reducedMotion]);

  const toggleWheelZoom = useCallback(() => {
    const map = mapRef.current;
    setWheelZoomEnabled((current) => {
      const next = !current;
      if (map) {
        if (next) map.scrollZoom.enable({ around: "center" });
        else map.scrollZoom.disable();
      }
      return next;
    });
    map?.getCanvas().focus({ preventScroll: true });
  }, []);

  /** Crea o actualiza los marcadores-logo visibles según viewport y zoom. */
  const syncLogoMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer("company-points")) return;
    const markers = markersRef.current;
    const rendered = map.queryRenderedFeatures(undefined, { layers: ["company-points"] });
    const seen = new Set<string>();
    for (const feature of rendered) {
      const id = String(feature.properties?.id || "");
      if (id) seen.add(id);
    }
    let chosen: Company[] = [];
    if (map.getZoom() >= LOGO_ZOOM) {
      const occupiedLocations = new Set<string>();
      chosen = [...seen]
        .map((id) => companyById.get(id))
        .filter((company): company is Company => Boolean(company))
        .sort((a, b) => b.score - a.score)
        .filter((company) => {
          const position = companyPosition(company);
          if (!position) return false;
          const key = `${position[0].toFixed(5)}|${position[1].toFixed(5)}`;
          if (occupiedLocations.has(key)) return false;
          occupiedLocations.add(key);
          return true;
        })
        .slice(0, MAX_LOGO_MARKERS);
    }
    const selected = selectedCompanyIdRef.current
      ? companyById.get(selectedCompanyIdRef.current) || null
      : null;
    if (selected && companyPosition(selected)) {
      const selectedPosition = companyPosition(selected)!;
      const selectedKey = `${selectedPosition[0].toFixed(5)}|${selectedPosition[1].toFixed(5)}`;
      chosen = chosen.filter((company) => {
        const position = companyPosition(company);
        return !position || `${position[0].toFixed(5)}|${position[1].toFixed(5)}` !== selectedKey;
      });
      chosen.unshift(selected);
      chosen = chosen.slice(0, MAX_LOGO_MARKERS);
    }
    const keep = new Set(chosen.map((company) => company.id));
    for (const [id, marker] of markers) {
      if (!keep.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
    for (const company of chosen) {
      if (markers.has(company.id)) continue;
      const position = companyPosition(company);
      if (!position) continue;
      const element = document.createElement("button");
      element.type = "button";
      const toneClass = logos[company.id]?.tone ? ` tone-${logos[company.id]?.tone}` : "";
      element.className = `map-logo-marker precision-${company.location?.precision || "sin_punto"}${toneClass}`;
      element.title = `${company.name} · ${precisionLabel[company.location?.precision || "sin_punto"]}`;
      element.setAttribute("aria-label", `Seleccionar ${company.name} en el mapa`);
      const record = logos[company.id];
      if (record?.file) {
        const image = document.createElement("img");
        image.src = record.file;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        image.addEventListener("error", () => {
          image.remove();
          element.appendChild(makeInitials(company.name));
        });
        element.appendChild(image);
      } else {
        element.appendChild(makeInitials(company.name));
      }
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        goToCompany(company);
      });
      if (selectedCompanyIdRef.current === company.id) element.classList.add("selected");
      const marker = new Marker({ element, anchor: "center" }).setLngLat(position as [number, number]).addTo(map);
      markers.set(company.id, marker);
    }
  }, [companyById, goToCompany, logos]);

  useEffect(() => {
    selectedCompanyIdRef.current = selectedCompanyId;
    for (const [id, marker] of markersRef.current) {
      marker.getElement().classList.toggle("selected", id === selectedCompanyId);
    }
    syncLogoMarkers();
  }, [selectedCompanyId, syncLogoMarkers]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const canvas = document.createElement("canvas");
    if (!canvas.getContext("webgl2")) {
      window.setTimeout(() => setStatus("fallback"), 0);
      return;
    }

    const collection: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: mapCompanies.map((company) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: companyPosition(company)!,
        },
        properties: {
          id: company.id,
          name: company.name,
          country: company.location?.canonicalMarket || company.primaryCountry,
          precision: company.location!.precision,
          label: company.location!.locationLabel,
          score: company.score,
        },
      })),
    };

    const map = new MapLibreMap({
      container: mapNode.current,
      style: "https://tiles.openfreemap.org/styles/dark",
      center: [2, 18],
      zoom: worldZoomForViewport(),
      pitch: 0,
      bearing: 0,
      minZoom: 0.95,
      maxZoom: 8,
      maxPitch: 0,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      cooperativeGestures: false,
      scrollZoom: false,
      doubleClickZoom: false,
      dragPan: { linearity: 0.08, maxSpeed: 0, deceleration: 6000 },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      keyboard: false,
      fadeDuration: 140,
    });
    mapRef.current = map;
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    map.scrollZoom.setWheelZoomRate(1 / 850);
    map.scrollZoom.setZoomRate(1 / 160);
    map.scrollZoom.enable({ around: "center" });
    map.touchZoomRotate.disable();
    map.touchZoomRotate.enable({ around: "center" });
    map.touchZoomRotate.setZoomRate(0.65);
    map.touchZoomRotate.disableRotation();

    const loadTimeout = window.setTimeout(() => {
      if (!map.loaded()) setStatus("fallback");
    }, 14_000);

    map.on("style.load", () => {
      map.setProjection({ type: "globe" });
      map.setSky({
        "sky-color": "#0a0f16",
        "horizon-color": "#2c4a73",
        "fog-color": "#101826",
        "sky-horizon-blend": 0.5,
        "horizon-fog-blend": 0.38,
        "fog-ground-blend": 0.12,
      });
    });

    map.on("load", () => {
      window.clearTimeout(loadTimeout);
      map.addSource("company-locations", {
        type: "geojson",
        data: collection,
        cluster: true,
        clusterMaxZoom: Math.ceil(LOGO_ZOOM) + 1,
        clusterRadius: 58,
      });
      map.addLayer({
        id: "company-cluster-halo",
        type: "circle",
        source: "company-locations",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "rgba(91,143,224,.13)",
          "circle-radius": ["step", ["get", "point_count"], 21, 10, 25, 40, 31, 100, 37],
          "circle-blur": 0.68,
        },
      });
      map.addLayer({
        id: "company-clusters",
        type: "circle",
        source: "company-locations",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#4b7fc8", 10, "#356ebd", 40, "#285da9", 100, "#1f4c8d"],
          "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 40, 22, 100, 27],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "rgba(231,240,253,.72)",
          "circle-opacity": 0.92,
        },
      });
      map.addLayer({
        id: "company-cluster-count",
        type: "symbol",
        source: "company-locations",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-allow-overlap": true },
        paint: { "text-color": "#ffffff", "text-halo-color": "#0a2a5e", "text-halo-width": 1 },
      });
      map.addLayer({
        id: "company-points",
        type: "circle",
        source: "company-locations",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match", ["get", "precision"],
            "exacta_publicada", "#34a853",
            "centro_ciudad", "#4285f4",
            "centro_pais_mercado", "#fbbc04",
            "#94a3b8",
          ],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 4, 5, 6.5, 10, 9],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "rgba(244,255,249,.8)",
          "circle-opacity": 0.88,
        },
      });
      setStatus("ready");
      setViewLevel(viewLevelForZoom(map.getZoom()));
      syncLogoMarkers();
    });

    const syncViewLevel = () => setViewLevel(viewLevelForZoom(map.getZoom()));
    map.on("moveend", syncLogoMarkers);
    map.on("zoomend", syncViewLevel);
    map.on("idle", syncLogoMarkers);

    map.on("click", "company-clusters", async (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const clusterId = Number(feature.properties?.cluster_id);
      const source = map.getSource("company-locations") as GeoJSONSource;
      const expansionZoom = await source.getClusterExpansionZoom(clusterId);
      const reduced = reducedMotion();
      const nextZoom = Math.min(expansionZoom, map.getZoom() + 1.2, 6.5);
      setSelectedCompanyId(null);
      map.stop();
      map.easeTo({
        center: feature.geometry.coordinates as [number, number],
        zoom: nextZoom,
        pitch: 0,
        bearing: 0,
        duration: reduced ? 0 : 480,
        easing: calmEasing,
      });
    });
    map.on("click", "company-points", (event: MapLayerMouseEvent) => {
      const id = String(event.features?.[0]?.properties?.id || "");
      const company = companyById.get(id);
      if (company) goToCompany(company);
    });
    map.on("mousemove", "company-points", (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const name = String(feature.properties?.name || "");
      const country = String(feature.properties?.country || "");
      const precision = String(feature.properties?.precision || "sin_punto") as keyof typeof precisionLabel;
      if (!hoverPopupRef.current) {
        hoverPopupRef.current = new Popup({ closeButton: false, closeOnClick: false, offset: 14, className: "map-hover-popup", maxWidth: "260px" });
      }
      hoverPopupRef.current
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setHTML(`<strong>${escapeHtml(name)}</strong><span>${escapeHtml(country)} · ${escapeHtml(precisionLabel[precision] || "")}</span>`)
        .addTo(map);
    });
    map.on("mouseleave", "company-points", () => {
      hoverPopupRef.current?.remove();
    });
    for (const layer of ["company-clusters", "company-points"]) {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
    }
    map.getCanvas().addEventListener("webglcontextlost", () => setStatus("fallback"));

    const markersAtMount = markersRef.current;
    return () => {
      window.clearTimeout(loadTimeout);
      for (const marker of markersAtMount.values()) marker.remove();
      markersAtMount.clear();
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [companyById, goToCompany, mapCompanies, reducedMotion, syncLogoMarkers]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) return;

      const key = event.key.toLowerCase();
      if (target?.closest("button, a, summary, [role='button']")) return;
      const repeatFactor = event.repeat ? 0.32 : 1;
      if (key === "arrowleft" || key === "a") nudgeMap(-PAN_STEP_X * repeatFactor, 0, event.repeat);
      else if (key === "arrowright" || key === "d") nudgeMap(PAN_STEP_X * repeatFactor, 0, event.repeat);
      else if (key === "arrowup" || key === "w") nudgeMap(0, PAN_STEP_Y * repeatFactor, event.repeat);
      else if (key === "arrowdown" || key === "s") nudgeMap(0, -PAN_STEP_Y * repeatFactor, event.repeat);
      else if (key === "+" || key === "=") zoomMap(ZOOM_STEP * repeatFactor, event.repeat);
      else if (key === "-" || key === "_") zoomMap(-ZOOM_STEP * repeatFactor, event.repeat);
      else if (key === "r" || key === "0") resetWorld();
      else if (key === "escape") {
        setExplorerOpen(false);
        setSelectedCompanyId(null);
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nudgeMap, resetWorld, zoomMap]);

  useEffect(() => {
    if (!explorerOpen) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [explorerOpen]);

  useEffect(() => {
    if (focusCompanyId || !focusCountry || !geoByName.has(focusCountry)) return;
    const frame = window.requestAnimationFrame(() => goToCountry(focusCountry));
    return () => window.cancelAnimationFrame(frame);
  }, [focusCompanyId, focusCountry, goToCountry, geoByName]);

  useEffect(() => {
    if (!focusCompanyId || status === "loading") return;
    const company = companyById.get(focusCompanyId);
    if (!company) return;
    const frame = window.requestAnimationFrame(() => {
      goToCompany(company);
      mapRef.current?.getCanvas().focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [companyById, goToCompany, focusCompanyId, status]);

  return (
    <section className="world-map-shell" aria-label="Mapa mundial interactivo de empresas">
      <div className="world-map-stage">
        <div
          ref={mapNode}
          role="region"
          aria-roledescription="mapa interactivo"
          className={`world-map-canvas${status === "fallback" ? " map-hidden" : ""}`}
          aria-label={`Mundo interactivo con ${mapCompanies.length} empresas localizables. Arrastra o usa las flechas y WASD para desplazarte. El zoom con rueda está ${wheelZoomEnabled ? "activado en modo suave" : "desactivado hasta que decidas activarlo"}.`}
        />

        {status === "loading" && (
          <div className="map-loading">
            <span />
            <b>Preparando el mundo…</b>
            <small>Ordenando territorios y empresas para que puedas explorarlos con calma</small>
          </div>
        )}
        {status === "fallback" && (
          <div className="map-fallback" role="status">
            <b>El mapa no está disponible en este dispositivo</b>
            <p>Abre el explorador de empresas para acceder a las mismas fichas.</p>
          </div>
        )}

        <header className="map-command-bar">
          <button className="map-exit" onClick={onExit} aria-label="Volver al portal">
            <span aria-hidden="true">←</span>
            <b>Portal</b>
          </button>
          <div className="map-world-title">
            <span className="map-brandmark">RV</span>
            <div>
              <strong>Mapa mundial</strong>
              <small>{mapCompanies.length} empresas · globo interactivo con pasos precisos</small>
            </div>
          </div>
          <button
            className={`map-explorer-toggle${explorerOpen ? " active" : ""}`}
            onClick={() => setExplorerOpen((current) => !current)}
            aria-expanded={explorerOpen}
            aria-controls="map-explorer"
          >
            <span aria-hidden="true">⌕</span>
            Explorar empresas
            <b>{companies.length}</b>
          </button>
        </header>

        <nav className="map-camera-controls" aria-label="Controles del mapa">
          <span className="map-view-level" aria-live="polite">Vista · <b>{viewLevel}</b></span>
          <div className="map-zoom-stack">
            <button onClick={() => zoomMap(ZOOM_STEP)} aria-label="Ampliar mapa" title="Ampliar suavemente (+)">+</button>
            <button onClick={() => zoomMap(-ZOOM_STEP)} aria-label="Reducir mapa" title="Reducir suavemente (-)">−</button>
            <button onClick={resetWorld} aria-label="Ver el mundo completo" title="Mundo completo (R)">◎</button>
          </div>
          <button
            className={`map-wheel-toggle${wheelZoomEnabled ? " active" : ""}`}
            onClick={toggleWheelZoom}
            aria-pressed={wheelZoomEnabled}
            title={wheelZoomEnabled ? "Desactivar zoom con rueda o trackpad" : "Activar zoom suave con rueda o trackpad"}
          >
            <span>Rueda</span>
            <b>{wheelZoomEnabled ? "SUAVE" : "OFF"}</b>
          </button>
          <div className="map-pan-pad" aria-label="Desplazar el mapa">
            <span />
            <button onClick={() => nudgeMap(0, PAN_STEP_Y)} aria-label="Mover hacia arriba" title="Arriba (W o flecha)">↑</button>
            <span />
            <button onClick={() => nudgeMap(-PAN_STEP_X, 0)} aria-label="Mover hacia la izquierda" title="Izquierda (A o flecha)">←</button>
            <i aria-hidden="true">•</i>
            <button onClick={() => nudgeMap(PAN_STEP_X, 0)} aria-label="Mover hacia la derecha" title="Derecha (D o flecha)">→</button>
            <span />
            <button onClick={() => nudgeMap(0, -PAN_STEP_Y)} aria-label="Mover hacia abajo" title="Abajo (S o flecha)">↓</button>
            <span />
          </div>
        </nav>

        <div className={`map-navigation-guide${selectedCompany ? " company-open" : ""}`} role="note" aria-label="Guía para navegar por el mundo">
          <div>
            <span>CONTROLES</span>
            <strong>Arrastra el globo o usa giros precisos</strong>
          </div>
          <div className="map-key-guide">
            <span><kbd>WASD</kbd><kbd>← ↑ ↓ →</kbd> Mover</span>
            <span><kbd>+</kbd><kbd>−</kbd> Ampliar / reducir</span>
            <span><kbd>Rueda</kbd> Zoom suave</span>
            <span><kbd>R</kbd> Mundo completo</span>
          </div>
        </div>

        <details className="map-legend">
          <summary>Qué significa cada punto</summary>
          <div>
            <span><i className="exact" /> Punto publicado</span>
            <span><i className="city" /> Centro de ciudad</span>
            <span><i className="market" /> País / mercado</span>
            <span><i className="cluster" /> Varias empresas</span>
          </div>
          <small>El mapa diferencia ubicaciones públicas de referencias aproximadas y nunca inventa una sede.</small>
        </details>

        {selectedCompany && (
          <article className="map-selected-company" aria-live="polite">
            <button className="map-selection-close" onClick={() => setSelectedCompanyId(null)} aria-label="Cerrar empresa seleccionada">×</button>
            <CompanyLogo company={selectedCompany} logos={logos} size="medium" />
            <div>
              <p className="eyebrow">EMPRESA EN EL MAPA</p>
              <h2>{selectedCompany.name}</h2>
              <span className={`precision-badge ${selectedCompany.location?.precision || "sin_punto"}`}>
                {precisionLabel[selectedCompany.location?.precision || "sin_punto"]}
              </span>
              <p>{selectedCompany.location?.locationLabel}</p>
            </div>
            {takeaways?.[selectedCompany.id] && (
              <p className="map-takeaway"><b>Lectura RedVitalia:</b> {takeaways[selectedCompany.id].t}</p>
            )}
            <button className="primary-action" onClick={() => onOpen(selectedCompany)}>Abrir ficha completa <span>→</span></button>
          </article>
        )}

        {explorerOpen && (
          <aside id="map-explorer" className="map-explorer" aria-label="Explorador de empresas">
            <header>
              <div>
                <p className="eyebrow">EXPLORADOR</p>
                <h2>Encuentra y visita</h2>
                <small>Elige un territorio o busca cualquier empresa.</small>
              </div>
              <button onClick={() => setExplorerOpen(false)} aria-label="Cerrar explorador">×</button>
            </header>
            <label className="map-country-picker">
              Territorio
              <select value={selectedCountry} onChange={(event) => goToCountry(event.target.value)}>
                {[...visibleGeo]
                  .sort((a, b) => (countryCounts.get(b.name) || specialCount(b.name)) - (countryCounts.get(a.name) || specialCount(a.name)) || a.name.localeCompare(b.name, "es"))
                  .map((place) => (
                    <option key={place.name} value={place.name}>{place.flag} {place.name} · {countryCounts.get(place.name) || specialCount(place.name)}</option>
                  ))}
              </select>
            </label>
            <label className="map-list-search">
              <span className="visually-hidden">Buscar empresa o mercado</span>
              <input
                ref={searchInputRef}
                type="search"
                value={listQuery}
                placeholder="Buscar empresa o mercado…"
                onChange={(event) => setListQuery(event.target.value)}
              />
            </label>
            <p className="map-list-context">
              {listQuery.trim()
                ? `${filteredCompanies.length} coincidencias globales`
                : `${geoByName.get(selectedCountry)?.flag || ""} ${selectedCountry} · ${selectedCompanies.length} empresas`}
            </p>
            <div className="map-company-list">
              {filteredCompanies.slice(0, 120).map((company) => (
                <button
                  key={company.id}
                  onClick={() => {
                    goToCompany(company);
                    setExplorerOpen(false);
                  }}
                  aria-label={`Ir a ${company.name} en el mapa`}
                  className={selectedCompanyId === company.id ? "selected" : ""}
                >
                  <CompanyLogo company={company} logos={logos} size="small" />
                  <span>
                    <strong>{company.name}</strong>
                    <small>{company.location?.canonicalMarket || company.primaryCountry} · {precisionLabel[company.location?.precision || "sin_punto"]}</small>
                  </span>
                  <b>{company.score}</b>
                </button>
              ))}
              {filteredCompanies.length > 120 && <p className="map-list-empty">Refina la búsqueda para ver las demás coincidencias.</p>}
              {filteredCompanies.length === 0 && <p className="map-list-empty">No hay coincidencias.</p>}
            </div>
            {unlocatedCompanies.length > 0 && (
              <details className="map-global">
                <summary>{unlocatedCompanies.length} fichas sin punto inventado</summary>
                {unlocatedCompanies.map((company) => <button key={company.id} onClick={() => onOpen(company)}>{company.name}<span>↗</span></button>)}
              </details>
            )}
            <p className="map-explorer-note">Las agrupaciones mantienen el mundo limpio. Pulsa una para acercarte y descubrir sus empresas.</p>
          </aside>
        )}
      </div>
    </section>
  );
}

function makeInitials(name: string): HTMLElement {
  const span = document.createElement("b");
  span.textContent = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "RV";
  return span;
}
