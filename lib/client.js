window.__ModuleLoader__.load({
	id: "dsh-auth",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_react_dom = require("react-dom");
var import_jsx_runtime = require("react/jsx-runtime");
var name = "dsh-auth";
var inject = ["slots", "locale"];
var NS = "dsh-auth";
var zh = {
  nav: "登录与安全",
  title: "登录与安全",
  description: "管理 DeepSeek Harness 的登录账户、密码和会话。",
  user: "当前用户",
  expires: "本次登录有效期至",
  others: "其他有效会话",
  mustChange: "当前账户仍在使用默认密码，请立即修改。",
  logoutTitle: "退出登录",
  logoutHint: "结束本浏览器的登录会话，并清除 DeepSeek Harness 的浏览器凭据。",
  logout: "退出登录",
  changeTitle: "修改用户名或密码",
  changeHint: "需要输入当前密码。保存后，其他设备和浏览器上的登录会话将全部失效。",
  current: "当前密码",
  newUser: "用户名",
  newPass: "新密码（留空则不修改）",
  confirm: "确认新密码",
  save: "保存修改",
  saving: "正在保存…",
  saved: "已保存。",
  revoked: "已注销其他会话：",
  mismatch: "两次输入的新密码不一致",
  tooShort: "新密码至少需要 {n} 个字符",
  loading: "正在加载…",
  loadFailed: "无法读取登录信息",
  failed: "保存失败",
  serviceTitle: "服务",
  serviceHint: "安装或更新插件后，如提示“请重启 DSH 使更改生效”，可在这里重启。登录状态会保留，页面会在服务恢复后自动刷新。",
  restart: "重启 DeepSeek Harness",
  confirmTitle: "重启 DeepSeek Harness？",
  confirmBody: "服务将停止几秒钟，正在进行的对话和任务会被中断。登录状态会保留，重启完成后页面将自动刷新。",
  confirmOk: "确认重启",
  cancel: "取消",
  restarting: "正在重启 DeepSeek Harness…",
  restartingHint: "服务恢复后页面将自动刷新（已等待 {s} 秒）",
  restartTimeout: "等待超时，服务可能仍在启动。",
  reloadNow: "立即刷新页面",
  restartFailed: "重启失败"
};
var en = { ...zh };
var S = {
  section: { display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 },
  h2: { fontSize: 18, fontWeight: 600, margin: 0 },
  muted: { opacity: 0.65, fontSize: 13, margin: "4px 0 0" },
  card: { border: "1px solid rgba(128,128,128,.28)", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10 },
  h3: { fontSize: 14, fontWeight: 600, margin: 0 },
  row: { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13 },
  input: { padding: "7px 10px", borderRadius: 7, border: "1px solid rgba(128,128,128,.4)", background: "transparent", color: "inherit", font: "inherit", fontSize: 14 },
  primary: { alignSelf: "flex-start", padding: "7px 16px", borderRadius: 7, border: 0, background: "#4d6bfe", color: "#fff", cursor: "pointer", fontSize: 13 },
  danger: { alignSelf: "flex-start", padding: "7px 16px", borderRadius: 7, border: "1px solid rgba(220,38,38,.5)", background: "transparent", color: "#dc2626", cursor: "pointer", fontSize: 13 },
  warn: { padding: "8px 12px", borderRadius: 8, background: "rgba(234,179,8,.14)", border: "1px solid rgba(234,179,8,.4)", fontSize: 13 },
  err: { padding: "8px 12px", borderRadius: 8, background: "rgba(220,38,38,.10)", border: "1px solid rgba(220,38,38,.35)", color: "#dc2626", fontSize: 13 },
  ok: { padding: "8px 12px", borderRadius: 8, background: "rgba(22,163,74,.10)", border: "1px solid rgba(22,163,74,.35)", color: "#16a34a", fontSize: 13 }
};
S.backdrop = { position: "fixed", inset: 0, zIndex: 2147483600, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: 'system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif' };
S.dialog = { width: "min(420px,92vw)", background: "#fff", color: "#111", borderRadius: 12, padding: 22, boxShadow: "0 12px 40px rgba(0,0,0,.3)", display: "flex", flexDirection: "column", gap: 12 };
S.overlay = { ...S.backdrop, background: "rgba(15,17,21,.88)", color: "#e5e7eb", flexDirection: "column", gap: 14, fontSize: 15 };
S.spinner = { width: 34, height: 34, borderRadius: "50%", border: "3px solid rgba(255,255,255,.2)", borderTopColor: "#4d6bfe", animation: "dsh-auth-spin .9s linear infinite" };
S.dangerFill = { ...S.primary, background: "#dc2626" };
S.ghost = { ...S.primary, background: "transparent", color: "inherit", border: "1px solid rgba(128,128,128,.4)" };
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function RestartCard({ t }) {
  const [confirming, setConfirming] = (0, import_react.useState)(false);
  const [phase, setPhase] = (0, import_react.useState)("idle");
  const [error, setError] = (0, import_react.useState)("");
  const [elapsed, setElapsed] = (0, import_react.useState)(0);
  const alive = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => () => {
    alive.current = false;
  }, []);
  const restart = async () => {
    setConfirming(false);
    setError("");
    let before;
    try {
      const r = await fetch(authUrl("/_auth/api/restart"), { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) {
        window.location.assign(authUrl("/_auth/login"));
        return;
      }
      if (!r.ok) {
        setError(data.error || t("restartFailed"));
        return;
      }
      before = data.instance;
    } catch {
      setError(t("restartFailed"));
      return;
    }
    setPhase("restarting");
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1e3)), 500);
    try {
      await sleep(1500);
      while (Date.now() - started < 12e4) {
        try {
          const h = await fetch(authUrl("/_auth/health"), { cache: "no-store", credentials: "same-origin" });
          if (h.ok) {
            const data = await h.json();
            if (data.instance && data.instance !== before) {
              const me = await fetch(authUrl("/_auth/api/me"), { cache: "no-store", credentials: "same-origin" });
              if (me.status === 401) {
                window.location.assign(authUrl("/_auth/login"));
                return;
              }
              window.location.reload();
              return;
            }
          }
        } catch {
        }
        await sleep(1e3);
      }
      if (alive.current) setPhase("timeout");
    } finally {
      clearInterval(timer);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.card, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: S.h3, children: t("serviceTitle") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { ...S.muted, marginTop: 0 }, children: t("serviceHint") }),
    error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.err, role: "alert", children: error }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: S.danger, "data-dsh-auth": "restart", onClick: () => setConfirming(true), children: t("restart") }),
    confirming ? (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.backdrop, role: "dialog", "aria-modal": "true", "data-dsh-auth": "restart-confirm", onClick: (e) => {
        if (e.target === e.currentTarget) setConfirming(false);
      }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.dialog, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { style: { fontSize: 16 }, children: t("confirmTitle") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: 0, fontSize: 14, lineHeight: 1.6, color: "#444" }, children: t("confirmBody") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: { ...S.ghost, color: "#111" }, onClick: () => setConfirming(false), children: t("cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: S.dangerFill, "data-dsh-auth": "restart-ok", onClick: restart, children: t("confirmOk") })
        ] })
      ] }) }),
      document.body
    ) : null,
    phase !== "idle" ? (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.overlay, "data-dsh-auth": "restart-overlay", role: "status", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: "@keyframes dsh-auth-spin{to{transform:rotate(360deg)}}" }),
        phase === "restarting" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.spinner }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: phase === "restarting" ? t("restarting") : t("restartTimeout") }),
        phase === "restarting" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, opacity: 0.7 }, children: t("restartingHint").replace("{s}", String(elapsed)) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: S.primary, onClick: () => window.location.reload(), children: t("reloadNow") })
      ] }),
      document.body
    ) : null
  ] });
}
var authUrl = (p) => new URL(p, window.location.origin).toString();
function Section({ t }) {
  const [me, setMe] = (0, import_react.useState)(null);
  const [loadError, setLoadError] = (0, import_react.useState)("");
  const [current, setCurrent] = (0, import_react.useState)("");
  const [username, setUsername] = (0, import_react.useState)("");
  const [pass, setPass] = (0, import_react.useState)("");
  const [pass2, setPass2] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [msg, setMsg] = (0, import_react.useState)(null);
  const load = (0, import_react.useCallback)(async () => {
    try {
      const r = await fetch(authUrl("/_auth/api/me"), { credentials: "same-origin", cache: "no-store" });
      if (r.status === 401) {
        window.location.assign(authUrl("/_auth/login"));
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      setMe(data);
      setUsername(data.username);
      setLoadError("");
    } catch {
      setLoadError(t("loadFailed"));
    }
  }, [t]);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (pass && pass !== pass2) return setMsg({ kind: "err", text: t("mismatch") });
    if (pass && me && [...pass].length < me.minPasswordLength) return setMsg({ kind: "err", text: t("tooShort").replace("{n}", String(me.minPasswordLength)) });
    setBusy(true);
    try {
      const r = await fetch(authUrl("/_auth/api/account"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, username, newPassword: pass, confirmPassword: pass2 })
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) {
        window.location.assign(authUrl("/_auth/login"));
        return;
      }
      if (!r.ok) {
        setMsg({ kind: "err", text: data.error || t("failed") });
        return;
      }
      setCurrent("");
      setPass("");
      setPass2("");
      setMsg({ kind: "ok", text: `${t("saved")} ${t("revoked")}${data.revokedSessions ?? 0}` });
      await load();
    } catch {
      setMsg({ kind: "err", text: t("failed") });
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.section, "data-dsh-auth": "settings", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { style: S.h2, children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: S.muted, children: t("description") })
    ] }),
    loadError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.err, children: loadError }) : null,
    !me && !loadError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.muted, children: t("loading") }) : null,
    me ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("user") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: me.username })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("expires") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: new Date(me.sessionExpiresAt).toLocaleString() })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("others") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: me.otherSessions })
      ] }),
      me.mustChange ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.warn, children: t("mustChange") }) : null
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { style: S.card, onSubmit: submit, autoComplete: "off", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: S.h3, children: t("changeTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { ...S.muted, marginTop: 0 }, children: t("changeHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: S.label, children: [
        t("current"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { style: S.input, type: "password", autoComplete: "current-password", required: true, value: current, onChange: (e) => setCurrent(e.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: S.label, children: [
        t("newUser"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { style: S.input, autoComplete: "username", value: username, onChange: (e) => setUsername(e.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: S.label, children: [
        t("newPass"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { style: S.input, type: "password", autoComplete: "new-password", value: pass, onChange: (e) => setPass(e.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: S.label, children: [
        t("confirm"),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { style: S.input, type: "password", autoComplete: "new-password", value: pass2, onChange: (e) => setPass2(e.target.value) })
      ] }),
      msg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: msg.kind === "ok" ? S.ok : S.err, role: "status", children: msg.text }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", style: S.primary, disabled: busy, children: busy ? t("saving") : t("save") })
    ] }),
    me && me.canRestart && !me.mustChange ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RestartCard, { t }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: S.h3, children: t("logoutTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { ...S.muted, marginTop: 0 }, children: t("logoutHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: S.danger, onClick: () => window.location.assign(authUrl("/_auth/logout")), children: t("logout") })
    ] })
  ] });
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-auth: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "dsh-auth",
    order: -5,
    label: () => t("nav"),
    locale: NS
  }, Section));
}

		Object.defineProperty(module.exports, Symbol.toStringTag, { value: "Module" });
		return module.exports;
	}
});
