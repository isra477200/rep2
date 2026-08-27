"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LngLatBounds,
  Map as MapLibreMap,
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
import styles from "./WorldMap.module.css";

setWorkerUrl(workerUrl);

const SPECIAL_MARKETS: CountryGeo[] = [
  { name: "Kosovo", code: "XK", code3: "XKX", latitude: 42.6, longitude: 20.9, region: "Europe", subregion: "Southeast Europe", flag: "🇽🇰", precision: "country_centroid", locationLabel: "Punto representativo del territorio; no indica una sede exacta", source: "centroide territorial público" },
  { name: "Hong Kong", code: "HK", code3: "HKG", latitude: 22.32, longitude: 114.17, region: "Asia", subregion: "Eastern Asia", flag: "🇭🇰", precision: "country_centroid", locationLabel: "Punto representativo del mercado; no indica una sede exacta", source: "centroide territorial público" },
  { name: "Taiwán", code: "TW", code3: "TWN", latitude: 23.7, longitude: 121, region: "Asia", subregion: "Eastern Asia", flag: "🇹🇼", precision: "country_centroid", locationLabel: "Punto representativo del mercado; no indica una sede exacta", source: "centroide territorial público" },
];

const precisionLabel = {
  exacta_publicada: "Ubicación publicada",
  centro_ciudad: "Centro de ciudad",
  centro_pais_mercado: "Referencia de mercado",
  centro_mercado_observado: "Mercado observado",
  sin_punto: "Sin punto inventado",
} as const;

type PrecisionFilter = "all" | "published" | "city" | "market";
type MapStatus = "loading" | "ready" | "fallback";
type MarketSummary = {
  name: string;
  flag: string;
  latitude: number;
  longitude: number;
  count: number;
  exactCount: number;
  cityCount: number;
  marketCount: number;
  topScore: number;
};

const WORLD_CENTER: [number, number] = [8, 22];
const WORLD_BOUNDS: [[number, number], [number, number]] = [[-168, -56], [178, 74]];
const ZOOM_STEP = 0.65;
const PAN_PIXELS = 84;
const EMPTY_SELECTION = "__none__";

function fold(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function companyMarket(company: Company): string {
  return company.location?.canonicalMarket || company.primaryCountry;
}

function companyPosition(company: Company): [number, number] | null {
  const location = company.location;
  if (!location || location.latitude === null || location.longitude === null) return null;
  return [location.longitude, location.latitude];
}

function hasPrecisePoint(company: Company): boolean {
  return company.location?.precision === "exacta_publicada" || company.location?.precision === "centro_ciudad";
}

function companyPrecisionLabel(company: Company): string {
  const precision = company.location?.precision as keyof typeof precisionLabel | undefined;
  return precision ? precisionLabel[precision] || "Referencia de mercado" : "Sin punto inventado";
}

function matchesPrecision(company: Company, filter: PrecisionFilter): boolean {
  const precision = company.location?.precision || "sin_punto";
  if (filter === "published") return precision === "exacta_publicada";
  if (filter === "city") return precision === "centro_ciudad";
  if (filter === "market") return precision === "centro_pais_mercado" || precision === "centro_mercado_observado" || precision === "sin_punto";
  return true;
}

function companyZoom(company: Company): number {
  const declaredZoom = company.location?.zoom;
  if (typeof declaredZoom === "number") return Math.max(4.2, Math.min(13.5, declaredZoom));
  if (company.location?.precision === "exacta_publicada") return 13.5;
  if (company.location?.precision === "centro_ciudad") return 10.2;
  return 4.2;
}

function marketBreakdownLabel(market: MarketSummary): string {
  const precise = market.exactCount + market.cityCount;
  const preciseLabel = precise === 1 ? "ubicación precisa" : "ubicaciones precisas";
  const marketLabel = market.marketCount === 1 ? "referencia de mercado" : "referencias de mercado";
  return `${precise} ${preciseLabel} · ${market.marketCount} ${marketLabel}`;
}

function cameraDuration(reduced: boolean, milliseconds: number): number {
  return reduced ? 0 : milliseconds;
}

function viewLevelForZoom(zoom: number): string {
  if (zoom < 2.4) return "Mundo";
  if (zoom < 4.15) return "Mercados";
  if (zoom < 6.2) return "Territorio";
  if (zoom < 8.1) return "Ciudad";
  return "Detalle";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] as string));
}

function buildMarketSummaries(companies: Company[], geoByName: Map<string, CountryGeo>): MarketSummary[] {
  const grouped = new Map<string, Company[]>();
  for (const company of companies) {
    const market = companyMarket(company);
    if (!market) continue;
    grouped.set(market, [...(grouped.get(market) || []), company]);
  }
  return [...grouped]
    .map(([name, items]) => {
      const place = geoByName.get(name);
      const fallback = items.map(companyPosition).find((position): position is [number, number] => Boolean(position));
      if (!place && !fallback) return null;
      return {
        name,
        flag: place?.flag || "•",
        latitude: place?.latitude ?? fallback![1],
        longitude: place?.longitude ?? fallback![0],
        count: items.length,
        exactCount: items.filter((item) => item.location?.precision === "exacta_publicada").length,
        cityCount: items.filter((item) => item.location?.precision === "centro_ciudad").length,
        marketCount: items.filter((item) => !hasPrecisePoint(item)).length,
        topScore: Math.max(...items.map((item) => item.score)),
      } satisfies MarketSummary;
    })
    .filter((item): item is MarketSummary => Boolean(item))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
}

function marketCollection(markets: MarketSummary[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: markets.map((market) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [market.longitude, market.latitude] },
      properties: {
        name: market.name,
        flag: market.flag,
        count: market.count,
        exactCount: market.exactCount,
        cityCount: market.cityCount,
        marketCount: market.marketCount,
        topScore: market.topScore,
      },
    })),
  };
}

function companyCollection(companies: Company[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: companies.filter(hasPrecisePoint).map((company) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: companyPosition(company)! },
      properties: {
        id: company.id,
        name: company.name,
        market: companyMarket(company),
        precision: company.location!.precision,
        locationLabel: company.location!.locationLabel,
        score: company.score,
      },
    })),
  };
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
  const popupRef = useRef<Popup | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [selectedMarket, setSelectedMarket] = useState(focusCountry || "");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [precisionFilter, setPrecisionFilter] = useState<PrecisionFilter>("all");
  const [scoreFloor, setScoreFloor] = useState(0);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [clusterCompanyIds, setClusterCompanyIds] = useState<string[] | null>(null);
  const [viewLevel, setViewLevel] = useState("Mundo");
  const [currentZoom, setCurrentZoom] = useState(1.5);
  const [visibleResults, setVisibleResults] = useState(companies.length);
  const [listLimit, setListLimit] = useState(120);

  const allGeo = useMemo(() => [...geo, ...SPECIAL_MARKETS], [geo]);
  const geoByName = useMemo(() => new Map(allGeo.map((place) => [place.name, place])), [allGeo]);
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const queryKey = fold(query);

  const globallyFilteredCompanies = useMemo(
    () => companies
      .filter((company) => matchesPrecision(company, precisionFilter))
      .filter((company) => company.score >= scoreFloor)
      .filter((company) => {
        if (!queryKey) return true;
        return [company.name, companyMarket(company), company.agencyType, company.offer, company.niche]
          .some((value) => fold(value).includes(queryKey));
      }),
    [companies, precisionFilter, queryKey, scoreFloor],
  );

  const activeCompanies = useMemo(() => {
    if (queryKey) return globallyFilteredCompanies;
    if (clusterCompanyIds) {
      const clusterSet = new Set(clusterCompanyIds);
      return globallyFilteredCompanies.filter((company) => clusterSet.has(company.id));
    }
    if (selectedMarket) return globallyFilteredCompanies.filter((company) => companyMarket(company) === selectedMarket);
    return globallyFilteredCompanies;
  }, [clusterCompanyIds, globallyFilteredCompanies, queryKey, selectedMarket]);

  const marketSummaries = useMemo(() => buildMarketSummaries(globallyFilteredCompanies, geoByName), [geoByName, globallyFilteredCompanies]);
  const activeMarketSummaries = useMemo(() => buildMarketSummaries(activeCompanies, geoByName), [activeCompanies, geoByName]);
  const preciseCompanies = useMemo(() => activeCompanies.filter(hasPrecisePoint), [activeCompanies]);
  const marketData = useMemo(() => marketCollection(activeMarketSummaries), [activeMarketSummaries]);
  const companyData = useMemo(() => companyCollection(preciseCompanies), [preciseCompanies]);
  const marketDataRef = useRef(marketData);
  const companyDataRef = useRef(companyData);

  const selectedCompany = selectedCompanyId ? companyById.get(selectedCompanyId) || null : null;
  const directoryCompanies = useMemo(
    () => [...activeCompanies].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es")),
    [activeCompanies],
  );
  const directoryShowsMarkets = !queryKey && !selectedMarket && !clusterCompanyIds;
  const activeFilterCount = Number(precisionFilter !== "all") + Number(scoreFloor > 0) + Number(Boolean(selectedMarket));
  const panelOpen = explorerOpen || Boolean(selectedCompany);

  const reducedMotion = useCallback(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const mapPositionForCompany = useCallback((company: Company): [number, number] | null => {
    if (hasPrecisePoint(company)) return companyPosition(company);
    const market = geoByName.get(companyMarket(company));
    if (market) return [market.longitude, market.latitude];
    return companyPosition(company);
  }, [geoByName]);
  const focusCanvas = useCallback(() => mapRef.current?.getCanvas().focus({ preventScroll: true }), []);

  useEffect(() => {
    marketDataRef.current = marketData;
    companyDataRef.current = companyData;
  }, [companyData, marketData]);

  const zoomMap = useCallback((delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.stop();
    map.easeTo({
      zoom: Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta)),
      duration: cameraDuration(reducedMotion(), 230),
      essential: false,
    });
    focusCanvas();
  }, [focusCanvas, reducedMotion]);

  const panMap = useCallback((x: number, y: number, repeated = false) => {
    const map = mapRef.current;
    if (!map) return;
    map.stop();
    map.panBy([x, y], {
      duration: cameraDuration(reducedMotion(), repeated ? 0 : 190),
      essential: false,
    });
    focusCanvas();
  }, [focusCanvas, reducedMotion]);

  const resetWorld = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setSelectedMarket("");
    setSelectedCompanyId(null);
    setClusterCompanyIds(null);
    setListLimit(120);
    map.stop();
    map.fitBounds(WORLD_BOUNDS, {
      padding: window.innerWidth <= 700 ? 18 : 42,
      duration: cameraDuration(reducedMotion(), 320),
      maxZoom: 2.15,
      essential: false,
    });
    focusCanvas();
  }, [focusCanvas, reducedMotion]);

  const fitResults = useCallback(() => {
    const map = mapRef.current;
    if (!map || activeCompanies.length === 0) return;
    const positions = activeCompanies.map(mapPositionForCompany).filter((position): position is [number, number] => Boolean(position));
    if (positions.length === 0) return;
    const onePosition = positions.length === 1 || positions.every((position) => position[0] === positions[0][0] && position[1] === positions[0][1]);
    if (onePosition) {
      const company = activeCompanies[0];
      const zoom = company && hasPrecisePoint(company) ? companyZoom(company) : 5.2;
      map.easeTo({ center: positions[0], zoom, duration: cameraDuration(reducedMotion(), 280), essential: false });
      return;
    }
    const bounds = new LngLatBounds();
    for (const position of positions) bounds.extend(position);
    map.fitBounds(bounds, {
      padding: window.innerWidth <= 700
        ? { top: 104, right: 28, bottom: panelOpen ? 310 : 72, left: 28 }
        : { top: 96, right: panelOpen ? 430 : 70, bottom: 82, left: 70 },
      maxZoom: 6.4,
      duration: cameraDuration(reducedMotion(), 320),
      essential: false,
    });
    focusCanvas();
  }, [activeCompanies, focusCanvas, mapPositionForCompany, panelOpen, reducedMotion]);

  const goToMarket = useCallback((name: string, openDirectory = true) => {
    const place = geoByName.get(name);
    if (!place) return;
    setSelectedMarket(name);
    setSelectedCompanyId(null);
    setClusterCompanyIds(null);
    setQuery("");
    setListLimit(120);
    setHelpOpen(false);
    if (openDirectory) setExplorerOpen(true);
    const map = mapRef.current;
    if (!map) return;
    map.stop();
    map.easeTo({
      center: [place.longitude, place.latitude],
      zoom: 4.15,
      offset: window.innerWidth > 900 && openDirectory ? [-150, 0] : [0, 0],
      duration: cameraDuration(reducedMotion(), 300),
      essential: false,
    });
  }, [geoByName, reducedMotion]);

  const goToCompany = useCallback((company: Company) => {
    const position = mapPositionForCompany(company);
    setSelectedMarket(companyMarket(company));
    setSelectedCompanyId(company.id);
    setClusterCompanyIds(null);
    setListLimit(120);
    setExplorerOpen(false);
    setHelpOpen(false);
    if (!position) return;
    const map = mapRef.current;
    if (!map) return;
    map.stop();
    map.easeTo({
      center: position,
      zoom: companyZoom(company),
      offset: window.innerWidth <= 700 ? [0, -135] : [-185, 0],
      duration: cameraDuration(reducedMotion(), 320),
      essential: false,
    });
  }, [mapPositionForCompany, reducedMotion]);

  const openExplorer = useCallback(() => {
    setSelectedCompanyId(null);
    setHelpOpen(false);
    setExplorerOpen(true);
  }, []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setPrecisionFilter("all");
    setScoreFloor(0);
    setSelectedMarket("");
    setSelectedCompanyId(null);
    setClusterCompanyIds(null);
    setListLimit(120);
  }, []);

  const updateVisibleResults = useCallback(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const bounds = map.getBounds();
    setVisibleResults(activeCompanies.filter((company) => {
      const position = mapPositionForCompany(company);
      return position ? bounds.contains(position) : false;
    }).length);
  }, [activeCompanies, mapPositionForCompany, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    (map.getSource("market-summary") as GeoJSONSource | undefined)?.setData(marketData);
    (map.getSource("company-locations") as GeoJSONSource | undefined)?.setData(companyData);
    window.requestAnimationFrame(updateVisibleResults);
  }, [companyData, marketData, status, updateVisibleResults]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    if (map.getLayer("selected-company")) {
      map.setFilter("selected-company", ["==", ["get", "id"], selectedCompanyId || EMPTY_SELECTION]);
    }
    if (map.getLayer("selected-market")) {
      const market = selectedCompany && !hasPrecisePoint(selectedCompany) ? companyMarket(selectedCompany) : selectedMarket;
      map.setFilter("selected-market", ["==", ["get", "name"], market || EMPTY_SELECTION]);
    }
  }, [selectedCompany, selectedCompanyId, selectedMarket, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    map.on("moveend", updateVisibleResults);
    updateVisibleResults();
    return () => { map.off("moveend", updateVisibleResults); };
  }, [status, updateVisibleResults]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const capabilityCanvas = document.createElement("canvas");
    if (!capabilityCanvas.getContext("webgl2")) {
      window.setTimeout(() => setStatus("fallback"), 0);
      return;
    }

    const map = new MapLibreMap({
      container: mapNode.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: WORLD_CENTER,
      zoom: window.innerWidth <= 700 ? 1.15 : 1.65,
      minZoom: 0.9,
      maxZoom: 14,
      maxPitch: 0,
      pitch: 0,
      bearing: 0,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      cooperativeGestures: false,
      scrollZoom: false,
      doubleClickZoom: true,
      dragPan: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      keyboard: false,
      fadeDuration: 100,
    });
    mapRef.current = map;
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    map.scrollZoom.setWheelZoomRate(1 / 600);
    map.scrollZoom.setZoomRate(1 / 120);
    map.scrollZoom.enable();
    map.touchZoomRotate.enable();
    map.touchZoomRotate.disableRotation();
    map.getCanvas().tabIndex = 0;
    map.getCanvas().setAttribute("aria-label", "Área interactiva del mapa. Usa las flechas o WASD para moverte y más o menos para ampliar.");

    const loadTimeout = window.setTimeout(() => {
      if (!map.loaded()) setStatus("fallback");
    }, 14_000);

    map.on("style.load", () => map.setProjection({ type: "mercator" }));

    const showPopup = (coordinates: [number, number], title: string, detail: string) => {
      if (!popupRef.current) {
        popupRef.current = new Popup({ closeButton: false, closeOnClick: false, offset: 16, className: styles.popup, maxWidth: "290px" });
      }
      popupRef.current
        .setLngLat(coordinates)
        .setHTML(`<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`)
        .addTo(map);
    };

    map.on("load", () => {
      window.clearTimeout(loadTimeout);
      map.addSource("market-summary", {
        type: "geojson",
        data: marketDataRef.current,
        cluster: true,
        clusterMaxZoom: 3,
        clusterRadius: 48,
        clusterProperties: {
          count: ["+", ["get", "count"]],
          exactCount: ["+", ["get", "exactCount"]],
          cityCount: ["+", ["get", "cityCount"]],
          marketCount: ["+", ["get", "marketCount"]],
        },
      });
      map.addLayer({
        id: "market-region-hit", type: "circle", source: "market-summary", maxzoom: 4.8,
        filter: ["has", "point_count"],
        paint: { "circle-radius": ["step", ["get", "count"], 28, 25, 34, 100, 40, 300, 46], "circle-opacity": 0.01 },
      });
      map.addLayer({
        id: "market-region-halo", type: "circle", source: "market-summary", maxzoom: 4.8,
        filter: ["has", "point_count"],
        paint: { "circle-color": "rgba(10,74,154,.14)", "circle-radius": ["step", ["get", "count"], 24, 25, 29, 100, 35, 300, 41], "circle-blur": 0.5 },
      });
      map.addLayer({
        id: "market-regions", type: "circle", source: "market-summary", maxzoom: 4.8,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "count"], "#4b77ae", 25, "#2b65aa", 100, "#14529a", 300, "#073c7d"],
          "circle-radius": ["step", ["get", "count"], 16, 25, 20, 100, 25, 300, 30],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "market-region-count", type: "symbol", source: "market-summary", maxzoom: 4.8,
        filter: ["has", "point_count"],
        layout: { "text-field": ["to-string", ["get", "count"]], "text-size": 11, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true },
        paint: { "text-color": "#ffffff", "text-halo-color": "rgba(4,34,76,.9)", "text-halo-width": 1 },
      });
      map.addLayer({
        id: "market-hit", type: "circle", source: "market-summary", maxzoom: 4.8,
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": ["step", ["get", "count"], 24, 10, 28, 30, 34, 100, 40], "circle-opacity": 0.01 },
      });
      map.addLayer({
        id: "market-halo", type: "circle", source: "market-summary", maxzoom: 4.8,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "rgba(11,87,208,.14)",
          "circle-radius": ["step", ["get", "count"], 19, 10, 23, 30, 28, 100, 34],
          "circle-blur": 0.45,
        },
      });
      map.addLayer({
        id: "market-bubbles", type: "circle", source: "market-summary", maxzoom: 4.8,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["step", ["get", "count"], "#4f7fbd", 10, "#3269ae", 30, "#1756a3", 100, "#0b3f8a"],
          "circle-radius": ["step", ["get", "count"], 12, 10, 15, 30, 19, 100, 24],
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,.92)",
          "circle-opacity": 0.94,
        },
      });
      map.addLayer({
        id: "selected-market", type: "circle", source: "market-summary", maxzoom: 4.8,
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "name"], EMPTY_SELECTION]],
        paint: { "circle-radius": ["step", ["get", "count"], 18, 10, 21, 30, 25, 100, 30], "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 4, "circle-stroke-color": "#f59e0b" },
      });
      map.addLayer({
        id: "market-count", type: "symbol", source: "market-summary", maxzoom: 4.8,
        filter: ["!", ["has", "point_count"]],
        layout: { "text-field": ["to-string", ["get", "count"]], "text-size": 11, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true },
        paint: { "text-color": "#ffffff", "text-halo-color": "rgba(4,34,76,.9)", "text-halo-width": 1 },
      });
      map.addLayer({
        id: "market-label", type: "symbol", source: "market-summary", minzoom: 1.45, maxzoom: 4.8,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 1.45, 9, 4, 12],
          "text-font": ["Noto Sans Regular"],
          "text-offset": [0, 2.25],
          "text-anchor": "top",
          "text-optional": true,
          "text-allow-overlap": false,
        },
        paint: { "text-color": "#26384f", "text-halo-color": "rgba(255,255,255,.96)", "text-halo-width": 1.5 },
      });

      map.addSource("company-locations", {
        type: "geojson",
        data: companyDataRef.current,
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 52,
      });
      map.addLayer({
        id: "company-cluster-hit", type: "circle", source: "company-locations", minzoom: 3.65,
        filter: ["has", "point_count"],
        paint: { "circle-radius": ["step", ["get", "point_count"], 24, 10, 28, 40, 32], "circle-opacity": 0.01 },
      });
      map.addLayer({
        id: "company-cluster-halo", type: "circle", source: "company-locations", minzoom: 3.65,
        filter: ["has", "point_count"],
        paint: { "circle-color": "rgba(24,119,242,.14)", "circle-radius": ["step", ["get", "point_count"], 21, 10, 25, 40, 30], "circle-blur": 0.55 },
      });
      map.addLayer({
        id: "company-clusters", type: "circle", source: "company-locations", minzoom: 3.65,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#2f73c8", 10, "#175cae", 40, "#084989"],
          "circle-radius": ["step", ["get", "point_count"], 13, 10, 16, 40, 20],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "company-cluster-count", type: "symbol", source: "company-locations", minzoom: 3.65,
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 10, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "company-hit", type: "circle", source: "company-locations", minzoom: 3.65,
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": 22, "circle-opacity": 0.01 },
      });
      map.addLayer({
        id: "company-points", type: "circle", source: "company-locations", minzoom: 3.65,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["match", ["get", "precision"], "exacta_publicada", "#18864b", "centro_ciudad", "#2563b8", "#64748b"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3.65, 6, 8, 9, 10, 11],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "selected-company", type: "circle", source: "company-locations", minzoom: 3.65,
        filter: ["==", ["get", "id"], EMPTY_SELECTION],
        paint: { "circle-color": "rgba(255,255,255,0)", "circle-radius": ["interpolate", ["linear"], ["zoom"], 3.65, 12, 8, 16, 10, 19], "circle-stroke-width": 4, "circle-stroke-color": "#f59e0b" },
      });
      map.addLayer({
        id: "company-labels", type: "symbol", source: "company-locations", minzoom: 7.25,
        filter: ["!", ["has", "point_count"]],
        layout: { "text-field": ["get", "name"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-offset": [0, 1.35], "text-anchor": "top", "text-optional": true },
        paint: { "text-color": "#1f2937", "text-halo-color": "rgba(255,255,255,.98)", "text-halo-width": 1.5 },
      });

      setStatus("ready");
      setViewLevel(viewLevelForZoom(map.getZoom()));
      setCurrentZoom(map.getZoom());
      map.fitBounds(WORLD_BOUNDS, { padding: window.innerWidth <= 700 ? 18 : 42, maxZoom: 2.15, duration: 0 });
    });

    map.on("click", "market-region-hit", async (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const source = map.getSource("market-summary") as GeoJSONSource;
      const clusterId = Number(feature.properties?.cluster_id);
      try {
        const expansionZoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({
          center: feature.geometry.coordinates as [number, number],
          zoom: Math.min(expansionZoom, 4.4),
          duration: cameraDuration(reducedMotion(), 260),
          essential: false,
        });
      } catch {
        map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom: Math.min(map.getZoom() + 1, 4.4), duration: cameraDuration(reducedMotion(), 260), essential: false });
      }
    });
    map.on("click", "market-hit", (event: MapLayerMouseEvent) => {
      const name = String(event.features?.[0]?.properties?.name || "");
      if (name) goToMarket(name, true);
    });
    map.on("click", "company-hit", (event: MapLayerMouseEvent) => {
      const id = String(event.features?.[0]?.properties?.id || "");
      const company = companyById.get(id);
      if (company) goToCompany(company);
    });
    map.on("click", "company-cluster-hit", async (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const clusterId = Number(feature.properties?.cluster_id);
      const source = map.getSource("company-locations") as GeoJSONSource;
      try {
        const leaves = await source.getClusterLeaves(clusterId, 500, 0);
        const ids = leaves.map((leaf) => String(leaf.properties?.id || "")).filter(Boolean);
        const coordinates = leaves
          .filter((leaf) => leaf.geometry.type === "Point")
          .map((leaf) => (leaf.geometry as GeoJSON.Point).coordinates as [number, number]);
        const distinct = new Set(coordinates.map((position) => `${position[0].toFixed(5)}|${position[1].toFixed(5)}`));
        if (ids.length === 1) {
          const company = companyById.get(ids[0]);
          if (company) goToCompany(company);
        } else if (distinct.size <= 1 || map.getZoom() >= 11.8) {
          setClusterCompanyIds(ids);
          setSelectedCompanyId(null);
          setExplorerOpen(true);
          setHelpOpen(false);
          setListLimit(120);
        } else {
          const bounds = new LngLatBounds();
          for (const coordinate of coordinates) bounds.extend(coordinate);
          const expansionZoom = await source.getClusterExpansionZoom(clusterId);
          map.fitBounds(bounds, {
            padding: window.innerWidth <= 700 ? { top: 100, right: 32, bottom: 88, left: 32 } : { top: 96, right: 80, bottom: 80, left: 80 },
            maxZoom: Math.min(expansionZoom, map.getMaxZoom() - 0.2),
            duration: cameraDuration(reducedMotion(), 280),
            essential: false,
          });
        }
      } catch {
        setExplorerOpen(true);
      }
    });

    map.on("mousemove", "market-region-hit", (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const markets = Number(feature.properties?.point_count || 0);
      const count = Number(feature.properties?.count || 0);
      showPopup(feature.geometry.coordinates as [number, number], `${markets} mercados`, `${count} empresas · pulsa para acercarte`);
    });
    map.on("mousemove", "market-hit", (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const count = Number(feature.properties?.count || 0);
      const precise = Number(feature.properties?.exactCount || 0) + Number(feature.properties?.cityCount || 0);
      showPopup(feature.geometry.coordinates as [number, number], String(feature.properties?.name || ""), `${count} empresas · ${precise} con punto de ciudad o publicado`);
    });
    map.on("mousemove", "company-hit", (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const precision = String(feature.properties?.precision || "centro_ciudad") as keyof typeof precisionLabel;
      showPopup(feature.geometry.coordinates as [number, number], String(feature.properties?.name || ""), `${String(feature.properties?.market || "")} · ${precisionLabel[precision] || "Ubicación conocida"}`);
    });
    for (const layer of ["market-region-hit", "market-hit", "company-hit", "company-cluster-hit"]) {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      });
    }

    const syncZoom = () => {
      setCurrentZoom(map.getZoom());
      setViewLevel(viewLevelForZoom(map.getZoom()));
    };
    map.on("zoomend", syncZoom);
    map.getCanvas().addEventListener("webglcontextlost", () => setStatus("fallback"));

    return () => {
      window.clearTimeout(loadTimeout);
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [companyById, goToCompany, goToMarket, reducedMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target?.isContentEditable || event.ctrlKey || event.metaKey || event.altKey) return;
      if (target?.closest("button, a, summary, [role='button']")) return;
      const key = event.key.toLowerCase();
      const pan = event.repeat ? 30 : PAN_PIXELS;
      if (key === "arrowleft" || key === "a") panMap(-pan, 0, event.repeat);
      else if (key === "arrowright" || key === "d") panMap(pan, 0, event.repeat);
      else if (key === "arrowup" || key === "w") panMap(0, -pan, event.repeat);
      else if (key === "arrowdown" || key === "s") panMap(0, pan, event.repeat);
      else if (key === "+" || key === "=") zoomMap(ZOOM_STEP);
      else if (key === "-" || key === "_") zoomMap(-ZOOM_STEP);
      else if (key === "home") fitResults();
      else if (key === "0") resetWorld();
      else if (key === "?") {
        setHelpOpen((current) => !current);
        setExplorerOpen(false);
        setSelectedCompanyId(null);
      } else if (key === "escape") {
        if (helpOpen) setHelpOpen(false);
        else if (selectedCompanyId) setSelectedCompanyId(null);
        else if (explorerOpen) setExplorerOpen(false);
        else return;
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [explorerOpen, fitResults, helpOpen, panMap, resetWorld, selectedCompanyId, zoomMap]);

  useEffect(() => {
    if (focusCompanyId && status !== "loading") {
      const company = companyById.get(focusCompanyId);
      if (company) window.requestAnimationFrame(() => goToCompany(company));
      return;
    }
    if (focusCountry && geoByName.has(focusCountry)) window.requestAnimationFrame(() => goToMarket(focusCountry, true));
  }, [companyById, focusCompanyId, focusCountry, geoByName, goToCompany, goToMarket, status]);

  return (
    <section className={styles.shell} aria-label="Mapa mundial interactivo de empresas">
      <div className={styles.stage}>
        <div
          ref={mapNode}
          role="region"
          aria-roledescription="mapa interactivo"
          className={`${styles.canvas}${status === "fallback" ? ` ${styles.canvasHidden}` : ""}`}
          aria-label={`Mapa con ${activeCompanies.length} empresas. Arrastra para moverte, usa la rueda para ampliar y las flechas o WASD para navegar.`}
        />

        {status === "loading" && (
          <div className={styles.loading} role="status">
            <span />
            <b>Preparando el mapa…</b>
            <small>Separando mercados de ubicaciones precisas</small>
          </div>
        )}
        {status === "fallback" && (
          <div className={styles.fallback} role="status">
            <b>No hemos podido mostrar el mapa base</b>
            <p>El directorio, los filtros y todas las fichas siguen disponibles.</p>
            <button onClick={openExplorer}>Abrir directorio</button>
          </div>
        )}

        <header className={styles.toolbar}>
          <button className={styles.exit} onClick={onExit} aria-label="Volver al portal">
            <span aria-hidden="true">←</span><b>Portal</b>
          </button>
          <div className={styles.identity}>
            <span>RV</span>
            <div><strong>Mapa mundial</strong><small>Mercados primero, ubicaciones precisas al acercarte</small></div>
          </div>
          <label className={styles.search}>
            <span aria-hidden="true">⌕</span>
            <span className="visually-hidden">Buscar empresa, país o tipo de agencia</span>
            <input
              ref={searchInputRef}
              type="search"
              aria-label="Buscar empresa, país o tipo de agencia"
              value={query}
              placeholder="Buscar empresa, país o tipo…"
              onFocus={openExplorer}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setQuery(nextQuery);
                setClusterCompanyIds(null);
                if (nextQuery.trim()) setSelectedMarket("");
                setListLimit(120);
                openExplorer();
              }}
            />
            {query && <button type="button" onClick={() => { setQuery(""); setListLimit(120); searchInputRef.current?.focus(); }} aria-label="Borrar búsqueda">×</button>}
          </label>
          <button
            className={`${styles.directoryButton}${explorerOpen ? ` ${styles.active}` : ""}`}
            onClick={() => explorerOpen ? setExplorerOpen(false) : openExplorer()}
            aria-expanded={explorerOpen}
            aria-controls="map-directory"
            aria-label={explorerOpen ? "Cerrar directorio y filtros" : "Abrir directorio y filtros"}
          >
            <span aria-hidden="true">☷</span><b>Directorio</b><i>{activeFilterCount || activeCompanies.length}</i>
          </button>
          <button
            className={`${styles.helpButton}${helpOpen ? ` ${styles.active}` : ""}`}
            onClick={() => {
              setHelpOpen((current) => !current);
              setExplorerOpen(false);
              setSelectedCompanyId(null);
            }}
            aria-expanded={helpOpen}
            aria-controls="map-help"
            aria-label="Ver ayuda de navegación"
          >?</button>
        </header>

        <nav className={`${styles.cameraControls}${panelOpen ? ` ${styles.withPanel}` : ""}`} aria-label="Controles de cámara">
          <span className={styles.viewLevel}>Vista <b>{viewLevel}</b></span>
          <div>
            <button onClick={() => zoomMap(ZOOM_STEP)} disabled={status !== "ready" || currentZoom >= 13.95} aria-label="Acercar" title="Acercar (+)">+</button>
            <button onClick={() => zoomMap(-ZOOM_STEP)} disabled={status !== "ready" || currentZoom <= 0.95} aria-label="Alejar" title="Alejar (−)">−</button>
            <button onClick={fitResults} disabled={status !== "ready" || activeCompanies.length === 0} aria-label="Ajustar a los resultados" title="Ajustar a resultados (Inicio)">⌖</button>
            <button onClick={resetWorld} disabled={status !== "ready"} aria-label="Ver el mundo completo" title="Mundo completo (0)">◎</button>
          </div>
        </nav>

        <div className={`${styles.resultStatus}${panelOpen ? ` ${styles.withPanel}` : ""}`} aria-live="polite">
          <strong>{activeCompanies.length.toLocaleString("es-ES")} resultados</strong>
          <span>{visibleResults.toLocaleString("es-ES")} en pantalla · {activeMarketSummaries.length} mercados</span>
        </div>

        <div className={styles.navigationGuide} role="note">
          <span className={styles.desktopGuide}><kbd>Arrastra</kbd> mover · <kbd>Rueda</kbd> zoom · <kbd>Flechas</kbd> mover · <kbd>+ −</kbd> zoom · <kbd>Inicio</kbd> ajustar</span>
          <span className={styles.mobileGuide}>Arrastra para mover · pellizca para ampliar</span>
        </div>

        <details className={`${styles.legend}${panelOpen ? ` ${styles.withPanel}` : ""}`}>
          <summary>Leyenda</summary>
          <div>
            <span><i className={styles.marketDot} /> Mercado y número de empresas</span>
            <span><i className={styles.exactDot} /> Ubicación publicada</span>
            <span><i className={styles.cityDot} /> Centro de ciudad</span>
            <span><i className={styles.clusterDot} /> Varias ubicaciones</span>
          </div>
        </details>

        {helpOpen && (
          <aside id="map-help" className={styles.helpPanel} aria-label="Ayuda para navegar por el mapa">
            <header><div><span>CONTROLES</span><h2>Navega sin perderte</h2></div><button onClick={() => setHelpOpen(false)} aria-label="Cerrar ayuda">×</button></header>
            <ul>
              <li><b>Ratón</b><span>Arrastra el mapa. La rueda amplía alrededor del cursor.</span></li>
              <li><b>Teclado</b><span>Flechas o WASD para moverte; + y − para el zoom.</span></li>
              <li><b>Inicio</b><span>Encuadra los resultados actuales. La tecla 0 recupera el mundo.</span></li>
              <li><b>Mercados</b><span>Los círculos grandes resumen países. Al pulsarlos se abre su directorio.</span></li>
              <li><b>Puntos</b><span>Solo aparecen sedes publicadas o centros de ciudad; no multiplicamos puntos falsos.</span></li>
            </ul>
          </aside>
        )}

        {selectedCompany && (
          <aside className={styles.detailPanel} aria-live="polite" aria-label={`Empresa seleccionada: ${selectedCompany.name}`}>
            <header><span>EMPRESA SELECCIONADA</span><button onClick={() => setSelectedCompanyId(null)} aria-label="Cerrar empresa seleccionada">×</button></header>
            <div className={styles.companyHero}>
              <CompanyLogo company={selectedCompany} logos={logos} size="large" />
              <div><h2>{selectedCompany.name}</h2><p>{companyMarket(selectedCompany)}</p></div>
            </div>
            <div className={styles.companyMeta}>
              <span><b>{selectedCompany.score}</b> puntuación</span>
              <span><b>{companyPrecisionLabel(selectedCompany)}</b>{selectedCompany.location?.locality || companyMarket(selectedCompany)}</span>
            </div>
            <section><span>QUÉ OFRECE</span><p>{selectedCompany.offer || selectedCompany.title || "Consulta la ficha para ver su propuesta comercial."}</p></section>
            {takeaways?.[selectedCompany.id] && <section className={styles.takeaway}><span>LECTURA REDVITALIA</span><p>{takeaways[selectedCompany.id].t}</p></section>}
            <p className={styles.locationNote}>{selectedCompany.location?.locationLabel || "Esta ficha no tiene un punto preciso asignado."}</p>
            <button className={styles.openCompany} onClick={() => onOpen(selectedCompany)}>Abrir ficha completa <span>→</span></button>
          </aside>
        )}

        {explorerOpen && (
          <aside id="map-directory" className={styles.directory} aria-label="Directorio del mapa">
            <header>
              <div><span>DIRECTORIO SINCRONIZADO</span><h2>{clusterCompanyIds ? "Empresas en este punto" : selectedMarket || "Explora el mundo"}</h2><small>{activeCompanies.length} resultados con los filtros actuales</small></div>
              <button onClick={() => setExplorerOpen(false)} aria-label="Cerrar directorio">×</button>
            </header>

            <div className={styles.filters}>
              <label>
                Mercado
                <select value={selectedMarket} onChange={(event) => {
                  const market = event.target.value;
                  setClusterCompanyIds(null);
                  if (market) goToMarket(market, true);
                  else {
                    setSelectedMarket("");
                    setListLimit(120);
                  }
                }}>
                  <option value="">Todos los mercados</option>
                  {marketSummaries.map((market) => <option key={market.name} value={market.name}>{market.flag} {market.name} · {market.count}</option>)}
                </select>
              </label>
              <label>
                Relevancia
                <select value={scoreFloor} onChange={(event) => { setScoreFloor(Number(event.target.value)); setListLimit(120); }}>
                  <option value={0}>Todas</option><option value={70}>70 o más</option><option value={85}>85 o más</option>
                </select>
              </label>
              <fieldset>
                <legend>Tipo de ubicación</legend>
                {([[
                  "all", "Todas",
                ], ["published", "Publicada"], ["city", "Ciudad"], ["market", "Mercado"]] as Array<[PrecisionFilter, string]>).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={precisionFilter === value} onClick={() => { setPrecisionFilter(value); setListLimit(120); }}>{label}</button>
                ))}
              </fieldset>
              {activeFilterCount > 0 && <button className={styles.clearFilters} onClick={clearFilters}>Borrar filtros</button>}
            </div>

            <div className={styles.directoryContext}>
              <span>{directoryShowsMarkets ? `${marketSummaries.length} mercados` : `${activeCompanies.length} empresas`}</span>
              <button onClick={fitResults}>Ajustar mapa</button>
            </div>

            <div className={styles.directoryList}>
              {directoryShowsMarkets ? marketSummaries.map((market) => (
                <button key={market.name} className={styles.marketRow} onClick={() => goToMarket(market.name, true)}>
                  <span className={styles.flag}>{market.flag}</span>
                  <span><strong>{market.name}</strong><small>{marketBreakdownLabel(market)}</small></span>
                  <b>{market.count}</b>
                </button>
              )) : directoryCompanies.slice(0, listLimit).map((company) => (
                <button key={company.id} className={styles.companyRow} onClick={() => goToCompany(company)} aria-label={`Seleccionar ${company.name}`}>
                  <CompanyLogo company={company} logos={logos} size="small" />
                  <span><strong>{company.name}</strong><small>{companyMarket(company)} · {companyPrecisionLabel(company)}</small></span>
                  <b>{company.score}</b>
                </button>
              ))}
              {!directoryShowsMarkets && directoryCompanies.length > listLimit && (
                <button className={styles.loadMore} onClick={() => setListLimit((current) => current + 120)}>Mostrar 120 más <span>{directoryCompanies.length - listLimit} pendientes</span></button>
              )}
              {((directoryShowsMarkets && marketSummaries.length === 0) || (!directoryShowsMarkets && activeCompanies.length === 0)) && (
                <div className={styles.emptyState}><b>No hay resultados con estos filtros</b><p>Prueba otra búsqueda o vuelve a ver todo el mercado.</p><button onClick={clearFilters}>Borrar filtros</button></div>
              )}
            </div>
            <p className={styles.directoryNote}>Los círculos de mercado resumen referencias de país. Los puntos individuales solo representan una ubicación publicada o un centro de ciudad.</p>
          </aside>
        )}
      </div>
    </section>
  );
}
