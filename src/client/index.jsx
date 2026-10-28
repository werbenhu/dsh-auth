// dsh-auth — browser half. Registers Settings > 登录与安全 through the settings.section slot.
// Built by build.mjs into dsh's module-loader format (lib/client.js).
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const name = 'dsh-auth'
export const inject = ['slots', 'locale']
const NS = 'dsh-auth'

const zh = {
  nav: '登录与安全',
  title: '登录与安全',
  description: '管理 DeepSeek Harness 的登录账户、密码和会话。',
  user: '当前用户',
  expires: '本次登录有效期至',
  others: '其他有效会话',
  mustChange: '当前账户仍在使用默认密码，请立即修改。',
  logoutTitle: '退出登录',
  logoutHint: '结束本浏览器的登录会话，并清除 DeepSeek Harness 的浏览器凭据。',
  logout: '退出登录',
  changeTitle: '修改用户名或密码',
  changeHint: '需要输入当前密码。保存后，其他设备和浏览器上的登录会话将全部失效。',
  current: '当前密码',
  newUser: '用户名',
  newPass: '新密码（留空则不修改）',
  confirm: '确认新密码',
  save: '保存修改',
  saving: '正在保存…',
  saved: '已保存。',
  revoked: '已注销其他会话：',
  mismatch: '两次输入的新密码不一致',
  tooShort: '新密码至少需要 {n} 个字符',
  loading: '正在加载…',
  loadFailed: '无法读取登录信息',
  failed: '保存失败',
  serviceTitle: '服务',
  serviceHint: '安装或更新插件后，如提示“请重启 DSH 使更改生效”，可在这里重启。登录状态会保留，页面会在服务恢复后自动刷新。',
  restart: '重启 DeepSeek Harness',
  confirmTitle: '重启 DeepSeek Harness？',
  confirmBody: '服务将停止几秒钟，正在进行的对话和任务会被中断。登录状态会保留，重启完成后页面将自动刷新。',
  confirmOk: '确认重启',
  cancel: '取消',
  restarting: '正在重启 DeepSeek Harness…',
  restartingHint: '服务恢复后页面将自动刷新（已等待 {s} 秒）',
  restartTimeout: '等待超时，服务可能仍在启动。',
  reloadNow: '立即刷新页面',
  restartFailed: '重启失败',
}
const en = { ...zh }

const S = {
  section: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 },
  h2: { fontSize: 18, fontWeight: 600, margin: 0 },
  muted: { opacity: 0.65, fontSize: 13, margin: '4px 0 0' },
  card: { border: '1px solid rgba(128,128,128,.28)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  h3: { fontSize: 14, fontWeight: 600, margin: 0 },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 },
  input: { padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(128,128,128,.4)', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: 14 },
  primary: { alignSelf: 'flex-start', padding: '7px 16px', borderRadius: 7, border: 0, background: '#4d6bfe', color: '#fff', cursor: 'pointer', fontSize: 13 },
  danger: { alignSelf: 'flex-start', padding: '7px 16px', borderRadius: 7, border: '1px solid rgba(220,38,38,.5)', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 13 },
  warn: { padding: '8px 12px', borderRadius: 8, background: 'rgba(234,179,8,.14)', border: '1px solid rgba(234,179,8,.4)', fontSize: 13 },
  err: { padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,.10)', border: '1px solid rgba(220,38,38,.35)', color: '#dc2626', fontSize: 13 },
  ok: { padding: '8px 12px', borderRadius: 8, background: 'rgba(22,163,74,.10)', border: '1px solid rgba(22,163,74,.35)', color: '#16a34a', fontSize: 13 },
}

S.backdrop = { position: 'fixed', inset: 0, zIndex: 2147483600, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif' }
S.dialog = { width: 'min(420px,92vw)', background: '#fff', color: '#111', borderRadius: 12, padding: 22, boxShadow: '0 12px 40px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', gap: 12 }
S.overlay = { ...S.backdrop, background: 'rgba(15,17,21,.88)', color: '#e5e7eb', flexDirection: 'column', gap: 14, fontSize: 15 }
S.spinner = { width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#4d6bfe', animation: 'dsh-auth-spin .9s linear infinite' }
S.dangerFill = { ...S.primary, background: '#dc2626' }
S.ghost = { ...S.primary, background: 'transparent', color: 'inherit', border: '1px solid rgba(128,128,128,.4)' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function RestartCard({ t }) {
  const [confirming, setConfirming] = useState(false)
  const [phase, setPhase] = useState('idle') // idle | restarting | timeout
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const restart = async () => {
    setConfirming(false); setError('')
    let before
    try {
      const r = await fetch(authUrl('/_auth/api/restart'), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' })
      const data = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.assign(authUrl('/_auth/login')); return }
      if (!r.ok) { setError(data.error || t('restartFailed')); return }
      before = data.instance
    } catch { setError(t('restartFailed')); return }
    setPhase('restarting')
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500)
    try {
      await sleep(1500)
      while (Date.now() - started < 120000) {
        try {
          const h = await fetch(authUrl('/_auth/health'), { cache: 'no-store', credentials: 'same-origin' })
          if (h.ok) {
            const data = await h.json()
            if (data.instance && data.instance !== before) {
              const me = await fetch(authUrl('/_auth/api/me'), { cache: 'no-store', credentials: 'same-origin' })
              if (me.status === 401) { window.location.assign(authUrl('/_auth/login')); return }
              window.location.reload(); return
            }
          }
        } catch {}
        await sleep(1000)
      }
      if (alive.current) setPhase('timeout')
    } finally { clearInterval(timer) }
  }

  return (
    <div style={S.card}>
      <h3 style={S.h3}>{t('serviceTitle')}</h3>
      <p style={{ ...S.muted, marginTop: 0 }}>{t('serviceHint')}</p>
      {error ? <div style={S.err} role="alert">{error}</div> : null}
      <button type="button" style={S.danger} data-dsh-auth="restart" onClick={() => setConfirming(true)}>{t('restart')}</button>
      {confirming ? createPortal(
        <div style={S.backdrop} role="dialog" aria-modal="true" data-dsh-auth="restart-confirm" onClick={(e) => { if (e.target === e.currentTarget) setConfirming(false) }}>
          <div style={S.dialog}>
            <strong style={{ fontSize: 16 }}>{t('confirmTitle')}</strong>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#444' }}>{t('confirmBody')}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" style={{ ...S.ghost, color: '#111' }} onClick={() => setConfirming(false)}>{t('cancel')}</button>
              <button type="button" style={S.dangerFill} data-dsh-auth="restart-ok" onClick={restart}>{t('confirmOk')}</button>
            </div>
          </div>
        </div>, document.body) : null}
      {phase !== 'idle' ? createPortal(
        <div style={S.overlay} data-dsh-auth="restart-overlay" role="status">
          <style>{'@keyframes dsh-auth-spin{to{transform:rotate(360deg)}}'}</style>
          {phase === 'restarting' ? <div style={S.spinner} /> : null}
          <div>{phase === 'restarting' ? t('restarting') : t('restartTimeout')}</div>
          {phase === 'restarting'
            ? <div style={{ fontSize: 13, opacity: 0.7 }}>{t('restartingHint').replace('{s}', String(elapsed))}</div>
            : <button type="button" style={S.primary} onClick={() => window.location.reload()}>{t('reloadNow')}</button>}
        </div>, document.body) : null}
    </div>
  )
}

const authUrl = (p) => new URL(p, window.location.origin).toString()

function Section({ t }) {
  const [me, setMe] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [current, setCurrent] = useState('')
  const [username, setUsername] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(authUrl('/_auth/api/me'), { credentials: 'same-origin', cache: 'no-store' })
      if (r.status === 401) { window.location.assign(authUrl('/_auth/login')); return }
      if (!r.ok) throw new Error(String(r.status))
      const data = await r.json()
      setMe(data); setUsername(data.username); setLoadError('')
    } catch { setLoadError(t('loadFailed')) }
  }, [t])
  useEffect(() => { load() }, [load])

  const submit = async (e) => {
    e.preventDefault()
    setMsg(null)
    if (pass && pass !== pass2) return setMsg({ kind: 'err', text: t('mismatch') })
    if (pass && me && [...pass].length < me.minPasswordLength) return setMsg({ kind: 'err', text: t('tooShort').replace('{n}', String(me.minPasswordLength)) })
    setBusy(true)
    try {
      const r = await fetch(authUrl('/_auth/api/account'), {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, username, newPassword: pass, confirmPassword: pass2 }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.assign(authUrl('/_auth/login')); return }
      if (!r.ok) { setMsg({ kind: 'err', text: data.error || t('failed') }); return }
      setCurrent(''); setPass(''); setPass2('')
      setMsg({ kind: 'ok', text: `${t('saved')} ${t('revoked')}${data.revokedSessions ?? 0}` })
      await load()
    } catch { setMsg({ kind: 'err', text: t('failed') }) } finally { setBusy(false) }
  }

  return (
    <div style={S.section} data-dsh-auth="settings">
      <div>
        <h2 style={S.h2}>{t('title')}</h2>
        <p style={S.muted}>{t('description')}</p>
      </div>
      {loadError ? <div style={S.err}>{loadError}</div> : null}
      {!me && !loadError ? <div style={S.muted}>{t('loading')}</div> : null}
      {me ? (
        <div style={S.card}>
          <div style={S.row}><span>{t('user')}</span><strong>{me.username}</strong></div>
          <div style={S.row}><span>{t('expires')}</span><span>{new Date(me.sessionExpiresAt).toLocaleString()}</span></div>
          <div style={S.row}><span>{t('others')}</span><span>{me.otherSessions}</span></div>
          {me.mustChange ? <div style={S.warn}>{t('mustChange')}</div> : null}
        </div>
      ) : null}
      <form style={S.card} onSubmit={submit} autoComplete="off">
        <h3 style={S.h3}>{t('changeTitle')}</h3>
        <p style={{ ...S.muted, marginTop: 0 }}>{t('changeHint')}</p>
        <label style={S.label}>{t('current')}
          <input style={S.input} type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label style={S.label}>{t('newUser')}
          <input style={S.input} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label style={S.label}>{t('newPass')}
          <input style={S.input} type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </label>
        <label style={S.label}>{t('confirm')}
          <input style={S.input} type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
        </label>
        {msg ? <div style={msg.kind === 'ok' ? S.ok : S.err} role="status">{msg.text}</div> : null}
        <button type="submit" style={S.primary} disabled={busy}>{busy ? t('saving') : t('save')}</button>
      </form>
      {me && me.canRestart && !me.mustChange ? <RestartCard t={t} /> : null}
      <div style={S.card}>
        <h3 style={S.h3}>{t('logoutTitle')}</h3>
        <p style={{ ...S.muted, marginTop: 0 }}>{t('logoutHint')}</p>
        <button type="button" style={S.danger} onClick={() => window.location.assign(authUrl('/_auth/logout'))}>{t('logout')}</button>
      </div>
    </div>
  )
}

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-auth: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-auth',
    order: -5,
    label: () => t('nav'),
    locale: NS,
  }, Section))
}
