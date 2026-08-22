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
  {
    name: "Kosovo",
    code: "XK",
    code3: "XKX",
    latitude: 42.6,
    longitude: 20.9,
    region: "Europe",
    subregion: "Southeast Europe",
    flag: "🇽🇰",
    precision: "country_centroid",
    locationLabel:
      "Punto representativo del territorio; no indica una sede exacta",
    source: "centroide territorial público",
  },
  {
    name: "Hong Kong",
    code: "HK",
    code3: "HKG",
    latitude: 22.32,
    longitude: 114.17,
    region: "Asia",
    subregion: "Eastern Asia",
    flag: "🇭🇰",
    precision: "country_centroid",
    locationLabel:
      "Punto representativo del mercado; no indica una sede exacta",
    source: "centroide territorial público",
  },
  {
    name: "Taiwán",
    code: "TW",
    code3: "TWN",
    latitude: 23.7,
    longitude: 121,
    region: "Asia",
    subregion: "Eastern Asia",
    flag: "🇹🇼",
    precision: "country_centroid",
    locationLabel:
      "Punto representativo del mercado; no indica una sede exacta",
    source: "centroide territorial público",
  },
];

type MapStatus = "loading" | "ready" | "fallback";

export default function WorldMap({
  companies,
  countries,
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
  const [selected, setSelected] = useState(focusCountry || "España");

  const countryCounts = useMemo(
    () => new Map(countries.map((country) => [country.name, country.count])),
    [countries],
  );
  const allGeo = useMemo(() => [...geo, ...SPECIAL_MARKETS], [geo]);
  const geoByName = useMemo(
    () => new Map(allGeo.map((country) => [country.name, country])),
    [allGeo],
  );
  const specialCount = useCallback(
    (name: string) =>
      companies.filter(
        (company) =>
          company.primaryCountry === name && !company.countries.length,
      ).length,
    [companies],
  );
  const visibleGeo = useMemo(
    () =>
      allGeo.filter(
        (country) =>
          (countryCounts.get(country.name) || specialCount(country.name)) > 0,
      ),
    [allGeo, countryCounts, specialCount],
  );
  const selectedCompanies = useMemo(
    () =>
      companies
        .filter(
          (company) =>
            company.countries.includes(selected) ||
            (!company.countries.length && company.primaryCountry === selected),
        )
        .sort((a, b) => b.score - a.score),
    [companies, selected],
  );
  const globalCompanies = useMemo(
    () => companies.filter((company) => company.primaryCountry === "Global"),
    [companies],
  );

  const flyTo = useCallback(
    (name: string) => {
      const place = geoByName.get(name);
      if (!place) return;
      setSelected(name);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      mapRef.current?.flyTo({
        center: [place.longitude, place.latitude],
        zoom: 4.35,
        pitch: reduced ? 0 : 42,
        bearing: reduced ? 0 : -12,
        duration: reduced ? 0 : 1900,
        curve: 1.42,
        essential: false,
      });
    },
    [geoByName],
  );

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const canvas = document.createElement("canvas");
    if (!canvas.getContext("webgl2")) {
      window.setTimeout(() => setStatus("fallback"), 0);
      return;
    }

    const collection: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: visibleGeo.map((country) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [country.longitude, country.latitude],
        },
        properties: {
          name: country.name,
          code: country.code,
          flag: country.flag,
          agencyCount:
            countryCounts.get(country.name) || specialCount(country.name),
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
    map.addControl(
      new NavigationControl({ visualizePitch: true }),
      "top-right",
    );
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    const loadTimeout = window.setTimeout(() => {
      if (!map.loaded()) setStatus("fallback");
    }, 14000);

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
      map.addSource("agency-countries", {
        type: "geojson",
        data: collection,
        cluster: true,
        clusterMaxZoom: 3,
        clusterRadius: 52,
        clusterProperties: { agency_count: ["+", ["get", "agencyCount"]] },
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "agency-countries",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "agency_count"],
            "#49d995",
            20,
            "#17b978",
            80,
            "#057a55",
            200,
            "#034936",
          ],
          "circle-radius": [
            "step",
            ["get", "agency_count"],
            19,
            20,
            24,
            80,
            31,
            200,
            39,
          ],
          "circle-stroke-width": 4,
          "circle-stroke-color": "rgba(224,255,241,.72)",
          "circle-opacity": 0.92,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "agency-countries",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["to-string", ["get", "agency_count"]],
          "text-font": ["Noto Sans Bold"],
          "text-size": 13,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#043829",
          "text-halo-width": 1,
        },
      });
      map.addLayer({
        id: "territory-points",
        type: "circle",
        source: "agency-countries",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#18c77a",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "agencyCount"],
            1,
            10,
            20,
            17,
            100,
            26,
          ],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#e8fff4",
        },
      });
      map.addLayer({
        id: "territory-count",
        type: "symbol",
        source: "agency-countries",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["to-string", ["get", "agencyCount"]],
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#07543a",
          "text-halo-width": 1,
        },
      });
      setStatus("ready");
    });

    map.on("click", "clusters", async (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const clusterId = Number(feature.properties?.cluster_id);
      const source = map.getSource("agency-countries") as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      map.easeTo({
        center: feature.geometry.coordinates as [number, number],
        zoom,
      });
    });
    map.on("click", "territory-points", (event: MapLayerMouseEvent) => {
      const name = String(event.features?.[0]?.properties?.name || "");
      if (name) flyTo(name);
    });
    for (const layer of ["clusters", "territory-points"]) {
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      });
    }
    map
      .getCanvas()
      .addEventListener("webglcontextlost", () => setStatus("fallback"));

    return () => {
      window.clearTimeout(loadTimeout);
      map.remove();
      mapRef.current = null;
    };
  }, [countryCounts, flyTo, specialCount, visibleGeo]);

  useEffect(() => {
    if (!focusCountry || !geoByName.has(focusCountry)) return;
    const frame = window.requestAnimationFrame(() => flyTo(focusCountry));
    return () => window.cancelAnimationFrame(frame);
  }, [focusCountry, flyTo, geoByName]);

  return (
    <section
      className="world-map-shell"
      aria-label="Mapa mundial de presencia y mercados asociados"
    >
      <div className="world-map-stage">
        <div
          ref={mapNode}
          className={`world-map-canvas${status === "fallback" ? " map-hidden" : ""}`}
          aria-label="Globo 3D interactivo"
        />
        {status === "loading" && (
          <div className="map-loading">
            <span />
            <b>Preparando el globo 3D…</b>
            <small>Cargando cartografía y puntos verificados</small>
          </div>
        )}
        {status === "fallback" && (
          <div className="map-fallback" role="status">
            <b>La vista 3D no está disponible en este dispositivo</b>
            <p>
              Puedes usar la lista geográfica completa: contiene exactamente los
              mismos mercados y abre las mismas fichas.
            </p>
          </div>
        )}
        <div className="map-legend">
          <span>
            <i /> Actor o mercado asociado
          </span>
          <span>
            <i className="cluster" /> Agrupación
          </span>
          <small>Precisión: centroide del territorio, no sede exacta</small>
        </div>
        <button
          className="map-reset"
          onClick={() =>
            mapRef.current?.flyTo({
              center: [2, 18],
              zoom: 1.22,
              pitch: 8,
              bearing: 0,
              duration: 1200,
            })
          }
        >
          Ver mundo completo
        </button>
      </div>

      <aside className="map-panel">
        <div className="map-panel-head">
          <p className="eyebrow">MERCADO SELECCIONADO</p>
          <h2>
            {geoByName.get(selected)?.flag} {selected}
          </h2>
          <p>
            {selectedCompanies.length} empresas vinculadas. El punto representa
            presencia o mercado asociado a nivel país, no una sede física
            confirmada.
          </p>
        </div>
        <label className="map-country-picker">
          Ir a un territorio
          <select
            value={selected}
            onChange={(event) => flyTo(event.target.value)}
          >
            {[...visibleGeo]
              .sort((a, b) => a.name.localeCompare(b.name, "es"))
              .map((place) => (
                <option key={place.name} value={place.name}>
                  {place.flag} {place.name} ·{" "}
                  {countryCounts.get(place.name) || specialCount(place.name)}
                </option>
              ))}
          </select>
        </label>
        <div className="map-company-list">
          {selectedCompanies.map((company) => (
            <button key={company.id} onClick={() => onOpen(company)}>
              <CompanyLogo company={company} logos={logos} size="small" />
              <span>
                <strong>{company.name}</strong>
                <small>{company.agencyType || company.scope}</small>
              </span>
              <b>{company.score}</b>
            </button>
          ))}
        </div>
        {globalCompanies.length > 0 && (
          <details className="map-global">
            <summary>
              {globalCompanies.length} modelos globales sin punto inventado
            </summary>
            {globalCompanies.map((company) => (
              <button key={company.id} onClick={() => onOpen(company)}>
                {company.name}
                <span>↗</span>
              </button>
            ))}
          </details>
        )}
      </aside>
    </section>
  );
}
