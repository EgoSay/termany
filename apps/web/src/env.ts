/**
 * [INPUT]: 依赖浏览器全局 window 的 __TAURI_INTERNALS__ 标记与 navigator.userAgent
 * [OUTPUT]: 对外提供 isTauri、isMac 两个运行环境常量
 * [POS]: 前端的环境边界；窗口外壳（windowChrome、titleBar、App）据此决定走原生窗口 API 还是浏览器行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** True when running inside the Tauri desktop shell (vs. a plain browser). */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** True on macOS, where the window chrome follows the platform's own conventions. */
export const isMac = typeof navigator !== "undefined" && navigator.userAgent.includes("Mac");
