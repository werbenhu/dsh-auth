# dsh-auth

Username/password login for the DeepSeek Harness (`dsh`) **web** profile, with a
native **Settings → 登录与安全** section (logout, change username/password).

## Install

```sh
cd /opt/dsh-auth && npm install && npm run build      # builds lib/client.js
dsh plugin --profile web add link:/opt/dsh-auth
# then make sure "dsh-auth" is listed in ~/.dsh/profiles/web/package.json -> dsh.profile.bundles
systemctl restart dsh-web
```

Default account: **admin / 123456**, flagged *must change*. With
`forcePasswordChange: true` the first login lands on `/_auth/account?force=1`
and the UI (`/`) and `/api` are blocked (403 `password-change-required`) until a
new password is set. `123456` (and the configured default) is rejected as a new
password. Reset to defaults: `node /opt/dsh-auth/bin/dsh-auth-reset.mjs`
(then `systemctl restart dsh-web` to clear lockout counters).

## What it does

Host half (`lib/index.js`, node builtins only):

| Route | Purpose |
|---|---|
| `/`, `/index.html` (exact) | gate: no session → `/_auth/login`; must-change → `/_auth/account?force=1`; no dsh cookie → mint it server-side (launch token never reaches the browser) and 303 to `/`; else render the index (same rendering as frontend-static) |
| `/_auth/login` GET/POST | Chinese login page "DeepSeek Harness 登录" |
| `/_auth/logout` GET/POST, `/_auth/api/logout` POST | revoke session, expire `dsh_session` and every `dsh-auth-*` cookie, `Clear-Site-Data: "cookies"` |
| `/_auth/account` GET/POST | server-rendered account / forced-change page (CSRF token) |
| `/_auth/api/me` GET, `/_auth/api/account` POST (JSON) | used by the Settings section |
| `/_auth/api/restart` POST (JSON, same-origin, session, not while a forced change is pending) | answers 202, then runs `systemctl restart --no-block <unit>`; logged to the journal and `<stateDir>/restart.log` |
| `/_auth/health` GET (public) | `{ok, instance, startedAt}`; `instance` changes on every start, the client polls it after a restart |
| waterfall `connection/request` | `/api` HTTP: 401 without a session, 403 while a forced change is pending |
| `tapIndex` | always-visible bottom-right "退出登录" link |

Bundle patch (`cordis.patch.yml`) also sets dsh's `connection.cookieMaxAgeDays: 7`
to match the 7-day session.

Browser half (`src/client/index.jsx` → `lib/client.js`, module-loader format):
registers `settings.section` id `dsh-auth`, label 登录与安全: account info, change
username/password, a **服务 → 重启 DeepSeek Harness** button (Chinese confirm dialog,
“正在重启…” overlay, polls `/_auth/health` until a new instance answers, then reloads;
sessions and dsh's cookie are persisted, so the user stays logged in), and logout.

dsh itself (0.2.1-rc.2) has no restart action in the web UI or API: the plugin manager only
shows “请重启 DSH 使更改生效” after an install that needs a restart.

## Config (`id: dsh-auth` row)

| key | default | |
|---|---|---|
| `stateDir` | `/var/lib/dsh-auth` | `account.json` + `sessions.json`, dir 0700, files 0600 |
| `sessionDays` | `7` | session lifetime |
| `forcePasswordChange` | `true` | block UI/API while the default password is in use; set `false` to only show a warning |
| `defaultUsername` / `defaultPassword` | `admin` / `123456` | used when no account exists yet |
| `minPasswordLength` | `8` | |
| `lockoutMax` / `lockoutMinutes` | `10` / `15` | failed password checks per client IP (login and current-password checks) |
| `trustForwardedFor` | `true` | use the last `X-Forwarded-For` hop **only** when the TCP peer is loopback (nginx) |
| `logoutLink` | `true` | inject the floating logout link |
| `restart` | `true` | enable the restart button / endpoint |
| `restartUnit` | auto | systemd unit to restart; detected from `/proc/self/cgroup` (e.g. `dsh-web.service`) |
| `restartCommand` | — | custom argv instead of `systemctl restart --no-block <unit>` |
| `distIndex` | auto | path to `dsh-web-frontend/dist/index.html` |

To override, restate the whole config in the profile's `cordis.patch.yml`:

```yaml
- id: dsh-auth
  config: { stateDir: /var/lib/dsh-auth, sessionDays: 7, forcePasswordChange: false }
```

Changing username or password requires the current password and revokes every
other session. Passwords are stored as scrypt (N=16384, r=8, p=1) hashes.

## Known limits

* `/api/remote.mux` (websocket) and channel routes are admitted by dsh's own
  `dsh-auth-*` cookie and do not pass through the `connection/request`
  waterfall. Logout clears that cookie in the browser, and it expires after 7
  days, but a copied dsh cookie stays valid until then (or until dsh's
  browser-session secret is rotated).
