// src/services/foliaCustomEnhancements.ts
// Folia 定制版 v4 · 纯运行时增强（不改任何 React 组件）
//
// 主题：7 套（含动态特效「液态玻璃」）/ 强调色色相 / 液态动效强度 /
//       启动动画双样式（液态玻璃 · 3D 晶体）/ 主题自动轮换 / 主题分享码 /
//       听歌计时提醒 / 悬浮球长按切主题。
// 全部 DOM 由 createElement 生成，样式门控在 html[data-folia-custom='true'] 下。

import {
    setGlobalVisualizerFrameRate,
    VISUALIZER_FRAME_RATE_STORAGE_KEY,
} from '../utils/frameRateLimiter';
// v5：流畅度专项（自动档 / FPS 采样 / 一键极速），独立模块
import {
    installPerfBoost, readPerfStats, setTurbo, readTurbo, setAuto, readAuto,
    setSkipSplash, readSkipSplash, resetPerf, detectDeviceTier,
} from './foliaPerfBoost';

type PowerMode = 'eco' | 'balanced' | 'vivid';
type ThemeName = 'aurora' | 'midnight' | 'ember' | 'glass' | 'sakura' | 'neon' | 'ink';
type ScaleName = '90' | '100' | '110' | '120';
type FrameRate = 'off' | 30 | 60;
type LiquidLevel = 'high' | 'low' | 'off';
type SplashStyle = 'liquid' | 'crystal';
type RotateMode = 'off' | 'random' | 'time';
type HueValue = 'auto' | number;

const K = {
    power: 'folia_custom_power',
    theme: 'folia_custom_theme',
    scale: 'folia_custom_scale',
    immersive: 'folia_custom_immersive',
    ambient: 'folia_custom_ambient',
    emptyCard: 'folia_custom_emptycard',
    liquid: 'folia_custom_liquid',
    hue: 'folia_custom_hue',
    rotate: 'folia_custom_rotate',
    splashStyle: 'folia_custom_splash_style',
    timerEnd: 'folia_custom_timer_end',
    fabPos: 'folia_custom_fab_pos',
    fabHidden: 'folia_custom_fab_hidden',
    seeded: 'folia_custom_seeded',
    lazyList: 'folia_custom_lazy_list',
};

const POWER: Record<PowerMode, { label: string; hint: string; rate: FrameRate }> = {
    eco: { label: '省电', hint: '30 FPS · 关模糊与阴影', rate: 30 },
    balanced: { label: '均衡', hint: '60 FPS · 日常推荐', rate: 60 },
    vivid: { label: '绚丽', hint: '不限帧 · 完整歌词动效', rate: 'off' },
};
const THEME: Record<ThemeName, string> = {
    aurora: '极光紫', midnight: '午夜蓝', ember: '暮光橙',
    glass: '液态玻璃', sakura: '樱雾粉', neon: '赛博霓虹', ink: '墨韵',
};
const LIQUID: Record<LiquidLevel, string> = { high: '强', low: '轻', off: '关' };
const SPLASH: Record<SplashStyle, string> = { liquid: '液态玻璃', crystal: '3D 晶体' };
const ROTATE: Record<RotateMode, string> = { off: '关闭', random: '每次启动随机', time: '按时段自动' };
const MODES: PowerMode[] = ['eco', 'balanced', 'vivid'];
const THEMES: ThemeName[] = ['glass', 'aurora', 'midnight', 'ember', 'sakura', 'neon', 'ink'];
const LIQUIDS: LiquidLevel[] = ['high', 'low', 'off'];
const SPLASHES: SplashStyle[] = ['liquid', 'crystal'];
const ROTATES: RotateMode[] = ['off', 'random', 'time'];
const SCALES: ScaleName[] = ['90', '100', '110', '120'];
const TIMERS = [0, 15, 30, 45, 60, 90]; // 分钟，0 = 关闭

const BACKUP_SKIP = ['folia_cover_', 'folia_blob_', '__debug', 'folia_custom_fab_pos'];
const BACKUP_MAX_VALUE = 512 * 1024;
const BACKUP_MAX_TOTAL = 4 * 1024 * 1024;

const get = (key: string): string | null => {
    try { return window.localStorage.getItem(key); } catch { return null; }
};
const set = (key: string, value: string): void => {
    try { window.localStorage.setItem(key, value); } catch { /* 隐私模式 */ }
};
const rm = (key: string): void => {
    try { window.localStorage.removeItem(key); } catch { /* noop */ }
};

const oneOf = <T extends string>(value: string | null, options: readonly T[], fallback: T): T =>
    (value && options.includes(value as T) ? value as T : fallback);

const readPower = (): PowerMode => oneOf(get(K.power), MODES, 'balanced');
const readTheme = (): ThemeName => oneOf(get(K.theme), THEMES, 'glass');
const readScale = (): ScaleName => oneOf(get(K.scale), SCALES, '100');
const readLiquid = (): LiquidLevel => oneOf(get(K.liquid), LIQUIDS, 'high');
const readSplash = (): SplashStyle => oneOf(get(K.splashStyle), SPLASHES, 'liquid');
const readRotate = (): RotateMode => oneOf(get(K.rotate), ROTATES, 'off');

const readHue = (): HueValue => {
    const raw = get(K.hue);
    if (!raw || raw === 'auto') return 'auto';
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 330 ? n : 'auto';
};

// ------------------------------------------------------------------ 各项应用
const applyPower = (mode: PowerMode, persist = true): void => {
    document.documentElement.setAttribute('data-folia-power', mode);
    const rate = POWER[mode].rate;
    set(VISUALIZER_FRAME_RATE_STORAGE_KEY, rate === 'off' ? 'off' : String(rate));
    try { setGlobalVisualizerFrameRate(rate); } catch { /* 旧版本兜底 */ }
    if (persist) set(K.power, mode);
    syncAmbient();
    syncLiquid();
};

const applyTheme = (theme: ThemeName, persist = true): void => {
    document.documentElement.setAttribute('data-folia-theme', theme);
    if (persist) set(K.theme, theme);
};

const applyScale = (scale: ScaleName, persist = true): void => {
    document.documentElement.setAttribute('data-folia-scale', scale);
    if (persist) set(K.scale, scale);
};

const applyHue = (hue: HueValue, persist = true): void => {
    const root = document.documentElement;
    if (hue === 'auto') {
        root.removeAttribute('data-folia-hue');
        if (persist) rm(K.hue);
        return;
    }
    root.setAttribute('data-folia-hue', String(hue));
    root.style.setProperty('--folia-hue', String(hue));
    if (persist) set(K.hue, String(hue));
};

const applyLiquid = (level: LiquidLevel, persist = true): void => {
    document.documentElement.setAttribute('data-folia-liquid', level);
    if (persist) set(K.liquid, level);
    syncLiquid();
};

const applySplashStyle = (style: SplashStyle, persist = true): void => {
    document.documentElement.setAttribute('data-folia-splash', style);
    if (persist) set(K.splashStyle, style);
};

const applyToggle = (key: string, attr: string, persist = true): boolean => {
    const next = !(get(key) === '1');
    document.documentElement.setAttribute(attr, next ? 'true' : 'off');
    if (persist) set(key, next ? '1' : '0');
    return next;
};

const seedDefaults = (): void => {
    if (get(K.seeded) === '1') return;
    if (get(VISUALIZER_FRAME_RATE_STORAGE_KEY) === null) set(VISUALIZER_FRAME_RATE_STORAGE_KEY, '60');
    if (get('folia_android_keep_screen_on') === null) set('folia_android_keep_screen_on', 'false');
    if (get('folia_android_phone_fit') === null) {
        set('folia_android_phone_fit', 'true');
        // 上游 installAndroidPhoneFitPreference 已先跑过（当时读到 null），补一次让本次启动就生效。
        document.documentElement.setAttribute('data-folia-phone-fit', 'true');
    }
    // v4 默认就是液态玻璃，装好第一眼就能看到动态特效。
    if (get(K.theme) === null) set(K.theme, 'glass');
    if (get(K.liquid) === null) set(K.liquid, 'high');
    if (get(K.splashStyle) === null) set(K.splashStyle, 'liquid');
    set(K.seeded, '1');
};

const applyRotation = (): void => {
    const mode = readRotate();
    if (mode === 'random') {
        applyTheme(THEMES[Math.floor(Math.random() * THEMES.length)], false);
        return;
    }
    if (mode === 'time') {
        const h = new Date().getHours();
        applyTheme(h >= 6 && h < 18 ? 'midnight' : h >= 18 && h < 22 ? 'ember' : 'aurora', false);
    }
};

// ------------------------------------------------------------------ 液态光斑背景层
let liquidLayer: HTMLDivElement | null = null;

const syncLiquid = (): void => {
    const root = document.documentElement;
    const level = get(K.liquid) ?? 'high';
    root.setAttribute('data-folia-liquid', level);
    const on = level !== 'off'
        && root.getAttribute('data-folia-power') !== 'eco'
        && root.getAttribute('data-folia-turbo') !== 'true'
        && !!document.body;
    if (on && !liquidLayer) {
        const layer = document.createElement('div');
        layer.className = 'folia-c-liquid';
        layer.setAttribute('aria-hidden', 'true');
        layer.innerHTML = '<i></i><i></i><i></i><i></i><b></b>';
        document.body.insertBefore(layer, document.body.firstChild);
        liquidLayer = layer;
    } else if (!on && liquidLayer) {
        liquidLayer.remove();
        liquidLayer = null;
    }
};

// ------------------------------------------------------------------ 3D 环境光效（v3 保留）
let ambientCanvas: HTMLCanvasElement | null = null;
let ambientRaf = 0;

const stopAmbient = (): void => {
    if (ambientRaf) window.cancelAnimationFrame(ambientRaf);
    ambientRaf = 0;
    ambientCanvas?.remove();
    ambientCanvas = null;
};

const startAmbient = (): void => {
    if (ambientCanvas || !document.body) return;
    const c = document.createElement('canvas');
    c.className = 'folia-c-ambient';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    ambientCanvas = c;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = (): void => {
        w = window.innerWidth; h = window.innerHeight;
        c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    // 不挂全局 resize 监听：在帧里检测尺寸变化，反复开关不会累积监听器。
    const draw = (ms: number): void => {
        if (window.innerWidth !== w || window.innerHeight !== h) resize();
        ctx.clearRect(0, 0, w, h);
        const t = ms / 1000;
        const cx = w * 0.5, cy = h * 0.42, r = Math.min(w, h) * 0.16;
        const ang = t * 0.22;
        const pts: [number, number][] = [];
        for (let i = 0; i < 8; i++) {
            const a = ang + i * Math.PI / 2;
            const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.44;
            const z = Math.sin(a + Math.PI / 4) * r * 0.5;
            pts.push([cx + x - z * 0.3, cy + y + (i < 4 ? -r * 0.55 : r * 0.55)]);
        }
        ctx.strokeStyle = 'rgba(180, 160, 255, .55)';
        ctx.lineWidth = 1;
        const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
        for (const [a, b] of edges) {
            ctx.beginPath(); ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); ctx.stroke();
        }
        for (let i = 0; i < 22; i++) {
            const a = i * 2.399 + t * 0.08, rr = r * (1.2 + (i % 5) * 0.28);
            ctx.beginPath();
            ctx.fillStyle = 'rgba(200,190,255,' + (0.10 + 0.10 * Math.sin(t + i)).toFixed(3) + ')';
            ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.5, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ambientRaf = window.requestAnimationFrame(draw);
    };
    ambientRaf = window.requestAnimationFrame(draw);
};

const syncAmbient = (): void => {
    const root = document.documentElement;
    const on = get(K.ambient) === '1'
        && root.getAttribute('data-folia-power') !== 'eco'
        && root.getAttribute('data-folia-turbo') !== 'true';
    root.setAttribute('data-folia-ambient', on ? 'true' : 'off');
    if (on) startAmbient(); else stopAmbient();
};

// ------------------------------------------------------------------ 空状态卡片化
const EMPTY_HEAD = '还没有连接在线平台';
const EMPTY_BODY_HINTS = ['歌单', '本地', '电台'];
// v5：常驻 MutationObserver 在长列表滚动时会频繁回调，改成「命中即停」的轻量轮询。
// 每 3 秒扫一次，找到空状态后停表；路由切换由 popstate / 点击标签栏重新唤醒。
let emptyTimer = 0;
let emptyPoll = 0;
let emptyFound = false;

const markEmptyStates = (): boolean => {
    const rootNode = document.getElementById('root');
    if (!rootNode || document.documentElement.getAttribute('data-folia-emptycard') === 'off') return false;
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    const found = new Set<Element>();
    while ((node = walker.nextNode())) {
        const text = node.textContent?.trim() ?? '';
        if (!text.includes(EMPTY_HEAD) || text.length > 120) continue;
        let el = node.parentElement;
        for (let depth = 0; depth < 5 && el; depth += 1) {
            const own = (el.textContent ?? '').trim();
            if (own.length > 45 && own.length < 420 && EMPTY_BODY_HINTS.some((h) => own.includes(h))) {
                found.add(el); break;
            }
            if (el === rootNode) break;
            el = el.parentElement;
        }
        if (found.size >= 2) break;
    }
    found.forEach((el) => el.setAttribute('data-folia-empty-state', 'true'));
    return found.size > 0;
};

const stopEmptyPolling = (): void => {
    if (emptyPoll) window.clearInterval(emptyPoll);
    emptyPoll = 0;
};

const startEmptyPolling = (): void => {
    if (emptyPoll || emptyFound) return;
    markEmptyStates();
    emptyPoll = window.setInterval(() => {
        if (markEmptyStates()) {
            emptyFound = true;
            stopEmptyPolling();
        }
    }, 3000);
    // 10 秒还没命中就停表，不做无谓的常驻扫描。
    window.setTimeout(stopEmptyPolling, 10000);
};

const watchEmptyStates = (): void => {
    startEmptyPolling();
    // SPA 路由变化后可能再次出现空状态，重新唤醒轮询（passive，不拦截事件）。
    window.addEventListener('popstate', () => { emptyFound = false; startEmptyPolling(); }, { passive: true });
    document.addEventListener('click', (e) => {
        const t = e.target as Element | null;
        if (t?.closest?.('[role="tab"]')) { emptyFound = false; startEmptyPolling(); }
    }, { passive: true });
};

const setEmptyCard = (on: boolean): void => {
    document.documentElement.setAttribute('data-folia-emptycard', on ? 'on' : 'off');
    set(K.emptyCard, on ? '1' : '0');
    if (on) { emptyFound = false; startEmptyPolling(); }
    else {
        stopEmptyPolling();
        emptyFound = false;
        document.querySelectorAll('[data-folia-empty-state]').forEach((el) =>
            el.removeAttribute('data-folia-empty-state'));
    }
};

// ------------------------------------------------------------------ 启动动画重播（双样式）
const splashMarkup = (style: SplashStyle): string => {
    const brand = (sub: string, status: string): string =>
        '<div class="fs-brand"><div class="fs-title">Folia <span>定制版</span></div>' +
        '<div class="fs-sub">' + sub + '</div></div>' +
        '<div class="fs-progress"><i></i></div>' +
        '<div class="fs-status">' + status + '</div>' +
        '<div class="fs-version">v0.7.29-custom.4 · 预览 3 秒</div>';
    if (style === 'crystal') {
        return '<div class="fs-crystal" style="display:flex">' +
            '<div class="fs-stage"><div class="fs-ring fs-ring--a"></div>' +
            '<div class="fs-ring fs-ring--b"></div><div class="fs-ring fs-ring--c"></div>' +
            '<div class="fs-cube"><div class="fs-face fs-face--front"><div class="fs-glyph">&#10022;</div></div>' +
            '<div class="fs-face fs-face--back"></div><div class="fs-face fs-face--right"></div>' +
            '<div class="fs-face fs-face--left"></div><div class="fs-face fs-face--top"></div>' +
            '<div class="fs-face fs-face--bottom"></div></div><div class="fs-core"></div></div>' +
            brand('LYRICS REIMAGINED &#183; 3D', '3D 晶体启动动画预览…') + '</div>';
    }
    return '<div class="fs-liquid" style="display:flex">' +
        '<div class="fs-glass-stage"><div class="fs-refract"></div><div class="fs-blob"></div>' +
        '<div class="fs-drop fs-drop--1"></div><div class="fs-drop fs-drop--2"></div>' +
        '<div class="fs-drop fs-drop--3"></div></div>' +
        brand('LIQUID GLASS &#183; LYRICS REIMAGINED', '液态玻璃启动动画预览…') + '</div>';
};

const replaySplash = (): void => {
    if (document.getElementById('app-splash')) return;
    const style = readSplash();
    const layer = document.createElement('div');
    layer.id = 'app-splash';
    layer.setAttribute('role', 'status');
    layer.innerHTML =
        '<div class="fs-aurora"><i></i><i></i><i></i></div>' +
        '<canvas id="folia-splash-stars"></canvas>' +
        '<div class="app-splash-inner" style="opacity:1">' + splashMarkup(style) + '</div>';
    document.body.appendChild(layer);

    // 内联粒子脚本只在首次加载跑一次，重播时补一段轻星尘。
    const stars = layer.querySelector('canvas') as HTMLCanvasElement | null;
    const sctx = stars?.getContext('2d') ?? null;
    if (stars && sctx) {
        const sw = window.innerWidth, sh = window.innerHeight;
        const sdpr = Math.min(window.devicePixelRatio || 1, 2);
        stars.width = Math.floor(sw * sdpr); stars.height = Math.floor(sh * sdpr);
        sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
        const pts = Array.from({ length: 40 }, () => ({
            x: Math.random() * sw, y: Math.random() * sh,
            r: Math.random() * 1.4 + 0.4, a: Math.random() * 0.5 + 0.15,
            vy: -(Math.random() * 0.2 + 0.05),
        }));
        let lastTick = 0;
        const tick = (ms: number): void => {
            window.requestAnimationFrame(tick);
            if (!document.body.contains(layer) || document.hidden) return;
            if (ms - lastTick < 33) return;   // v5：星尘锁 30fps，不必跟满屏刷新率
            lastTick = ms;
            sctx.clearRect(0, 0, sw, sh);
            pts.forEach((p) => {
                p.y += p.vy; if (p.y < -4) p.y = sh + 4;
                sctx.beginPath();
                sctx.fillStyle = 'rgba(214,202,255,' + p.a.toFixed(3) + ')';
                sctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); sctx.fill();
            });
        };
        window.requestAnimationFrame(tick);
    }
    window.setTimeout(() => {
        layer.classList.add('is-hiding');
        window.setTimeout(() => layer.remove(), 340);
    }, 3000);
};

// ------------------------------------------------------------------ 听歌计时提醒
const remainingMinutes = (): number => {
    const end = Number(get(K.timerEnd) ?? 0);
    if (!end || end <= Date.now()) return 0;
    return Math.max(1, Math.ceil((end - Date.now()) / 60000));
};

const armListenTimer = (): void => {
    const end = Number(get(K.timerEnd) ?? 0);
    if (!end || end <= Date.now()) { rm(K.timerEnd); return; }
    window.setTimeout(() => {
        // 到点只提示，不碰播放逻辑；刷新后若已过期也会在启动时清掉。
        if (Number(get(K.timerEnd) ?? 0) !== end) return;
        rm(K.timerEnd);
        toast('听歌计时结束啦，起来活动一下吧');
    }, Math.min(end - Date.now(), 2147483647));
};

const setListenTimer = (minutes: number): void => {
    if (!minutes) { rm(K.timerEnd); toast('听歌计时已关闭'); return; }
    const end = Date.now() + minutes * 60000;
    set(K.timerEnd, String(end));
    armListenTimer();
    toast(`听歌计时 ${minutes} 分钟，到点提醒你`);
};

// ------------------------------------------------------------------ 主题分享码
const sharePayload = (): Record<string, string> => ({
    t: readTheme(), h: String(readHue()), l: readLiquid(),
    a: readRotate(), p: readPower(), s: readSplash(), z: readScale(),
});

const encodeShare = (): string => {
    try {
        return btoa(JSON.stringify(sharePayload())).replace(/=+$/, '');
    } catch { return ''; }
};

const applyShare = (code: string): boolean => {
    try {
        const parsed = JSON.parse(atob(code.trim())) as Record<string, string>;
        const t = parsed.t as ThemeName, l = parsed.l as LiquidLevel;
        const a = parsed.a as RotateMode, p = parsed.p as PowerMode;
        const s = parsed.s as SplashStyle, z = parsed.z as ScaleName;
        if (!THEMES.includes(t) || !LIQUIDS.includes(l) || !ROTATES.includes(a)
            || !MODES.includes(p) || !SPLASHES.includes(s) || !SCALES.includes(z)) return false;
        applyTheme(t); applyLiquid(l); applyPower(p); applyScale(z); applySplashStyle(s);
        set(K.rotate, a);
        const hue = parsed.h === 'auto' ? 'auto' : Number(parsed.h);
        applyHue(hue === 'auto' || !Number.isFinite(hue) ? 'auto' : hue);
        return true;
    } catch { return false; }
};

const copyShare = (): void => {
    const code = encodeShare();
    if (!code) { window.alert('生成主题码失败'); return; }
    const done = (): void => toast('主题码已复制，发给朋友即可导入');
    if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(code).then(done).catch(() => window.prompt('复制主题码：', code));
    } else {
        window.prompt('复制主题码：', code);
    }
};

const importShare = (): void => {
    const code = window.prompt('粘贴主题码（由本应用「复制主题码」生成）：');
    if (!code) return;
    if (applyShare(code)) toast('主题方案已导入');
    else window.alert('主题码无法识别，请检查是否完整复制。');
};

// ------------------------------------------------------------------ 备份 / 恢复 / 诊断
const collectBackup = (): Record<string, string> => {
    const data: Record<string, string> = {};
    let total = 0;
    try {
        for (let i = 0; i < window.localStorage.length; i += 1) {
            const key = window.localStorage.key(i);
            if (!key || BACKUP_SKIP.some((p) => key.startsWith(p))) continue;
            const value = window.localStorage.getItem(key);
            if (value === null || value.length > BACKUP_MAX_VALUE) continue;
            if (total + value.length > BACKUP_MAX_TOTAL) break;
            data[key] = value; total += value.length;
        }
    } catch { /* noop */ }
    return data;
};

const stamp = (): string => {
    const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
};

const isNative = (): boolean => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return cap?.isNativePlatform?.() === true;
};

const saveNative = async (name: string, text: string): Promise<boolean> => {
    if (!isNative()) return false;
    try {
        const mod = await import('@capacitor/filesystem');
        await mod.Filesystem.writeFile({
            path: name, data: text,
            directory: mod.Directory.Documents, encoding: mod.Encoding.UTF8,
        });
        return true;
    } catch { return false; }
};

const downloadBlob = (name: string, text: string): void => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
};

const exportBackup = (): void => {
    const payload = {
        app: 'Folia 定制版', version: '0.7.29-custom.4',
        package: 'top.folia.custom', exportedAt: new Date().toISOString(),
        settings: collectBackup(),
    };
    const text = JSON.stringify(payload, null, 2);
    const name = 'Folia定制版-设置备份-' + stamp() + '.json';
    const count = Object.keys(payload.settings).length;
    void saveNative(name, text).then((saved) => {
        if (!saved) downloadBlob(name, text);
        toast(saved ? '已保存 ' + count + ' 项到 Documents/' + name : '已导出 ' + count + ' 项设置');
    });
};

const importBackup = (): void => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
        const file = input.files?.[0]; input.remove();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result)) as { settings?: Record<string, string> };
                const entries = Object.entries(parsed?.settings ?? {}).filter(
                    ([k, v]) => typeof k === 'string' && typeof v === 'string');
                if (!entries.length) throw new Error('empty');
                if (!window.confirm('将恢复 ' + entries.length + ' 项设置并重新载入应用，继续？')) return;
                entries.forEach(([k, v]) => set(k, v));
                toast('已恢复 ' + entries.length + ' 项，正在重载…');
                window.setTimeout(() => window.location.reload(), 700);
            } catch { window.alert('备份文件无法读取，请选择本应用导出的 JSON 文件。'); }
        };
        reader.readAsText(file, 'utf-8');
    }, { once: true });
    document.body.appendChild(input); input.click();
};

const copyDiagnostics = (): void => {
    const perf = readPerfStats();
    const info = [
        'Folia 定制版 0.7.29-custom.4 (534)',
        '包名: top.folia.custom',
        '主题: ' + THEME[readTheme()] + ' / 强调色: ' + String(readHue()),
        '液态动效: ' + LIQUID[readLiquid()] + ' / 启动动画: ' + SPLASH[readSplash()],
        '轮换: ' + ROTATE[readRotate()] + ' / 性能: ' + POWER[readPower()].label,
        '字号: ' + readScale() + '% / 帧率: ' + (get(VISUALIZER_FRAME_RATE_STORAGE_KEY) ?? 'off'),
        '性能: FPS ' + perf.fps + ' / 最低 ' + perf.minFps + ' / 长任务 ' + perf.longTasks,
        '档位判定: ' + perf.reason + ' / 极速: ' + (perf.turbo ? '开' : '关'),
        '平台: ' + (isNative() ? 'Android (Capacitor)' : 'Web'),
        'UA: ' + navigator.userAgent,
    ].join('\n');
    const done = (): void => toast('诊断信息已复制');
    if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(info).then(done).catch(() => window.alert(info));
    } else {
        const ta = document.createElement('textarea');
        ta.value = info; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch { window.alert(info); }
        ta.remove();
    }
};

// ------------------------------------------------------------------ UI 构建
const el = <K2 extends keyof HTMLElementTagNameMap>(tag: K2, cls?: string, text?: string): HTMLElementTagNameMap[K2] => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
};

let lastToast: { text: string; at: number; node: HTMLElement | null } = { text: '', at: 0, node: null };
const toast = (message: string): void => {
    const now = Date.now();
    // 连续相同提示复用同一个节点，避免连点时叠出好几个 toast 触发重排。
    if (lastToast.text === message && now - lastToast.at < 1500 && lastToast.node?.isConnected) {
        lastToast.at = now;
        return;
    }
    const n = el('div', 'folia-c-toast', message);
    document.body.appendChild(n);
    lastToast = { text: message, at: now, node: n };
    // 只保留一条常驻计时器，节点移除由这一次回调完成。
    window.setTimeout(() => {
        n.remove();
        if (lastToast.node === n) lastToast.node = null;
    }, 2200);
};

type Refs = { fab: HTMLButtonElement; menu: HTMLDivElement };

const item = (label: string, hint: string, checked: boolean, onClick: () => void): HTMLButtonElement => {
    const b = el('button', 'folia-c-menu__item') as HTMLButtonElement;
    b.type = 'button';
    b.setAttribute('aria-checked', String(checked));
    const left = el('span');
    left.appendChild(el('span', undefined, label));
    if (hint) left.appendChild(el('span', 'folia-c-menu__hint', hint));
    b.appendChild(left);
    if (checked) b.appendChild(el('span', 'folia-c-badge', '当前'));
    b.addEventListener('click', onClick);
    return b;
};

const cycleItem = (label: string, hint: string, onClick: () => void): HTMLButtonElement => {
    const b = el('button', 'folia-c-menu__item') as HTMLButtonElement;
    b.type = 'button';
    b.setAttribute('aria-checked', 'false');
    const left = el('span');
    left.appendChild(el('span', undefined, label));
    left.appendChild(el('span', 'folia-c-menu__hint', hint));
    b.appendChild(left);
    b.addEventListener('click', onClick);
    return b;
};

const group = (menu: HTMLElement, label: string): void => {
    menu.appendChild(el('div', 'folia-c-menu__group', label));
};

const renderMenu = (refs: Refs, onHide: () => void): void => {
    const { menu } = refs;
    menu.replaceChildren();
    const title = el('div', 'folia-c-menu__title');
    title.appendChild(el('span', undefined, 'Folia 定制版 · 快捷设置'));
    title.appendChild(el('span', 'folia-c-badge', 'v4'));
    menu.appendChild(title);
    const rerender = (): void => renderMenu(refs, onHide);

    group(menu, '主题（7 套）');
    THEMES.forEach((name) => menu.appendChild(item(
        THEME[name], name === 'glass' ? '动态特效 · 亚克力光斑与流动光泽' : '',
        readTheme() === name,
        () => { applyTheme(name); rerender(); toast('主题：' + THEME[name] + (name === 'glass' ? '（液态玻璃）' : '')); },
    )));

    group(menu, '强调色色相');
    const hue = readHue();
    menu.appendChild(cycleItem('循环切换色相', '当前 ' + (hue === 'auto' ? '跟随主题' : hue + '°') + ' · 自动→0°→330°', () => {
        const next: HueValue = hue === 'auto' ? 0 : hue >= 330 ? 'auto' : hue + 30;
        applyHue(next); rerender();
        toast(next === 'auto' ? '强调色：跟随主题' : '强调色：' + next + '°');
    }));

    group(menu, '液态动效强度');
    LIQUIDS.forEach((level) => menu.appendChild(item(
        LIQUID[level], level === 'high' ? '光斑漂移 + 光泽扫过 + 噪点材质' : level === 'low' ? '更慢更淡，省一点电' : '静态玻璃，无动画',
        readLiquid() === level,
        () => { applyLiquid(level); rerender(); toast('液态动效：' + LIQUID[level]); },
    )));

    group(menu, '启动动画');
    SPLASHES.forEach((style) => menu.appendChild(item(
        SPLASH[style], style === 'liquid' ? '融化玻璃球 + 液滴 + 流光' : '旋转立方体 + 三道光环',
        readSplash() === style,
        () => { applySplashStyle(style); rerender(); toast('下次启动：' + SPLASH[style]); },
    )));

    group(menu, '主题自动轮换');
    ROTATES.forEach((mode) => menu.appendChild(item(
        ROTATE[mode], mode === 'time' ? '日间午夜蓝 / 傍晚暮光橙 / 夜间极光紫' : '',
        readRotate() === mode,
        () => { set(K.rotate, mode); applyRotation(); rerender(); toast('轮换：' + ROTATE[mode]); },
    )));

    // ---- v5 流畅度 ----
    group(menu, '流畅度与性能');
    const perf = readPerfStats();
    menu.appendChild(cycleItem('实时帧率 ' + (perf.fps || '…') + ' FPS',
        '最低 ' + (perf.minFps || '…') + ' · 长任务 ' + perf.longTasks + ' · ' + perf.reason,
        () => { rerender(); toast(readPerfStats().fps + ' FPS · 长按不需要，点按刷新'); }));
    menu.appendChild(item('一键极速', '关光斑/模糊/阴影 + 30fps，歌词与音频不变',
        readTurbo(), () => {
            const on = setTurbo(!readTurbo());
            syncLiquid(); syncAmbient(); rerender();
            toast(on ? '极速模式已开启' : '极速模式已关闭');
        }));
    menu.appendChild(item('自动性能档', '下次启动按 CPU / 内存 / DPR 判定',
        readAuto(), () => {
            setAuto(!readAuto()); rerender();
            toast(readAuto() ? '自动档已开启：' + detectDeviceTier().reason : '自动档已关闭');
        }));
    menu.appendChild(item('跳过启动动画', '冷启动直接进主界面',
        readSkipSplash(), () => {
            setSkipSplash(!readSkipSplash()); rerender();
            toast(readSkipSplash() ? '已跳过启动动画（下次生效）' : '启动动画已恢复');
        }));
    menu.appendChild(item('列表懒绘制', '长歌单屏外不绘制，个别布局异常可关',
        get(K.lazyList) !== '0', () => {
            const on = get(K.lazyList) === '0';
            set(K.lazyList, on ? '1' : '0');
            document.documentElement.setAttribute('data-folia-lazy-list', on ? 'true' : 'off');
            rerender(); toast(on ? '列表懒绘制已开启' : '列表懒绘制已关闭');
        }));
    menu.appendChild(cycleItem('恢复性能默认', '清极速 / 自动档 / 帧率，重载生效', () => {
        resetPerf(); toast('性能设置已恢复，正在重载…');
        window.setTimeout(() => window.location.reload(), 700);
    }));

    group(menu, '性能模式（立即生效）');
    MODES.forEach((mode) => menu.appendChild(item(
        POWER[mode].label, POWER[mode].hint, readPower() === mode,
        () => { applyPower(mode); rerender(); toast('已切换为「' + POWER[mode].label + '」'); },
    )));

    group(menu, '界面');
    menu.appendChild(cycleItem('界面字号', '当前 ' + readScale() + '% · 点按循环 90→120%', () => {
        const next = SCALES[(SCALES.indexOf(readScale()) + 1) % SCALES.length];
        applyScale(next); rerender(); toast('界面字号 ' + next + '%');
    }));
    menu.appendChild(item('沉浸模式', '弱化工具栏与悬浮球，只留内容',
        get(K.immersive) === '1', () => {
            const on = applyToggle(K.immersive, 'data-folia-immersive');
            rerender(); toast(on ? '沉浸模式已开启' : '沉浸模式已关闭');
        }));
    menu.appendChild(item('3D 环境光效', '背景旋转线框与星尘，省电档自动关',
        get(K.ambient) === '1', () => {
            applyToggle(K.ambient, 'data-folia-ambient'); syncAmbient(); rerender();
            toast(get(K.ambient) === '1' ? '3D 环境光效已开启' : '3D 环境光效已关闭');
        }));
    menu.appendChild(item('空状态卡片', '把「还没有连接在线平台」变成引导卡片',
        document.documentElement.getAttribute('data-folia-emptycard') !== 'off', () => {
            const on = document.documentElement.getAttribute('data-folia-emptycard') === 'off';
            setEmptyCard(on); rerender(); toast(on ? '空状态卡片已开启' : '空状态卡片已关闭');
        }));

    group(menu, '听歌计时（到点提醒，不停止播放）');
    const left = remainingMinutes();
    menu.appendChild(cycleItem(left ? '剩余 ' + left + ' 分钟' : '未开启计时',
        '点按循环：关 → 15 → 30 → 45 → 60 → 90 分钟', () => {
            const idx = TIMERS.findIndex((m) => m === left);
            const next = TIMERS[(idx + 1 + TIMERS.length) % TIMERS.length];
            setListenTimer(next); rerender();
        }));

    group(menu, '工具');
    menu.appendChild(item('重播启动动画', '按当前样式预览 3 秒', false,
        () => { replaySplash(); menu.setAttribute('data-open', 'false'); }));
    menu.appendChild(item('复制主题码', '把当前主题方案发给朋友', false, () => copyShare()));
    menu.appendChild(item('导入主题码', '粘贴朋友分享的方案', false, () => { importShare(); rerender(); }));
    menu.appendChild(item('导出设置备份', 'JSON · Android 存到 Documents', false, () => exportBackup()));
    menu.appendChild(item('恢复设置备份', '选择此前导出的 JSON', false, () => importBackup()));
    menu.appendChild(item('复制诊断信息', '版本 / 包名 / 主题 / UA', false, () => copyDiagnostics()));

    group(menu, '关于');
    menu.appendChild(item('Folia 定制版 0.7.29-custom.4',
        'top.folia.custom · AGPL-3.0 · 仅供个人学习', false, () => {
            window.alert('Folia 定制版 0.7.29-custom.4 (534)\n包名：top.folia.custom\n\n'
                + '上游：chthollyphile/folia-major（AGPL-3.0）\n'
                + 'Android 移植：whycfawa/folia-android（AGPL-3.0）\n\n'
                + '仅供个人学习与非营利测试；在线音乐版权归各平台所有。');
        }));
    menu.appendChild(item('隐藏悬浮按钮', '单击开菜单 · 长按切主题 · 双击顶部唤回', false, () => {
        onHide(); toast('已隐藏；双击屏幕顶部可唤出');
    }));

    menu.appendChild(el('div', 'folia-c-menu__foot',
        '液态玻璃为纯 CSS + 2D canvas 动效，不用 WebGL；省电档会自动关闭动态光斑。所有改动均可一键回退。'));
};

const restoreFabPosition = (fab: HTMLElement): void => {
    // v5：位置存的是 translate 偏移量，而不是 left/top 绝对坐标。
    // 拖拽只改 transform（合成层），完全不触发布局与重排。
    const raw = get(K.fabPos);
    if (!raw) return;
    try {
        const pos = JSON.parse(raw) as { x?: number; y?: number };
        if (typeof pos.x === 'number' && typeof pos.y === 'number') {
            fab.style.transform = 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)';
        }
    } catch { rm(K.fabPos); }
};

const wireFab = (refs: Refs): void => {
    const { fab, menu } = refs;
    let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    let pressTimer = 0, longPressed = false;
    let finalX = 0, finalY = 0;

    const setHidden = (hidden: boolean): void => {
        document.documentElement.setAttribute('data-folia-fab', hidden ? 'hidden' : 'visible');
        set(K.fabHidden, hidden ? '1' : '0');
        if (hidden) menu.setAttribute('data-open', 'false');
    };

    const currentOffset = (): { x: number; y: number } => {
        const raw = get(K.fabPos);
        if (!raw) return { x: 0, y: 0 };
        try {
            const p = JSON.parse(raw) as { x?: number; y?: number };
            return { x: Number(p.x) || 0, y: Number(p.y) || 0 };
        } catch { return { x: 0, y: 0 }; }
    };

    setHidden(get(K.fabHidden) === '1');
    restoreFabPosition(fab);
    renderMenu(refs, () => setHidden(true));

    fab.addEventListener('pointerdown', (e: PointerEvent) => {
        dragging = true; moved = false; longPressed = false;
        sx = e.clientX; sy = e.clientY;
        const off = currentOffset(); ox = off.x; oy = off.y;
        try { fab.setPointerCapture(e.pointerId); } catch { /* noop */ }
        window.clearTimeout(pressTimer);
        pressTimer = window.setTimeout(() => {
            longPressed = true;
            const next = THEMES[(THEMES.indexOf(readTheme()) + 1) % THEMES.length];
            applyTheme(next);
            renderMenu(refs, () => setHidden(true));
            toast('长按切主题：' + THEME[next]);
        }, 600);
    }, { passive: true });

    fab.addEventListener('pointermove', (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 6) {
            moved = true;
            window.clearTimeout(pressTimer);
        }
        if (!moved) return;
        // 只改 transform：GPU 合成，不触发 layout / paint
        const maxX = window.innerWidth - 60, maxY = window.innerHeight - 60;
        const x = Math.min(Math.max(-maxX, ox + dx), maxX);
        const y = Math.min(Math.max(-maxY, oy + dy), maxY);
        finalX = x; finalY = y;
        fab.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    }, { passive: true });

    const endPress = (e: PointerEvent): void => {
        if (!dragging) return;
        dragging = false;
        window.clearTimeout(pressTimer);
        try { fab.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        if (longPressed) { longPressed = false; return; }
        if (moved) {
            // 直接用 pointermove 里算好的值，不再解析 transform 字符串
            set(K.fabPos, JSON.stringify({ x: finalX, y: finalY }));
            return;
        }
        menu.setAttribute('data-open', menu.getAttribute('data-open') === 'true' ? 'false' : 'true');
    };
    fab.addEventListener('pointerup', endPress, { passive: true });
    fab.addEventListener('pointercancel', () => {
        dragging = false; window.clearTimeout(pressTimer); longPressed = false;
    }, { passive: true });

    document.addEventListener('dblclick', (e: MouseEvent) => {
        if (e.clientY <= 90 && get(K.fabHidden) === '1') {
            setHidden(false); toast('悬浮按钮已恢复');
        }
    }, { passive: true });
    document.addEventListener('pointerdown', (e: PointerEvent) => {
        if (menu.getAttribute('data-open') !== 'true') return;
        const target = e.target as Node | null;
        if (target && !menu.contains(target) && !fab.contains(target)) {
            menu.setAttribute('data-open', 'false');
        }
    }, { passive: true });
    window.addEventListener('resize', () => {
        // transform 是相对偏移，无需按视口 clamp；仅收起菜单避免错位
        if (menu.getAttribute('data-open') === 'true') menu.setAttribute('data-open', 'false');
    }, { passive: true });
    // 极速 / 性能档切换时，让背景层同步一次
    window.addEventListener('folia:perf-changed', () => {
        syncLiquid(); syncAmbient();
    }, { passive: true } as EventListenerOptions);
};

/** index.tsx 调用；重复调用安全（幂等）。 */
export const installFoliaCustomEnhancements = (): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const root = document.documentElement;
    if (root.getAttribute('data-folia-custom') === 'true') return;

    root.setAttribute('data-folia-custom', 'true');
    seedDefaults();
    // v5：先装流畅度模块（自动档 / FPS 采样 / 极速状态），再套主题与背景层，
    // 这样 syncLiquid / syncAmbient 第一次就能读到 data-folia-turbo。
    installPerfBoost();
    root.setAttribute('data-folia-lazy-list', get(K.lazyList) === '0' ? 'off' : 'true');
    applyTheme(readTheme(), false);
    applyRotation();
    applyHue(readHue(), false);
    applyLiquid(readLiquid(), false);
    applyPower(readPower(), false);
    applyScale(readScale(), false);
    applySplashStyle(readSplash(), false);
    root.setAttribute('data-folia-immersive', get(K.immersive) === '1' ? 'true' : 'off');
    root.setAttribute('data-folia-emptycard', get(K.emptyCard) === '0' ? 'off' : 'on');
    syncAmbient();

    try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && get(K.power) === null) {
            applyPower('eco');
        }
    } catch { /* 老 WebView */ }

    const attach = (): void => {
        if (!document.body) { window.setTimeout(attach, 60); return; }
        const fab = el('button', 'folia-c-fab', '✦') as HTMLButtonElement;
        fab.type = 'button';
        fab.setAttribute('aria-label', 'Folia 定制版快捷设置');
        const menu = el('div', 'folia-c-menu');
        menu.setAttribute('data-open', 'false');
        document.body.appendChild(fab);
        document.body.appendChild(menu);
        wireFab({ fab, menu });
        watchEmptyStates();
        syncAmbient();
        syncLiquid();
        armListenTimer();
    };
    attach();
};
