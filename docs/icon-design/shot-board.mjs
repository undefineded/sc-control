// 截图设计板：按页面实际高度设置视口，输出整页
// 用法: node shot-board.mjs <url> <out> [width] [dsf]
import { writeFileSync } from 'node:fs'

const [url, out, w = '1280', dsf = '2'] = process.argv.slice(2)
const width = Number(w)
const scale = Number(dsf)

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
await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: scale, mobile: false })
await send('Emulation.setScrollbarsHidden', { hidden: true }).catch(() => {})
await send('Page.navigate', { url })
await new Promise((r) => setTimeout(r, 2500))

const { result } = await send('Runtime.evaluate', {
  expression: 'Math.ceil(document.documentElement.scrollHeight)',
  returnByValue: true
})
const height = Math.max(600, Math.min(4000, result.value))
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false })
await new Promise((r) => setTimeout(r, 600))

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
writeFileSync(out, Buffer.from(shot.data, 'base64'))
console.log('saved', out, width, height)
ws.close()
process.exit(0)
