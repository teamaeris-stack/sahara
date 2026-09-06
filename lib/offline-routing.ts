import { FALLBACK_LOCATION, readCachedLocation, writeCachedLocation } from "./sos";

export interface LatLng {
  lat: number;
  lng: number;
}

interface GraphEdge {
  to: string;
  metres: number;
  wayId: string;
}

export interface GraphNode extends LatLng {
  edges: GraphEdge[];
}

export interface RoadFeature {
  id: string;
  highway: string;
  name?: string;
  coordinates: LatLng[];
}

export interface OfflineMapData {
  roads: RoadFeature[];
  nodes: Map<string, GraphNode>;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

export interface OfflineRoute {
  coordinates: LatLng[];
  distanceKm: number;
  walkingMinutes: number;
  snappedStart: LatLng;
  snappedEnd: LatLng;
  wayIds: string[];
  segments: OfflineRouteSegment[];
}

export interface OfflineRouteSegment {
  wayId: string;
  name?: string;
  coordinates: LatLng[];
  metres: number;
}

export interface RoutingClosure {
  center: LatLng;
  radiusMetres: number;
}

export interface ResolvedLocation {
  point: LatLng;
  source: "gps" | "cached" | "demo";
}

const BLOCKED_HIGHWAYS = new Set([
  "motorway",
  "motorway_link",
  "construction",
  "proposed",
  "abandoned",
  "raceway",
]);
const ALUVA_CENTRE: LatLng = { lat: FALLBACK_LOCATION.latitude, lng: FALLBACK_LOCATION.longitude };
let mapPromise: Promise<OfflineMapData> | null = null;
let locationPromise: Promise<ResolvedLocation> | null = null;

export function haversineMetres(a: LatLng, b: LatLng): number {
  const radius = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(x));
}

export function loadOfflineMap(): Promise<OfflineMapData> {
  if (!mapPromise) {
    mapPromise = fetch("/maps/aluva.osm", { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Aluva OSM data is missing from public/maps/aluva.osm");
        return parseOsm(await response.text());
      })
      .catch((error) => {
        mapPromise = null;
        throw error;
      });
  }
  return mapPromise;
}

export function parseOsm(xmlText: string): OfflineMapData {
  const document = new DOMParser().parseFromString(xmlText, "text/xml");
  if (document.querySelector("parsererror")) throw new Error("The Aluva OSM file is not valid XML");

  const coordinates = new Map<string, LatLng>();
  document.querySelectorAll("node").forEach((node) => {
    const id = node.getAttribute("id");
    const lat = Number(node.getAttribute("lat"));
    const lng = Number(node.getAttribute("lon"));
    if (id && Number.isFinite(lat) && Number.isFinite(lng)) coordinates.set(id, { lat, lng });
  });

  const roads: RoadFeature[] = [];
  const nodes = new Map<string, GraphNode>();

  document.querySelectorAll("way").forEach((way) => {
    const tags = new Map<string, string>();
    const children = Array.from(way.children);
    children
      .filter((child) => child.localName === "tag")
      .forEach((tag) => {
        const key = tag.getAttribute("k");
        const value = tag.getAttribute("v");
        if (key && value) tags.set(key, value);
      });
    const highway = tags.get("highway");
    if (
      !highway ||
      BLOCKED_HIGHWAYS.has(highway) ||
      tags.get("foot") === "no" ||
      tags.get("access") === "private"
    )
      return;

    const refs = children
      .map((child) => (child.localName === "nd" ? child.getAttribute("ref") : null))
      .filter((ref): ref is string => !!ref && coordinates.has(ref));
    if (refs.length < 2) return;
    const id = way.getAttribute("id") ?? `way-${roads.length}`;
    const line = refs.map((ref) => coordinates.get(ref)!);
    const name = tags.get("name");
    roads.push(
      name ? { id, highway, name, coordinates: line } : { id, highway, coordinates: line },
    );

    for (const ref of refs) {
      if (!nodes.has(ref)) nodes.set(ref, { ...coordinates.get(ref)!, edges: [] });
    }
    for (let index = 1; index < refs.length; index += 1) {
      const fromId = refs[index - 1]!;
      const toId = refs[index]!;
      if (
        haversineMetres(ALUVA_CENTRE, coordinates.get(fromId)!) > 5000 ||
        haversineMetres(ALUVA_CENTRE, coordinates.get(toId)!) > 5000
      )
        continue;
      const metres = haversineMetres(coordinates.get(fromId)!, coordinates.get(toId)!);
      nodes.get(fromId)!.edges.push({ to: toId, metres, wayId: id });
      nodes.get(toId)!.edges.push({ to: fromId, metres, wayId: id });
    }
  });

  if (roads.length === 0 || nodes.size === 0)
    throw new Error("No walkable roads were found in aluva.osm");
  const used = Array.from(nodes.values());
  return {
    roads,
    nodes,
    bounds: {
      minLat: Math.min(...used.map((node) => node.lat)),
      maxLat: Math.max(...used.map((node) => node.lat)),
      minLng: Math.min(...used.map((node) => node.lng)),
      maxLng: Math.max(...used.map((node) => node.lng)),
    },
  };
}

export function calculateWalkingRoute(
  data: OfflineMapData,
  start: LatLng,
  end: LatLng,
  blockedWayIds = new Set<string>(),
  closures: RoutingClosure[] = [],
): OfflineRoute | null {
  const startId = nearestNode(data.nodes, start);
  const endId = nearestNode(data.nodes, end);
  if (!startId || !endId) return null;

  const open = new MinHeap();
  const distance = new Map<string, number>([[startId, 0]]);
  const previous = new Map<string, { node: string; wayId: string }>();
  open.push(startId, haversineMetres(data.nodes.get(startId)!, data.nodes.get(endId)!));

  while (open.size > 0) {
    const current = open.pop()!;
    if (current === endId) break;
    const currentDistance = distance.get(current);
    if (currentDistance === undefined) continue;
    for (const edge of data.nodes.get(current)!.edges) {
      const from = data.nodes.get(current)!;
      const to = data.nodes.get(edge.to)!;
      if (
        blockedWayIds.has(edge.wayId) ||
        closures.some(
          (closure) =>
            distanceToRoadSegmentMetres(closure.center, from, to) <= closure.radiusMetres,
        )
      )
        continue;
      const nextDistance = currentDistance + edge.metres;
      if (nextDistance >= (distance.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue;
      distance.set(edge.to, nextDistance);
      previous.set(edge.to, { node: current, wayId: edge.wayId });
      const heuristic = haversineMetres(data.nodes.get(edge.to)!, data.nodes.get(endId)!);
      open.push(edge.to, nextDistance + heuristic);
    }
  }

  if (!distance.has(endId)) return null;
  const ids = [endId];
  const wayIds: string[] = [];
  let cursor = endId;
  while (cursor !== startId) {
    const step = previous.get(cursor);
    if (!step) return null;
    wayIds.push(step.wayId);
    cursor = step.node;
    ids.push(cursor);
  }
  ids.reverse();
  wayIds.reverse();
  const roadNames = new Map(data.roads.map((road) => [road.id, road.name]));
  const segments: OfflineRouteSegment[] = [];
  for (let index = 0; index < wayIds.length; index += 1) {
    const wayId = wayIds[index]!;
    const from = data.nodes.get(ids[index]!)!;
    const to = data.nodes.get(ids[index + 1]!)!;
    const metres = haversineMetres(from, to);
    const previousSegment = segments[segments.length - 1];
    if (previousSegment?.wayId === wayId) {
      previousSegment.coordinates.push(to);
      previousSegment.metres += metres;
    } else {
      const name = roadNames.get(wayId);
      segments.push(
        name
          ? { wayId, name, coordinates: [from, to], metres }
          : { wayId, coordinates: [from, to], metres },
      );
    }
  }
  const snappedStart = data.nodes.get(startId)!;
  const snappedEnd = data.nodes.get(endId)!;
  const metres =
    distance.get(endId)! + haversineMetres(start, snappedStart) + haversineMetres(end, snappedEnd);
  return {
    coordinates: [start, ...ids.map((id) => data.nodes.get(id)!), end],
    distanceKm: Math.round(metres / 10) / 100,
    walkingMinutes: Math.max(1, Math.round((metres / 1000 / 4.5) * 60)),
    snappedStart,
    snappedEnd,
    wayIds: Array.from(new Set(wayIds)),
    segments,
  };
}

/** Equirectangular point-to-segment distance; accurate enough for a local 5 km graph. */
function distanceToRoadSegmentMetres(point: LatLng, a: LatLng, b: LatLng): number {
  const centreLat = ((point.lat + a.lat + b.lat) / 3) * (Math.PI / 180);
  const metresPerLng = 111_320 * Math.cos(centreLat);
  const toLocal = (value: LatLng) => ({
    x: (value.lng - point.lng) * metresPerLng,
    y: (value.lat - point.lat) * 110_540,
  });
  const from = toLocal(a);
  const to = toLocal(b);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -(from.x * dx + from.y * dy) / lengthSquared));
  return Math.hypot(from.x + t * dx, from.y + t * dy);
}

function nearestNode(nodes: Map<string, GraphNode>, point: LatLng): string | null {
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [id, node] of nodes) {
    if (!node.edges.length) continue;
    const distance = haversineMetres(point, node);
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return bestDistance <= 1500 ? best : null;
}

export function resolveUserLocation(): Promise<ResolvedLocation> {
  if (locationPromise) return locationPromise;
  locationPromise = new Promise((resolve) => {
    const cached = readCachedLocation();
    const fallback = (): ResolvedLocation => {
      if (cached) {
        const point = { lat: cached.latitude, lng: cached.longitude };
        if (haversineMetres(point, ALUVA_CENTRE) <= 5_000) return { point, source: "cached" };
      }
      return { point: ALUVA_CENTRE, source: "demo" };
    };
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(fallback());
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (haversineMetres(point, ALUVA_CENTRE) > 5_000) return resolve(fallback());
        writeCachedLocation(point.lat, point.lng);
        resolve({ point, source: "gps" });
      },
      () => resolve(fallback()),
      { enableHighAccuracy: true, timeout: 4_000, maximumAge: 60_000 },
    );
  });
  return locationPromise;
}

class MinHeap {
  private values: { id: string; priority: number }[] = [];
  get size() {
    return this.values.length;
  }
  push(id: string, priority: number) {
    this.values.push({ id, priority });
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent]!.priority <= priority) break;
      this.values[index] = this.values[parent]!;
      index = parent;
    }
    this.values[index] = { id, priority };
  }
  pop(): string | null {
    if (this.values.length === 0) return null;
    const root = this.values[0]!.id;
    const last = this.values.pop()!;
    if (this.values.length === 0) return root;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      const child =
        right < this.values.length && this.values[right]!.priority < this.values[left]!.priority
          ? right
          : left;
      if (this.values[child]!.priority >= last.priority) break;
      this.values[index] = this.values[child]!;
      index = child;
    }
    this.values[index] = last;
    return root;
  }
}
