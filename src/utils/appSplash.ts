// src/utils/appSplash.ts
// 控制 index.html 内联的首屏加载遮罩：React 挂载后淡出，动画结束再从 DOM 摘掉。

const SPLASH_ELEMENT_ID = 'app-splash';
// 与 index.html 中 #app-splash 的 transition 时长保持一致。
const FADE_OUT_MS = 320;
// v6：星云动画最短展示时长（比 v5 略长，让逐字浮现与光轨能看完整）。命中缓存时 React 可能几十毫秒就挂载，
// 立刻淡出会让启动界面一闪而过；不足的部分补一个短延迟。
const MIN_SHOW_MS = 1050;
const now = (): number => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);
const START_MS = now();

// 淡出并移除首屏加载遮罩；遮罩不存在（OBS 源已提前移除、或已经调用过）时是空操作。
export const hideAppSplash = (): void => {
    const splash = document.getElementById(SPLASH_ELEMENT_ID);
    if (!splash) {
        return;
    }
    const fade = () => {
        splash.classList.add('is-hiding');
        window.setTimeout(() => splash.remove(), FADE_OUT_MS);
    };
    const remaining = Math.max(0, MIN_SHOW_MS - (now() - START_MS));
    if (remaining > 0) window.setTimeout(fade, remaining);
    else fade();
};
