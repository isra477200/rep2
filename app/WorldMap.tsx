"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import CompanyLogo from "./CompanyLogo";
import type { Company, Country, CountryGeo, LogoManifest } from "./data-types";

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

/** Zoom a partir del cual los puntos se convierten en logos. */
const LOGO_ZOOM = 3.1;
/** Máximo de logos DOM simultáneos en pantalla (rendimiento). */
const MAX_LOGO_MARKERS = 90;
/** Ángulo áureo para la distribución en girasol de puntos solapados. */
const GOLDEN_ANGLE = 2.399963229728653;

type MapStatus = "loading" | "ready" | "fallback";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));
}

export default function WorldMap({
  companies,
  geo,
  logos,
  focusCountry,
  focusCompanyId,
  onOpen,
}: {
  companies: Company[];
  countries: Country[];
  geo: CountryGeo[];
  logos: LogoManifest;
  focusCountry: string | null;
  focusCompanyId: string | null;
  onOpen: (company: Company) => void;
}) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const hoverPopupRef = useRef<Popup | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [selectedCountry, setSelectedCountry] = useState(focusCountry || "España");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState("");
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

  /**
   * Coordenadas ordenadas: las fichas que comparten exactamente el mismo punto
   * (p. ej. el centroide de un país) se reparten en una espiral de girasol
   * determinista alrededor del punto original, con la mejor puntuada en el centro.
   * Así cada ficha tiene SU sitio en el mapa en vez de apilarse en un solo pixel.
   */
  const spreadPosition = useMemo(() => {
    const groups = new Map<string, Company[]>();
    for (const company of mapCompanies) {
      const key = `${company.location!.latitude}|${company.location!.longitude}`;
      const group = groups.get(key);
      if (group) group.push(company);
      else groups.set(key, [company]);
    }
    const positions = new Map<string, [number, number]>();
    for (const group of groups.values()) {
      group.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"));
      const base = group[0].location!;
      const baseLat = base.latitude!;
      const baseLng = base.longitude!;
      if (group.length === 1) {
        positions.set(group[0].id, [baseLng, baseLat]);
        continue;
      }
      const countryLevel = group.every((company) => company.location!.precision === "centro_pais_mercado");
      const step = countryLevel
        ? Math.min(0.15, Math.max(0.05, 2.3 / Math.sqrt(group.length)))
        : 0.016;
      const stretch = Math.min(3.4, 1 / Math.max(0.28, Math.cos((baseLat * Math.PI) / 180)));
      group.forEach((company, index) => {
        if (index === 0) {
          positions.set(company.id, [baseLng, baseLat]);
          return;
        }
        const radius = step * Math.sqrt(index);
        const angle = index * GOLDEN_ANGLE;
        positions.set(company.id, [
          baseLng + Math.cos(angle) * radius * stretch,
          baseLat + Math.sin(angle) * radius,
        ]);
      });
    }
    return positions;
  }, [mapCompanies]);

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
    if (!query) return selectedCompanies;
    return selectedCompanies.filter((company) => company.name.toLowerCase().includes(query));
  }, [selectedCompanies, listQuery]);
  const selectedCompany = selectedCompanyId ? companyById.get(selectedCompanyId) || null : null;

  const flyToCountry = useCallback((name: string) => {
    const place = geoByName.get(name);
    if (!place) return;
    setSelectedCountry(name);
    setSelectedCompanyId(null);
    setListQuery("");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapRef.current?.flyTo({
      center: [place.longitude, place.latitude],
      zoom: 4.35,
      pitch: reduced ? 0 : 42,
      bearing: reduced ? 0 : -12,
      duration: reduced ? 0 : 1900,
      curve: 1.42,
      essential: false,
    });
  }, [geoByName]);

  const flyToCompany = useCallback((company: Company) => {
    setSelectedCountry(company.location?.canonicalMarket || company.primaryCountry);
    setSelectedCompanyId(company.id);
    const location = company.location;
    if (!location || location.latitude === null || location.longitude === null) return;
    const spread = spreadPosition.get(company.id);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapRef.current?.flyTo({
      center: spread || [location.longitude, location.latitude],
      zoom: Math.max(location.zoom || 8, LOGO_ZOOM + 2.4),
      pitch: reduced ? 0 : location.precision === "centro_pais_mercado" ? 42 : 58,
      bearing: reduced ? 0 : -24,
      duration: reduced ? 0 : 2200,
      curve: 1.55,
      essential: false,
    });
  }, [spreadPosition]);

  /** Crea o actualiza los marcadores-logo visibles según viewport y zoom. */
  const syncLogoMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer("company-points")) return;
    const markers = markersRef.current;
    if (map.getZoom() < LOGO_ZOOM) {
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      return;
    }
    const rendered = map.queryRenderedFeatures(undefined, { layers: ["company-points"] });
    const seen = new Map<string, GeoJSON.Position>();
    for (const feature of rendered) {
      const id = String(feature.properties?.id || "");
      if (id && !seen.has(id) && feature.geometry.type === "Point") seen.set(id, feature.geometry.coordinates);
    }
    const chosen = [...seen.keys()]
      .map((id) => companyById.get(id))
      .filter((company): company is Company => Boolean(company))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_LOGO_MARKERS);
    const keep = new Set(chosen.map((company) => company.id));
    for (const [id, marker] of markers) {
      if (!keep.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
    for (const company of chosen) {
      if (markers.has(company.id)) continue;
      const position = spreadPosition.get(company.id);
      if (!position) continue;
      const element = document.createElement("button");
      element.type = "button";
      element.className = `map-logo-marker precision-${company.location?.precision || "sin_punto"}`;
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
          element.append(makeInitials(company.name));
        });
        element.append(image);
      } else {
        element.append(makeInitials(company.name));
      }
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        flyToCompany(company);
      });
      if (selectedCompanyIdRef.current === company.id) element.classList.add("selected");
      const marker = new Marker({ element, anchor: "center" }).setLngLat(position as [number, number]).addTo(map);
      markers.set(company.id, marker);
    }
  }, [companyById, flyToCompany, logos, spreadPosition]);

  useEffect(() => {
    selectedCompanyIdRef.current = selectedCompanyId;
    for (const [id, marker] of markersRef.current) {
      marker.getElement().classList.toggle("selected", id === selectedCompanyId);
    }
  }, [selectedCompanyId]);

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
          coordinates: spreadPosition.get(company.id) || [company.location!.longitude!, company.location!.latitude!],
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
      zoom: 1.22,
      pitch: 8,
      maxZoom: 15.5,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      fadeDuration: 90,
      locale: {
        "NavigationControl.ZoomIn": "Acercar",
        "NavigationControl.ZoomOut": "Alejar",
        "NavigationControl.ResetBearing": "Restablecer orientación",
      },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    const loadTimeout = window.setTimeout(() => {
      if (!map.loaded()) setStatus("fallback");
    }, 14_000);

    map.on("style.load", () => {
      map.setProjection({ type: "globe" });
      map.setSky({
        "sky-color": "#03110c",
        "horizon-color": "#1d5942",
        "fog-color": "#0a2a1f",
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
        clusterRadius: 44,
      });
      map.addLayer({
        id: "company-cluster-halo",
        type: "circle",
        source: "company-locations",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "rgba(43,196,134,.16)",
          "circle-radius": ["step", ["get", "point_count"], 26, 10, 32, 40, 40, 100, 50],
          "circle-blur": 0.55,
        },
      });
      map.addLayer({
        id: "company-clusters",
        type: "circle",
        source: "company-locations",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#2bc486", 10, "#17a878", 40, "#0b8163", 100, "#075b48"],
          "circle-radius": ["step", ["get", "point_count"], 17, 10, 22, 40, 28, 100, 35],
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(214,255,238,.85)",
          "circle-opacity": 0.96,
        },
      });
      map.addLayer({
        id: "company-cluster-count",
        type: "symbol",
        source: "company-locations",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-allow-overlap": true },
        paint: { "text-color": "#ffffff", "text-halo-color": "#043829", "text-halo-width": 1 },
      });
      map.addLayer({
        id: "company-points",
        type: "circle",
        source: "company-locations",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match", ["get", "precision"],
            "exacta_publicada", "#00d084",
            "centro_ciudad", "#3aa9ff",
            "centro_pais_mercado", "#f1b24a",
            "#94a3b8",
          ],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 5.5, 5, 8, 10, 11],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "rgba(244,255,249,.92)",
          "circle-opacity": 0.94,
        },
      });
      setStatus("ready");
      syncLogoMarkers();
    });

    map.on("moveend", syncLogoMarkers);
    map.on("idle", syncLogoMarkers);

    map.on("click", "company-clusters", async (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const clusterId = Number(feature.properties?.cluster_id);
      const source = map.getSource("company-locations") as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.easeTo({
        center: feature.geometry.coordinates as [number, number],
        zoom: Math.min(Math.max(zoom, LOGO_ZOOM + 0.4), 13),
        pitch: reduced ? 0 : 48,
        duration: reduced ? 0 : 1300,
      });
    });
    map.on("click", "company-points", (event: MapLayerMouseEvent) => {
      const id = String(event.features?.[0]?.properties?.id || "");
      const company = companyById.get(id);
      if (company) flyToCompany(company);
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
  }, [companyById, flyToCompany, mapCompanies, spreadPosition, syncLogoMarkers]);

  useEffect(() => {
    if (!focusCountry || !geoByName.has(focusCountry)) return;
    const frame = window.requestAnimationFrame(() => flyToCountry(focusCountry));
    return () => window.cancelAnimationFrame(frame);
  }, [focusCountry, flyToCountry, geoByName]);

  useEffect(() => {
    if (!focusCompanyId || status === "loading") return;
    const company = companyById.get(focusCompanyId);
    if (!company) return;
    const frame = window.requestAnimationFrame(() => {
      flyToCompany(company);
      mapNode.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [companyById, flyToCompany, focusCompanyId, status]);

  return (
    <section className="world-map-shell" aria-label="Mapa mundial de competidores y precisión de ubicación">
      <div className="world-map-stage">
        <div ref={mapNode} tabIndex={-1} className={`world-map-canvas${status === "fallback" ? " map-hidden" : ""}`} aria-label={`Globo 3D interactivo con ${mapCompanies.length} competidores localizables`} />
        {status === "loading" && <div className="map-loading"><span /><b>Preparando el globo 3D…</b><small>Cargando puntos, logos y precisión verificada</small></div>}
        {status === "fallback" && <div className="map-fallback" role="status"><b>La vista 3D no está disponible en este dispositivo</b><p>La lista lateral conserva todas las fichas del catálogo y abre la misma información.</p></div>}
        <div className="map-legend" aria-label="Leyenda de precisión">
          <span><i className="exact" /> Punto publicado</span>
          <span><i className="city" /> Centro de ciudad</span>
          <span><i className="market" /> País / mercado</span>
          <span><i className="cluster" /> Agrupación</span>
          <span><i className="logo" /> Logo = ficha con identidad visual</span>
          <small>Ningún punto se presenta como sede central confirmada. Los puntos de un mismo territorio se reparten alrededor de su centro para poder distinguirlos.</small>
        </div>
        <button className="map-reset" onClick={() => {
          const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          mapRef.current?.flyTo({ center: [2, 18], zoom: 1.22, pitch: reduced ? 0 : 8, bearing: 0, duration: reduced ? 0 : 1200 });
        }}>Ver mundo completo</button>
      </div>

      <aside className="map-panel">
        {selectedCompany ? (
          <article className="map-selected-company" aria-live="polite">
            <CompanyLogo company={selectedCompany} logos={logos} size="medium" />
            <div>
              <p className="eyebrow">PUNTO SELECCIONADO</p>
              <h2>{selectedCompany.name}</h2>
              <span className={`precision-badge ${selectedCompany.location?.precision || "sin_punto"}`}>{precisionLabel[selectedCompany.location?.precision || "sin_punto"]}</span>
              <p>{selectedCompany.location?.locationLabel}</p>
              <small>{selectedCompany.location?.limitation}</small>
            </div>
            <button className="primary-action" onClick={() => onOpen(selectedCompany)}>Abrir ficha completa →</button>
          </article>
        ) : (
          <div className="map-panel-head">
            <p className="eyebrow">TERRITORIO SELECCIONADO</p>
            <h2>{geoByName.get(selectedCountry)?.flag} {selectedCountry}</h2>
            <p>{selectedCompanies.length} ubicaciones públicas vinculadas. El catálogo separa además los mercados comerciales atendidos.</p>
          </div>
        )}
        <label className="map-country-picker">
          Ir a un territorio
          <select value={selectedCountry} onChange={(event) => flyToCountry(event.target.value)}>
            {[...visibleGeo]
              .sort((a, b) => (countryCounts.get(b.name) || specialCount(b.name)) - (countryCounts.get(a.name) || specialCount(a.name)) || a.name.localeCompare(b.name, "es"))
              .map((place) => (
                <option key={place.name} value={place.name}>{place.flag} {place.name} · {countryCounts.get(place.name) || specialCount(place.name)}</option>
              ))}
          </select>
        </label>
        <label className="map-list-search">
          <span className="visually-hidden">Filtrar fichas del territorio</span>
          <input
            type="search"
            value={listQuery}
            placeholder={`Filtrar ${selectedCompanies.length} fichas…`}
            onChange={(event) => setListQuery(event.target.value)}
          />
        </label>
        <div className="map-company-list">
          {filteredCompanies.map((company) => (
            <button key={company.id} onClick={() => flyToCompany(company)} aria-label={`Volar hasta ${company.name} y mostrar su precisión`} className={selectedCompanyId === company.id ? "selected" : ""}>
              <CompanyLogo company={company} logos={logos} size="small" />
              <span><strong>{company.name}</strong><small>{precisionLabel[company.location?.precision || "sin_punto"]} · {company.agencyType || company.scope}</small></span>
              <b>{company.score}</b>
            </button>
          ))}
          {filteredCompanies.length === 0 && <p className="map-list-empty">Ninguna ficha coincide con el filtro.</p>}
        </div>
        {unlocatedCompanies.length > 0 && (
          <details className="map-global">
            <summary>{unlocatedCompanies.length} modelos sin punto inventado</summary>
            {unlocatedCompanies.map((company) => <button key={company.id} onClick={() => onOpen(company)}>{company.name}<span>↗</span></button>)}
          </details>
        )}
      </aside>
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
