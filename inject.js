/*
 * inject.js — MAIN world
 * 1) 强制 permission.allowed = true
 * 2) 提供 __yhkt.play(videoId) —— 完整实现「签发凭证 + 组装 URL + 带 Origin 拉流 + blob 播放」
 * 3) 提供 __yhkt.sessions(courseId) —— 走不过滤权限的 v1 接口
 */
(function () {
  if (window.__yhktInstalled) return;
  window.__yhktInstalled = true;

  const state = { enabled: true, log: [] };
  const XCLIENT_KEY = '1138b69dfef641d9d7ba49137d2d4875';
  const PATH_SEG = 'f4ff94d1bc715b077e1ebe03493799fd';
  const API = 'https://cbiz.yanhekt.cn';

  const log = (...a) => {
    state.log.push({ t: Date.now(), msg: a.join(' ') });
    if (state.log.length > 300) state.log.shift();
  };

  window.addEventListener('__yhkt_config', (e) => {
    state.enabled = !!(e.detail && e.detail.enabled);
    log('enabled ->', state.enabled);
  });

  /* ---------- MD5 ---------- */
  function md5(str) {
    function rl(x, c) { return (x << c) | (x >>> (32 - c)); }
    function ad(x, y) { const l = (x & 0xffff) + (y & 0xffff); const m = (x >> 16) + (y >> 16) + Math.floor(l / 65536); return (m << 16) | (l & 0xffff); }
    function cm(q, a, b, x, s, t) { return ad(rl(ad(ad(a, q), ad(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cm((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cm((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cm(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cm(c ^ (b | ~d), a, b, x, s, t); }
    const s = [];
    for (let i = 0; i < str.length; i++) s[i >> 2] |= (str.charCodeAt(i) & 0xff) << ((i % 4) * 8);
    const bl = str.length * 8;
    s[bl >> 5] |= 0x80 << bl % 32;
    s[(((bl + 64) >>> 9) << 4) + 14] = bl;
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let i = 0; i < s.length; i += 16) {
      const oa = a, ob = b, oc = c, od = d;
      a = ff(a, b, c, d, s[i] | 0, 7, -680876936); d = ff(d, a, b, c, s[i + 1] | 0, 12, -389564586);
      c = ff(c, d, a, b, s[i + 2] | 0, 17, 606105819); b = ff(b, c, d, a, s[i + 3] | 0, 22, -1044525330);
      a = ff(a, b, c, d, s[i + 4] | 0, 7, -176418897); d = ff(d, a, b, c, s[i + 5] | 0, 12, 1200080426);
      c = ff(c, d, a, b, s[i + 6] | 0, 17, -1473231341); b = ff(b, c, d, a, s[i + 7] | 0, 22, -45705983);
      a = ff(a, b, c, d, s[i + 8] | 0, 7, 1770035416); d = ff(d, a, b, c, s[i + 9] | 0, 12, -1958414417);
      c = ff(c, d, a, b, s[i + 10] | 0, 17, -42063); b = ff(b, c, d, a, s[i + 11] | 0, 22, -1990404162);
      a = ff(a, b, c, d, s[i + 12] | 0, 7, 1804603682); d = ff(d, a, b, c, s[i + 13] | 0, 12, -40341101);
      c = ff(c, d, a, b, s[i + 14] | 0, 17, -1502002290); b = ff(b, c, d, a, s[i + 15] | 0, 22, 1236535329);
      a = gg(a, b, c, d, s[i + 1] | 0, 5, -165796510); d = gg(d, a, b, c, s[i + 6] | 0, 9, -1069501632);
      c = gg(c, d, a, b, s[i + 11] | 0, 14, 643717713); b = gg(b, c, d, a, s[i] | 0, 20, -373897302);
      a = gg(a, b, c, d, s[i + 5] | 0, 5, -701558691); d = gg(d, a, b, c, s[i + 10] | 0, 9, 38016083);
      c = gg(c, d, a, b, s[i + 15] | 0, 14, -660478335); b = gg(b, c, d, a, s[i + 4] | 0, 20, -405537848);
      a = gg(a, b, c, d, s[i + 9] | 0, 5, 568446438); d = gg(d, a, b, c, s[i + 14] | 0, 9, -1019803690);
      c = gg(c, d, a, b, s[i + 3] | 0, 14, -187363961); b = gg(b, c, d, a, s[i + 8] | 0, 20, 1163531501);
      a = gg(a, b, c, d, s[i + 13] | 0, 5, -1444681467); d = gg(d, a, b, c, s[i + 2] | 0, 9, -51403784);
      c = gg(c, d, a, b, s[i + 7] | 0, 14, 1735328473); b = gg(b, c, d, a, s[i + 12] | 0, 20, -1926607734);
      a = hh(a, b, c, d, s[i + 5] | 0, 4, -378558); d = hh(d, a, b, c, s[i + 8] | 0, 11, -2022574463);
      c = hh(c, d, a, b, s[i + 11] | 0, 16, 1839030562); b = hh(b, c, d, a, s[i + 14] | 0, 23, -35309556);
      a = hh(a, b, c, d, s[i + 1] | 0, 4, -1530992060); d = hh(d, a, b, c, s[i + 4] | 0, 11, 1272893353);
      c = hh(c, d, a, b, s[i + 7] | 0, 16, -155497632); b = hh(b, c, d, a, s[i + 10] | 0, 23, -1094730640);
      a = hh(a, b, c, d, s[i + 13] | 0, 4, 681279174); d = hh(d, a, b, c, s[i] | 0, 11, -358537222);
      c = hh(c, d, a, b, s[i + 3] | 0, 16, -722521979); b = hh(b, c, d, a, s[i + 6] | 0, 23, 76029189);
      a = hh(a, b, c, d, s[i + 9] | 0, 4, -640364487); d = hh(d, a, b, c, s[i + 12] | 0, 11, -421815835);
      c = hh(c, d, a, b, s[i + 15] | 0, 16, 530742520); b = hh(b, c, d, a, s[i + 2] | 0, 23, -995338651);
      a = ii(a, b, c, d, s[i] | 0, 6, -198630844); d = ii(d, a, b, c, s[i + 7] | 0, 10, 1126891415);
      c = ii(c, d, a, b, s[i + 14] | 0, 15, -1416354905); b = ii(b, c, d, a, s[i + 5] | 0, 21, -57434055);
      a = ii(a, b, c, d, s[i + 12] | 0, 6, 1700485571); d = ii(d, a, b, c, s[i + 3] | 0, 10, -1894986606);
      c = ii(c, d, a, b, s[i + 10] | 0, 15, -1051523); b = ii(b, c, d, a, s[i + 1] | 0, 21, -2054922799);
      a = ii(a, b, c, d, s[i + 8] | 0, 6, 1873313359); d = ii(d, a, b, c, s[i + 15] | 0, 10, -30611744);
      c = ii(c, d, a, b, s[i + 6] | 0, 15, -1560198380); b = ii(b, c, d, a, s[i + 13] | 0, 21, 1309151649);
      a = ii(a, b, c, d, s[i + 4] | 0, 6, -145523070); d = ii(d, a, b, c, s[i + 11] | 0, 10, -1120210379);
      c = ii(c, d, a, b, s[i + 2] | 0, 15, 718787259); b = ii(b, c, d, a, s[i + 9] | 0, 21, -343485551);
      a = ad(a, oa); b = ad(b, ob); c = ad(c, oc); d = ad(d, od);
    }
    let o = '';
    [a, b, c, d].forEach((n) => {
      for (let j = 0; j < 4; j++) o += ((n >> (j * 8 + 4)) & 0x0f).toString(16) + ((n >> (j * 8)) & 0x0f).toString(16);
    });
    return o;
  }

  const getToken = () => {
    try { return JSON.parse(localStorage.getItem('auth') || '{}').token || ''; }
    catch (e) { return ''; }
  };

  const signHeaders = () => {
    const ts = Math.floor(Date.now() / 1000);
    return {
      Authorization: 'Bearer ' + getToken(),
      'Xdomain-Client': 'web_user',
      'xclient-version': 'v1',
      'xclient-timestamp': String(ts),
      'xclient-signature': md5(XCLIENT_KEY + '_v1_' + ts),
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*'
    };
  };

  /* ---------- 响应改写 ---------- */
  function patchPerm(body) {
    if (body && body.data && typeof body.data === 'object' && 'allowed' in body.data) {
      body.data.allowed = true;
      delete body.data.type;
      delete body.data.message;
    }
    return body;
  }

  /*
   * 关键：把页面调用的 v2 受限接口，替换成 v1 全量接口的数据。
   * 页面自己的列表渲染逻辑（缩略图/时长/章节/点击播放）原样复用，
   * 因此无权限课程页的表现与有权限课程页完全一致。
   */
  const RESPONSE_REWRITES = [
    {
      test: (u) => u.indexOf('/v2/course/session/list') > -1,
      build: (u) => {
        const m = u.match(/course_id=(\d+)/);
        if (!m) return null;
        // 页面有两种调用方式：
        //   with_page=true  → 期望 data 是分页对象 {data:[], total, ...}
        //   无 with_page    → 期望 data 直接是数组
        const withPage = /[?&]with_page=true/.test(u);
        return {
          url: API + '/v1/course/session/list?course_id=' + m[1],
          transform: withPage ? shapeSessionsPage : shapeSessionsArray
        };
      }
    },
    {
      test: (u) => u.indexOf('/v2/course/list') > -1,
      build: () => null // 课程列表 v2 不改写
    }
  ];

  /* v1 数组 → 分页结构（with_page=true 的调用方） */
  function shapeSessionsPage(v1Body) {
    const list = toArray(v1Body);
    return {
      code: 0,
      message: '',
      data: {
        current_page: 1,
        data: list,
        from: list.length ? 1 : 0,
        last_page: 1,
        per_page: list.length || 10,
        to: list.length,
        total: list.length
      }
    };
  }

  /* v1 数组 → 纯数组（无 with_page 的调用方，页面直接 .data.map） */
  function shapeSessionsArray(v1Body) {
    return { code: 0, message: '', data: toArray(v1Body) };
  }

  function toArray(v1Body) {
    const d = v1Body && v1Body.data;
    if (Array.isArray(d)) return d;
    if (d && Array.isArray(d.data)) return d.data;
    return [];
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!state.enabled) return origFetch.apply(this, arguments);

    /* 1) permission 强制放行 */
    if (url.indexOf('/v1/auth/permission') > -1) {
      return origFetch.apply(this, arguments).then((res) =>
        res.clone().json().then((j) => jsonResponse(patchPerm(j), res)).catch(() => res)
      );
    }

    /* 2) v2 受限接口 → v1 全量数据 */
    for (const rule of RESPONSE_REWRITES) {
      if (!rule.test(url)) continue;
      const plan = rule.build(url);
      if (!plan) break;
      return origFetch(plan.url, { headers: signHeaders(), credentials: 'omit' })
        .then((r) => r.json())
        .then((v1) => jsonResponse(plan.transform(v1), null))
        .catch(() => origFetch.apply(this, arguments));
    }

    return origFetch.apply(this, arguments);
  };

  function jsonResponse(obj, likeRes) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    return new Response(JSON.stringify(obj), {
      status: 200,
      statusText: 'OK',
      headers: headers
    });
  }

  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    let reqUrl = '';
    const o = xhr.open;
    xhr.open = function (m, u) { reqUrl = String(u); return o.apply(xhr, arguments); };

    xhr.addEventListener('readystatechange', () => {
      if (!state.enabled || xhr.readyState !== 4) return;

      // permission 放行
      if (reqUrl.indexOf('/v1/auth/permission') > -1) {
        try {
          const p = JSON.stringify(patchPerm(JSON.parse(xhr.responseText)));
          Object.defineProperty(xhr, 'responseText', { configurable: true, get: () => p });
          Object.defineProperty(xhr, 'response', { configurable: true, get: () => p });
        } catch (e) {}
        return;
      }

      // v2 → v1：同步 XHR 无法异步改写，这里只在已有缓存时替换
      const rule = RESPONSE_REWRITES.find((r) => r.test(reqUrl));
      if (!rule) return;
      try {
        const cur = JSON.parse(xhr.responseText);
        const list = cur && cur.data && cur.data.data;
        if (Array.isArray(list) && list.length) return; // 有数据就不动

        const m = reqUrl.match(/course_id=(\d+)/);
        if (!m) return;
        // 用同步 XHR 取 v1 数据（同域，页面上下文）
        const sx = new OrigXHR();
        sx.open('GET', API + '/v1/course/session/list?course_id=' + m[1], false);
        const h = signHeaders();
        for (const k in h) { try { sx.setRequestHeader(k, h[k]); } catch (e) {} }
        try { sx.setRequestHeader('Origin', location.origin); } catch (e) {}
        try { sx.setRequestHeader('Referer', location.origin + '/'); } catch (e) {}
        sx.send();
        if (sx.status !== 200) return;

        const v1 = JSON.parse(sx.responseText);
        const plan = rule.build(reqUrl);
        const patched = JSON.stringify(plan.transform(v1));
        Object.defineProperty(xhr, 'responseText', { configurable: true, get: () => patched });
        Object.defineProperty(xhr, 'response', { configurable: true, get: () => patched });
        log('xhr v2->v1 patched', reqUrl.slice(0, 60));
      } catch (e) {}
    });
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  /* ---------- 数据接口 ---------- */
  async function jsonGet(path) {
    const r = await origFetch(API + path, { headers: signHeaders(), credentials: 'omit' });
    return r.json();
  }

  state.sessions = async (courseId) => (await jsonGet('/v1/course/session/list?course_id=' + courseId)).data || [];
  state.videoToken = async (videoId) => (await jsonGet('/v1/auth/video/token?id=' + videoId)).data.token;
  state.videoUrl = async (videoId) => (await jsonGet('/v1/video?id=' + videoId)).data.main;

  state.buildUrl = (raw, vt) => {
    const ts = Math.floor(Date.now() / 1000);
    const q = '?Xvideo_Token=' + vt +
      '&Xclient_Timestamp=' + ts +
      '&Xclient_Signature=' + md5(XCLIENT_KEY + '_v1_' + ts) +
      '&Xclient_Version=v1&Platform=yhkt_user';
    const i = raw.lastIndexOf('/');
    return raw.substring(0, i) + '/' + PATH_SEG + raw.substring(i) + q;
  };

  /* ---------- 关键：构造可播放地址 ---------- */
  // 注意：在页面上下文（www.yanhekt.cn）中 fetch cvideo 时，浏览器会自动附带
  // Origin 与 Referer，CDN 校验通过。因此扩展只需组装正确 URL 交给 hls 播放。
  state.fetchBlob = async (url) => {
    const r = await origFetch(url, { credentials: 'omit' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.blob();
  };

  state.play = async ({ videoId }) => {
    const vt = await state.videoToken(videoId);
    const raw = await state.videoUrl(videoId);
    if (!vt || !raw) throw new Error('no token/url');
    const url = state.buildUrl(raw, vt);
    state.lastUrl = url;
    log('play', videoId, url.slice(0, 80));
    return { url };
  };

  /* ---------- 全屏播放器 ---------- */
  state.openPlayer = async (videoId, title) => {
    const { url } = await state.play({ videoId });

    let box = document.getElementById('__yhkt_player');
    if (box) box.remove();
    box = document.createElement('div');
    box.id = '__yhkt_player';
    box.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'background:rgba(0,0,0,.94)', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:12px'
    ].join(';');

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:10px;align-items:center;color:#dfe6f0;font:14px "Microsoft YaHei",sans-serif';
    const label = document.createElement('span');
    label.textContent = title || ('视频 ' + videoId);
    const btnClose = document.createElement('button');
    btnClose.textContent = '关闭';
    btnClose.style.cssText = 'padding:5px 14px;border-radius:6px;border:1px solid #3a4250;background:#232a35;color:#d7dde7;cursor:pointer';
    btnClose.onclick = () => box.remove();
    bar.appendChild(label);
    bar.appendChild(btnClose);

    const video = document.createElement('video');
    video.controls = true;
    video.autoplay = true;
    video.style.cssText = 'width:min(1200px,92vw);max-height:78vh;background:#000;border-radius:8px';

    const tip = document.createElement('div');
    tip.style.cssText = 'color:#8b95a5;font:12px "Microsoft YaHei",sans-serif;max-width:90vw;word-break:break-all';
    tip.textContent = '加载中…';

    box.appendChild(bar);
    box.appendChild(video);
    box.appendChild(tip);
    document.body.appendChild(box);

    // 加载 hls.js（页面自带优先，否则从 CDN 动态载入）
    const loadHls = () => new Promise((resolve) => {
      if (window.Hls && window.Hls.isSupported) return resolve(window.Hls);
      if (window.__yhkt_hlsLoading) {
        window.__yhkt_hlsLoading.then(() => resolve(window.Hls || null));
        return;
      }
      const urls = [
        'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js',
        'https://unpkg.com/hls.js@1.5.13/dist/hls.min.js'
      ];
      window.__yhkt_hlsLoading = (async () => {
        for (const u of urls) {
          try {
            const r = await origFetch(u, { credentials: 'omit' });
            if (!r.ok) continue;
            const code = await r.text();
            const s = document.createElement('script');
            s.textContent = code;
            document.head.appendChild(s);
            if (window.Hls) return window.Hls;
          } catch (e) {}
        }
        return null;
      })();
      window.__yhkt_hlsLoading.then((h) => resolve(h || null));
    });

    tip.textContent = '加载播放引擎…';
    const Hls = await loadHls();

    if (Hls && typeof Hls.isSupported === 'function' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        xhrSetup: (xhr) => { try { xhr.withCredentials = false; } catch (e) {} }
      });
      hls.on(Hls.Events.ERROR, (evt, data) => {
        if (data && data.fatal) {
          tip.textContent = 'HLS 错误：' + data.type + '/' + data.details;
          if (data.type === 'networkError') {
            tip.textContent += '（凭证可能过期，请重新点击播放）';
          }
        }
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        tip.textContent = 'hls.js 已就绪 · 开始播放';
        video.play().catch(() => {});
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      state._stop = () => { try { hls.destroy(); } catch (e) {} };
      return url;
    }

    // 兜底：MSE 直接塞 TS（部分内核可解）
    tip.textContent = 'hls.js 未加载成功，尝试 MSE 直塞…';
    const plRes = await origFetch(url, { credentials: 'omit' });
    if (!plRes.ok) { tip.textContent = '播放列表请求失败 HTTP ' + plRes.status; return url; }
    const text = await plRes.text();
    const dir = url.substring(0, url.lastIndexOf('/') + 1);
    const qs = url.substring(url.indexOf('?'));
    const segs = text.split('\n').map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => dir + l + (l.indexOf('?') > -1 ? '' : qs));
    if (!segs.length) { tip.textContent = '播放列表为空'; return url; }

    const MSE = window.MediaSource || window.WebKitMediaSource;
    if (!MSE) {
      video.src = url;
      tip.textContent = '浏览器不支持 MSE，已回退为直链（可能无法播放 HLS）';
      return url;
    }

    // 探测可用的 SourceBuffer 类型
    const MIMES = [
      'video/mp2t',
      'video/mp4; codecs="avc1.64001f,mp4a.40.2"',
      'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
      'video/mp4; codecs="avc1.42E01E"',
      'video/mp4'
    ];
    const usable = MIMES.filter((m) => { try { return MSE.isTypeSupported(m); } catch (e) { return false; } });

    const ms = new MSE();
    video.src = URL.createObjectURL(ms);
    let sb = null, idx = 0, playing = false, mimeIdx = 0;

    const tryCreateBuffer = () => {
      while (mimeIdx < usable.length) {
        try {
          return ms.addSourceBuffer(usable[mimeIdx]);
        } catch (e) {
          mimeIdx++;
        }
      }
      return null;
    };

    const appendNext = () => {
      if (idx >= segs.length) { tip.textContent = '播放完成 · 共 ' + segs.length + ' 段'; return; }
      tip.textContent = 'MSE 播放 · ' + (idx + 1) + '/' + segs.length + ' 段 · ' + url.slice(0, 60) + '…';
      origFetch(segs[idx], { credentials: 'omit' }).then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      }).then((ab) => {
        if (!sb) return;
        if (sb.updating) { setTimeout(appendNext, 60); return; }
        idx++;
        try {
          sb.appendBuffer(new Uint8Array(ab));
          if (!playing && idx >= 1) {
            playing = true;
            video.play().catch(() => {});
          }
        } catch (e) {
          tip.textContent = '分片写入失败：' + e.message;
        }
      }).catch((e) => {
        tip.textContent = '分片下载失败：' + e.message + '（第 ' + (idx + 1) + ' 段）';
      });
    };

    ms.addEventListener('sourceopen', () => {
      sb = tryCreateBuffer();
      if (!sb) {
        tip.textContent = '当前浏览器无可用 MSE 编码（已尝试：' + MIMES.join(' / ') + '）。请点「复制播放直链」用 PotPlayer / VLC 播放。';
        video.style.display = 'none';
        return;
      }
      tip.textContent = 'MSE 缓冲类型：' + usable[mimeIdx];
      sb.addEventListener('updateend', () => setTimeout(appendNext, 40));
      appendNext();
    });
    ms.addEventListener('error', () => { tip.textContent = 'MediaSource 错误'; });

    state._stop = () => {
      try { if (sb && sb.updating) sb.abort(); } catch (e) {}
      try { if (ms.readyState === 'open') ms.endOfStream(); } catch (e) {}
    };
    return url;
  };

  state.log = state.log;

  /* ---------- RPC 服务端：响应 hook.js 的调用 ---------- */
  // 所有请求都在页面上下文执行，Origin = https://www.yanhekt.cn，服务端正常放行
  const RPC = {
    ping: () => ({ ready: true }),

    // 课程列表（搜索 / 分页）
    courseList: (p) => {
      const page = p && p.page ? p.page : 1;
      const kw = p && p.keyword ? String(p.keyword).trim() : '';
      const q = kw
        ? '/v1/course/list?keyword=' + encodeURIComponent(kw) + '&page=' + page + '&page_size=20'
        : '/v1/course/list?page=' + page + '&page_size=20';
      return jsonGet(q).then((j) => ({
        total: (j.data && j.data.total) || 0,
        lastPage: (j.data && j.data.last_page) || 1,
        list: (j.data && j.data.data) || []
      }));
    },

    // 课程详情
    courseDetail: (p) => jsonGet('/v1/course?id=' + p.courseId).then((j) => j.data || {}),

    // 全部节次（v1 不过滤权限）
    sessions: (p) => state.sessions(p.courseId).then((arr) =>
      arr.map((s) => ({
        id: s.id,
        title: s.title,
        started_at: s.started_at,
        location: s.location,
        videoId: (s.video_ids && s.video_ids[0]) || null
      }))
    ),

    // 播放
    play: (p) => state.openPlayer(p.videoId, p.title || ''),

    // 生成直链
    directUrl: async (p) => {
      const vt = await state.videoToken(p.videoId);
      const raw = await state.videoUrl(p.videoId);
      if (!vt || !raw) throw new Error('无法获取凭证或地址');
      return state.buildUrl(raw, vt);
    },

    // 是否已登录
    authState: () => ({ token: !!getToken() })
  };

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.__yhkt_req !== true) return;
    const fn = RPC[d.method];
    if (!fn) {
      window.postMessage({ __yhkt_res: true, id: d.id, error: '未知方法：' + d.method }, '*');
      return;
    }
    Promise.resolve()
      .then(() => fn(d.args || {}))
      .then((result) => window.postMessage({ __yhkt_res: true, id: d.id, result }, '*'))
      .catch((e) => window.postMessage({ __yhkt_res: true, id: d.id, error: String((e && e.message) || e) }, '*'));
  });

  window.__yhkt = state;
  log('installed');
})();
