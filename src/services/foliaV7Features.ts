// src/services/foliaV7Features.ts
// Folia 定制版 v7：晨雾玻璃 UI、主题化弹窗（替换系统 alert）、检测更新、更新日志。
// 纯运行时：不修改任何 React 组件；增强节点一律追加到 document.body，避免被虚拟 DOM 覆盖。

const VERSION = '0.7.29-custom.7';
const CODE = 537;
const PKG = 'top.folia.custom';
const REPO = 'lyu323/Folialinyu';
const RELEASES_URL = 'https://github.com/' + REPO + '/releases';
const API_LATEST = 'https://api.github.com/repos/' + REPO + '/releases/latest';
const PREFIX = 'folia_v7_';

type UpdateInfo = { tag: string; version: string; body: string; download: string; htmlUrl: string };

const read = (k: string, fb: string): string => {
  try { return localStorage.getItem(PREFIX + k) || fb; } catch { return fb; }
};
const write = (k: string, v: string): void => {
  try { localStorage.setItem(PREFIX + k, v); } catch { /* 隐私模式 */ }
};
const idle = (fn: () => void, delay = 120): void => {
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(fn, { timeout: delay + 600 });
  else window.setTimeout(fn, delay);
};
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);

let activeOverlay: HTMLElement | null = null;
let latestInfo: UpdateInfo | null = null;
let emptyHost: HTMLElement | null = null;
let noteEl: HTMLElement | null = null;
let actionsEl: HTMLElement | null = null;
let positionRaf = 0;
let toastTimer = 0;

/* ── 轻量 toast ───────────────────────────────────────────────────────── */
const toast = (msg: string): void => {
  const old = document.querySelector('.f7-toast');
  if (old) old.remove();
  window.clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = 'f7-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  toastTimer = window.setTimeout(() => el.remove(), 2600);
};

/* ── 通用主题化弹窗 ───────────────────────────────────────────────────── */
type ModalOpts = { title: string; kicker?: string; html: string; actions?: string; onAction?: (act: string) => void };

const showModal = (opts: ModalOpts): void => {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'f7-overlay';
  overlay.setAttribute('role', 'presentation');
  overlay.innerHTML =
    '<div class="f7-modal" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '">' +
      '<button class="f7-close" type="button" data-act="close" aria-label="关闭">×</button>' +
      (opts.kicker ? '<div class="f7-kicker">' + esc(opts.kicker) + '</div>' : '') +
      '<h2>' + esc(opts.title) + '</h2>' +
      opts.html +
      (opts.actions ? '<div class="f7-actions">' + opts.actions + '</div>' : '') +
    '</div>';
  document.body.appendChild(overlay);
  activeOverlay = overlay;
  overlay.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement;
    if (target === overlay) { closeModal(); return; }
    const btn = target.closest('[data-act]') as HTMLElement | null;
    if (!btn) return;
    const act = btn.dataset.act || '';
    if (act === 'close') { closeModal(); return; }
    if (act.startsWith('http') || act === 'open-releases') {
      window.open(act === 'open-releases' ? RELEASES_URL : act, '_blank', 'noopener,noreferrer');
      return;
    }
    opts.onAction?.(act);
  }, { passive: true });
};
const closeModal = (): void => {
  if (activeOverlay) { activeOverlay.remove(); activeOverlay = null; }
};

/* ── 版本比较：只比 custom.N ──────────────────────────────────────────── */
const customNum = (v: string): number => {
  const m = v.match(/custom\.(\d+)/i);
  return m ? Number(m[1]) : 0;
};
const isNewer = (remote: string): boolean => customNum(remote) > customNum(VERSION);

/* ── 检测更新：用 XHR，绕过 Android 原生桥对 fetch 的替换 ─────────────── */
const fetchLatest = (): Promise<UpdateInfo> => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', API_LATEST + '?t=' + Date.now(), true);
  xhr.setRequestHeader('Accept', 'application/vnd.github+json');
  xhr.timeout = 9000;
  xhr.onreadystatechange = (): void => {
    if (xhr.readyState !== 4) return;
    if (xhr.status < 200 || xhr.status >= 300) { reject(new Error('HTTP ' + xhr.status)); return; }
    try {
      const d = JSON.parse(xhr.responseText) as {
        tag_name?: string; body?: string; html_url?: string;
        assets?: Array<{ browser_download_url?: string }>;
      };
      const tag = d.tag_name || '';
      const assets = d.assets || [];
      resolve({
        tag,
        version: tag.replace(/^v/, ''),
        body: d.body || '',
        download: assets.find((a) => a.browser_download_url)?.browser_download_url || '',
        htmlUrl: d.html_url || RELEASES_URL,
      });
    } catch (e) { reject(e as Error); }
  };
  xhr.ontimeout = (): void => reject(new Error('timeout'));
  xhr.onerror = (): void => reject(new Error('network'));
  xhr.send();
});

/* ── 内置更新日志（拉不到远端也能看） ────────────────────────────────── */
const LOCAL_LOG =
  '<h3>v7 · 晨雾玻璃（当前版本）</h3><ul>' +
  '<li>修复空状态卡片只认「还没有连接在线平台」，导致「还没有导入本地音乐」页面仍是黑底灰字</li>' +
  '<li>按参考图重做该页：悬浮玻璃栏、胶囊标签、居中音符图标、高对比标题与说明、双主操作按钮</li>' +
  '<li>「关于」弹窗由白色系统框改为主题化卡片，与 7 套主题 / 流光强调色同步</li>' +
  '<li>新增检测更新：启动时静默检查 + 手动检查，直连 GitHub Releases，可一键跳转下载</li>' +
  '<li>新增更新日志面板：本地内置 + 尝试拉取远端 Release 说明</li>' +
  '<li>修正关于弹窗与诊断信息里硬编码的旧版本号</li></ul>' +
  '<h3>v6 · 星云纪元</h3><ul>' +
  '<li>星云启动页（玻璃核 / 三层轨道 / 流星 / 逐字标题），液态玻璃与 3D 晶体保留可切</li>' +
  '<li>主题预设收藏夹、五组细腻调节、流光强调色、静谧模式、低电量省电</li>' +
  '<li>零常驻模糊、离屏暂停动画、低帧三级自适应降级</li></ul>' +
  '<h3>v5 · 流畅度专项</h3><ul>' +
  '<li>液态玻璃主题、7 套配色、三档性能、自动性能档、一键极速</li>' +
  '<li>实时帧率面板、设置备份恢复、可拖动悬浮球、复制诊断</li></ul>' +
  '<h3>v1–v4</h3><ul>' +
  '<li>图标 / 包名 / 版本号定制、3D 启动页、主题系统、主题分享码、听歌计时</li></ul>';

/* ── 关于弹窗 ─────────────────────────────────────────────────────────── */
const aboutHtml = (): string =>
  '<div class="f7-version"><span class="f7-dot"></span><b>' + VERSION + '</b><span>· build ' + CODE + '</span></div>' +
  '<dl class="f7-meta">' +
    '<dt>包名</dt><dd>' + PKG + '</dd>' +
    '<dt>上游</dt><dd>chthollyphile/folia-major（AGPL-3.0）</dd>' +
    '<dt>Android 移植</dt><dd>whycfawa/folia-android（AGPL-3.0）</dd>' +
    '<dt>仓库</dt><dd>' + REPO + '</dd>' +
  '</dl>' +
  '<div class="f7-divider"></div>' +
  '<p>仅供个人学习与非营利测试；在线音乐、歌词与封面版权归各平台所有，请通过官方渠道支持正版。</p>' +
  '<div class="f7-status" data-state="idle"><span class="f7-dot"></span><span class="f7-status-text">尚未检查更新</span></div>' +
  '<div class="f7-foot">主题化弹窗 · 与当前主题与流光强调色同步 · 点按遮罩或右上角关闭</div>';

const aboutActions = (): string =>
  '<button type="button" class="f7-primary" data-act="check">检测更新</button>' +
  '<button type="button" data-act="log">更新日志</button>' +
  '<button type="button" data-act="diag">复制诊断</button>' +
  '<button type="button" data-act="close">知道了</button>';

const showAbout = (): void => {
  showModal({
    kicker: 'FOLIA CUSTOM', title: 'Folia 定制版',
    html: aboutHtml(), actions: aboutActions(),
    onAction: (act) => {
      if (act === 'check') void checkUpdate(true);
      if (act === 'log') void showChangelog();
      if (act === 'diag') copyDiag();
    },
  });
  const cached = read('update_state', '');
  if (cached) applyStatusBadge(cached);
};

/* ── 更新状态条 ───────────────────────────────────────────────────────── */
const applyStatusBadge = (text: string, state = 'ok'): void => {
  const box = activeOverlay?.querySelector('.f7-status') as HTMLElement | null;
  if (!box) return;
  box.dataset.state = state;
  const t = box.querySelector('.f7-status-text');
  if (t) t.textContent = text;
};

/* ── 检测更新 ─────────────────────────────────────────────────────────── */
const checkUpdate = async (interactive: boolean): Promise<void> => {
  if (interactive) {
    if (!activeOverlay) showAbout();
    applyStatusBadge('正在连接 GitHub…', 'idle');
  }
  try {
    const info = await fetchLatest();
    latestInfo = info;
    write('update_state', info.version);
    const newer = isNewer(info.version);
    const text = newer
      ? '发现新版本 ' + info.version + '（当前 ' + VERSION + '）'
      : '已是最新版本 ' + VERSION;
    if (interactive) {
      applyStatusBadge(text, newer ? 'new' : 'ok');
      const holder = activeOverlay?.querySelector('.f7-actions');
      if (holder && newer && !holder.querySelector('[data-act="download"]')) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'f7-primary'; b.dataset.act = 'download';
        b.textContent = '下载新版本';
        holder.insertBefore(b, holder.firstChild);
        // 用事件委托的 onAction 处理不了新 act，这里单独绑定
        b.addEventListener('click', () => {
          window.open(info.download || info.htmlUrl, '_blank', 'noopener,noreferrer');
        }, { passive: true });
      }
      if (newer && info.body) {
        const box = activeOverlay?.querySelector('.f7-modal');
        if (box && !box.querySelector('.f7-release-note')) {
          const d = document.createElement('div');
          d.className = 'f7-log f7-release-note';
          d.style.maxHeight = '150px';
          d.innerHTML = '<h3>新版本说明</h3>' + mdToHtml(info.body.slice(0, 1200));
          box.insertBefore(d, box.querySelector('.f7-actions'));
        }
      }
    } else if (newer) {
      toast('发现新版本 ' + info.version + ' · 点 ✦ → 关于 → 检测更新');
    }
  } catch (e) {
    if (interactive) {
      applyStatusBadge('检查失败：网络不可用或接口受限', 'err');
      const holder = activeOverlay?.querySelector('.f7-actions');
      if (holder && !holder.querySelector('[data-act="open-releases"]')) {
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.act = 'open-releases'; b.textContent = '打开 Releases 页面';
        holder.insertBefore(b, holder.firstChild);
      }
    }
  }
};

/* 极简 markdown → 安全 html */
const mdToHtml = (md: string): string =>
  esc(md)
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^-\s+(.+)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '<br>')
    .replace(/\n/g, '<br>');

/* ── 更新日志 ─────────────────────────────────────────────────────────── */
const showChangelog = async (): Promise<void> => {
  let remote = '';
  const info = latestInfo;
  if (info?.body) remote = '<h3>远端 Release · ' + esc(info.tag) + '</h3>' + mdToHtml(info.body.slice(0, 2400));
  else {
    try {
      const got = await fetchLatest();
      latestInfo = got;
      remote = '<h3>远端 Release · ' + esc(got.tag) + '</h3>' + mdToHtml(got.body.slice(0, 2400));
    } catch { remote = '<h3>远端 Release</h3><p>暂时取不到远端说明，以下为内置日志。</p>'; }
  }
  showModal({
    kicker: 'CHANGELOG', title: '更新日志',
    html: '<div class="f7-log">' + remote + LOCAL_LOG + '</div>' +
      '<div class="f7-foot">当前 ' + VERSION + ' · 完整版本归档见仓库 versions/ 目录</div>',
    actions: '<button type="button" class="f7-primary" data-act="check">检测更新</button>' +
      '<button type="button" data-act="about">关于</button>' +
      '<button type="button" data-act="close">关闭</button>',
    onAction: (act) => {
      if (act === 'check') void checkUpdate(true);
      if (act === 'about') showAbout();
    },
  });
};

/* ── 复制诊断 ─────────────────────────────────────────────────────────── */
const copyDiag = (): void => {
  const info = [
    'Folia 定制版 ' + VERSION + ' (' + CODE + ')',
    '包名: ' + PKG,
    '主题: ' + (document.documentElement.getAttribute('data-folia-theme') || 'glass'),
    'v7 晨雾: ' + (document.documentElement.getAttribute('data-folia-v7') || 'off'),
    '更新状态: ' + (read('update_state', '未检查')),
    '平台: ' + (navigator.userAgent.includes('Android') ? 'Android (Capacitor)' : 'Web'),
    'UA: ' + navigator.userAgent,
  ].join('\n');
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(info).then(() => toast('诊断信息已复制')).catch(() => showTextModal('诊断信息', info));
  } else showTextModal('诊断信息', info);
};
const showTextModal = (title: string, text: string): void => {
  showModal({ kicker: 'INFO', title, html: '<div class="f7-log">' + esc(text).replace(/\n/g, '<br>') + '</div>',
    actions: '<button type="button" class="f7-primary" data-act="close">好</button>' });
};

/* ── 替换系统 alert（图三白框） ───────────────────────────────────────── */
const nativeAlert = window.alert.bind(window);
const installAlertHook = (): void => {
  window.alert = (message?: unknown): void => {
    const text = String(message ?? '');
    if (!text || !document.body) { nativeAlert(text); return; }
    // 关于弹窗：含包名或版本串 → 富信息主题卡片
    if (text.includes('top.folia.custom') || text.includes('Folia 定制版')) {
      // 把旧版本串统一替换成当前版本，修掉硬编码旧号
      showAbout();
      return;
    }
    if (text.length > 90 || text.includes('\n')) {
      showTextModal('提示', text);
      return;
    }
    showModal({
      kicker: 'FOLIA', title: '提示',
      html: '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>',
      actions: '<button type="button" class="f7-primary" data-act="close">好</button>',
    });
  };
};

/* ── 空状态重做：借鉴参考图 ───────────────────────────────────────────── */
const EMPTY_TEXTS = [
  '还没有导入本地音乐', '暂无本地音乐', '还没有连接在线平台',
  '还没有导入', '暂无音乐', '没有音乐',
];
const NOTE_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="rgba(246,243,255,.92)" stroke-width="1.7" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

const findEmptyHost = (): HTMLElement | null => {
  const root = document.getElementById('root');
  if (!root) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = (node.textContent || '').trim();
    if (!text || text.length > 60 || !EMPTY_TEXTS.some((t) => text.includes(t))) continue;
    let el = node.parentElement;
    for (let d = 0; d < 6 && el && el !== root; d += 1) {
      const own = (el.textContent || '').trim();
      if (own.length > 24 && own.length < 420) return el;
      el = el.parentElement;
    }
  }
  return null;
};

const BUTTON_PRIMARY =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>导入文件夹';
const BUTTON_GHOST =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>扫描设备音乐库';

const clickExisting = (keywords: string[]): boolean => {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], a'));
  const hit = buttons.find((b) => {
    const t = ((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')).trim();
    return t && t.length < 40 && keywords.some((k) => t.includes(k));
  });
  if (hit) { hit.click(); return true; }
  return false;
};

const openMoreMenu = (): void => {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'));
  const more = buttons.find((b) => {
    const label = (b.getAttribute('aria-label') || '') + (b.className || '');
    const text = (b.textContent || '').trim();
    return /more|menu|ellipsis/i.test(label) || text === '…' || text === '···' || text === '•••';
  });
  if (more) more.click();
};

const onPrimary = (): void => {
  if (clickExisting(['导入文件夹', '导入目录', '选择文件夹', '导入'])) return;
  openMoreMenu();
  toast('在「…」菜单里选「导入文件夹」');
};
const onGhost = (): void => {
  if (clickExisting(['扫描设备音乐库', '扫描设备', '扫描音乐库', '扫描'])) return;
  openMoreMenu();
  toast('在「…」菜单里选「扫描设备音乐库」');
};

const positionEmpty = (): void => {
  if (!emptyHost || !emptyHost.isConnected) { clearEmpty(); return; }
  const r = emptyHost.getBoundingClientRect();
  if (r.height < 40 || r.bottom < 0 || r.top > window.innerHeight) {
    if (noteEl) noteEl.style.opacity = '0';
    if (actionsEl) actionsEl.style.opacity = '0';
    return;
  }
  if (noteEl) {
    noteEl.style.opacity = '1';
    noteEl.style.left = (r.left + r.width / 2) + 'px';
    noteEl.style.top = (r.top + 38) + 'px';
  }
  if (actionsEl) {
    actionsEl.style.opacity = '1';
    actionsEl.style.left = (r.left + r.width / 2) + 'px';
    actionsEl.style.top = Math.max(0, r.bottom - 74) + 'px';
    actionsEl.style.transform = 'translate(-50%, 0)';
  }
};
const schedulePosition = (): void => {
  if (positionRaf) return;
  positionRaf = window.requestAnimationFrame(() => { positionRaf = 0; positionEmpty(); });
};

const clearEmpty = (): void => {
  if (noteEl) { noteEl.remove(); noteEl = null; }
  if (actionsEl) { actionsEl.remove(); actionsEl = null; }
  if (emptyHost) { emptyHost.removeAttribute('data-f7-empty'); emptyHost = null; }
  window.removeEventListener('scroll', schedulePosition, true);
  window.removeEventListener('resize', schedulePosition);
};

const mountEmpty = (): void => {
  if (activeOverlay || read('mist', 'on') !== 'on') return;
  const host = findEmptyHost();
  if (!host) return;
  if (emptyHost === host && noteEl && actionsEl) { schedulePosition(); return; }
  if (emptyHost !== host) clearEmpty();
  emptyHost = host;
  host.setAttribute('data-f7-empty', 'true');

  if (!noteEl) {
    noteEl = document.createElement('div');
    noteEl.className = 'f7-empty-note';
    noteEl.innerHTML = NOTE_SVG;
    document.body.appendChild(noteEl);
  }
  if (!actionsEl) {
    actionsEl = document.createElement('div');
    actionsEl.className = 'f7-empty-actions';
    actionsEl.innerHTML =
      '<button type="button" class="f7-btn-primary" data-f7="import">' + BUTTON_PRIMARY + '</button>' +
      '<button type="button" class="f7-btn-ghost" data-f7="scan">' + BUTTON_GHOST + '</button>';
    document.body.appendChild(actionsEl);
    actionsEl.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest('button') as HTMLElement | null;
      if (!b) return;
      if (b.dataset.f7 === 'import') onPrimary();
      if (b.dataset.f7 === 'scan') onGhost();
    }, { passive: true });
  }
  window.addEventListener('scroll', schedulePosition, { passive: true, capture: true });
  window.addEventListener('resize', schedulePosition, { passive: true });
  schedulePosition();
};

/* ── 注入 v6 设置面板一行（不改 v6 源码文件） ─────────────────────────── */
const injectV6Panel = (): void => {
  const panel = document.querySelector('.f6-panel') as HTMLElement | null;
  if (!panel || panel.querySelector('.f7-inject')) return;
  const wrap = document.createElement('div');
  wrap.className = 'f7-inject';
  wrap.innerHTML =
    '<div class="f6-row"><span class="f6-label">v7 晨雾 UI</span><span class="f6-seg">' +
      '<button type="button" data-f7-toggle="on">开</button><button type="button" data-f7-toggle="off">关</button>' +
    '</span></div>' +
    '<div class="f6-row"><span class="f6-label">检测更新</span><span class="f6-seg">' +
      '<button type="button" data-f7-act="check">检查</button><button type="button" data-f7-act="log">日志</button>' +
      '<button type="button" data-f7-act="about">关于</button></span></div>' +
    '<p class="f6-note">' + VERSION + ' · 上次检查：' + esc(read('update_state', '尚未检查')) + '</p>';
  panel.appendChild(wrap);
  const cur = read('mist', 'on');
  wrap.querySelectorAll<HTMLElement>('[data-f7-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.f7Toggle === cur ? 'true' : 'false');
  });
  wrap.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!b) return;
    ev.stopPropagation();
    if (b.dataset.f7Toggle) {
      write('mist', b.dataset.f7Toggle);
      document.documentElement.setAttribute('data-folia-v7', b.dataset.f7Toggle);
      if (b.dataset.f7Toggle === 'off') clearEmpty(); else idle(mountEmpty);
      wrap.querySelectorAll<HTMLElement>('[data-f7-toggle]').forEach((x) =>
        x.setAttribute('aria-pressed', x.dataset.f7Toggle === b.dataset.f7Toggle ? 'true' : 'false'));
      toast(b.dataset.f7Toggle === 'on' ? '晨雾 UI 已开启' : '晨雾 UI 已关闭');
      return;
    }
    if (b.dataset.f7Act === 'check') void checkUpdate(true);
    if (b.dataset.f7Act === 'log') void showChangelog();
    if (b.dataset.f7Act === 'about') showAbout();
  }, { passive: true });
};

/* ── 入口 ─────────────────────────────────────────────────────────────── */
export const installFoliaV7Features = (): void => {
  const root = document.documentElement;
  if (root.dataset.foliaV7Installed === '1') return;
  root.dataset.foliaV7Installed = '1';
  root.setAttribute('data-folia-v7', read('mist', 'on'));

  installAlertHook();

  // 空状态：首屏命中即停的短轮询 + 路由变化时重新唤醒
  let tries = 0;
  const scan = (): void => {
    mountEmpty();
    tries += 1;
    if (!emptyHost && tries < 24) window.setTimeout(scan, 700);
  };
  idle(() => {
    scan();
    document.addEventListener('click', (e) => {
      const t = e.target as Element | null;
      if (t?.closest?.('[role="tab"]') || t?.closest?.('[data-f7]')) {
        tries = 0; idle(mountEmpty, 240);
      }
    }, { passive: true });
    window.addEventListener('popstate', () => { tries = 0; clearEmpty(); idle(mountEmpty, 240); }, { passive: true });
  }, 200);

  // v6 面板出现时注入一行
  const mo = new MutationObserver(() => { if (document.querySelector('.f6-panel')) injectV6Panel(); });
  mo.observe(document.body, { childList: true });
  window.setTimeout(() => { /* observer 保持轻量：只在 childList 变化时跑一次 querySelector */ }, 0);

  // 启动 8 秒后静默检查一次更新（只提示，不打断）
  window.setTimeout(() => { void checkUpdate(false); }, 8000);

  (window as unknown as { __foliaV7?: unknown }).__foliaV7 = {
    version: VERSION, code: CODE,
    about: showAbout, log: showChangelog, check: () => checkUpdate(true),
    get latest(): UpdateInfo | null { return latestInfo; },
    get nativeAlert(): (m?: unknown) => void { return nativeAlert; },
  };
};
