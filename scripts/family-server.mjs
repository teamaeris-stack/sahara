import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Small single-process demo store. Use HTTPS in front of this server outside localhost.
const file = resolve(process.env.SAHARA_FAMILY_DB || "family-demo-data.json");
const db = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(18).toString("hex");
const save = () => {
  writeFileSync(file + ".tmp", JSON.stringify(db), { mode: 0o600 });
  renameSync(file + ".tmp", file);
};
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
function snapshot(family) {
  return {
    members: Object.entries(family.roster).map(([id, name]) => ({
      ...(family.members[id]?.record || {}),
      id,
      name,
    })),
    requests: family.requests,
  };
}
const validId = (id) =>
  typeof id === "string" &&
  /^[a-zA-Z0-9_-]{1,64}$/.test(id) &&
  !["__proto__", "constructor", "prototype"].includes(id);
const cleanName = (value) => {
  const name = String(value || "")
    .trim()
    .slice(0, 40);
  if (!name) fail(400, "Enter a member name");
  return name;
};
function location(value) {
  if (value === null) return null;
  if (
    !value ||
    !Number.isFinite(value.lat) ||
    !Number.isFinite(value.lng) ||
    Math.abs(value.lat) > 90 ||
    Math.abs(value.lng) > 180 ||
    !Number.isFinite(value.at) ||
    value.at > Date.now() + 60000
  )
    fail(400, "Invalid location");
  return {
    lat: value.lat,
    lng: value.lng,
    at: value.at,
    label: String(value.label || "GPS location").slice(0, 80),
  };
}
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  const origin = req.headers.origin;
  const allowed = (
    process.env.SAHARA_ALLOWED_ORIGINS ||
    "http://localhost:8080,http://127.0.0.1:8080,https://localhost"
  ).split(",");
  if (origin && !allowed.includes(origin)) {
    res.writeHead(403);
    return res.end(JSON.stringify({ error: "Origin not allowed" }));
  }
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  try {
    if (req.method !== "POST" || req.url !== "/api/family") fail(404, "Not found");
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 32000) fail(413, "Request too large");
    }
    const input = JSON.parse(body);
    if (!validId(input.memberId)) fail(400, "Invalid member identity");
    let code = String(input.code || "").toUpperCase();
    if (input.action === "create") {
      if (Object.keys(db).length >= 1000) fail(503, "Demo server capacity reached");
      code = randomBytes(6).toString("hex").toUpperCase();
      db[code] = {
        members: {},
        roster: input.name ? {} : { me: "Me", dad: "Dad", mom: "Mom" },
        removed: [],
        requests: [],
        createdAt: Date.now(),
      };
    }
    const family = db[code];
    if (!family) fail(404, "Family code not found");
    family.roster ||= { me: "Me", dad: "Dad", mom: "Mom" };
    family.removed ||= [];
    if (input.action === "create" || input.action === "join") {
      if (input.name) {
        const name = cleanName(input.name);
        const existing = Object.keys(family.roster).find(
          (id) => family.roster[id].toLowerCase() === name.toLowerCase(),
        );
        if (existing) input.memberId = existing;
        else {
          if (family.removed.includes(input.memberId)) fail(409, "This member was removed");
          family.roster[input.memberId] = name;
        }
      } else if (!Object.hasOwn(family.roster, input.memberId)) fail(400, "Enter a member name");
      if (family.members[input.memberId]) fail(409, "That member is already assigned to a phone");
      const token = random();
      family.members[input.memberId] = {
        token: hash(token),
        sequence: 0,
        record: {
          status: "UNKNOWN",
          updatedAt: 0,
          location: null,
          history: [],
          places: [],
          sos: null,
          demo: false,
        },
      };
      save();
      res.end(JSON.stringify({ code, token, memberId: input.memberId, ...snapshot(family) }));
      return;
    }
    const member = family.members[input.memberId];
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    if (!member || member.token !== hash(token)) fail(401, "Member removed or credentials invalid");
    if (
      input.action === "addMember" ||
      input.action === "renameMember" ||
      input.action === "removeMember"
    ) {
      if (!validId(input.target)) fail(400, "Invalid member");
      if (input.action === "removeMember") {
        if (input.target === input.memberId) fail(400, "You cannot remove this phone from here");
        delete family.roster[input.target];
        delete family.members[input.target];
        if (!family.removed.includes(input.target)) family.removed.push(input.target);
        family.requests = family.requests.filter(
          (q) => q.from !== input.target && q.to !== input.target,
        );
      } else if (!family.removed.includes(input.target)) {
        const name = cleanName(input.name);
        if (
          Object.entries(family.roster).some(
            ([id, n]) => id !== input.target && n.toLowerCase() === name.toLowerCase(),
          )
        )
          fail(409, "Use a distinct member name");
        if (input.action === "renameMember" && !Object.hasOwn(family.roster, input.target))
          fail(404, "Member not found");
        if (input.action === "renameMember" || !Object.hasOwn(family.roster, input.target))
          family.roster[input.target] = name;
      }
    } else if (input.action === "update") {
      if (!Number.isSafeInteger(input.sequence) || input.sequence < 1)
        fail(400, "Invalid update sequence");
      const r = input.record;
      if (
        !r ||
        !["UNKNOWN", "SAFE", "NEEDS_HELP", "NO_RESPONSE", "RECHECK_MISSED", "AT_SHELTER"].includes(
          r.status,
        )
      )
        fail(400, "Invalid status");
      if (input.sequence > member.sequence) {
        const point = location(r.location);
        const history = member.record.history || [];
        if (point && !history.some((p) => p.at === point.at)) history.push(point);
        member.record = {
          status: r.status,
          updatedAt: Date.now(),
          location: point,
          history: history.slice(-8),
          demo: r.demo === true,
          places: (Array.isArray(r.places) ? r.places : []).slice(0, 5).map(location),
          sos: r.sos
            ? {
                id: String(r.sos.id).slice(0, 60),
                type: String(r.sos.type).slice(0, 60),
                at: Number(r.sos.at) || Date.now(),
              }
            : null,
        };
        member.sequence = input.sequence;
        if (r.status === "SAFE" || r.status === "AT_SHELTER")
          family.requests.forEach((q) => {
            if (q.to === input.memberId && !q.respondedAt) q.respondedAt = Date.now();
          });
      }
    } else if (input.action === "checkin") {
      if (!Object.hasOwn(family.roster, input.to) || input.to === input.memberId)
        fail(400, "Invalid check-in recipient");
      if (!family.requests.some((q) => q.id === input.eventId))
        family.requests.push({
          id: String(input.eventId).slice(0, 80),
          from: input.memberId,
          to: input.to,
          at: Date.now(),
          respondedAt: null,
        });
      family.requests = family.requests.slice(-30);
    } else if (input.action !== "pull") fail(400, "Unknown action");
    save();
    res.end(JSON.stringify(snapshot(family)));
  } catch (error) {
    res.writeHead(error.status || 400);
    res.end(JSON.stringify({ error: error.message }));
  }
});
server.listen(
  Number(process.env.SAHARA_FAMILY_PORT || 8787),
  process.env.SAHARA_FAMILY_HOST || "127.0.0.1",
  () => console.log("Sahara family sync ready"),
);
