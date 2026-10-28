// dsh-auth — host half (Node). Only node builtins; loaded by the dsh cordis loader.
//
// Routes (registered on dsh's webServer):
//   exact  /  and /index.html   gate: plugin session -> (forced change) -> dsh cookie mint -> index
//   prefix /_auth               login / logout / account pages and the JSON API used by the
//                               Settings > 登录与安全 section
//   waterfall connection/request refuses /api HTTP without a valid plugin session
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const name = 'dsh-auth'
export const inject = ['webServer', 'connection']

const SESSION_COOKIE = 'dsh_session'
const DSH_COOKIE_PREFIX = 'dsh-auth-'
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEYLEN = 32

const DEFAULTS = {
  stateDir: '/var/lib/dsh-auth',
  sessionDays: 7,
  forcePasswordChange: true,
  defaultUsername: 'admin',
  defaultPassword: '123456',
  minPasswordLength: 8,
  lockoutMax: 10,
  lockoutMinutes: 15,
  trustForwardedFor: true,
  logoutLink: true,
  restart: true,
  restartUnit: undefined,
  restartCommand: undefined,
  distIndex: undefined,
}

// ---------------------------------------------------------------- crypto
export function hashPassword(password, salt = randomBytes(16)) {
  const hash = scryptSync(String(password).normalize('NFKC'), salt, KEYLEN, SCRYPT)
  return { alg: 'scrypt', N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, salt: salt.toString('base64'), hash: hash.toString('base64') }
}
function verifyPassword(account, password) {
  if (!account || typeof password !== 'string') return false
  try {
    const salt = Buffer.from(account.salt, 'base64')
    const expected = Buffer.from(account.hash, 'base64')
    const actual = scryptSync(password.normalize('NFKC'), salt, expected.length, { N: account.N, r: account.r, p: account.p, maxmem: SCRYPT.maxmem })
    return timingSafeEqual(actual, expected)
  } catch { return false }
}
const b64u = (buf) => Buffer.from(buf).toString('base64url')
function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

// ---------------------------------------------------------------- state
export function defaultAccount(cfg) {
  return {
    version: 1,
    username: cfg.defaultUsername,
    ...hashPassword(cfg.defaultPassword),
    mustChange: true,
    secret: b64u(randomBytes(32)),
    updatedAt: new Date().toISOString(),
  }
}
function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 })
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, file)
}
class Store {
  constructor(cfg) {
    this.cfg = cfg
    this.dir = cfg.stateDir
    this.accountFile = path.join(this.dir, 'account.json')
    this.sessionsFile = path.join(this.dir, 'sessions.json')
    this.cache = new Map()
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 })
    fs.chmodSync(this.dir, 0o700)
    if (!fs.existsSync(this.accountFile)) writeJson(this.accountFile, defaultAccount(cfg))
    if (!fs.existsSync(this.sessionsFile)) writeJson(this.sessionsFile, {})
    for (const f of [this.accountFile, this.sessionsFile]) fs.chmodSync(f, 0o600)
  }
  // Re-read when the file changes on disk, so `dsh-auth-reset` applies without a restart.
  read(file, fallback) {
    let st
    try { st = fs.statSync(file) } catch { return fallback() }
    const key = `${st.mtimeMs}:${st.size}:${st.ino}`
    const hit = this.cache.get(file)
    if (hit && hit.key === key) return hit.value
    let value
    try { value = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { value = fallback() }
    this.cache.set(file, { key, value })
    return value
  }
  write(file, value) { writeJson(file, value); this.cache.delete(file) }
  account() {
    return this.read(this.accountFile, () => { const a = defaultAccount(this.cfg); this.write(this.accountFile, a); return a })
  }
  saveAccount(a) { this.write(this.accountFile, a) }
  sessions() {
    const all = this.read(this.sessionsFile, () => ({}))
    const now = Date.now()
    let dirty = false
    for (const [sid, s] of Object.entries(all)) if (!s || s.e <= now) { delete all[sid]; dirty = true }
    if (dirty) this.write(this.sessionsFile, all)
    return all
  }
  saveSessions(s) { this.write(this.sessionsFile, s) }
}

// ---------------------------------------------------------------- http helpers
function parseCookies(req) {
  const out = {}
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
  }
  return out
}
function isLoopback(addr) {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1' || /^127\./.test(addr || '') || /^::ffff:127\./.test(addr || '')
}
function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = []
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('body too large')); req.destroy() } else chunks.push(c) })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
function send(res, status, body, headers = {}) {
  if (res.headersSent) return
  res.writeHead(status, { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers })
  res.end(body)
}
function json(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), { 'content-type': 'application/json; charset=utf-8', ...headers })
}
function redirect(res, location, cookies = [], status = 302) {
  send(res, status, '', { location, ...(cookies.length ? { 'set-cookie': cookies } : {}) })
}
function safeNext(value) {
  const v = String(value || '/')
  return /^\/(?![/\\])[^\s]*$/.test(v) && !v.startsWith('/_auth') ? v : '/'
}

// ---------------------------------------------------------------- pages
const CSS = `*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#0f1115;color:#e5e7eb}
.card{width:min(380px,92vw);background:#181b22;border:1px solid #2a2f3a;border-radius:14px;padding:30px 28px;box-shadow:0 10px 40px rgba(0,0,0,.35)}
h1{font-size:20px;margin:0 0 6px;font-weight:600}.sub{color:#9ca3af;font-size:13px;margin:0 0 22px}
label{display:block;font-size:13px;color:#9ca3af;margin:14px 0 6px}
input{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #2f3542;background:#0f1115;color:#e5e7eb;font-size:14px;outline:none}
input:focus{border-color:#4d6bfe}button{margin-top:22px;width:100%;padding:11px;border:0;border-radius:8px;background:#4d6bfe;color:#fff;font-size:15px;cursor:pointer}
button:hover{background:#3d5bee}.err{background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.35);color:#fca5a5;padding:9px 12px;border-radius:8px;font-size:13px;margin-bottom:6px}
.ok{background:rgba(22,163,74,.12);border:1px solid rgba(22,163,74,.35);color:#86efac;padding:9px 12px;border-radius:8px;font-size:13px;margin-bottom:6px}
.warn{background:rgba(234,179,8,.12);border:1px solid rgba(234,179,8,.35);color:#fde68a;padding:9px 12px;border-radius:8px;font-size:13px;margin-bottom:6px}
.links{margin-top:16px;font-size:13px;text-align:center}.links a{color:#9ca3af}.hint{font-size:12px;color:#6b7280;margin-top:6px}`
function page(title, inner) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title><link rel="icon" href="/favicon.svg"><style>${CSS}</style></head>
<body><div class="card">${inner}</div></body></html>`
}
const HTML = { 'content-type': 'text/html; charset=utf-8', 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'" }

function loginPage({ error, notice, next, username }) {
  return page('DeepSeek Harness 登录', `<h1>DeepSeek Harness 登录</h1><p class="sub">请输入用户名和密码以继续</p>
${error ? `<div class="err">${esc(error)}</div>` : ''}${notice ? `<div class="ok">${esc(notice)}</div>` : ''}
<form method="post" action="/_auth/login" autocomplete="on">
<input type="hidden" name="next" value="${esc(next)}">
<label for="u">用户名</label><input id="u" name="username" autocomplete="username" required autofocus value="${esc(username || '')}">
<label for="p">密码</label><input id="p" name="password" type="password" autocomplete="current-password" required>
<button type="submit">登录</button></form>`)
}
function accountPage({ username, force, error, notice, csrf, minLen }) {
  return page('账户与安全 · DeepSeek Harness', `<h1>${force ? '请修改默认密码' : '账户与安全'}</h1>
<p class="sub">当前用户：${esc(username)}</p>
${force ? '<div class="warn">当前账户仍在使用默认密码。修改密码后才能使用 DeepSeek Harness。</div>' : ''}
${error ? `<div class="err">${esc(error)}</div>` : ''}${notice ? `<div class="ok">${esc(notice)}</div>` : ''}
<form method="post" action="/_auth/account" autocomplete="off">
<input type="hidden" name="csrf" value="${esc(csrf)}">
<label for="c">当前密码</label><input id="c" name="currentPassword" type="password" autocomplete="current-password" required autofocus>
<label for="u">新用户名（留空则不变）</label><input id="u" name="username" autocomplete="username" value="${esc(username)}">
<label for="n">新密码${force ? '' : '（留空则不变）'}</label><input id="n" name="newPassword" type="password" autocomplete="new-password" ${force ? 'required' : ''} minlength="${minLen}">
<label for="n2">确认新密码</label><input id="n2" name="confirmPassword" type="password" autocomplete="new-password" ${force ? 'required' : ''}>
<p class="hint">至少 ${minLen} 个字符，不能使用默认密码。修改后其他设备上的登录会话将全部失效。</p>
<button type="submit">保存</button></form>
<div class="links">${force ? '' : '<a href="/">返回 DeepSeek Harness</a> · '}<a href="/_auth/logout">退出登录</a></div>`)
}
const LOGOUT_LINK = `<style>#dsh-logout{position:fixed;bottom:12px;right:14px;z-index:2147483000;font:12px/1.4 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#6b7280;background:rgba(255,255,255,.85);border:1px solid rgba(0,0,0,.12);border-radius:6px;padding:3px 9px;text-decoration:none;opacity:.75;transition:opacity .15s}#dsh-logout:hover{opacity:1;color:#dc2626;border-color:rgba(220,38,38,.4)}@media(prefers-color-scheme:dark){#dsh-logout{color:#9ca3af;background:rgba(21,21,23,.85);border-color:rgba(255,255,255,.15)}}</style><a id="dsh-logout" href="/_auth/logout" title="退出 DeepSeek Harness 登录">退出登录</a>`

// ---------------------------------------------------------------- restart
// The systemd unit this process runs in, from /proc/self/cgroup (e.g. dsh-web.service).
function detectUnit() {
  try {
    for (const line of fs.readFileSync('/proc/self/cgroup', 'utf8').split('\n')) {
      const m = /\/([^/]+\.service)(?:\/|$)/.exec(line.split(':').slice(2).join(':'))
      if (m) return m[1]
    }
  } catch {}
  return undefined
}

// ---------------------------------------------------------------- plugin
function resolveDistIndex(cfg) {
  if (cfg.distIndex) return cfg.distIndex
  const tries = []
  try { tries.push(createRequire(fs.realpathSync(process.argv[1]))) } catch {}
  tries.push(createRequire('/usr/lib/node_modules/@deepseek-ai/dsh/package.json'))
  for (const req of tries) {
    try { return path.join(path.dirname(req.resolve('@deepseek-ai/dsh-web-frontend/package.json')), 'dist', 'index.html') } catch {}
  }
  return '/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html'
}

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...Object.fromEntries(Object.entries(config || {}).filter(([, v]) => v !== undefined && v !== null)) }
  cfg.sessionDays = Number(cfg.sessionDays) > 0 ? Number(cfg.sessionDays) : 7
  const store = new Store(cfg)
  const sessionMs = cfg.sessionDays * 86400_000
  const distIndex = resolveDistIndex(cfg)
  const failures = new Map() // ip -> { n, first }
  const instance = b64u(randomBytes(9)) // changes on every start; the client polls for a new one
  const startedAt = Date.now()
  let restarting = false
  const log = (...a) => { try { console.error('[dsh-auth]', ...a) } catch {} }

  const clientIp = (req) => {
    const sock = req.socket?.remoteAddress || ''
    if (cfg.trustForwardedFor && isLoopback(sock)) {
      const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean)
      if (xff.length) return xff[xff.length - 1]
    }
    return sock
  }
  const isSecure = (req) => ctx.webServer.protocol === 'https:' ||
    (isLoopback(req.socket?.remoteAddress) && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https')
  const lockedFor = (ip) => {
    const f = failures.get(ip); const win = cfg.lockoutMinutes * 60_000
    if (!f) return 0
    if (Date.now() - f.first > win) { failures.delete(ip); return 0 }
    return f.n >= cfg.lockoutMax ? Math.ceil((f.first + win - Date.now()) / 60_000) : 0
  }
  const fail = (ip) => {
    const f = failures.get(ip); const win = cfg.lockoutMinutes * 60_000
    if (!f || Date.now() - f.first > win) failures.set(ip, { n: 1, first: Date.now() })
    else f.n++
    if (failures.size > 10000) for (const [k, v] of failures) if (Date.now() - v.first > win) failures.delete(k)
  }

  const logRestart = (msg) => {
    log(msg)
    try { fs.appendFileSync(path.join(cfg.stateDir, 'restart.log'), `${new Date().toISOString()} ${msg}\n`, { mode: 0o600 }) } catch {}
  }
  const forced = (account) => cfg.forcePasswordChange && account.mustChange
  const sign = (secret, body) => createHmac('sha256', secret).update(body).digest('base64url')
  const sessionCookie = (req, value, maxAge) =>
    `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${isSecure(req) ? '; Secure' : ''}`

  function getSession(req) {
    const raw = parseCookies(req)[SESSION_COOKIE]
    if (!raw) return undefined
    const dot = raw.lastIndexOf('.')
    if (dot < 1) return undefined
    const account = store.account()
    const body = raw.slice(0, dot)
    if (!safeEqual(raw.slice(dot + 1), sign(account.secret, body))) return undefined
    let p; try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) } catch { return undefined }
    if (!p || typeof p.s !== 'string' || p.e <= Date.now() || p.u !== account.username) return undefined
    const rec = store.sessions()[p.s]
    if (!rec || rec.e <= Date.now() || rec.u !== account.username) return undefined
    return { sid: p.s, exp: rec.e, account }
  }
  function createSession(req, account) {
    const sid = b64u(randomBytes(24)); const e = Date.now() + sessionMs
    const all = store.sessions(); all[sid] = { u: account.username, e, ip: clientIp(req), c: Date.now() }
    store.saveSessions(all)
    const body = b64u(JSON.stringify({ u: account.username, s: sid, e }))
    return sessionCookie(req, `${body}.${sign(account.secret, body)}`, Math.floor(sessionMs / 1000))
  }
  function dropSession(sid) { const all = store.sessions(); if (sid in all) { delete all[sid]; store.saveSessions(all) } }
  const csrfFor = (sess) => sign(sess.account.secret, `csrf:${sess.sid}`)
  function clearCookies(req) {
    const out = [sessionCookie(req, '', 0)]
    for (const k of Object.keys(parseCookies(req))) if (k.startsWith(DSH_COOKIE_PREFIX)) out.push(`${k}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${isSecure(req) ? '; Secure' : ''}`)
    return out
  }
  // Same-origin check for state-changing requests (browsers always send Origin on POST).
  function sameOrigin(req) {
    const origin = req.headers.origin
    if (!origin) return !req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin'
    try { return new URL(origin).host === req.headers.host } catch { return false }
  }

  // Mint dsh's own browser cookie server-side: run authorizeIndex on a synthetic launch-token
  // request and capture its Set-Cookie. The launch token never leaves this process.
  function mintDshCookies(req) {
    try {
      const u = new URL(ctx.connection.authenticatedUrl('http://127.0.0.1/'))
      const fake = { method: 'GET', url: `/${u.search}`, headers: { host: req.headers.host, accept: 'text/html' }, socket: req.socket }
      let captured = []
      const shim = {
        headersSent: false, statusCode: 200,
        setHeader(k, v) { if (String(k).toLowerCase() === 'set-cookie') captured = captured.concat(v) },
        getHeader() {}, removeHeader() {},
        writeHead(_s, a, b) {
          const h = (typeof a === 'object' && a) || b || {}
          for (const [k, v] of Object.entries(h)) if (k.toLowerCase() === 'set-cookie') captured = captured.concat(v)
          this.headersSent = true; return this
        },
        write() { return true }, end() { this.headersSent = true; return this },
      }
      ctx.connection.authorizeIndex(fake, shim)
      return captured.map(String).filter((c) => c.startsWith(DSH_COOKIE_PREFIX)).map((c) => (isSecure(req) && !/;\s*secure/i.test(c) ? `${c}; Secure` : c))
    } catch (e) { log('mint failed', e?.message); return [] }
  }

  async function serveIndex(req, res) {
    const html = ctx.webServer.renderIndex(await fs.promises.readFile(distIndex, 'utf8'))
      .replace(/<head(?:\s[^>]*)?>/i, (open) => `${open}<base href="./">`)
    send(res, 200, req.method === 'HEAD' ? '' : html, { 'content-type': 'text/html; charset=utf-8' })
  }

  async function gate(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { allow: 'GET, HEAD' })
    if (ctx.connection.isTrusted && !ctx.connection.isTrusted(req)) return send(res, 403, 'Forbidden')
    const sess = getSession(req)
    if (!sess) return redirect(res, '/_auth/login')
    if (forced(sess.account)) return redirect(res, '/_auth/account?force=1')
    const admission = ctx.connection.admit(req)
    if ('rejection' in admission) {
      if (admission.rejection === 403) return send(res, 403, 'Forbidden')
      const cookies = mintDshCookies(req)
      if (!cookies.length) return send(res, 500, 'dsh-auth: could not establish the dsh browser session')
      return redirect(res, '/', cookies, 303)
    }
    return serveIndex(req, res)
  }

  function changeAccount(req, sess, body) {
    const ip = clientIp(req)
    const mins = lockedFor(ip)
    if (mins) return { status: 429, error: `尝试次数过多，请 ${mins} 分钟后再试` }
    const account = sess.account
    if (!verifyPassword(account, String(body.currentPassword || ''))) { fail(ip); return { status: 403, error: '当前密码不正确' } }
    const username = String(body.username ?? '').trim() || account.username
    const newPassword = String(body.newPassword || '')
    const confirm = body.confirmPassword === undefined ? newPassword : String(body.confirmPassword)
    if (!/^[\p{L}\p{N}_.@-]{1,64}$/u.test(username)) return { status: 400, error: '用户名只能包含字母、数字以及 _ . @ -，长度 1–64' }
    if (forced(account) && !newPassword) return { status: 400, error: '请设置新密码' }
    if (!newPassword && username === account.username) return { status: 400, error: '没有需要保存的修改' }
    if (newPassword) {
      if (newPassword !== confirm) return { status: 400, error: '两次输入的新密码不一致' }
      if (newPassword === String(cfg.defaultPassword) || newPassword === '123456') return { status: 400, error: '不能使用默认密码' }
      if ([...newPassword].length < cfg.minPasswordLength) return { status: 400, error: `新密码至少需要 ${cfg.minPasswordLength} 个字符` }
      if (verifyPassword(account, newPassword)) return { status: 400, error: '新密码不能与当前密码相同' }
    }
    failures.delete(ip)
    const next = { ...account, username, updatedAt: new Date().toISOString() }
    if (newPassword) Object.assign(next, hashPassword(newPassword), { mustChange: false })
    store.saveAccount(next)
    // Revoke every other session; keep (and re-sign for a new username) the current one.
    const all = store.sessions(); const mine = all[sess.sid]
    const kept = {}
    if (mine) kept[sess.sid] = { ...mine, u: username }
    store.saveSessions(kept)
    const revoked = Object.keys(all).length - (mine ? 1 : 0)
    const bodyTok = b64u(JSON.stringify({ u: username, s: sess.sid, e: mine?.e ?? Date.now() + sessionMs }))
    const cookie = sessionCookie(req, `${bodyTok}.${sign(next.secret, bodyTok)}`, Math.max(0, Math.floor(((mine?.e ?? Date.now() + sessionMs) - Date.now()) / 1000)))
    log(`account updated (username changed: ${username !== account.username}, password changed: ${!!newPassword}, revoked ${revoked} session(s))`)
    return { status: 200, cookie, revoked, username, passwordChanged: !!newPassword }
  }

  async function authRoute(req, res) {
    const url = new URL(req.url || '/', 'http://x')
    const p = url.pathname.replace(/\/+$/, '') || '/'
    const method = req.method || 'GET'
    try {
      if (p === '/_auth/login') {
        const next = safeNext(url.searchParams.get('next'))
        if (method === 'GET' || method === 'HEAD') {
          const sess = getSession(req)
          if (sess) return redirect(res, forced(sess.account) ? '/_auth/account?force=1' : next)
          return send(res, 200, loginPage({ next, notice: url.searchParams.has('out') ? '已退出登录' : url.searchParams.has('changed') ? '账户已更新，请重新登录' : '' }), HTML)
        }
        if (method !== 'POST') return send(res, 405, 'Method Not Allowed')
        if (!sameOrigin(req)) return send(res, 403, 'Forbidden')
        const form = new URLSearchParams(await readBody(req))
        const ip = clientIp(req); const fnext = safeNext(form.get('next'))
        const mins = lockedFor(ip)
        if (mins) return send(res, 429, loginPage({ next: fnext, error: `登录失败次数过多，请 ${mins} 分钟后再试` }), { ...HTML, 'retry-after': String(mins * 60) })
        const account = store.account()
        const u = String(form.get('username') || '').trim(); const pw = String(form.get('password') || '')
        const ok = verifyPassword(account, pw) && safeEqual(u, account.username)
        if (!ok) { fail(ip); log(`login failed from ${ip}`); return send(res, 401, loginPage({ next: fnext, username: u, error: '用户名或密码错误' }), HTML) }
        failures.delete(ip)
        log(`login ok from ${ip}`)
        const cookies = [createSession(req, account), ...mintDshCookies(req)]
        return redirect(res, forced(account) ? '/_auth/account?force=1' : fnext, cookies, 303)
      }
      if (p === '/_auth/logout' || p === '/_auth/api/logout') {
        if (method === 'POST' && !sameOrigin(req)) return send(res, 403, 'Forbidden')
        const sess = getSession(req)
        if (sess) dropSession(sess.sid)
        const headers = { 'set-cookie': clearCookies(req), 'clear-site-data': '"cookies"' }
        if (p === '/_auth/api/logout') return json(res, 200, { ok: true }, headers)
        return send(res, 302, '', { ...headers, location: '/_auth/login?out=1' })
      }
      if (p === '/_auth/account') {
        const sess = getSession(req)
        if (!sess) return redirect(res, '/_auth/login')
        const force = forced(sess.account)
        const view = (extra, status = 200) => send(res, status, accountPage({ username: sess.account.username, force, csrf: csrfFor(sess), minLen: cfg.minPasswordLength, ...extra }), HTML)
        if (method === 'GET' || method === 'HEAD') return view({})
        if (method !== 'POST') return send(res, 405, 'Method Not Allowed')
        const form = Object.fromEntries(new URLSearchParams(await readBody(req)))
        if (!sameOrigin(req) || !safeEqual(form.csrf || '', csrfFor(sess))) return send(res, 403, 'Forbidden')
        const r = changeAccount(req, sess, form)
        if (r.status !== 200) return view({ error: r.error }, r.status)
        return redirect(res, '/', [r.cookie], 303)
      }
      if (p === '/_auth/health') {
        return json(res, 200, { ok: true, instance, startedAt })
      }
      if (p === '/_auth/api/restart') {
        if (method !== 'POST') return send(res, 405, 'Method Not Allowed')
        if (!sameOrigin(req) || !String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 403, { error: 'forbidden' })
        const sess = getSession(req)
        if (!sess) return json(res, 401, { error: 'unauthenticated' })
        if (forced(sess.account)) return json(res, 403, { error: 'password-change-required' })
        if (!cfg.restart) return json(res, 403, { error: '重启功能已在配置中关闭' })
        const unit = cfg.restartUnit || detectUnit()
        const command = Array.isArray(cfg.restartCommand) && cfg.restartCommand.length
          ? cfg.restartCommand.map(String)
          : unit ? ['systemctl', 'restart', '--no-block', unit] : undefined
        if (!command) return json(res, 501, { error: '未检测到 systemd 服务，无法从网页重启' })
        if (restarting) return json(res, 202, { ok: true, instance, unit, already: true })
        restarting = true
        logRestart(`restart requested by ${sess.account.username} from ${clientIp(req)} -> ${command.join(' ')}`)
        // Answer first; run the restart only after the response is flushed.
        res.once('finish', () => setTimeout(() => {
          try {
            const child = spawn(command[0], command.slice(1), { detached: true, stdio: 'ignore' })
            child.on('error', (e) => { restarting = false; logRestart(`restart command failed: ${e.message}`) })
            child.on('exit', (code) => { if (code) { restarting = false; logRestart(`restart command exited with ${code}`) } })
            child.unref()
          } catch (e) { restarting = false; logRestart(`restart spawn failed: ${e.message}`) }
        }, 300))
        return json(res, 202, { ok: true, instance, unit })
      }
      if (p === '/_auth/api/me') {
        const sess = getSession(req)
        if (!sess) return json(res, 401, { error: 'unauthenticated' })
        return json(res, 200, { username: sess.account.username, mustChange: !!sess.account.mustChange, forcePasswordChange: !!cfg.forcePasswordChange, sessionExpiresAt: sess.exp, minPasswordLength: cfg.minPasswordLength, canRestart: !!cfg.restart, instance, otherSessions: Math.max(0, Object.keys(store.sessions()).length - 1) })
      }
      if (p === '/_auth/api/account') {
        if (method !== 'POST') return send(res, 405, 'Method Not Allowed')
        if (!sameOrigin(req) || !String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 403, { error: 'forbidden' })
        const sess = getSession(req)
        if (!sess) return json(res, 401, { error: 'unauthenticated' })
        let body; try { body = JSON.parse(await readBody(req)) } catch { return json(res, 400, { error: '请求格式错误' }) }
        const r = changeAccount(req, sess, body || {})
        if (r.status !== 200) return json(res, r.status, { error: r.error })
        return json(res, 200, { ok: true, username: r.username, passwordChanged: r.passwordChanged, revokedSessions: r.revoked }, { 'set-cookie': [r.cookie] })
      }
      return send(res, 404, 'Not Found')
    } catch (e) {
      log('error', e?.stack || e)
      return send(res, 500, 'Internal Server Error')
    }
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/', handler: gate }), 'dsh-auth: / gate')
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/index.html', handler: gate }), 'dsh-auth: /index.html gate')
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/_auth', handler: authRoute }), 'dsh-auth: /_auth routes')
  if (cfg.logoutLink) ctx.effect(() => ctx.webServer.tapIndex((html) => html.replace(/<\/body>/i, `${LOGOUT_LINK}</body>`)), 'dsh-auth: logout link')

  ctx.on('connection/request', async (req, res, next) => {
    const sess = getSession(req)
    if (!sess) return json(res, 401, { error: 'unauthenticated', login: '/_auth/login' })
    if (forced(sess.account)) return json(res, 403, { error: 'password-change-required', account: '/_auth/account?force=1' })
    return next()
  })
  if (fs.existsSync(path.join(cfg.stateDir, 'restart.log'))) try { fs.chmodSync(path.join(cfg.stateDir, 'restart.log'), 0o600) } catch {}
  log(`ready (instance ${instance}, unit ${cfg.restartUnit || detectUnit() || 'none'}, state ${cfg.stateDir}, session ${cfg.sessionDays}d, forcePasswordChange ${cfg.forcePasswordChange})`)
}
