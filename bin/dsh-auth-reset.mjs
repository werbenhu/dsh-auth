#!/usr/bin/env node
// Reset dsh-auth to its default state: username/password from the defaults
// (admin / 123456 unless overridden), must-change set, all sessions revoked,
// new signing secret. The running dsh picks the files up on the next request;
// restart dsh to also clear in-memory lockout counters.
//
//   dsh-auth-reset [--state-dir /var/lib/dsh-auth] [--username admin] [--password 123456]
import fs from 'node:fs'
import path from 'node:path'
import { defaultAccount } from '../lib/index.js'

const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const stateDir = opt('--state-dir', '/var/lib/dsh-auth')
const cfg = { defaultUsername: opt('--username', 'admin'), defaultPassword: opt('--password', '123456') }
fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 })
fs.chmodSync(stateDir, 0o700)
for (const [file, data] of [['account.json', defaultAccount(cfg)], ['sessions.json', {}]]) {
  const target = path.join(stateDir, file)
  const tmp = `${target}.reset.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 })
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, target)
}
console.log(`dsh-auth: reset ${stateDir} to default account "${cfg.defaultUsername}" (must change password), sessions cleared`)
