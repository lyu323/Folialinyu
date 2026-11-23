// src/services/foliaV6Features.ts
// Folia 定制版 v6：精致化设置、主题预设、自适应流畅度、星云启动页重播。
// 纯运行时模块：只操作 <html> 属性 / localStorage / 自建 DOM，不改任何 React 组件。
// 所有动画走 transform/opacity；初始化按空闲分片；监听一律 passive。

const PREFIX = 'folia_v6_';
const VERSION = '0.7.29-custom.6';

type Seg = { key: string; values: Array<[string, string]>; attr: string; fallback: string };

const SEGS: Seg[] = [
  { key: 'density', attr: 'data-f6-density', fallback: 'standard',
    values: [['宽松', 'cozy'], ['标准', 'standard'], ['紧凑', 'compact']] },
  { key: 'detail', attr: 'data-f6-detail', fallback: 'refined',
    values: [['极简', 'minimal'], ['标准', 'standard'], ['细腻', 'refined']] },
  { key: 'letter', attr: 'data-f6-letter', fallback: 'normal',
    values: [['紧', 'tight'], ['标准', 'normal'], ['疏', 'wide']] },
  { key: 'weight', attr: 'data-f6-weight', fallback: 'normal',
    values: [['轻', 'light'], ['标准', 'normal'], ['重', 'strong']] },
  { key: 'motion', attr: 'data-f6-motion', fallback: 'standard',
    values: [['关', 'off'], ['柔和', 'soft'], ['标准', 'standard'], ['弹性', 'bouncy']] },
];

const TOGGLES: Array<{ key: string; attr: string; label: string; fallback: string }> = [
  { key: 'flow', attr: 'data-f6-flow', label: '流光强调色', fallback: 'on' },
  { key: 'quiet', attr: 'data-f6-quiet', label: '静谧模式', fallback: 'off' },
  { key: 'adaptive', attr: 'data-f6-adaptive', label: '自适应降级', fallback: 'on' },
  { key: 'boost', attr: 'data-f6-boost', label: '低对比文字提亮', fallback: 'on' },
];

const read = (key: string, fallback: string): string => {
  try { return localStorage.getItem(PREFIX + key) || fallback; } catch { return fallback; }
};
const write = (key: string, value: string): void => {
  try { localStorage.setItem(PREFIX + key, value); } catch { /* 隐私模式：本次会话仍生效 */ }
};
const idle = (fn: () => void): void => {
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(fn, { timeout: 900 });
  else window.setTimeout(fn, 120);
};

let splashMarkup = '';
let panelEl: HTMLDivElement | null = null;
let fpsValue = 0;
let mountMs = 0;
let degradeStep = 0;
let lowSamples = 0;

const applyAll = (): void => {
  const root = document.documentElement;
  root.setAttribute('data-folia-v6', 'on');
  for (const seg of SEGS) root.setAttribute(seg.attr, read(seg.key, seg.fallback));
  for (const t of TOGGLES) root.setAttribute(t.attr, read(t.key, t.fallback));
};

const setSeg = (key: string, value: string): void => {
  write(key, value);
  const seg = SEGS.find((s) => s.key === key);
  if (seg) document.documentElement.setAttribute(seg.attr, value);
  refreshPanel();
};
const setToggle = (key: string, value: string): void => {
  write(key, value);
  const t = TOGGLES.find((x) => x.key === key);
  if (t) document.documentElement.setAttribute(t.attr, value);
  refreshPanel();
};

/* ── 主题预设收藏夹：把当前 v6 组合命名存起来，随时切回 ────────────────── */
type Preset = { name: string; savedAt: number; values: Record<string, string> };
const presets = (): Preset[] => {
  try { return JSON.parse(localStorage.getItem(PREFIX + 'presets') || '[]') as Preset[]; }
  catch { return []; }
};
const savePresets = (list: Preset[]): void => {
  try { localStorage.setItem(PREFIX + 'presets', JSON.stringify(list.slice(0, 12))); } catch { /* ignore */ }
};
const savePreset = (name: string): void => {
  const values: Record<string, string> = {};
  for (const s of SEGS) values[s.key] = read(s.key, s.fallback);
  for (const t of TOGGLES) values[t.key] = read(t.key, t.fallback);
  const list = presets().filter((p) => p.name !== name);
  list.unshift({ name, savedAt: Date.now(), values });
  savePresets(list);
  refreshPanel();
};
const applyPreset = (name: string): void => {
  const p = presets().find((x) => x.name === name);
  if (!p) return;
  for (const [k, v] of Object.entries(p.values)) write(k, v);
  applyAll();
  refreshPanel();
};
const deletePreset = (name: string): void => {
  savePresets(presets().filter((p) => p.name !== name));
  refreshPanel();
};

/* ── 启动页重播：复用 index.html 内联样式，插入一份克隆 ─────────────────── */
const replaySplash = (): void => {
  if (!splashMarkup) return;
  const old = document.getElementById('app-splash');
  if (old) old.remove();
  const holder = document.createElement('div');
  holder.innerHTML = splashMarkup;
  const node = holder.firstElementChild as HTMLElement | null;
  if (!node) return;
  node.style.zIndex = '2147483600';
  document.body.appendChild(node);
  window.setTimeout(() => {
    node.classList.add('is-hiding');
    window.setTimeout(() => node.remove(), 340);
  }, 1800);
};

/* ── 低对比文字提亮：一次性扫描，命中即断开 observer ───────────────────── */
const boostDimText = (): void => {
  if (read('boost', 'on') !== 'on') return;
  const nodes = document.querySelectorAll<HTMLElement>(
    '[class*="empty"], [class*="hint"], [class*="placeholder"], [class*="subtitle"], [class*="muted"]'
  );
  let touched = 0;
  for (let i = 0; i < nodes.length && touched < 48; i++) {
    const el = nodes[i];
    if (el.dataset.f6Boosted === '1') continue;
    const cs = getComputedStyle(el);
    const m = cs.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) continue;
    const lum = (Number(m[1]) * 0.299 + Number(m[2]) * 0.587 + Number(m[3]) * 0.114) / 255;
    const alpha = cs.color.includes('rgba') ? Number((cs.color.match(/rgba\([^)]*,\s*([\d.]+)\)/) || [])[1] || 1) : 1;
    if (lum * alpha < 0.44) {
      el.style.color = 'rgba(238, 232, 255, .82)';
      el.dataset.f6Boosted = '1';
      touched++;
    }
  }
};
const watchFirstPaint = (): void => {
  const root = document.getElementById('root');
  if (!root) return;
  const run = (): void => { boostDimText(); obs.disconnect(); };
  const obs = new MutationObserver(() => {
    if (root.childElementCount > 0) run();
  });
  obs.observe(root, { childList: true, subtree: true });
  if (root.childElementCount > 0) run();
  window.setTimeout(() => obs.disconnect(), 12000);
};

/* ── 离屏暂停装饰动画 ──────────────────────────────────────────────────── */
const watchOffscreen = (): void => {
  if (typeof IntersectionObserver === 'undefined') return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      (e.target as HTMLElement).dataset.f6Offscreen = e.isIntersecting ? 'false' : 'true';
    }
  }, { rootMargin: '80px' });
  const list = document.querySelectorAll<HTMLElement>(
    '[class*="aurora"], [class*="glow"], [class*="spark"], [class*="sheen"]'
  );
  for (let i = 0; i < Math.min(list.length, 60); i++) io.observe(list[i]);
};

/* ── 自适应降级：每 2 秒采一次帧率，连续低帧逐级关特效 ─────────────────── */
const startFrameSampling = (): void => {
  let frames = 0;
  let last = performance.now();
  const tick = (ts: number): void => {
    frames++;
    if (ts - last >= 2000) {
      fpsValue = Math.round((frames * 1000) / (ts - last));
      frames = 0; last = ts;
      if (read('adaptive', 'on') === 'on' && !document.hidden) {
        if (fpsValue < 42) lowSamples++; else lowSamples = Math.max(0, lowSamples - 1);
        if (lowSamples >= 3 && degradeStep < 3) {
          degradeStep++;
          lowSamples = 0;
          if (degradeStep === 1) document.documentElement.setAttribute('data-f6-flow', 'off');
          if (degradeStep === 2) document.documentElement.setAttribute('data-f6-detail', 'minimal');
          if (degradeStep === 3) {
            document.documentElement.setAttribute('data-f6-motion', 'soft');
            document.documentElement.setAttribute('data-f6-quiet', 'on');
          }
          window.dispatchEvent(new CustomEvent('folia:perf:degrade', { detail: { step: degradeStep, fps: fpsValue } }));
        }
      }
      const badge = document.getElementById('f6-fps');
      if (badge) badge.textContent = fpsValue + ' FPS';
    }
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
};

/* ── 低电量自动省电（不支持则静默跳过） ───────────────────────────────── */
const watchBattery = (): void => {
  const nav = navigator as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean }> };
  if (typeof nav.getBattery !== 'function') return;
  nav.getBattery().then((b) => {
    if (b.level < 0.2 && !b.charging) {
      document.documentElement.setAttribute('data-f6-quiet', 'on');
      document.documentElement.setAttribute('data-f6-flow', 'off');
    }
  }).catch(() => { /* ignore */ });
};

/* ── 面板 UI ───────────────────────────────────────────────────────────── */
const segHtml = (s: Seg): string => {
  const cur = read(s.key, s.fallback);
  return '<div class="f6-row"><span class="f6-label">' + ({
    density: '界面密度', detail: '精致度', letter: '字距', weight: '字重', motion: '微动效',
  } as Record<string, string>)[s.key] + '</span><span class="f6-seg" data-seg="' + s.key + '">' +
    s.values.map(([label, v]) =>
      '<button type="button" data-value="' + v + '" aria-pressed="' + (v === cur ? 'true' : 'false') + '">' + label + '</button>'
    ).join('') + '</span></div>';
};
const toggleHtml = (t: { key: string; label: string; fallback: string }): string => {
  const cur = read(t.key, t.fallback);
  return '<div class="f6-row"><span class="f6-label">' + t.label + '</span>' +
    '<span class="f6-seg" data-toggle="' + t.key + '">' +
    '<button type="button" data-value="on" aria-pressed="' + (cur === 'on' ? 'true' : 'false') + '">开</button>' +
    '<button type="button" data-value="off" aria-pressed="' + (cur === 'off' ? 'true' : 'false') + '">关</button>' +
    '</span></div>';
};

const CHANGELOG = [
  '<b>v6 · 星云纪元</b>',
  '· 启动页重做：星云玻璃核 + 三层轨道 + 逐字浮现 + 光轨星尘（三套可切）',
  '· 新增主题预设收藏夹，命名保存 / 一键切回整套外观',
  '· 新增界面密度、精致度、字距、字重、微动效五组细腻调节',
  '· 新增流光强调色、静谧模式、低对比文字提亮',
  '· 流畅度：零常驻模糊、离屏暂停动画、低帧三级自适应降级',
  '· 低电量自动省电、启动耗时与实时帧率读数、更新日志面板',
  '<b>保留 v5 全部能力</b>：液态玻璃 / 7 套主题 / 三档性能 / 备份恢复 / 悬浮球 / 3D 晶体启动页',
].join('<br>');

const panelHtml = (): string => {
  const list = presets();
  return '<button class="f6-close" type="button" data-act="close" aria-label="关闭">×</button>' +
    '<h3>✦ Folia v6 · 精致与流畅 <span id="f6-fps" style="float:right;font-size:10px;opacity:.6;font-weight:400">' + (fpsValue || '--') + ' FPS</span></h3>' +
    SEGS.map(segHtml).join('') +
    TOGGLES.map(toggleHtml).join('') +
    '<div class="f6-row"><span class="f6-label">主题预设</span><span class="f6-seg">' +
      '<button type="button" data-act="save-preset">保存当前</button></span></div>' +
    (list.length
      ? '<div class="f6-row" style="flex-wrap:wrap">' + list.map((p) =>
          '<span class="f6-seg" style="margin:2px 0"><button type="button" data-preset="' + p.name + '">' + p.name + '</button>' +
          '<button type="button" data-del="' + p.name + '" aria-label="删除">×</button></span>'
        ).join('') + '</div>'
      : '<div class="f6-note">还没有预设，点「保存当前」把这套外观存下来。</div>') +
    '<div class="f6-actions">' +
      '<button type="button" data-act="replay">重播启动动画</button>' +
      '<button type="button" data-act="changelog">更新日志</button>' +
      '<button type="button" data-act="diag">复制诊断</button>' +
      '<button type="button" data-act="reset">恢复 v6 默认</button>' +
    '</div>' +
    '<div id="f6-extra" style="display:none" class="f6-log">' + CHANGELOG + '</div>' +
    '<p class="f6-note">v' + VERSION + ' · 首屏 ' + (mountMs ? mountMs + ' ms' : '测量中') +
    ' · 包名 top.folia.custom · AGPL-3.0 个人学习用途</p>';
};

const closePanel = (): void => {
  if (panelEl) { panelEl.remove(); panelEl = null; }
};
const refreshPanel = (): void => {
  if (!panelEl) return;
  const extraOpen = (panelEl.querySelector('#f6-extra') as HTMLElement | null)?.style.display !== 'none';
  panelEl.innerHTML = panelHtml();
  if (extraOpen) {
    const e = panelEl.querySelector('#f6-extra') as HTMLElement | null;
    if (e) e.style.display = 'block';
  }
};
const openPanel = (): void => {
  if (panelEl) { closePanel(); return; }
  const el = document.createElement('div');
  el.className = 'f6-panel';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Folia v6 设置');
  el.innerHTML = panelHtml();
  document.body.appendChild(el);
  panelEl = el;
  el.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!btn) return;
    const seg = btn.closest('[data-seg]') as HTMLElement | null;
    if (seg && btn.dataset.value) { setSeg(seg.dataset.seg as string, btn.dataset.value); return; }
    const tog = btn.closest('[data-toggle]') as HTMLElement | null;
    if (tog && btn.dataset.value) { setToggle(tog.dataset.toggle as string, btn.dataset.value); return; }
    if (btn.dataset.preset) { applyPreset(btn.dataset.preset); return; }
    if (btn.dataset.del) { deletePreset(btn.dataset.del); return; }
    switch (btn.dataset.act) {
      case 'close': closePanel(); break;
      case 'replay': closePanel(); replaySplash(); break;
      case 'save-preset': {
        const name = window.prompt('给这套外观起个名字', '我的预设 ' + (presets().length + 1));
        if (name && name.trim()) savePreset(name.trim().slice(0, 18));
        break;
      }
      case 'changelog': {
        const e = el.querySelector('#f6-extra') as HTMLElement | null;
        if (e) e.style.display = e.style.display === 'none' ? 'block' : 'none';
        break;
      }
      case 'diag': {
        const info = [
          'Folia 定制版 v6 / ' + VERSION,
          '包名: top.folia.custom',
          '首屏: ' + (mountMs || '--') + ' ms',
          '帧率: ' + (fpsValue || '--') + ' FPS',
          '降级档: ' + degradeStep,
          'UA: ' + navigator.userAgent,
        ].join('\n');
        if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(info);
        btn.textContent = '已复制 ✓';
        window.setTimeout(() => { btn.textContent = '复制诊断'; }, 1400);
        break;
      }
      case 'reset': {
        for (const s of SEGS) { try { localStorage.removeItem(PREFIX + s.key); } catch { /* ignore */ } }
        for (const t of TOGGLES) { try { localStorage.removeItem(PREFIX + t.key); } catch { /* ignore */ } }
        degradeStep = 0; lowSamples = 0;
        applyAll(); refreshPanel();
        break;
      }
    }
  }, { passive: true });
};

/* ── 左下角可拖动徽标（与 v5 右下悬浮球错开） ─────────────────────────── */
const buildLauncher = (): void => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'f6-launcher';
  btn.setAttribute('aria-label', '打开 Folia v6 设置');
  btn.textContent = '✦';
  btn.style.cssText = 'position:fixed;z-index:2147482900;width:38px;height:38px;border-radius:50%;' +
    'border:1px solid rgba(255,255,255,.20);background:linear-gradient(145deg,rgba(124,92,236,.82),rgba(63,182,176,.72));' +
    'color:#fff;font-size:17px;line-height:1;cursor:pointer;box-shadow:0 6px 22px rgba(60,40,140,.42);' +
    'touch-action:none;user-select:none;-webkit-tap-highlight-color:transparent;';
  let x = 14, y = 14;
  try {
    const saved = JSON.parse(localStorage.getItem(PREFIX + 'launcher') || 'null') as { x: number; y: number } | null;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) { x = saved.x; y = saved.y; }
  } catch { /* ignore */ }
  const place = (): void => { btn.style.left = x + 'px'; btn.style.bottom = y + 'px'; };
  place();
  document.body.appendChild(btn);

  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false, holdTimer = 0;
  const onDown = (e: PointerEvent): void => {
    dragging = true; moved = false; sx = e.clientX; sy = e.clientY; ox = x; oy = y;
    holdTimer = window.setTimeout(() => {
      if (!moved) {
        const cur = read('quiet', 'off');
        setToggle('quiet', cur === 'on' ? 'off' : 'on');
      }
    }, 600);
    btn.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) { moved = true; window.clearTimeout(holdTimer); }
    if (!moved) return;
    x = Math.max(8, Math.min(window.innerWidth - 46, ox + dx));
    y = Math.max(8, Math.min(window.innerHeight - 46, oy - dy));
    place();
  };
  const onUp = (): void => {
    if (!dragging) return;
    dragging = false; window.clearTimeout(holdTimer);
    if (moved) { try { localStorage.setItem(PREFIX + 'launcher', JSON.stringify({ x, y })); } catch { /* ignore */ } }
    else openPanel();
  };
  btn.addEventListener('pointerdown', onDown as EventListener, { passive: true });
  btn.addEventListener('pointermove', onMove as EventListener, { passive: true });
  btn.addEventListener('pointerup', onUp as EventListener, { passive: true });
  btn.addEventListener('pointercancel', onUp as EventListener, { passive: true });
};

/* ── 入口 ─────────────────────────────────────────────────────────────── */
export const installFoliaV6Features = (): void => {
  if (document.documentElement.dataset.foliaV6Installed === '1') return;
  document.documentElement.dataset.foliaV6Installed = '1';

  // 启动页此时还在 DOM，留一份用于「重播启动动画」
  const splash = document.getElementById('app-splash');
  if (splash) splashMarkup = splash.outerHTML;
  mountMs = Math.round(performance.now());

  applyAll();
  idle(() => {
    buildLauncher();
    idle(() => {
      watchFirstPaint();
      watchOffscreen();
      watchBattery();
      idle(() => {
        startFrameSampling();
        mountMs = Math.round(performance.now());
        const note = document.querySelector('.f6-panel .f6-note');
        if (note) note.textContent = 'v' + VERSION + ' · 首屏 ' + mountMs + ' ms · 包名 top.folia.custom · AGPL-3.0 个人学习用途';
      });
    });
  });

  (window as unknown as { __foliaV6?: unknown }).__foliaV6 = {
    open: openPanel, close: closePanel, replay: replaySplash,
    set: setSeg, toggle: setToggle, version: VERSION,
    get fps(): number { return fpsValue; },
  };
};
