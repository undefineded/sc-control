// 以透明背景截取 png.html（1024x512 @2x），供切图
import { writeFileSync } from 'node:fs'

const url = process.argv[2]
const out = process.argv[3]

const res = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' })
const target = await res.json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const msgId = ++id
  pending.set(msgId, { resolve, reject })
  ws.send(JSON.stringify({ id: msgId, method, params }))
})

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result)
  }
})

await new Promise((r) => ws.addEventListener('open', r, { once: true }))
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 256, deviceScaleFactor: 2, mobile: false })
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
await send('Emulation.setScrollbarsHidden', { hidden: true }).catch(() => {})
await send('Page.navigate', { url })
await new Promise((r) => setTimeout(r, 1800))

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
writeFileSync(out, Buffer.from(shot.data, 'base64'))
console.log('saved', out)
ws.close()
process.exit(0)
