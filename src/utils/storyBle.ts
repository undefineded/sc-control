import Taro from '@tarojs/taro'

/* 故事机 BLE 协议 (与固件 src/ble.cpp 对应) */
const SERVICE_UUID = '6b7a0001-3c4d-4e5f-8a9b-0c1d2e3f4a5b'
const WRITE_UUID = '6b7a0002-3c4d-4e5f-8a9b-0c1d2e3f4a5b'
const NOTIFY_UUID = '6b7a0003-3c4d-4e5f-8a9b-0c1d2e3f4a5b'
const NAME_PREFIX = 'StoryBox-'

export interface StoryDevice {
  deviceId: string
  name: string
  RSSI?: number
}

export interface HelloInfo {
  name: string
  fw: string
  bound: boolean
  hasPin?: boolean
  code?: string
}

export interface StoryStatus {
  play: boolean
  paused: boolean
  vol: number
  volMin: number
  volMax: number
  mode: string
  title: string
  cur: number
  dur: number
  used: number
  limit: number
  lock: number
  reason: string
  rem: number
  bedtime: boolean
  remote: boolean
  bound: boolean
  timeSynced: boolean
  dayKey: number
}

export interface StoryConfig {
  dailyLimitMin: number
  volMin: number
  volMax: number
  vol: number
  bedtimeEnabled: boolean
  bedStartMin: number
  bedEndMin: number
  allowlistEnabled: boolean
  remoteLocked: boolean
  bound: boolean
  hasPin: boolean
  used: number
  limit: number
  lock: number
  reason: string
}

export interface StoryItem {
  i: number
  n: string
  a: boolean
}

export interface MusicItem {
  i: number
  n: string
  c: string
  ci: number
  a: boolean
  f?: boolean
}

export interface CategoryItem {
  i: number
  n: string
  c: number
  a: boolean
}

export interface ReportItem {
  day: number
  used: number
}

export interface StoryReport {
  today: number
  day: number
  limit: number
  history: ReportItem[]
}

type Pending = {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timer: any
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/* 小程序 JS 引擎不保证有 TextDecoder，这里手写 UTF-8 编解码 */
function utf8Decode(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  while (i < bytes.length) {
    const b0 = bytes[i++]
    if (b0 < 0x80) {
      out += String.fromCharCode(b0)
    } else if ((b0 & 0xe0) === 0xc0 && i < bytes.length) {
      const b1 = bytes[i++] & 0x3f
      out += String.fromCharCode(((b0 & 0x1f) << 6) | b1)
    } else if ((b0 & 0xf0) === 0xe0 && i + 1 < bytes.length) {
      const b1 = bytes[i++] & 0x3f
      const b2 = bytes[i++] & 0x3f
      out += String.fromCharCode(((b0 & 0x0f) << 12) | (b1 << 6) | b2)
    } else if ((b0 & 0xf8) === 0xf0 && i + 2 < bytes.length) {
      const b1 = bytes[i++] & 0x3f
      const b2 = bytes[i++] & 0x3f
      const b3 = bytes[i++] & 0x3f
      const cp = ((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3
      const u = cp - 0x10000
      out += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff))
    } else {
      out += '\uFFFD'
    }
  }
  return out
}

function utf8Encode(str: string): Uint8Array {
  const out: number[] = []
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i)
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1)
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00)
        i++
      }
    }
    if (cp < 0x80) {
      out.push(cp)
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      )
    }
  }
  return new Uint8Array(out)
}

class StoryBleManager {
  private deviceId = ''
  private deviceName = ''
  private writeChar = ''
  private notifyChar = ''
  private mtu = 20
  private connected = false
  private authed = false
  private token = ''
  private helloInfo: HelloInfo | null = null
  private status: StoryStatus | null = null
  private rxBytes: number[] = []
  private seq = 0
  private pending = new Map<number, Pending>()
  private statusCb: ((status: StoryStatus) => void) | null = null
  private connCb: ((connected: boolean) => void) | null = null
  private adapterReady = false
  private connListenerReady = false
  private writeChain: Promise<void> = Promise.resolve()

  private ensureConnListener() {
    if (this.connListenerReady) return
    this.connListenerReady = true
    Taro.onBLEConnectionStateChange((res) => {
      if (res.deviceId === this.deviceId && !res.connected) {
        this.connected = false
        this.authed = false
        this.rejectAll(new Error('蓝牙连接已断开'))
        this.connCb?.(false)
      }
    })
  }

  async init(): Promise<boolean> {
    if (this.adapterReady) return true
    try {
      await Taro.openBluetoothAdapter()
      this.adapterReady = true
      this.ensureConnListener()
      return true
    } catch (e) {
      console.error('蓝牙初始化失败:', e)
      Taro.showToast({ title: '请开启蓝牙', icon: 'none' })
      return false
    }
  }

  /* 微信的 GATT client 偶发卡死: 扫描照常，但 createBLEConnection 一直 10003/10012。
     这种状态只能关掉再打开适配器才能恢复（风扇页每次连接都做了这件事，故事页以前没有），
     否则重试多少次都一样。 */
  async resetAdapter(): Promise<boolean> {
    try { Taro.offBLEConnectionStateChange() } catch {}
    try { await Taro.closeBluetoothAdapter() } catch {}
    this.adapterReady = false
    this.connListenerReady = false
    this.connected = false
    this.authed = false
    this.rejectAll(new Error('蓝牙已重置'))
    await sleep(300)
    return this.init()
  }

  getDeviceId() {
    return this.deviceId
  }

  getDeviceName() {
    return this.deviceName
  }

  isConnected() {
    return this.connected
  }

  isAuthed() {
    return this.authed
  }

  isBound() {
    return !!this.helloInfo?.bound
  }

  getHello() {
    return this.helloInfo
  }

  getStatus() {
    return this.status
  }

  onStatus(cb: ((status: StoryStatus) => void) | null) {
    this.statusCb = cb
  }

  onConnection(cb: ((connected: boolean) => void) | null) {
    this.connCb = cb
  }

  async scan(timeoutMs = 8000): Promise<StoryDevice[]> {
    if (!(await this.init())) return []
    const found = new Map<string, StoryDevice>()
    const all = new Map<string, StoryDevice>()

    Taro.offBluetoothDeviceFound()
    Taro.onBluetoothDeviceFound((res) => {
      res.devices.forEach((d) => {
        const name = d.name || d.localName || ''
        if (!name) return
        all.set(d.deviceId, { deviceId: d.deviceId, name, RSSI: d.RSSI })
        if (name.indexOf(NAME_PREFIX) === 0) {
          found.set(d.deviceId, { deviceId: d.deviceId, name, RSSI: d.RSSI })
        }
      })
    })

    try {
      await Taro.startBluetoothDevicesDiscovery({ allowDuplicatesKey: false })
      await sleep(timeoutMs)
    } catch (e) {
      console.error('扫描故事机失败:', e)
    } finally {
      try { await Taro.stopBluetoothDevicesDiscovery() } catch {}
      Taro.offBluetoothDeviceFound()
    }

    /* 设备名放不进广播包时会挪到 scan response，个别机型首包拿不到名字。
       按前缀一个都没找到就退化成"所有带名字的设备"，避免列表永远是空的。 */
    if (!found.size && all.size) {
      console.warn('未发现 StoryBox- 前缀，改为列出全部设备:', Array.from(all.values()))
    }
    return Array.from((found.size ? found : all).values())
      .sort((a, b) => (b.RSSI || -999) - (a.RSSI || -999))
  }

  /* 建立链路: 失败先重置适配器再试一次，还不行就扫一次确认地址（保存的 deviceId 可能已失效） */
  private async openLink(deviceId: string, name: string): Promise<void> {
    try {
      await Taro.createBLEConnection({ deviceId, timeout: 10000 })
      return
    } catch (e) {
      console.warn('createBLEConnection 失败，重置适配器后重试:', e)
    }

    await this.resetAdapter()
    await sleep(400)
    try {
      await Taro.createBLEConnection({ deviceId, timeout: 10000 })
      return
    } catch (e2) {
      console.warn('重置适配器后仍失败，扫描确认设备地址:', e2)
    }

    const list = await this.scan(3000)
    const match = list.find((d) => d.deviceId === deviceId) ||
                  (name ? list.find((d) => d.name === name) : undefined)
    if (!match) throw new Error('蓝牙连接失败，请重启故事机后重试')

    if (match.deviceId !== deviceId) {
      console.warn('设备地址已变化:', deviceId, '->', match.deviceId)
      const migrated = this.loadToken(match.deviceId)
      if (migrated) this.token = migrated
      else if (this.token) this.saveToken(match.deviceId, this.token)
      this.deviceId = match.deviceId
      this.deviceName = match.name
    }
    await Taro.createBLEConnection({ deviceId: this.deviceId, timeout: 10000 })
  }

  async connect(deviceId: string, name = ''): Promise<HelloInfo> {
    if (this.connected && this.deviceId === deviceId && this.helloInfo) {
      return this.helloInfo
    }
    if (this.connected) await this.disconnect()
    if (!(await this.init())) throw new Error('蓝牙未就绪')

    this.deviceId = deviceId
    this.deviceName = name
    this.rxBytes = []
    this.status = null
    this.helloInfo = null
    this.authed = false
    this.mtu = 20
    this.token = this.loadToken(deviceId)

    await this.openLink(deviceId, name)
    deviceId = this.deviceId          // 地址可能在 openLink 里被刷新
    await sleep(400)
    try { await Taro.setBLEMTU({ deviceId, mtu: 512 }) } catch {}
    try {
      const mtuRes: any = await Taro.getBLEMTU({ deviceId })
      if (mtuRes && mtuRes.mtu >= 23) this.mtu = Number(mtuRes.mtu)
    } catch {}
    /* 设备用 notify 发 JSON，NimBLE 在长度超过 MTU-3 时会直接截断，MTU 太低就会表现为"设备响应超时" */
    console.log('[storyBle] MTU =', this.mtu)
    if (this.mtu < 50) console.warn('[storyBle] MTU 过小，设备回复可能被截断')

    const services = await Taro.getBLEDeviceServices({ deviceId })
    const service = services.services.find((s) => s.uuid.toLowerCase() === SERVICE_UUID)
    if (!service) {
      await Taro.closeBLEConnection({ deviceId })
      throw new Error('未找到故事机服务')
    }

    const chars = await Taro.getBLEDeviceCharacteristics({
      deviceId,
      serviceId: service.uuid
    })
    const write = chars.characteristics.find((c) => c.uuid.toLowerCase() === WRITE_UUID)
    const notify = chars.characteristics.find((c) => c.uuid.toLowerCase() === NOTIFY_UUID)
    if (!write || !notify) {
      await Taro.closeBLEConnection({ deviceId })
      throw new Error('未找到故事机特征值')
    }
    this.writeChar = write.uuid
    this.notifyChar = notify.uuid

    Taro.offBLECharacteristicValueChange()
    Taro.onBLECharacteristicValueChange((res) => {
      if (res.deviceId !== this.deviceId) return
      this.onChunk(res.value)
    })
    await sleep(500)
    await Taro.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId: service.uuid,
      characteristicId: this.notifyChar,
      state: true
    })

    this.connected = true
    await sleep(300)
    let hello: any
    try {
      hello = await this.request('hello', {}, 4000)
    } catch (e) {
      try {
        await sleep(400)
        hello = await this.request('hello', {}, 4000)
      } catch (err) {
        await this.disconnect()
        throw err
      }
    }
    this.helloInfo = {
      name: hello.name || name || '故事机',
      fw: hello.fw || '',
      bound: !!hello.bound,
      hasPin: !!hello.hasPin,
      code: hello.code
    }

    if (this.token) {
      try {
        await this.request('auth', { token: this.token }, 3000)
        this.authed = true
      } catch {
        this.authed = false
      }
    }
    /* 没设家长密码的机器没有可校验的秘密: 直接授权, 不要弹密码框 */
    if (!this.authed && this.helloInfo.bound && !this.helloInfo.hasPin) {
      try {
        await this.request('auth', {}, 3000)
        this.authed = true
      } catch (e) {
        console.warn('无密码授权失败:', e)
      }
    }

    if (this.authed) {
      /* 校时/读状态是锦上添花: 失败不能让整个"连接"判负, 否则链路还开着、UI 却回到未连接,
         设备被占住不再广播, 于是再扫描就"没有发现故事机"了 */
      try { await this.syncTime() } catch (e) { console.warn('校时失败:', e) }
      try { await this.refreshState() } catch (e) { console.warn('读取状态失败:', e) }
    }

    this.connCb?.(true)
    return this.helloInfo
  }

  async disconnect(): Promise<void> {
    const deviceId = this.deviceId
    this.connected = false
    this.authed = false
    this.rejectAll(new Error('已断开'))
    if (deviceId) {
      try { await Taro.closeBLEConnection({ deviceId }) } catch {}
    }
    this.deviceId = ''
    this.deviceName = ''
    this.writeChar = ''
    this.notifyChar = ''
    this.helloInfo = null
    this.status = null
    this.connCb?.(false)
  }

  async bind(code: string): Promise<void> {
    const res = await this.request('bind', { code }, 5000)
    if (!res.token) throw new Error('绑定失败')
    this.token = res.token
    this.saveToken(this.deviceId, res.token)
    this.authed = true
    if (this.helloInfo) this.helloInfo.bound = true
    await this.syncTime()
  }

  async authWithPin(pin: string): Promise<void> {
    await this.request('auth', { pin }, 4000)
    this.authed = true
    await this.syncTime()
    await this.refreshState()
  }

  async syncTime(): Promise<void> {
    const epoch = Math.floor(Date.now() / 1000)
    const tz = -new Date().getTimezoneOffset()
    await this.request('sync', { epoch, tz }, 4000)
  }

  async refreshState(): Promise<StoryStatus> {
    const res = await this.request('get', { what: 'state' }, 4000)
    this.status = res.data as StoryStatus
    this.statusCb?.(this.status)
    return this.status
  }

  async getConfig(): Promise<StoryConfig> {
    const res = await this.request('get', { what: 'config' }, 4000)
    return res.data as StoryConfig
  }

  async getStories(): Promise<StoryItem[]> {
    const items: StoryItem[] = []
    let offset = 0
    let total = 1
    while (offset < total) {
      const res = await this.request('get', { what: 'stories', offset, limit: 4 }, 5000)
      const data = res.data || {}
      total = Number(data.total || 0)
      const page = (data.items || []) as StoryItem[]
      items.push(...page)
      if (!page.length) break
      offset += page.length
    }
    return items
  }

  async getMusic(): Promise<MusicItem[]> {
    const items: MusicItem[] = []
    let offset = 0
    let total = 1
    while (offset < total) {
      const res = await this.request('get', { what: 'music', offset, limit: 4 }, 5000)
      const data = res.data || {}
      total = Number(data.total || 0)
      const page = (data.items || []) as MusicItem[]
      items.push(...page)
      if (!page.length) break
      offset += page.length
    }
    return items
  }

  async getCategories(): Promise<CategoryItem[]> {
    const items: CategoryItem[] = []
    let offset = 0
    let total = 1
    while (offset < total) {
      const res = await this.request('get', { what: 'cats', offset, limit: 4 }, 5000)
      const data = res.data || {}
      total = Number(data.total || 0)
      const page = (data.items || []) as CategoryItem[]
      items.push(...page)
      if (!page.length) break
      offset += page.length
    }
    return items
  }

  async getReport(): Promise<StoryReport> {
    const res = await this.request('get', { what: 'report' }, 5000)
    return res.data as StoryReport
  }

  async setConfig(cfg: Record<string, any>): Promise<StoryConfig> {
    const res = await this.request('set', cfg, 6000)
    if (res.data) return res.data as StoryConfig
    return this.getConfig()
  }

  async ctrl(action: string, value?: number): Promise<void> {
    const payload: Record<string, any> = { action }
    if (value !== undefined) payload.value = value
    await this.request('ctrl', payload, 4000)
  }

  /* 收藏/取消收藏 (设备与小程序共用同一套全量曲目下标), 返回新状态 */
  async setFavorite(index: number): Promise<boolean> {
    const res = await this.request('ctrl', { action: 'fav', value: index }, 4000)
    return !!res.f
  }

  async setPin(pin: string): Promise<void> {
    await this.request('pin', { action: 'set', pin }, 4000)
  }

  async verifyPin(pin: string): Promise<boolean> {
    const res = await this.request('pin', { action: 'verify', pin }, 4000)
    return !!res.valid
  }

  private loadToken(deviceId: string): string {
    try { return Taro.getStorageSync(`storyToken:${deviceId}`) || '' } catch { return '' }
  }

  private saveToken(deviceId: string, token: string) {
    try { Taro.setStorageSync(`storyToken:${deviceId}`, token) } catch {}
  }

  private onChunk(value: ArrayBuffer) {
    const bytes = new Uint8Array(value)
    for (let i = 0; i < bytes.length; i++) this.rxBytes.push(bytes[i])

    /* 按字节找换行，整行再做 UTF-8 解码，避免中文被拆到两个 BLE 包 */
    let idx = this.rxBytes.indexOf(0x0a)
    while (idx >= 0) {
      const lineBytes = new Uint8Array(this.rxBytes.slice(0, idx))
      this.rxBytes = this.rxBytes.slice(idx + 1)
      const line = utf8Decode(lineBytes).trim()
      if (line) this.onLine(line)
      idx = this.rxBytes.indexOf(0x0a)
    }
    if (this.rxBytes.length > 4096) this.rxBytes = []
  }

  private onLine(line: string) {
    let msg: any
    try { msg = JSON.parse(line) } catch { return }

    /* 先按 id 完成请求, 再处理事件: hello 响应同时带 id 与 evt */
    const id = Number(msg.id || 0)
    if (id) {
      const pending = this.pending.get(id)
      if (pending) {
        clearTimeout(pending.timer)
        this.pending.delete(id)
        if (msg.ok === false) pending.reject(new Error(msg.err || '操作失败'))
        else pending.resolve(msg)
      }
    }

    if (msg.evt === 'state') {
      this.status = msg as StoryStatus
      this.statusCb?.(msg as StoryStatus)
      return
    }
    if (msg.evt === 'hello') {
      this.helloInfo = {
        name: msg.name || this.helloInfo?.name || '故事机',
        fw: msg.fw || '',
        bound: !!msg.bound,
        hasPin: !!msg.hasPin,
        code: msg.code
      }
    }
  }

  private request(cmd: string, data: Record<string, any>, timeoutMs = 4000): Promise<any> {
    if (!this.connected) return Promise.reject(new Error('故事机未连接'))
    const id = ++this.seq
    const payload = JSON.stringify({ v: 1, id, cmd, ...data }) + '\n'
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('设备响应超时'))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.write(payload).catch((e) => {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(e)
      })
    })
  }

  private async write(text: string): Promise<void> {
    /* 协议是单条字节流: 并发请求的分片必须排队写, 否则两条命令会拼成一条坏 JSON */
    const job = this.writeChain.then(() => this.writeRaw(text))
    this.writeChain = job.catch(() => {})
    return job
  }

  private async writeRaw(text: string): Promise<void> {
    if (!this.connected) throw new Error('故事机未连接')
    const bytes = utf8Encode(text)
    const chunkSize = Math.max(20, this.mtu - 3)
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.slice(offset, offset + chunkSize)
      await Taro.writeBLECharacteristicValue({
        deviceId: this.deviceId,
        serviceId: SERVICE_UUID,
        characteristicId: this.writeChar,
        value: chunk.buffer
      })
    }
  }

  private rejectAll(err: Error) {
    this.pending.forEach((p) => {
      clearTimeout(p.timer)
      p.reject(err)
    })
    this.pending.clear()
  }
}

export const storyBle = new StoryBleManager()
