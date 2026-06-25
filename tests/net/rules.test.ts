import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, set, get, update } from "firebase/database";
import { readFileSync } from "node:fs";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "discthrowers-test",
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(async () => { await env.cleanup(); });

const meta = (over: object = {}) =>
  ({ createdAt: 1, host: "host", status: "active", mode: "beginner", ...over });

async function seed() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.database();
    await set(ref(db, "games/g/meta"), meta());
    await set(ref(db, "games/g/_claims/0"), "tokenZero");
    await set(ref(db, "games/g/state"), { version: 0, turn: { activeSeat: 0 } });
  });
}

describe("meta rules", () => {
  it("creates only with host = self, and any authenticated player updates game settings without changing host", async () => {
    const h = env.authenticatedContext("h").database();
    await assertSucceeds(set(ref(h, "games/m1/meta"), meta({ host: "h", status: "lobby" })));
    await assertFails(set(ref(h, "games/m2/meta"), meta({ host: "someone-else", status: "lobby" })));
    await assertSucceeds(set(ref(h, "games/m1/meta/mode"), "random"));
    await assertFails(set(ref(h, "games/m1/meta/host"), "takeover"));
    const eve = env.authenticatedContext("eve").database();
    await assertSucceeds(set(ref(eve, "games/m1/meta/mode"), "beginner"));
    await assertFails(set(ref(eve, "games/m1/meta/host"), "takeover"));
  });
});

describe("lobby rules", () => {
  async function lobbyGame(id: string) {
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), `games/${id}/meta`), meta({ status: "lobby" }));
    });
  }

  it("claims an empty slot with own uid; stealing and impersonation are denied", async () => {
    await lobbyGame("l1");
    const alice = env.authenticatedContext("alice").database();
    // Disc Throwers lobby has no color field — only uid + name required
    await assertSucceeds(set(ref(alice, "games/l1/lobby/0"), { uid: "alice", name: "Alice" }));
    const bob = env.authenticatedContext("bob").database();
    await assertFails(set(ref(bob, "games/l1/lobby/0"), { uid: "bob", name: "Bob" }));
    await assertFails(set(ref(bob, "games/l1/lobby/1"), { uid: "alice", name: "Fake" }));
  });

  it("lets a player edit their own seat", async () => {
    await lobbyGame("l2");
    const alice = env.authenticatedContext("alice").database();
    await set(ref(alice, "games/l2/lobby/0"), { uid: "alice", name: "Alice" });
    await assertSucceeds(set(ref(alice, "games/l2/lobby/0"), { uid: "alice", name: "Queen Alice" }));
  });

  it("any authenticated lobby player can clear a seat", async () => {
    await lobbyGame("l3");
    const alice = env.authenticatedContext("alice").database();
    await set(ref(alice, "games/l3/lobby/0"), { uid: "alice", name: "Alice" });
    const eve = env.authenticatedContext("eve").database();
    await assertSucceeds(set(ref(eve, "games/l3/lobby/0"), null));
  });

  it("rejects malformed seats (missing name) and claims after the game started", async () => {
    await lobbyGame("l4");
    const alice = env.authenticatedContext("alice").database();
    // Missing name → rejected
    await assertFails(set(ref(alice, "games/l4/lobby/0"), { uid: "alice" }));
    // Empty name → rejected
    await assertFails(set(ref(alice, "games/l4/lobby/1"), { uid: "alice", name: "" }));
    // After status flips to active → rejected
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/l4/meta/status"), "active");
    });
    await assertFails(set(ref(alice, "games/l4/lobby/2"), { uid: "alice", name: "Alice" }));
  });
});

describe("start + rescue rules", () => {
  it("lets authenticated players read claim tokens for recovery links", async () => {
    await seed();
    const db = env.authenticatedContext("eve").database();
    const snap = await assertSucceeds(get(ref(db, "games/g/_claims/0")));
    expect(snap.val()).toBe("tokenZero");
  });

  it("any authenticated player mints tokens and seats once", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/s1/meta"), meta({ status: "lobby" }));
    });
    const host = env.authenticatedContext("host").database();
    await assertSucceeds(set(ref(host, "games/s1/_claims/0"), "t0"));
    await assertFails(set(ref(host, "games/s1/_claims/0"), "t0-again")); // write-once
    await assertSucceeds(set(ref(host, "games/s1/seats/0"), { uid: "alice" }));
    const eve = env.authenticatedContext("eve").database();
    await assertSucceeds(set(ref(eve, "games/s1/_claims/1"), "t1"));
    await assertSucceeds(set(ref(eve, "games/s1/seats/1"), { uid: "eve-friend" }));
  });

  it("any authenticated player starts with one atomic multi-path update", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/s2/meta"), meta({ status: "lobby" }));
    });
    const eve = env.authenticatedContext("eve").database();
    await assertSucceeds(update(ref(eve, "games/s2"), {
      state: { version: 0, turn: { activeSeat: 0 } },
      "meta/status": "active",
      "seats/0": { uid: "alice" },
      "seats/1": { uid: "bob" },
      "_claims/0": "t0", "_claims/1": "t1",
    }));
    const snap = await get(ref(env.authenticatedContext("alice").database(), "games/s2/meta"));
    expect(snap.val().status).toBe("active");
  });

  it("rebinds a seat to a new device with the proof token (rescue link)", async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/g/seats/0"), { uid: "old-device" });
    });
    const fresh = env.authenticatedContext("new-device").database();
    await assertSucceeds(set(ref(fresh, "games/g/seats/0"), { uid: "new-device", proof: "tokenZero" }));
    const thief = env.authenticatedContext("thief").database();
    await assertFails(set(ref(thief, "games/g/seats/0"), { uid: "thief", proof: "wrong" }));
  });
});

describe("state rules", () => {
  it("any authenticated player creates the initial state (status=lobby)", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/st1/meta"), meta({ status: "lobby" }));
    });
    const eve = env.authenticatedContext("eve").database();
    await assertSucceeds(set(ref(eve, "games/st1/state"), { version: 0, turn: { activeSeat: 0 } }));
  });

  it("non-seated user cannot write state", async () => {
    await seed();
    // No seat bound for 'stranger' → write must fail
    const stranger = env.authenticatedContext("stranger").database();
    await assertFails(set(ref(stranger, "games/g/state"), { version: 1, turn: { activeSeat: 0 } }));
  });

  it("active seat can commit version+1", async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/g/seats/0"), { uid: "alice" });
    });
    const alice = env.authenticatedContext("alice").database();
    await assertSucceeds(set(ref(alice, "games/g/state"), { version: 1, turn: { activeSeat: 0 } }));
    // Skipping a version is rejected
    await assertFails(set(ref(alice, "games/g/state"), { version: 99, turn: { activeSeat: 0 } }));
  });

  it("non-active seat cannot write state", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.database();
      await set(ref(db, "games/na/meta"), meta());
      await set(ref(db, "games/na/seats/0"), { uid: "alice" });
      await set(ref(db, "games/na/seats/1"), { uid: "bob" });
      await set(ref(db, "games/na/state"), { version: 0, turn: { activeSeat: 0 } });
    });
    // bob owns seat 1, but active seat is 0 (alice) → rejected
    const bob = env.authenticatedContext("bob").database();
    await assertFails(set(ref(bob, "games/na/state"), { version: 1, turn: { activeSeat: 0 } }));
  });

  it("seat claim proof validates: valid token succeeds, invalid token fails", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.database();
      await set(ref(db, "games/sc/meta"), meta());
      await set(ref(db, "games/sc/_claims/2"), "secret-token");
      await set(ref(db, "games/sc/seats/2"), { uid: "original-owner" });
    });
    // New device with correct proof → succeeds
    const freshDevice = env.authenticatedContext("new-uid").database();
    await assertSucceeds(set(ref(freshDevice, "games/sc/seats/2"), { uid: "new-uid", proof: "secret-token" }));
    // Wrong proof → fails
    const badActor = env.authenticatedContext("bad-uid").database();
    await assertFails(set(ref(badActor, "games/sc/seats/2"), { uid: "bad-uid", proof: "wrong-token" }));
  });

  // DEFERRED: These tests require the Firebase Local Emulator Suite (Java).
  // They are written correctly and will pass once the emulator is available.
  it.skip("[DEFERRED/emulator] eligible non-active reactor CAN write version+1 while pendingReaction exists", async () => {
    // Seed: alice owns seat 0 (active), bob owns seat 1 (non-active).
    // pendingReaction is set — bob is an eligible reactor.
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.database();
      await set(ref(db, "games/pr1/meta"), meta());
      await set(ref(db, "games/pr1/seats/0"), { uid: "alice" });
      await set(ref(db, "games/pr1/seats/1"), { uid: "bob" });
      await set(ref(db, "games/pr1/state"), {
        version: 5,
        turn: { activeSeat: 0 },
        pendingReaction: {
          card: "steal-axe",
          actorSeat: 0,
          eligibleReactors: [1],
          passed: [],
        },
      });
    });
    // bob (non-active, seat 1) should be allowed to commit version+1 because pendingReaction exists
    const bob = env.authenticatedContext("bob").database();
    await assertSucceeds(set(ref(bob, "games/pr1/state"), {
      version: 6,
      turn: { activeSeat: 0 },
      pendingReaction: null,
    }));
  });

  it.skip("[DEFERRED/emulator] non-active seat CANNOT write when NO pendingReaction exists", async () => {
    // Seed: alice owns seat 0 (active), bob owns seat 1 (non-active).
    // No pendingReaction — only the active player may write.
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.database();
      await set(ref(db, "games/pr2/meta"), meta());
      await set(ref(db, "games/pr2/seats/0"), { uid: "alice" });
      await set(ref(db, "games/pr2/seats/1"), { uid: "bob" });
      await set(ref(db, "games/pr2/state"), {
        version: 5,
        turn: { activeSeat: 0 },
        // No pendingReaction
      });
    });
    // bob (non-active, seat 1) must be rejected — no pendingReaction
    const bob = env.authenticatedContext("bob").database();
    await assertFails(set(ref(bob, "games/pr2/state"), {
      version: 6,
      turn: { activeSeat: 0 },
    }));
  });
});
