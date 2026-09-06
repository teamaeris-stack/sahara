import { useLang } from "@/lib/i18n";
import { HAZARD_META, ROADS, SHELTERS, USER_POS, toPath, type Hazard, type Point, type RouteDef, type Shelter } from "@/lib/shelters";

const STATUS_FILL = {
  AVAILABLE: "var(--color-safe)",
  LIMITED: "var(--color-warning)",
  FULL: "var(--color-emergency)",
} as const;

/** Evidence marker for the Family map (never "live"). */
export interface MapEvidence {
  id: string;
  pos: Point;
  label: string;
  kind: "CHECKIN" | "PEER" | "SELF";
  latest?: boolean;
}

/**
 * Stylized offline emergency map. Pure SVG — no tiles, no network.
 * Coordinates live in shelters.ts (0–100 space).
 */
export function LocalMap({
  selectedId,
  onSelect,
  route,
  hazards,
  compact,
  evidence,
  trail,
  hideUser,
}: {
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  route?: RouteDef | null;
  hazards: Hazard[];
  compact?: boolean;
  evidence?: MapEvidence[];
  /** Ordered evidence positions drawn as a dashed trail. */
  trail?: Point[];
  hideUser?: boolean;
}) {
  const { t, tx } = useLang();
  const blockedRoads = new Set(hazards.filter((h) => h.roadKey).map((h) => h.roadKey));

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={t("localMap")}
      className={`w-full rounded-xl border bg-[color:var(--color-navy-soft)] ${compact ? "aspect-[4/3]" : "aspect-square"}`}
    >
      <defs>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke="var(--color-border)" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#grid)" />

      {/* Roads */}
      {ROADS.map((r) => (
        <g key={r.key}>
          <path d={toPath(r.points)} stroke="var(--color-card)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d={toPath(r.points)} stroke="var(--color-input)" strokeWidth="0.6" strokeDasharray="1.5 1.5" fill="none" />
          {blockedRoads.has(r.key) && (
            <path d={toPath(r.points)} stroke="var(--color-warning)" strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.8" />
          )}
        </g>
      ))}

      {/* Road labels */}
      <MapLabel x={52} y={80} text={t("mainRoad")} />
      <MapLabel x={10} y={46} text={t("schoolRoad")} />
      <MapLabel x={10} y={92} text={t("templeRoad")} />
      <MapLabel x={12} y={62} text={t("northStreet")} rotate={-90} rx={24} ry={64} />
      <MapLabel x={56} y={68} text={t("eastStreet")} />
      <MapLabel x={78} y={40} text={t("stationRoad")} rotate={-90} rx={76} ry={40} />
      <circle cx={50} cy={48} r={1.6} fill="var(--color-foreground)" />
      <MapLabel x={52} y={46} text={t("marketJunction")} bold />

      {/* Active route */}
      {route && (
        <>
          <path d={toPath(route.points)} stroke="var(--color-card)" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d={toPath(route.points)} stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      )}

      {/* Evidence trail */}
      {trail && trail.length > 1 && (
        <path d={toPath(trail)} stroke="var(--color-primary)" strokeWidth="1.2" strokeDasharray="2 1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
      )}

      {/* Hazards */}
      {hazards.map((h) => {
        const Icon = HAZARD_META[h.kind].icon;
        return (
          <g key={h.id} transform={`translate(${h.pos.x} ${h.pos.y})`}>
            <title>{t(HAZARD_META[h.kind].key)}</title>
            <circle r={h.reported ? 4.2 : 3.6} fill="var(--color-warning)" stroke={h.reported ? "var(--color-emergency)" : "var(--color-card)"} strokeWidth="0.8" />
            <foreignObject x={-2.4} y={-2.4} width={4.8} height={4.8}>
              <Icon className="h-full w-full text-warning-foreground" strokeWidth={2.5} aria-hidden />
            </foreignObject>
          </g>
        );
      })}

      {/* Shelters */}
      {SHELTERS.map((s) => (
        <ShelterMarker key={s.id} shelter={s} selected={selectedId === s.id} onSelect={onSelect} label={tx(s.name)} />
      ))}

      {/* Family evidence */}
      {evidence?.map((e) => (
        <g key={e.id} transform={`translate(${e.pos.x} ${e.pos.y})`}>
          <title>{e.label}</title>
          {e.latest && <circle r={5.5} fill="none" stroke="var(--color-primary)" strokeWidth="0.8" strokeDasharray="1.2 1" />}
          <circle r={e.kind === "PEER" ? 2.6 : 3.2} fill={e.kind === "PEER" ? "var(--color-card)" : "var(--color-primary)"} stroke="var(--color-primary)" strokeWidth="1" />
          <text x={0} y={-4.6} textAnchor="middle" fontSize="2.6" fontWeight="800" fill="var(--color-primary)" style={{ paintOrder: "stroke" }} stroke="var(--color-card)" strokeWidth="0.7">
            {e.label}
          </text>
        </g>
      ))}

      {/* User */}
      {!hideUser && (
        <g transform={`translate(${USER_POS.x} ${USER_POS.y})`}>
          <circle r={5} fill="var(--color-primary)" opacity="0.2">
            <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle r={2.6} fill="var(--color-primary)" stroke="var(--color-card)" strokeWidth="0.9" />
          <text x={0} y={7.5} textAnchor="middle" fontSize="3.4" fontWeight="800" fill="var(--color-primary)">
            {t("you")}
          </text>
        </g>
      )}
    </svg>
  );
}

function ShelterMarker({
  shelter,
  selected,
  onSelect,
  label,
}: {
  shelter: Shelter;
  selected: boolean;
  onSelect?: ((id: string) => void) | undefined;
  label: string;
}) {
  const fill = STATUS_FILL[shelter.status];
  const short = label.split(" ").slice(0, 2).join(" ");
  const interactive = !!onSelect;
  return (
    <g
      transform={`translate(${shelter.pos.x} ${shelter.pos.y})`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={label}
      aria-pressed={interactive ? selected : undefined}
      onClick={() => onSelect?.(shelter.id)}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect?.(shelter.id);
        }
      }}
      className={interactive ? "cursor-pointer outline-none focus-visible:[&>circle]:stroke-[var(--color-ring)]" : ""}
    >
      {selected && <circle r={6.5} fill="none" stroke={fill} strokeWidth="0.9" strokeDasharray="1.2 1" />}
      <circle r={selected ? 4.4 : 3.6} fill={fill} stroke="var(--color-card)" strokeWidth="1" />
      <text x={0} y={1.2} textAnchor="middle" fontSize="3.2" fontWeight="900" fill="var(--color-card)">
        {shelter.type === "SAFE_ASSEMBLY_ZONE" ? "Z" : shelter.type === "MEDICAL_SAFE_POINT" ? "+" : "S"}
      </text>
      <text x={0} y={-5.5} textAnchor="middle" fontSize="2.8" fontWeight="800" fill="var(--color-foreground)" style={{ paintOrder: "stroke" }} stroke="var(--color-card)" strokeWidth="0.8">
        {short}
      </text>
    </g>
  );
}

function MapLabel({ x, y, text, bold, rotate, rx, ry }: { x: number; y: number; text: string; bold?: boolean; rotate?: number; rx?: number; ry?: number }) {
  return (
    <text
      x={x}
      y={y}
      fontSize="2.6"
      fontWeight={bold ? 800 : 600}
      fill="var(--color-muted-foreground)"
      transform={rotate ? `rotate(${rotate} ${rx ?? x} ${ry ?? y})` : undefined}
    >
      {text}
    </text>
  );
}
