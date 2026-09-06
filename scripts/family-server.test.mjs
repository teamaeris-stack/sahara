import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

test("three independent clients: identity, SOS/location, offline replay, check-in, restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "sahara-sync-test-"));
  const port = 18787;
  const start = async () => {
    const child = spawn(process.execPath, ["scripts/family-server.mjs"], {
      env: {
        ...process.env,
        SAHARA_FAMILY_PORT: String(port),
        SAHARA_FAMILY_DB: join(directory, "db.json"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => {
        throw new Error("Test server exited");
      }),
    ]);
    return child;
  };
  let child = await start();
  const call = async (body, token = "", status = 200) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/family`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  };
  try {
    const me = await call({ action: "create", memberId: "me" });
    const code = me.code;
    const dad = await call({ action: "join", memberId: "dad", code });
    const mom = await call({ action: "join", memberId: "mom", code });
    await call({ action: "join", memberId: "dad", code }, "", 409);
    await call({ action: "join", memberId: "fourth", code }, "", 400);
    await call({ action: "pull", memberId: "dad", code }, me.token, 401);
    const point = { lat: 10.1076, lng: 76.3516, at: Date.now(), label: "Test Aluva" };
    const update = {
      action: "update",
      memberId: "dad",
      code,
      sequence: 1,
      record: {
        status: "NEEDS_HELP",
        location: point,
        places: [],
        sos: { id: "test-sos", type: "FLOOD", at: Date.now() },
        demo: true,
      },
    };
    await call(update, dad.token);
    await call(update, dad.token);
    let snapshot = await call({ action: "pull", memberId: "me", code }, me.token);
    assert.equal(snapshot.members.length, 3);
    assert.equal(snapshot.members.find((m) => m.id === "dad").sos.id, "test-sos");
    assert.equal(snapshot.members.find((m) => m.id === "dad").history.length, 1);
    await call(
      {
        action: "update",
        memberId: "mom",
        code,
        sequence: 1,
        record: { status: "SAFE", location: point, places: [], sos: null },
      },
      mom.token,
    );
    await call({ action: "checkin", memberId: "me", code, to: "dad", eventId: "check1" }, me.token);
    await call({ action: "checkin", memberId: "me", code, to: "dad", eventId: "check1" }, me.token);
    await call(
      { ...update, sequence: 2, record: { ...update.record, status: "SAFE", sos: null } },
      dad.token,
    );
    // An old offline retry must not overwrite a later acknowledged status.
    await call(update, dad.token);
    child.kill();
    await once(child, "exit");
    child = await start();
    snapshot = await call({ action: "pull", memberId: "me", code }, me.token);
    assert.equal(snapshot.members.find((m) => m.id === "dad").status, "SAFE");
    assert.equal(snapshot.requests.length, 1);
    assert.ok(snapshot.requests[0].respondedAt);
    const owner = await call({ action: "create", memberId: "owner-phone", name: "Kaif" });
    const familyCode = owner.code;
    assert.deepEqual(
      owner.members.map((m) => m.name),
      ["Kaif"],
    );
    const edit = (action, target, name) =>
      call({ action, code: familyCode, memberId: "owner-phone", target, name }, owner.token);
    for (const [target, name] of [
      ["a", "Aisha"],
      ["b", "Brother"],
      ["c", "Uncle"],
      ["d", "Grandma"],
    ])
      await edit("addMember", target, name);
    await edit("addMember", "a", "Aisha");
    let roster = await call(
      { action: "pull", code: familyCode, memberId: "owner-phone" },
      owner.token,
    );
    assert.equal(roster.members.length, 5);
    const aisha = await call({
      action: "join",
      code: familyCode,
      memberId: "new-device-id",
      name: "Aisha",
    });
    assert.equal(aisha.memberId, "a");
    await edit("renameMember", "a", "Aisha Siddique");
    await call(
      {
        action: "update",
        code: familyCode,
        memberId: "a",
        sequence: 1,
        record: { status: "SAFE", location: point, places: [], sos: null },
      },
      aisha.token,
    );
    roster = await call({ action: "pull", code: familyCode, memberId: "a" }, aisha.token);
    assert.equal(roster.members.find((m) => m.id === "a").name, "Aisha Siddique");
    await edit("removeMember", "a");
    await edit("removeMember", "a");
    await edit("addMember", "a", "Aisha");
    await call({ action: "pull", code: familyCode, memberId: "a" }, aisha.token, 401);
    await call(
      { action: "removeMember", code: familyCode, memberId: "owner-phone", target: "owner-phone" },
      owner.token,
      400,
    );
    child.kill();
    await once(child, "exit");
    child = await start();
    roster = await call({ action: "pull", code: familyCode, memberId: "owner-phone" }, owner.token);
    assert.equal(roster.members.length, 4);
    assert.ok(!roster.members.some((m) => m.id === "a"));
  } finally {
    child.kill();
    await once(child, "exit");
  }
});
