/*
 * inject.js — MAIN world
 * 1) 强制 permission.allowed = true
 * 2) 提供 __yhkt.sessions(courseId) —— 读取节次目录
 */
(function () {
  if (window.__yhktInstalled) return;
  window.__yhktInstalled = true;

  const state = { enabled: true, log: [] };
  const XCLIENT_KEY = '1138b69dfef641d9d7ba49137d2d4875';
  const API = 'https://cbiz.yanhekt.cn';

  const log = (...a) => {
    state.log.push({ t: Date.now(), msg: a.join(' ') });
    if (state.log.length > 300) state.log.shift();
  };

  function requireEnabled() {
    if (!state.enabled) throw new Error('扩展已关闭，请先启用');
  }


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
    if (body && (body.code === 0 || body.code === '0') && body.data && typeof body.data === 'object' && 'allowed' in body.data) {
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
    assertApiBody(v1Body);
    const d = v1Body && v1Body.data;
    if (Array.isArray(d)) return d;
    if (d && Array.isArray(d.data)) return d.data;
    throw new Error('节次列表格式异常');
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!state.enabled) return origFetch.apply(this, arguments);

    /* 1) permission 强制放行 */
    if (url.indexOf('/v1/auth/permission') > -1) {
      return origFetch.apply(this, arguments).then((res) => {
        if (!res.ok) return res;
        return res.clone().json().then((j) => jsonResponse(patchPerm(j), res)).catch(() => res);
      });
    }

    /* 2) v2 受限接口 → v1 全量数据 */
    for (const rule of RESPONSE_REWRITES) {
      if (!rule.test(url)) continue;
      const plan = rule.build(url);
      if (!plan) break;
      return origFetch(plan.url, { headers: signHeaders(), credentials: 'omit' })
        .then((r) => {
          if (!r.ok) throw new Error('接口请求失败 HTTP ' + r.status);
          return r.json();
        })
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
      if (!state.enabled || xhr.readyState !== 4 || xhr.status < 200 || xhr.status >= 300) return;

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
  function assertApiBody(body) {
    if (!body || (body.code !== 0 && body.code !== '0')) {
      throw new Error((body && body.message) || '接口返回异常');
    }
    return body;
  }

  async function jsonGet(path) {
    requireEnabled();
    const r = await origFetch(API + path, { headers: signHeaders(), credentials: 'omit' });
    if (!r.ok) throw new Error('接口请求失败 HTTP ' + r.status);
    return assertApiBody(await r.json());
  }

  state.sessions = async (courseId) => toArray(await jsonGet('/v1/course/session/list?course_id=' + courseId));

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
        location: s.location
      }))
    ),

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
      .then(() => {
        if (d.method !== 'ping' && d.method !== 'authState') requireEnabled();
        return fn(d.args || {});
      })
      .then((result) => window.postMessage({ __yhkt_res: true, id: d.id, result }, '*'))
      .catch((e) => window.postMessage({ __yhkt_res: true, id: d.id, error: String((e && e.message) || e) }, '*'));
  });

  window.__yhkt = state;
  log('installed');
})();
