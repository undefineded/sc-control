// 用 CDP 以精确 390x844 视口截图 Taro H5 产物（headless 窗口有最小宽度，--window-size 不精确）
// 用法: node shot-h5.mjs <url> <outfile> [width] [height] [dsf] [waitMs]
import { writeFileSync } from 'node:fs'

const [url, outFile, w = '390', h = '844', dsf = '2', wait = '3500', evalJs = ''] = process.argv.slice(2)
const width = Number(w)
const height = Number(h)
const scale = Number(dsf)

const res = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' })
const target = await res.json()
const ws = new WebSocket(target.webSocketDebuggerUrl)

let id = 0
const pending = new Map()

function send(method, params = {}) {
  const msgId = ++id
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
}

const loaded = new Promise((resolve) => {
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)))
      else p.resolve(msg.result)
      return
    }
    if (msg.method === 'Page.loadEventFired') resolve()
  })
})

await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: scale,
  mobile: true
})
await send('Page.navigate', { url })
await Promise.race([loaded, new Promise((r) => setTimeout(r, 6000))])
await new Promise((r) => setTimeout(r, Number(wait)))

if (evalJs) {
  await send('Runtime.evaluate', { expression: evalJs, awaitPromise: true })
  await new Promise((r) => setTimeout(r, 900))
}

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
writeFileSync(outFile, Buffer.from(shot.data, 'base64'))
console.log('saved', outFile)
await send('Target.closeTarget', { targetId: target.id }).catch(() => {})
ws.close()
process.exit(0)
