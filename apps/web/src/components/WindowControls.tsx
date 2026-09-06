/**
 * [INPUT]: 依赖 @tauri-apps/api/window 的 getCurrentWindow，依赖 ../env 的 isMac，依赖 ../windowChrome 的 zoomButtonAction / applyWindowAction
 * [OUTPUT]: 对外提供 WindowControls 组件（自绘的关闭 / 最小化 / 缩放三灯）
 * [POS]: 桌面无边框窗口的控制层；原生全屏期间由 App 卸载，让位给 macOS 悬停顶部时滑出的原生标题栏
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isMac } from "../env";
import { applyWindowAction, zoomButtonAction } from "../windowChrome";

// Glyphs shown on hover, matching the macOS traffic lights (✕ / − / fill arrows).
const glyphs = {
  close: (
    <svg viewBox="0 0 12 12" aria-hidden>
      <path
        d="M3.4 3.4l5.2 5.2M8.6 3.4l-5.2 5.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  min: (
    <svg viewBox="0 0 12 12" aria-hidden>
      <path d="M3 6h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  zoom: (
    <svg viewBox="0 0 12 12" aria-hidden>
      <path d="M3 3.4 L7 3.4 L3 7.4 Z M9 8.6 L5 8.6 L9 4.6 Z" fill="currentColor" />
    </svg>
  ),
};

/**
 * macOS-style traffic lights, drawn by us because the window is borderless
 * (decorations: false) to avoid the native frame's top hairline. Rendered only
 * inside the Tauri shell, and only outside native full screen: there macOS
 * hides its own lights and slides them back in with the menu bar on hover.
 *
 * The green light follows the platform: on macOS a click enters native full
 * screen (its own Space, so Mission Control can tile it) and ⌥-click zooms;
 * elsewhere it maximizes.
 */
export function WindowControls() {
  const win = getCurrentWindow();
  return (
    <div className="win-controls">
      <button className="win-dot close" aria-label="Close" onClick={() => void win.close()}>
        {glyphs.close}
      </button>
      <button className="win-dot min" aria-label="Minimize" onClick={() => void win.minimize()}>
        {glyphs.min}
      </button>
      <button
        className="win-dot zoom"
        aria-label="Zoom"
        onClick={(e) => void applyWindowAction(zoomButtonAction(isMac, e.altKey), win)}
      >
        {glyphs.zoom}
      </button>
    </div>
  );
}
