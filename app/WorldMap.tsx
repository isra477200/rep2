"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
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

type MapStatus = "loading" | "ready" | "fallback";

export default function WorldMap({
  companies,
  geo,
  logos,
  focusCountry,
  onOpen,
}: {
  companies: Company[];
  countries: Country[];
  geo: CountryGeo[];
  logos: LogoManifest;
  focusCountry: string | null;
  onOpen: (company: Company) => void;
}) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [selectedCountry, setSelectedCountry] = useState(focusCountry || "España");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

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
    () => companies.filter((company) => company.location?.latitude !== null && company.location?.longitude !== null),
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
  const selectedCompany = selectedCompanyId ? companyById.get(selectedCompanyId) || null : null;

  const flyToCountry = useCallback((name: string) => {
    const place = geoByName.get(name);
    if (!place) return;
    setSelectedCountry(name);
    setSelectedCompanyId(null);
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
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapRef.current?.flyTo({
      center: [location.longitude, location.latitude],
      zoom: location.zoom || 8,
      pitch: reduced ? 0 : location.precision === "centro_pais_mercado" ? 42 : 58,
      bearing: reduced ? 0 : -24,
      duration: reduced ? 0 : 2200,
      curve: 1.55,
      essential: false,
    });
  }, []);

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
        geometry: { type: "Point", coordinates: [company.location!.longitude!, company.location!.latitude!] },
        properties: {
          id: company.id,
          name: company.name,
          country: company.location?.canonicalMarket || company.primaryCountry,
          precision: company.location!.precision,
          label: company.location!.locationLabel,
        },
      })),
    };

    const map = new MapLibreMap({
      container: mapNode.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [2, 18],
      zoom: 1.22,
      pitch: 8,
      attributionControl: { compact: true },
      cooperativeGestures: true,
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
        "sky-color": "#061711",
        "horizon-color": "#d9f5e8",
        "fog-color": "#d9f5e8",
        "sky-horizon-blend": 0.54,
        "horizon-fog-blend": 0.32,
        "fog-ground-blend": 0.08,
      });
    });

    map.on("load", () => {
      window.clearTimeout(loadTimeout);
      map.addSource("company-locations", {
        type: "geojson",
        data: collection,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 48,
      });
      map.addLayer({
        id: "company-clusters",
        type: "circle",
        source: "company-locations",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#49d995", 10, "#17b978", 40, "#057a55", 100, "#034936"],
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 23, 40, 29, 100, 36],
          "circle-stroke-width": 4,
          "circle-stroke-color": "rgba(224,255,241,.78)",
          "circle-opacity": 0.94,
        },
      });
      map.addLayer({
        id: "company-cluster-count",
        type: "symbol",
        source: "company-locations",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 13 },
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
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 6, 5, 9, 10, 13],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#f4fff9",
          "circle-opacity": 0.94,
        },
      });
      setStatus("ready");
    });

    map.on("click", "company-clusters", async (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const clusterId = Number(feature.properties?.cluster_id);
      const source = map.getSource("company-locations") as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom: Math.min(zoom, 13), pitch: 48, duration: 1300 });
    });
    map.on("click", "company-points", (event: MapLayerMouseEvent) => {
      const id = String(event.features?.[0]?.properties?.id || "");
      const company = companyById.get(id);
      if (company) flyToCompany(company);
    });
    for (const layer of ["company-clusters", "company-points"]) {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
    }
    map.getCanvas().addEventListener("webglcontextlost", () => setStatus("fallback"));

    return () => {
      window.clearTimeout(loadTimeout);
      map.remove();
      mapRef.current = null;
    };
  }, [companyById, flyToCompany, mapCompanies]);

  useEffect(() => {
    if (!focusCountry || !geoByName.has(focusCountry)) return;
    const frame = window.requestAnimationFrame(() => flyToCountry(focusCountry));
    return () => window.cancelAnimationFrame(frame);
  }, [focusCountry, flyToCountry, geoByName]);

  return (
    <section className="world-map-shell" aria-label="Mapa mundial de competidores y precisión de ubicación">
      <div className="world-map-stage">
        <div ref={mapNode} className={`world-map-canvas${status === "fallback" ? " map-hidden" : ""}`} aria-label="Globo 3D interactivo con 709 competidores localizables" />
        {status === "loading" && <div className="map-loading"><span /><b>Preparando el globo 3D…</b><small>Cargando puntos y precisión verificada</small></div>}
        {status === "fallback" && <div className="map-fallback" role="status"><b>La vista 3D no está disponible en este dispositivo</b><p>La lista lateral conserva las 712 fichas y abre la misma información.</p></div>}
        <div className="map-legend" aria-label="Leyenda de precisión">
          <span><i className="exact" /> Punto publicado</span>
          <span><i className="city" /> Centro de ciudad</span>
          <span><i className="market" /> País / mercado</span>
          <span><i className="cluster" /> Agrupación</span>
          <small>Ningún punto se presenta como sede central confirmada.</small>
        </div>
        <button className="map-reset" onClick={() => mapRef.current?.flyTo({ center: [2, 18], zoom: 1.22, pitch: 8, bearing: 0, duration: 1200 })}>Ver mundo completo</button>
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
            {[...visibleGeo].sort((a, b) => a.name.localeCompare(b.name, "es")).map((place) => (
              <option key={place.name} value={place.name}>{place.flag} {place.name} · {countryCounts.get(place.name) || specialCount(place.name)}</option>
            ))}
          </select>
        </label>
        <div className="map-company-list">
          {selectedCompanies.map((company) => (
            <button key={company.id} onClick={() => flyToCompany(company)} aria-label={`Volar hasta ${company.name} y mostrar su precisión`} className={selectedCompanyId === company.id ? "selected" : ""}>
              <CompanyLogo company={company} logos={logos} size="small" />
              <span><strong>{company.name}</strong><small>{precisionLabel[company.location?.precision || "sin_punto"]} · {company.agencyType || company.scope}</small></span>
              <b>{company.score}</b>
            </button>
          ))}
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
