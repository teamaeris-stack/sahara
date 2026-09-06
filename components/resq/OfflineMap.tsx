import { useEffect, useMemo, useState, useRef } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLang } from "@/lib/i18n";
import { Layers3, Minus, Plus, WifiOff } from "lucide-react";
import { mapToLatLng } from "@/lib/community";
import {
  calculateWalkingRoute,
  haversineMetres,
  loadOfflineMap,
  resolveUserLocation,
  type LatLng,
  type OfflineMapData,
  type OfflineRoute,
  type OfflineRouteSegment,
  type ResolvedLocation,
} from "@/lib/offline-routing";
import { HAZARD_META, SHELTERS, type Hazard, type LiveShelter } from "@/lib/shelters";

export interface OfflineNavigationState {
  map: OfflineMapData | null;
  location: ResolvedLocation | null;
  route: OfflineRoute | null;
  loading: boolean;
  error: string | null;
}

export function shelterPoint(shelter: {
  pos: { x: number; y: number };
  geo?: { lat: number; lng: number };
}): LatLng {
  if (shelter.geo) return shelter.geo;
  const point = mapToLatLng(shelter.pos);
  return { lat: point.latitude, lng: point.longitude };
}

export function useOfflineNavigation(
  destinationId?: string | null,
  routingHazards: Hazard[] = [],
): OfflineNavigationState {
  const [map, setMap] = useState<OfflineMapData | null>(null);
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([loadOfflineMap(), resolveUserLocation()])
      .then(([nextMap, nextLocation]) => {
        if (!active) return;
        setMap(nextMap);
        setLocation(nextLocation);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Offline map could not be loaded");
      });
    return () => {
      active = false;
    };
  }, []);

  const hazardKey = JSON.stringify(
    routingHazards
      .filter((hazard) => hazard.reported && hazard.osmWayId)
      .map((hazard) => ({
        wayId: hazard.osmWayId,
        geo: hazard.geo,
        radius: hazard.closureRadiusM ?? 0,
      })),
  );
  const route = useMemo(() => {
    if (!map || !location || !destinationId) return null;
    const shelter = SHELTERS.find((item) => item.id === destinationId);
    const active = routingHazards.filter(
      (hazard) => hazard.reported && hazard.osmWayId,
    );
    // Older saved reports have only a way id. New reports use a 90 m local closure,
    // which blocks the affected junction/road stretch and produces a meaningful detour.
    const blocked = new Set(
      active.map((hazard) => hazard.osmWayId!),
    );
    const closures = active
      .filter((hazard) => hazard.geo && (hazard.closureRadiusM ?? 0) > 0)
      .map((hazard) => ({
        center: hazard.geo!,
        radiusMetres: hazard.closureRadiusM ?? 0,
      }));
    return shelter
      ? calculateWalkingRoute(map, location.point, shelterPoint(shelter), blocked, closures)
      : null;
    // hazardKey is the stable routing dependency; routingHazards itself is recreated by the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, location, destinationId, hazardKey]);

  return { map, location, route, loading: !error && (!map || !location), error };
}

export function nearestAvailableByRoad(
  map: OfflineMapData | null,
  location: ResolvedLocation | null,
  shelters: LiveShelter[],
) {
  if (!map || !location) return null;
  return (
    shelters
      .filter(
        (shelter) =>
          shelter.status !== "FULL" &&
          haversineMetres(location.point, shelterPoint(shelter)) <= 5_000,
      )
      .map((shelter) => ({
        shelter,
        route: calculateWalkingRoute(map, location.point, shelterPoint(shelter)),
      }))
      .filter(
        (item): item is { shelter: LiveShelter; route: OfflineRoute } =>
          item.route !== null && item.route.distanceKm <= 5,
      )
      .sort((a, b) => a.route.distanceKm - b.route.distanceKm)[0] ?? null
  );
}

export function OfflineMap({
  navigation,
  selectedId,
  onSelect,
  hazards = [],
  routePickMode = false,
  onRouteSegmentPick,
  compact = false,
  familyMarkers = [],
  onFamilySelect,
}: {
  navigation: OfflineNavigationState;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  hazards?: Hazard[];
  routePickMode?: boolean;
  onRouteSegmentPick?: (segment: OfflineRouteSegment, point: LatLng) => void;
  compact?: boolean;
  familyMarkers?: { id: string; label: string; point: LatLng; urgent: boolean }[];
  onFamilySelect?: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<Leaflet.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [contextError, setContextError] = useState(false);
  const [mapStyle, setMapStyle] = useState<"map" | "terrain">("map");
  const mapStyleRef = useRef(mapStyle);
  mapStyleRef.current = mapStyle;
  const restyleRef = useRef<((style: "map" | "terrain") => void) | null>(null);
  const { t, tx } = useLang();
  const { map, location, route, error } = navigation;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onRouteSegmentPickRef = useRef(onRouteSegmentPick);
  onRouteSegmentPickRef.current = onRouteSegmentPick;
  const familySelectRef = useRef(onFamilySelect);
  familySelectRef.current = onFamilySelect;
  const familyKey = JSON.stringify(familyMarkers);

  useEffect(() => {
    if (!container.current || !map || !location) return;
    let disposed = false;
    let resize: ResizeObserver | undefined;
    let cleanup: (() => void) | undefined;
    void import("leaflet").then(async (L) => {
      if (disposed || !container.current) return;
      const view = L.map(container.current, {
        attributionControl: false,
        zoomControl: false,
        preferCanvas: true,
        minZoom: 12,
        maxZoom: 19,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        scrollWheelZoom: true,
        wheelDebounceTime: 25,
        wheelPxPerZoomLevel: 90,
        inertia: true,
        inertiaDeceleration: 2600,
        easeLinearity: 0.22,
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: true,
        maxBounds: [
          [10.0626, 76.3059],
          [10.1526, 76.3973],
        ],
        maxBoundsViscosity: 0.8,
      }).setView([location.point.lat, location.point.lng], 15.5);
      const coverage = L.circle([10.1076, 76.3516], {
        radius: 5000,
        color: "#64748b",
        weight: 1,
        dashArray: "5 5",
        fill: false,
        interactive: false,
      }).addTo(view);
      view.createPane("coverage").style.zIndex = "450";
      const ring: [number, number][] = [];
      for (let i = 0; i <= 360; i++) {
        const a = (i * Math.PI) / 180;
        ring.push([10.1076 + 0.044966 * Math.cos(a), 76.3516 + 0.045675 * Math.sin(a)]);
      }
      L.polygon(
        [
          [
            [-85, -180],
            [-85, 180],
            [85, 180],
            [85, -180],
          ],
          ring,
        ],
        {
          pane: "coverage",
          stroke: false,
          fillColor: "#e5e7eb",
          fillOpacity: 1,
          interactive: false,
        },
      ).addTo(view);
      void coverage;
      instance.current = view;
      L.control.zoom({ position: "bottomright" }).addTo(view);
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(view);
      const canvas = L.canvas({ padding: 0.3, pane: "roads" });
      view.createPane("land").style.zIndex = "200";
      view.createPane("water").style.zIndex = "220";
      view.createPane("buildings").style.zIndex = "240";
      view.createPane("roads").style.zIndex = "300";
      view.createPane("route").style.zIndex = "400";
      view.createPane("hazards").style.zIndex = "420";
      const contextRenderers = {
        land: L.canvas({ padding: 0.2, pane: "land" }),
        water: L.canvas({ padding: 0.2, pane: "water" }),
        waterway: L.canvas({ padding: 0.2, pane: "water" }),
        building: L.canvas({ padding: 0.2, pane: "buildings" }),
      };
      const roadLayers: { layer: Leaflet.Polyline; major: boolean; casing: boolean }[] = [];
      const contextLayers: { layer: Leaflet.GeoJSON; kind: string }[] = [];
      const roadLabels = L.layerGroup();
      const names = new Set<string>();
      const label = (text: string) => {
        const el = document.createElement("span");
        el.textContent = text;
        return el;
      };
      for (const road of map.roads) {
        const major = /^(primary|secondary|tertiary|trunk)/.test(road.highway);
        const coords = road.coordinates.map((p) => [p.lat, p.lng] as [number, number]);
        const border = L.polyline(coords, {
          pane: "roads",
          renderer: canvas,
          color: major ? "#c9ad7a" : "#d4cfc7",
          weight: major ? 7 : 4,
          opacity: 1,
          interactive: false,
        }).addTo(view);
        const line = L.polyline(coords, {
          pane: "roads",
          renderer: canvas,
          color: major ? "#ffe5a2" : "#fff",
          weight: major ? 5 : 2.5,
          opacity: 1,
          interactive: false,
        }).addTo(view);
        roadLayers.push(
          { layer: border, major, casing: true },
          { layer: line, major, casing: false },
        );
        if (road.name && !names.has(road.name)) {
          names.add(road.name);
          const p = coords[Math.floor(coords.length / 2)]!;
          L.marker(p, {
            icon: L.divIcon({
              className: "sahara-road-label",
              html: label(road.name),
              iconSize: [140, 18],
              iconAnchor: [70, 9],
            }),
            interactive: false,
          }).addTo(roadLabels);
        }
      }
      let buildings: Leaflet.GeoJSON | undefined;
      const restyle = (style: "map" | "terrain") => {
        const terrain = style === "terrain";
        if (container.current)
          container.current.style.background = terrain ? "#4f704f" : "#f3f0e8";
        roadLayers.forEach(({ layer, major, casing }) =>
          layer.setStyle({
            color: casing
              ? terrain
                ? major
                  ? "#705f49"
                  : "#66705d"
                : major
                  ? "#c9ad7a"
                  : "#d4cfc7"
              : terrain
                ? major
                  ? "#e7c878"
                  : "#d9d5bd"
                : major
                  ? "#ffe5a2"
                  : "#fff",
          }),
        );
        contextLayers.forEach(({ layer, kind }) =>
          layer.setStyle({
            color:
              kind === "building"
                ? terrain
                  ? "#7d7768"
                  : "#bcb3a7"
                : kind === "land"
                  ? terrain
                    ? "#416d3d"
                    : "#c8dbba"
                  : terrain
                    ? "#3b82a0"
                    : "#7bbaca",
            fillColor:
              kind === "building"
                ? terrain
                  ? "#a39b85"
                  : "#ded7cc"
                : kind === "land"
                  ? terrain
                    ? "#4e7d45"
                    : "#dce8cf"
                  : terrain
                    ? "#448fab"
                    : "#a6d7e7",
          }),
        );
      };
      restyleRef.current = restyle;
      const updateDetail = () => {
        const z = view.getZoom();
        roadLayers.forEach(({ layer, major, casing }) =>
          layer.setStyle({
            weight:
              (major ? (casing ? 7 : 5) : casing ? 4 : 2.5) * (z >= 17 ? 1.5 : z <= 13 ? 0.6 : 1),
          }),
        );
        if (z >= 16) roadLabels.addTo(view);
        else view.removeLayer(roadLabels);
        if (buildings) {
          if (z >= 15) buildings.addTo(view);
          else view.removeLayer(buildings);
        }
      };
      view.on("zoomend", updateDetail);
      resize = new ResizeObserver(() => view.invalidateSize());
      resize.observe(container.current);
      cleanup = () => view.remove();
      setReady(true);
      try {
        const response = await fetch("/maps/aluva-context.geojson");
        if (!response.ok) throw new Error("Map context missing");
        const data = await response.json();
        if (disposed) return;
        for (const kind of ["land", "water", "waterway", "building"]) {
          const layer = L.geoJSON(data, {
            filter: (f) => f.properties?.kind === kind,
            pane: kind === "building" ? "buildings" : kind === "land" ? "land" : "water",
            style: (f) => ({
              renderer: contextRenderers[kind as keyof typeof contextRenderers],
              color: kind === "building" ? "#bcb3a7" : kind === "land" ? "#c8dbba" : "#7bbaca",
              fillColor: kind === "building" ? "#ded7cc" : kind === "land" ? "#dce8cf" : "#a6d7e7",
              fillOpacity: 1,
              weight: kind === "waterway" ? (f?.properties?.waterway === "river" ? 5 : 2) : 0.8,
            }),
            onEachFeature: (f, layer) => {
              if (f.properties?.name) layer.bindTooltip(label(f.properties.name), { sticky: true });
            },
          });
          contextLayers.push({ layer, kind });
          if (kind === "building") buildings = layer;
          else layer.addTo(view);
        }
        restyle(mapStyleRef.current);
        updateDetail();
      } catch {
        if (!disposed) setContextError(true);
      }
    });
    return () => {
      disposed = true;
      resize?.disconnect();
      cleanup?.();
      instance.current = null;
      restyleRef.current = null;
      setReady(false);
    };
  }, [map, location]);

  useEffect(() => {
    restyleRef.current?.(mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    if (!ready || !instance.current || !location) return;
    const view = instance.current;
    view.getContainer().style.cursor = routePickMode ? "crosshair" : "grab";
    let disposed = false;
    let group: Leaflet.LayerGroup | undefined;
    void import("leaflet").then((L) => {
      if (disposed) return;
      group = L.layerGroup().addTo(view);
      const nameElement = (text: string) => {
        const el = document.createElement("span");
        el.textContent = text;
        return el;
      };
      for (const shelter of SHELTERS) {
        const p = shelterPoint(shelter);
        const selected = shelter.id === selectedId;
        const marker = L.marker([p.lat, p.lng], {
          title: tx(shelter.name),
          icon: L.divIcon({
            className: "",
            html: `<div class="sahara-shelter-pin ${selected ? "selected" : ""}" style="background:${shelter.status === "FULL" ? "#c93838" : shelter.status === "LIMITED" ? "#d28c00" : "#16814b"}">S</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        });
        marker.bindTooltip(nameElement(tx(shelter.name)), {
          permanent: selected,
          direction: "top",
          offset: [0, -12],
        });
        marker.on("click", () => onSelectRef.current?.(shelter.id));
        marker.addTo(group);
      }
      for (const member of familyMarkers) {
        const title = nameElement(member.label);
        const marker = L.circleMarker([member.point.lat,member.point.lng], {
          radius: 13, color: '#fff', weight: 3, fillColor: member.urgent ? '#dc2626' : '#15803d', fillOpacity: 1,
        }).bindTooltip(title, { permanent: true, direction: 'top' }).addTo(group);
        marker.on('click',()=>familySelectRef.current?.(member.id));
      }
      if (!route && familyMarkers.length) view.fitBounds(L.latLngBounds(familyMarkers.map(m=>[m.point.lat,m.point.lng] as [number,number])), {padding:[55,70],maxZoom:16});
      L.circleMarker([location.point.lat, location.point.lng], {
        radius: 9,
        color: "#fff",
        weight: 3,
        fillColor: "#1667c4",
        fillOpacity: 1,
      })
        .bindTooltip(nameElement(tx({ en: "You", hi: "आप" })), { direction: "bottom" })
        .addTo(group);
      if (route) {
        const coords = route.coordinates.map((p) => [p.lat, p.lng] as [number, number]);
        L.polyline(coords, { pane: "route", color: "#fff", weight: 9, opacity: 1 }).addTo(group);
        L.polyline(coords, { pane: "route", color: "#1769d2", weight: 5, opacity: 1 }).addTo(group);
        if (routePickMode) {
          route.segments.forEach((segment, index) => {
            const segmentCoords = segment.coordinates.map(
              (point) => [point.lat, point.lng] as [number, number],
            );
            const target = L.polyline(segmentCoords, {
              pane: "hazards",
              color: "#f97316",
              weight: 16,
              opacity: 0.42,
              dashArray: "8 7",
              interactive: true,
            });
            target.bindTooltip(
              nameElement(
                segment.name ??
                  tx({ en: `Local road segment ${index + 1}`, hi: `स्थानीय मार्ग खंड ${index + 1}` }),
              ),
              { sticky: true },
            );
            target.on("click", (event) => {
              L.DomEvent.stopPropagation(event);
              onRouteSegmentPickRef.current?.(segment, {
                lat: event.latlng.lat,
                lng: event.latlng.lng,
              });
            });
            target.addTo(group!);
          });
        }
        view.fitBounds(L.latLngBounds(coords), {
          padding: [50, 65],
          maxZoom: 17,
          animate: true,
          duration: 0.7,
        });
      }
      for (const hazard of hazards.filter((item) => item.reported && item.geo)) {
        const p = hazard.geo!;
        const savedRoad = hazard.osmCoordinates;
        const packagedRoad = map?.roads.find((road) => road.id === hazard.osmWayId);
        const blockedGeometry = packagedRoad?.coordinates ?? savedRoad;
        const blockedName = hazard.osmWayName ?? packagedRoad?.name ?? "Local OSM road";
        if (blockedGeometry && blockedGeometry.length > 1) {
          const blockedCoords = blockedGeometry.map(
            (point) => [point.lat, point.lng] as [number, number],
          );
          L.polyline(blockedCoords, {
            pane: "hazards",
            color: "#fff",
            weight: 12,
            opacity: 0.95,
            interactive: false,
          }).addTo(group);
          L.polyline(blockedCoords, {
            pane: "hazards",
            color: "#dc2626",
            weight: 7,
            opacity: 1,
            dashArray: "10 7",
            interactive: false,
          }).addTo(group);
        }
        const marker = L.marker([p.lat, p.lng], {
          title: `BLOCKED · ${blockedName}`,
          pane: "hazards",
          icon: L.divIcon({
            className: "",
            html: '<div class="sahara-hazard-pin"><span>!</span></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        });
        marker
          .bindTooltip(
            nameElement(`BLOCKED · ${blockedName} · ${t(HAZARD_META[hazard.kind].key)}`),
            { direction: "top", permanent: true, offset: [0, -12] },
          )
          .addTo(group);
      }
    });
    return () => {
      disposed = true;
      view.getContainer().style.cursor = "";
      group?.remove();
    };
    // Family marker content is serialized so callers can recreate the array without resetting zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, location, route, selectedId, hazards, routePickMode, t, tx, familyKey]);

  const fitRoute = () => {
    const points = route?.coordinates;
    if (points?.length)
      instance.current?.fitBounds(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [50, 65], maxZoom: 17, animate: true, duration: 0.7 },
      );
  };
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-1 bg-card px-3 py-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-navy px-2 py-1 text-[11px] font-extrabold text-navy-foreground">
          <WifiOff size={13} /> OFFLINE MAP
        </span>
        <span className="text-[10px] font-bold">
          {location?.source === "gps"
            ? "CURRENT LOCATION"
            : location?.source === "cached"
              ? "LAST KNOWN LOCATION"
              : "ALUVA DEMO LOCATION"}
        </span>
      </div>
      <div className="relative">
        <div
          ref={container}
          data-testid="offline-map"
          style={{ height: compact ? 400 : 480, background: "#f3f0e8", zIndex: 0 }}
        />
        {!ready && (
          <div className="absolute inset-0 grid place-items-center bg-muted p-4 text-center text-sm font-bold">
            {error ?? "Loading local Aluva map…"}
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <button
            type="button"
            className="rounded-lg border bg-white px-3 py-2 text-xs font-bold shadow"
            onClick={() =>
              location && instance.current?.setView([location.point.lat, location.point.lng], 16)
            }
          >
            {tx({ en: "My location", hi: "मेरा स्थान" })}
          </button>
          {route && (
            <button
              type="button"
              className="rounded-lg border bg-white px-3 py-2 text-xs font-bold shadow"
              onClick={fitRoute}
            >
              {tx({ en: "Fit route", hi: "पूरा मार्ग" })}
            </button>
          )}
        </div>
        {hazards.some((hazard) => hazard.reported && hazard.geo) && (
          <div className="absolute bottom-3 left-3 rounded-lg border bg-white/95 px-3 py-2 text-[10px] font-extrabold shadow">
            <p><span className="mr-1 inline-block h-1 w-5 bg-blue-600" /> ALTERNATE ROUTE</p>
            <p className="mt-1"><span className="mr-1 inline-block h-1 w-5 bg-red-600" /> BLOCKED ROAD</p>
          </div>
        )}
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <button
            type="button"
            aria-label="Zoom in"
            className="grid h-10 w-10 place-items-center rounded-lg border bg-white shadow"
            onClick={() => instance.current?.zoomIn(0.5, { animate: true })}
          >
            <Plus size={20} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            className="grid h-10 w-10 place-items-center rounded-lg border bg-white shadow"
            onClick={() => instance.current?.zoomOut(0.5, { animate: true })}
          >
            <Minus size={20} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-extrabold shadow"
          onClick={() => setMapStyle((current) => (current === "map" ? "terrain" : "map"))}
        >
          <Layers3 size={16} aria-hidden />
          {mapStyle === "map" ? "TERRAIN" : "MAP"}
        </button>
      </div>
      <p className="bg-card px-3 py-2 text-[10px] text-muted-foreground">
        © OpenStreetMap contributors · 5 km Aluva coverage · Smooth drag/pinch/scroll zoom
        {contextError
          ? " · River/building data could not load"
          : " · Offline terrain styling (not satellite photography)"}
      </p>
    </div>
  );
}
