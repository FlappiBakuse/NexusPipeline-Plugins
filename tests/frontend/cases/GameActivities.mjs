import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

export async function assertGameActivitiesBehavior(plugin) {
  const hook = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts")) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  } });
  let createActivityState, createCoverAssets, policy, formatTime, shallowRef, computed, nextTick;
  try {
    ({ createActivityState } = await import(pathToFileURL(path.join(plugin, "frontend/src/useActivityState.ts"))));
    ({ createCoverAssets } = await import(pathToFileURL(path.join(plugin, "frontend/src/useCoverAssets.ts"))));
    policy = await import(pathToFileURL(path.join(plugin, "frontend/src/activityPolicy.ts")));
    ({ formatTime } = await import(pathToFileURL(path.join(plugin, "frontend/src/formatting.ts"))));
    ({ shallowRef, computed, nextTick } = await import("vue"));
  } finally { hook.deregister(); }
  const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); await nextTick(); };
  const host = { i18n: { locale: "en-US", t: (key, args) => key === "time.sourceDefault" ? args.zone : key } };
  const point = { instantUtc: "2030-10-01T02:00:00Z", rawValue: "2030-10-01T10:00:00", timeBasis: "source-default", sourceZone: "UTC+8" };
  assert.equal(policy.displayInstant(point), Date.parse(point.instantUtc));
  assert.notEqual(formatTime(point, host, "Asia/Shanghai"), formatTime(point, host, "America/New_York"));
  assert.match(formatTime({ ...point, instantUtc: null }, host, "UTC"), /time.unverified/);
  assert.equal(policy.status({ times: { start: null, playEnd: null } }, Date.now()), "unknown");
  const equal = [{eventId:"z",times:{start:point,playEnd:{...point,instantUtc:"2030-11-01T00:00:00Z"}}},{eventId:"a",times:{start:point,playEnd:{...point,instantUtc:"2030-11-01T00:00:00Z"}}}];
  assert.deepEqual(policy.order(equal, Date.parse("2030-10-02T00:00:00Z")).map(x=>x.eventId), ["z","a"]);
  const original = { Image: globalThis.Image, setTimeout, clearTimeout, setInterval, clearInterval };
  const timers = new Map(), intervals = new Map(); let nextId = 0;
  globalThis.setTimeout = (fn, delay) => { const id = ++nextId; timers.set(id, { fn, delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.setInterval = (fn, delay) => { const id = ++nextId; intervals.set(id, { fn, delay }); return id; };
  globalThis.clearInterval = id => intervals.delete(id);
  let state, covers;
  try {
    let resolveState, stateReads = 0, active = 0, maximum = 0, feedReads = 0;
    const feed = { formatVersion: 3, gameId: "blue-archive", progressionId: "cn", contentLocale: "zh-CN", snapshotId: "same", health: { cacheState: "fresh" } };
    const response = { formatVersion: 3, serverNowUtc: new Date().toISOString(), settingsRevision: 0, refreshing: false,
      settings: { selectedGames: ["blue-archive"], progressions: { "blue-archive": "cn", "neverness-to-everness": "cn" }, carouselIntervalSeconds: 30 }, selectedFeeds: [{ ...feed }] };
    host.api = { get: async route => {
      if (route === "feed") { feedReads++; return feed; }
      stateReads++; active++; maximum = Math.max(maximum, active);
      if (stateReads === 1) await new Promise(resolve => { resolveState = resolve; });
      active--; return structuredClone(response);
    } };
    state = createActivityState(host); const joined = Promise.all([state.load(), state.load(), state.load()]);
    resolveState(); await joined; await settle();
    assert.equal(maximum, 1); assert.equal(feedReads, 1);
    response.selectedFeeds[0].health.cacheState = "stale"; await state.load();
    assert.equal(feedReads, 1); assert.equal(state.feeds.value["blue-archive/cn"].health.cacheState, "stale");
    state.dispose(); state = null;
    assert.equal(timers.size, 0); assert.equal(intervals.size, 0);

    let calls = 0, fail = true, decodeRelease;
    globalThis.Image = class { decode() { return this.src && calls > 2 ? new Promise(resolve => { decodeRelease = resolve; }) : Promise.resolve(); } };
    host.api.blob = async () => { calls++; if (fail) throw new Error("temporary 503"); return new Blob(["controlled decoded image"]); };
    const slides = shallowRef([{ id: "slide", entityId: "entity", cover: { assetId: "one" } }]);
    covers = createCoverAssets(host, computed(() => slides.value)); await settle();
    assert.equal(calls, 1); assert.equal(covers.images.value["overview/slide"], undefined);
    fail = false; covers.retryFailed(); await settle();
    const oldUrl = covers.images.value["overview/slide"]; assert.ok(oldUrl);
    const firstGroup = covers.createGroup(), secondGroup = covers.createGroup();
    assert.notEqual(firstGroup, secondGroup);
    covers.bindMany(firstGroup, [{ id: "item", entityId: "entity", cover: { assetId: "one" } }]);
    covers.bindMany(secondGroup, [{ id: "item", entityId: "entity", cover: { assetId: "one" } }]); await settle();
    covers.releaseGroup(firstGroup);
    assert.equal(covers.images.value[firstGroup + "item"], undefined);
    assert.equal(covers.images.value[secondGroup + "item"], oldUrl);
    covers.releaseGroup(secondGroup);
    covers.bindMany("details/", [{ id: "item", entityId: "entity", cover: { assetId: "one" } }]); await settle();
    assert.equal(calls, 2); assert.equal(covers.images.value["details/item"], oldUrl);
    slides.value = [{ id: "slide", entityId: "entity", cover: { assetId: "two" } }]; await settle();
    assert.equal(covers.images.value["overview/slide"], oldUrl, "same entity must retain old image until decode finishes");
    decodeRelease(); await settle(); assert.notEqual(covers.images.value["overview/slide"], oldUrl);
    covers.releaseGroup("details/"); slides.value = [{ id: "slide", entityId: "new-entity", cover: null }]; await settle();
    assert.equal(covers.images.value["overview/slide"], undefined, "another overview must never inherit the old cover");
    covers.dispose(); covers = null; assert.equal(timers.size, 0); assert.equal(intervals.size, 0);
  } finally {
    state?.dispose(); covers?.dispose();
    for (const [key, value] of Object.entries(original)) globalThis[key] = value;
  }
}
