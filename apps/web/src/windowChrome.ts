/**
 * [INPUT]: 依赖 @tauri-apps/api/window 的 getCurrentWindow（startDragging / toggleMaximize / setFullscreen / isFullscreen / onResized），依赖 react 的 useEffect / useState，依赖 ./env 的 isTauri
 * [OUTPUT]: 对外提供 WindowAction / ChromeWindow / FullscreenSource 类型，zoomButtonAction、applyWindowAction、watchFullscreen、useWindowFullscreen、toggleFullscreen
 * [POS]: 桌面窗口外壳动作的唯一所有者；WindowControls、titleBar 与 App 都经此模块触达窗口，不再各自直接调 Tauri
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { isTauri } from "./env";

// ── 类型 ──────────────────────────────────────────────────────────────────

/** 窗口级动作。drag / zoom 来自标题栏手势，fullscreen 来自绿灯、快捷键与菜单。 */
export type WindowAction = "drag" | "zoom" | "fullscreen" | null;

/** 动作执行所需的窗口能力切片；结构化类型，测试用假对象即可替代。 */
export type ChromeWindow = {
  startDragging(): Promise<void>;
  toggleMaximize(): Promise<void>;
  setFullscreen(fullscreen: boolean): Promise<void>;
  isFullscreen(): Promise<boolean>;
};

/** 全屏观察所需的窗口能力切片。 */
export type FullscreenSource = {
  isFullscreen(): Promise<boolean>;
  onResized(handler: () => void): Promise<() => void>;
};

// ── 决策 ──────────────────────────────────────────────────────────────────

/**
 * 绿灯按下时该做什么。macOS 的约定：点击进原生全屏（独立 Space，可与其他
 * 应用分屏），按住 ⌥ 才是 zoom（铺满当前屏幕）。其他平台没有全屏 Space 的
 * 概念，绿灯一律 zoom。
 */
export function zoomButtonAction(isMac: boolean, altKey: boolean): WindowAction {
  return isMac && !altKey ? "fullscreen" : "zoom";
}

// ── 执行 ──────────────────────────────────────────────────────────────────

/**
 * 执行一个窗口动作。
 *
 * drag 不查任何状态：它必须搭在当前这次原生鼠标事件上，多一次异步往返就
 * 会错过。zoom 在原生全屏里被忽略：全屏期间 tao 暂存了窗口的样式与几何，
 * 这时再 toggleMaximize 会把退出全屏时要还原的状态搅乱。
 */
export async function applyWindowAction(action: WindowAction, win: ChromeWindow): Promise<void> {
  if (action === "drag") return win.startDragging();
  if (!action) return;
  const fullscreen = await win.isFullscreen();
  if (action === "fullscreen") return win.setFullscreen(!fullscreen);
  if (!fullscreen) return win.toggleMaximize();
}

// ── 观察 ──────────────────────────────────────────────────────────────────

/**
 * 观察窗口是否处于原生全屏，返回退订函数。
 *
 * Tauri 没有 fullscreen 事件，但 tao 在进入与退出全屏后都会发 resize，
 * 所以每次 resize 后重新问一次即可。退订后即使订阅的 Promise 尚未落地，
 * 也不会再回调。
 */
export function watchFullscreen(
  source: FullscreenSource,
  onChange: (fullscreen: boolean) => void,
): () => void {
  let live = true;
  const refresh = () => {
    void source
      .isFullscreen()
      .then((fullscreen) => {
        if (live) onChange(fullscreen);
      })
      .catch(() => {});
  };
  refresh();
  const unlisten = source.onResized(refresh);
  return () => {
    live = false;
    void unlisten.then((stop) => stop()).catch(() => {});
  };
}

/** 当前窗口是否处于原生全屏；浏览器里恒为 false。 */
export function useWindowFullscreen(): boolean {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    if (!isTauri) return;
    return watchFullscreen(getCurrentWindow(), setFullscreen);
  }, []);
  return fullscreen;
}

/** 供快捷键、⌘P 面板使用：进入或退出原生全屏。浏览器里无事发生。 */
export function toggleFullscreen(): Promise<void> {
  if (!isTauri) return Promise.resolve();
  return applyWindowAction("fullscreen", getCurrentWindow());
}
