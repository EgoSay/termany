/**
 * [INPUT]: 依赖 node:test、node:assert 与 windowChrome 的纯函数（动作决策、动作执行、全屏观察）
 * [OUTPUT]: 验证绿灯语义、全屏切换、全屏内禁 zoom、拖动不查状态、全屏观察者的订阅与退订
 * [POS]: 窗口外壳行为的回归测试，用假窗口对象驱动，不依赖真实 Tauri 窗口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWindowAction,
  watchFullscreen,
  zoomButtonAction,
  type ChromeWindow,
  type FullscreenSource,
} from "./windowChrome";

// ── 假窗口：记录调用，可控全屏态 ──────────────────────────────────────────
function fakeWindow(fullscreen = false) {
  const calls: string[] = [];
  const win: ChromeWindow = {
    startDragging: async () => { calls.push("drag"); },
    toggleMaximize: async () => { calls.push("zoom"); },
    isFullscreen: async () => fullscreen,
    setFullscreen: async (on: boolean) => { calls.push(`fullscreen:${on}`); },
  };
  return { win, calls };
}

// ── 绿灯语义 ──────────────────────────────────────────────────────────────
test("green button on macOS enters native full screen", () => {
  assert.equal(zoomButtonAction(true, false), "fullscreen");
});

test("option-click on the macOS green button zooms instead", () => {
  assert.equal(zoomButtonAction(true, true), "zoom");
});

test("green button outside macOS always zooms", () => {
  assert.equal(zoomButtonAction(false, false), "zoom");
  assert.equal(zoomButtonAction(false, true), "zoom");
});

// ── 动作执行 ──────────────────────────────────────────────────────────────
test("fullscreen action enters full screen from a window", async () => {
  const { win, calls } = fakeWindow(false);
  await applyWindowAction("fullscreen", win);
  assert.deepEqual(calls, ["fullscreen:true"]);
});

test("fullscreen action leaves full screen when already in it", async () => {
  const { win, calls } = fakeWindow(true);
  await applyWindowAction("fullscreen", win);
  assert.deepEqual(calls, ["fullscreen:false"]);
});

test("zoom is ignored inside native full screen", async () => {
  const { win, calls } = fakeWindow(true);
  await applyWindowAction("zoom", win);
  assert.deepEqual(calls, []);
});

test("zoom toggles maximize in a window", async () => {
  const { win, calls } = fakeWindow(false);
  await applyWindowAction("zoom", win);
  assert.deepEqual(calls, ["zoom"]);
});

test("drag starts at once without querying window state", async () => {
  const { win, calls } = fakeWindow(false);
  win.isFullscreen = async () => { throw new Error("drag must not wait on a state query"); };
  await applyWindowAction("drag", win);
  assert.deepEqual(calls, ["drag"]);
});

test("a null action does nothing", async () => {
  const { win, calls } = fakeWindow(false);
  await applyWindowAction(null, win);
  assert.deepEqual(calls, []);
});

// ── 全屏观察者 ────────────────────────────────────────────────────────────
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function fakeSource() {
  let fullscreen = false;
  let handler: (() => void) | null = null;
  let unlistened = 0;
  const source: FullscreenSource = {
    isFullscreen: async () => fullscreen,
    onResized: async (cb: () => void) => {
      handler = cb;
      return () => { unlistened++; };
    },
  };
  return {
    source,
    set: (v: boolean) => { fullscreen = v; },
    resize: () => handler?.(),
    get unlistened() { return unlistened; },
  };
}

test("watchFullscreen reports the initial state and every change after a resize", async () => {
  const src = fakeSource();
  const seen: boolean[] = [];
  watchFullscreen(src.source, (v) => seen.push(v));
  await tick();
  assert.deepEqual(seen, [false]);

  src.set(true);
  src.resize();
  await tick();
  assert.deepEqual(seen, [false, true]);
});

test("watchFullscreen stops reporting and unlistens after unsubscribe", async () => {
  const src = fakeSource();
  const seen: boolean[] = [];
  const stop = watchFullscreen(src.source, (v) => seen.push(v));
  await tick();
  stop();
  await tick();
  assert.equal(src.unlistened, 1);

  src.set(true);
  src.resize();
  await tick();
  assert.deepEqual(seen, [false]);
});
