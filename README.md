# dsh-auth

English | [中文](README.zh-CN.md)

`dsh-auth` is a plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`). It puts a username/password login in front of the dsh **Web UI**, so you can expose `dsh web` on a server, usually behind a reverse proxy with HTTPS, without leaving it open to anyone who finds the URL.

## Features

- **Login / logout**: a login page in front of the Web UI. Unauthenticated requests to the UI are redirected to `/_auth/login`, and `/api` requests get `401`. Logout clears both the dsh-auth session and dsh's own browser credential.
- **Account settings**: a native section in **Settings → Login & Security** to change the username and password. The section also shows the session expiry and lets you log out. Changing the password signs out all other sessions.
- **Forced password change**: a fresh install starts with the default account `admin` / `123456`. Until that password is changed, the UI and `/api` are blocked and a change-password page is shown. The default password is never accepted as a new password.
- **Brute-force lockout**: too many failed logins from one client IP lock that IP out for a while (10 attempts / 15 minutes by default).
- **Restart button**: the **Restart DeepSeek Harness** button in the **Service** card (**Settings → Login & Security**) restarts dsh from the browser. dsh itself only tells you to "restart DSH" after some plugin installs; the Web UI has no way to do it. The page shows a confirmation dialog and a "restarting…" overlay, waits for dsh to come back, then reloads. You stay logged in.
- **Works behind a reverse proxy**: honours `X-Forwarded-For` / `X-Forwarded-Proto` only from a loopback peer. The cookie is `Secure` over HTTPS, `HttpOnly` and `SameSite=Lax`.

| Login | Forced password change |
| --- | --- |
| ![Login](docs/login.png) | ![Forced password change](docs/force-change.png) |

| Settings → Login & Security | Restarting |
| --- | --- |
| ![Settings](docs/settings.png) | ![Restarting](docs/restarting.png) |

### UI language

The plugin's UI text is currently Chinese only. Use this table to find the English labels used in this README:

| English | Chinese (shown in the UI) |
| --- | --- |
| Login & Security (Settings section) | 登录与安全 |
| Username / Password / Log in | 用户名 / 密码 / 登录 |
| Change your default password (forced change page) / Save | 请修改默认密码 / 保存 |
| Current password / New password / Confirm new password | 当前密码 / 新密码 / 确认新密码 |
| Change username or password / Save changes | 修改用户名或密码 / 保存修改 |
| Service (card) | 服务 |
| Restart DeepSeek Harness (button) | 重启 DeepSeek Harness |
| Confirm restart / Cancel | 确认重启 / 取消 |
| Restarting DeepSeek Harness… (overlay) | 正在重启 DeepSeek Harness… |
| Log out | 退出登录 |
| Error: wrong username or password | 用户名或密码错误 |
| Error: too many failed logins, try again in N minutes | 登录失败次数过多，请 N 分钟后再试 |
| Error: the default password cannot be used | 不能使用默认密码 |

## Requirements

- DeepSeek Harness **0.2.1-rc.2** (the version this plugin is tested with; dsh is in developer preview and its plugin API may change)
- Node.js **22**
- `pnpm`, which `dsh plugin` needs (`npm i -g pnpm@10`)
- For the restart button: dsh running as a **systemd** service (or a custom `restartCommand`)

## Install

```sh
git clone https://github.com/werbenhu/dsh-auth.git
cd dsh-auth
npm install
npm run build            # builds lib/client.js (the Settings section)

dsh plugin --profile web add link:/path/to/dsh-auth
```

Then restart dsh, e.g. `systemctl restart <your-dsh-unit>` or stop and start `dsh web`.

The package ships a bundle patch (`cordis.patch.yml`) that mounts the plugin and sets dsh's browser-cookie lifetime to match the 7-day session. No other profile edits are needed.

Open the Web UI and log in as **`admin` / `123456`**. You will be asked to choose a new password (at least 8 characters, not `123456`) before you can use dsh.

## Configuration

To override options, add a `dsh-auth` row to your profile's `cordis.patch.yml`, e.g. `~/.dsh/profiles/web/cordis.patch.yml`. Options you leave out keep their defaults:

```yaml
- id: dsh-auth
  config:
    stateDir: /home/me/.dsh-auth
    sessionDays: 30
```

| Option | Default | Description |
| --- | --- | --- |
| `stateDir` | `/var/lib/dsh-auth` | Where the account (`account.json`), sessions (`sessions.json`) and `restart.log` are kept. The directory is `0700` and the files are `0600`. Use a writable path if dsh does not run as root. |
| `sessionDays` | `7` | Login session lifetime in days. |
| `forcePasswordChange` | `true` | Block the UI and `/api` until the default password has been changed. |
| `defaultUsername` | `admin` | Username written when no account exists yet. |
| `defaultPassword` | `123456` | Password written when no account exists yet. It is always rejected as a new password. |
| `minPasswordLength` | `8` | Minimum length of a new password. |
| `lockoutMax` | `10` | Failed logins per client IP before lockout. |
| `lockoutMinutes` | `15` | Lockout window and duration in minutes. |
| `trustForwardedFor` | `true` | Use `X-Forwarded-For` / `X-Forwarded-Proto`, but only when the request comes from a loopback address (your reverse proxy). |
| `logoutLink` | `true` | Inject a small floating **Log out** link into the bottom-right corner of the UI. |
| `restart` | `true` | Enable the restart button and `POST /_auth/api/restart`. |
| `restartUnit` | auto | The systemd unit to restart. It is detected from `/proc/self/cgroup` (e.g. `dsh-web.service`). |
| `restartCommand` | — | A custom command as an argv array, e.g. `["supervisorctl", "restart", "dsh"]`, used instead of `systemctl restart --no-block <unit>`. |
| `distIndex` | auto | Path to the Web UI's `index.html`. Normally resolved from the installed dsh client. |

Restart dsh after changing the configuration.

## Routes

| Route | Description |
| --- | --- |
| `GET/POST /_auth/login` | Login page |
| `GET/POST /_auth/logout`, `POST /_auth/api/logout` | Log out |
| `GET/POST /_auth/account` | Forced password change page |
| `GET /_auth/api/me` | Current user and session info (used by the Settings section) |
| `POST /_auth/api/account` | Change username and password (JSON, same-origin) |
| `POST /_auth/api/restart` | Restart dsh. Needs a session, a same-origin JSON request, and no pending forced change. Answers `202`, then restarts. |
| `GET /_auth/health` | Public `{ ok, instance, startedAt }`. `instance` changes on every start. |

## Reverse proxy (nginx)

Run dsh on loopback, e.g. `dsh web --no-open --host 127.0.0.1 --port 3080 --trusted-host your.domain`, and proxy to it:

```nginx
# dsh rejects cross-site requests. When a user follows a link to the UI from
# another site (chat app, mail, ...), the browser sends Sec-Fetch-Site:
# cross-site and dsh answers 403. Treat cross-site top-level GET/HEAD navigations as
# direct visits ("none"); API calls, POSTs and WebSockets keep the real value.
map "$request_method:$http_sec_fetch_mode:$http_sec_fetch_site" $dsh_fetch_site {
    "~^(GET|HEAD):navigate:cross-site$" "none";
    default $http_sec_fetch_site;
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl;
    server_name your.domain;
    # ssl_certificate / ssl_certificate_key ...

    location / {
        proxy_pass http://127.0.0.1:3080;
        proxy_http_version 1.1;

        # WebSocket (dsh uses /api/remote.mux)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Sec-Fetch-Site $dsh_fetch_site;

        # streaming responses and long-lived connections
        proxy_buffering off;
        proxy_read_timeout 1d;
        proxy_send_timeout 1d;
    }
}
```

Pass `--trusted-host` with your public host name so dsh accepts it.

## Resetting the account

If you lose the password, reset the account on the server:

```sh
node bin/dsh-auth-reset.mjs [--state-dir /var/lib/dsh-auth] [--username admin] [--password 123456]
```

This writes the default account with the forced change enabled, revokes all sessions and rotates the signing secret. Restart dsh afterwards to also clear lockout counters.

## Security notes

- Passwords are hashed with scrypt. Session cookies are HMAC-signed and checked against a server-side session list, so logging out or changing the password revokes them.
- State-changing endpoints require same-origin requests, plus a JSON content type or a CSRF token.
- **Use HTTPS.** Without it, the password and cookies travel in clear text.
- The lockout is per client IP. `X-Forwarded-For` is trusted only from loopback, so if your proxy runs on another host, every client appears as the proxy's IP and they all share one lockout counter. Run the proxy on the same host, or add fail2ban or rate limiting at the proxy.
- The restart endpoint runs `systemctl` as the dsh user, so it can only restart a unit that user is allowed to restart. Set `restart: false` to turn it off.
- Change the default password right away. Until you do, anyone who can reach the server can log in with `admin` / `123456` and take the account.

## Known limitations

- The WebSocket (`/api/remote.mux`) and dsh's channel routes do not go through dsh-auth's request hook. They are protected only by dsh's own browser cookie, which dsh-auth issues at login and clears at logout. A cookie already issued stays valid for its lifetime (7 days by default) even after the dsh-auth session is revoked, until dsh rotates its own credentials.
- One account only. There are no roles and no 2FA.
- The UI text is Chinese only.

## Disable / uninstall

- Disable the restart button only: set `restart: false`.
- Disable the forced password change: set `forcePasswordChange: false`.
- Uninstall:

  ```sh
  dsh plugin --profile web remove dsh-auth
  ```

  Remove any `id: dsh-auth` row you added to the profile's `cordis.patch.yml`, restart dsh, and optionally delete `stateDir`. Without the plugin, the dsh Web UI is open to anyone who can reach it again, so restrict access some other way.

## License

[MIT](LICENSE)
