// src/services/foliaPerfBoost.ts
// Folia 定制版 v5 · 流畅度专项（独立模块，不改任何 React 组件）
//
// 提供：自动性能档（按设备能力判定）/ 实时 FPS 与长任务采样 / 一键极速 /
//       跳过启动动画 / 后台自动停帧 / 低帧提示。
// 设计原则：只动 transform / opacity，所有重绘型效果交给 CSS 覆盖层降级；
// 采样本身极轻（每秒结算一次），页面隐藏时完全停表，不制造额外卡顿。

import { setGlobalVisualizerFrameRate, VISUALIZER_FRAME_RATE_STORAGE_KEY } from '../utils/frameRateLimiter';

const K = {
    turbo: 'folia_custom_turbo',
    auto: 'folia_custom_perf_auto',
    skipSplash: 'folia_custom_skip_splash',
    power: 'folia_custom_power',
};

export type PerfStats = {
    fps: number;
    minFps: number;
    longTasks: number;
    reason: string;
    turbo: boolean;
    auto: boolean;
};

const safeGet = (key: string): string | null => {
    try { return window.localStorage.getItem(key); } catch { return null; }
};
const safeSet = (key: string, value: string): void => {
    try { window.localStorage.setItem(key, value); } catch { /* 隐私模式 */ }
};
const safeRemove = (key: string): void => {
    try { window.localStorage.removeItem(key); } catch { /* noop */ }
};

let fps = 0;
let minFps = 999;
let longTasks = 0;
let reason = '未采样';
let frameCount = 0;
let windowStart = 0;
let rafId = 0;
let longTaskObserver: PerformanceObserver | null = null;
let installed = false;

const nav = (): { cores: number; memory: number; dpr: number } => {
    const n = navigator as Navigator & { hardwareConcurrency?: number; deviceMemory?: number };
    return {
        cores: n.hardwareConcurrency ?? 4,
        memory: n.deviceMemory ?? 4,
        dpr: window.devicePixelRatio || 1,
    };
};

/** 按设备能力给出建议档位；返回可直接展示的中文原因。 */
export const detectDeviceTier = (): { power: 'eco' | 'balanced' | 'vivid'; reason: string } => {
    const { cores, memory, dpr } = nav();
    let reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* 老 WebView */ }
    if (reduced) return { power: 'eco', reason: '系统已开启「减少动态效果」' };
    if (cores <= 4 || memory <= 3) {
        return { power: 'eco', reason: `${cores} 核 / ${memory}GB，低端机自动省电` };
    }
    if (cores <= 6 || memory <= 4 || dpr >= 3) {
        return { power: 'balanced', reason: `${cores} 核 / ${memory}GB / DPR ${dpr}，均衡档更稳` };
    }
    return { power: 'vivid', reason: `${cores} 核 / ${memory}GB，设备性能充足` };
};

/** 自动档：只在用户从未手动选过性能档时生效，绝不覆盖既有选择。 */
export const detectAutoPower = (): void => {
    if (safeGet(K.auto) !== '1') return;
    if (safeGet(K.power) !== null) return; // 用户手动选过，尊重用户
    const tier = detectDeviceTier();
    reason = tier.reason;
    const root = document.documentElement;
    root.setAttribute('data-folia-power', tier.power);
    root.setAttribute('data-folia-perf-auto', tier.power);
    const rate = tier.power === 'eco' ? '30' : tier.power === 'balanced' ? '60' : 'off';
    safeSet(VISUALIZER_FRAME_RATE_STORAGE_KEY, rate);
    try { setGlobalVisualizerFrameRate(tier.power === 'eco' ? 30 : tier.power === 'balanced' ? 60 : 'off'); } catch { /* noop */ }
};

/** 一键极速：关掉所有背景层 / 模糊 / 阴影 / 长动画，锁 30fps。歌词与音频不受影响。 */
export const setTurbo = (on: boolean): boolean => {
    const root = document.documentElement;
    root.setAttribute('data-folia-turbo', on ? 'true' : 'off');
    safeSet(K.turbo, on ? '1' : '0');
    if (on) {
        safeSet(VISUALIZER_FRAME_RATE_STORAGE_KEY, '30');
        try { setGlobalVisualizerFrameRate(30); } catch { /* noop */ }
    }
    // 通知 v4 的背景层同步逻辑重跑一次（它会读 data-folia-turbo 并停掉 canvas）
    window.dispatchEvent(new CustomEvent('folia:perf-changed', { detail: { turbo: on } }));
    return on;
};

export const readTurbo = (): boolean => safeGet(K.turbo) === '1';
export const readAuto = (): boolean => safeGet(K.auto) === '1';
export const readSkipSplash = (): boolean => safeGet(K.skipSplash) === '1';

export const setAuto = (on: boolean): void => {
    safeSet(K.auto, on ? '1' : '0');
    reason = on ? '自动档已开启，下次启动按设备判定' : detectDeviceTier().reason;
};

export const setSkipSplash = (on: boolean): void => {
    safeSet(K.skipSplash, on ? '1' : '0');
};

/** 恢复性能相关默认值（不动主题、包名、备份等用户数据）。 */
export const resetPerf = (): void => {
    safeRemove(K.turbo);
    safeRemove(K.auto);
    safeRemove(K.power);
    safeRemove(VISUALIZER_FRAME_RATE_STORAGE_KEY);
    document.documentElement.removeAttribute('data-folia-turbo');
    document.documentElement.removeAttribute('data-folia-perf-auto');
};

export const readPerfStats = (): PerfStats => ({
    fps: Math.round(fps),
    minFps: minFps === 999 ? 0 : Math.round(minFps),
    longTasks,
    reason,
    turbo: readTurbo(),
    auto: readAuto(),
});

const tick = (ts: number): void => {
    if (document.hidden) {           // 后台完全停表，避免回到前台出现假低帧
        frameCount = 0;
        windowStart = ts;
        rafId = window.requestAnimationFrame(tick);
        return;
    }
    frameCount += 1;
    if (!windowStart) windowStart = ts;
    const span = ts - windowStart;
    if (span >= 1000) {
        const current = (frameCount * 1000) / span;
        fps = Math.min(240, current);
        if (current < minFps) minFps = current;
        frameCount = 0;
        windowStart = ts;
    }
    rafId = window.requestAnimationFrame(tick);
};

/** 只安装一次；重复调用安全。 */
export const installPerfBoost = (): void => {
    if (installed || typeof window === 'undefined') return;
    installed = true;

    const root = document.documentElement;
    root.setAttribute('data-folia-turbo', readTurbo() ? 'true' : 'off');
    if (readAuto() && !readTurbo()) detectAutoPower();
    else reason = detectDeviceTier().reason;

    // FPS 采样：单条 rAF 链，每秒结算一次，不建 DOM、不写存储。
    rafId = window.requestAnimationFrame(tick);

    // 长任务采样：拿不到 PerformanceObserver 的老 WebView 静默跳过。
    try {
        const PO = (window as unknown as { PerformanceObserver?: typeof PerformanceObserver }).PerformanceObserver;
        if (PO && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
            longTaskObserver = new PO((list) => { longTasks += list.getEntries().length; });
            longTaskObserver.observe({ entryTypes: ['longtask'] });
        }
    } catch { /* noop */ }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { frameCount = 0; windowStart = 0; }
    }, { passive: true });

    // 供诊断面板 / 外部读取
    (window as unknown as { __foliaPerf?: () => PerfStats }).__foliaPerf = readPerfStats;
};
