import Taro from '@tarojs/taro'

/* 本地设备台账: 绑定列表 + 别名 + 上次连接时间/状态 + 最近使用。
   只做存储, 不碰蓝牙, 方便首页 / 风扇页 / 故事机页共用。 */

export type DeviceKind = 'fan' | 'story'

export interface SavedFanDevice {
  deviceId: string
  name: string
  RSSI?: number
  connected?: boolean
}

export interface StorySavedDevice {
  deviceId: string
  name: string
}

export interface BoundDevice {
  id: string
  kind: DeviceKind
  rawName: string
  name: string
  lastSeen: number
  lastState: string
}

const KEY = {
  fans: 'savedDevices',
  story: 'storyDevice',
  alias: 'deviceAlias',
  lastSeen: 'deviceLastSeen',
  lastState: 'deviceLastState',
  lastUsed: 'lastUsedDevice'
}

function read<T>(key: string, fallback: T): T {
  try {
    const value = Taro.getStorageSync(key)
    return (value === '' || value === null || value === undefined) ? fallback : value as T
  } catch (e) {
    return fallback
  }
}

function write(key: string, value: any) {
  try {
    Taro.setStorageSync(key, value)
  } catch (e) {
    console.warn('写入本地存储失败:', key, e)
  }
}

/* ---------------- 绑定列表 ---------------- */

export function getFanDevices(): SavedFanDevice[] {
  const list = read<SavedFanDevice[]>(KEY.fans, [])
  return Array.isArray(list) ? list.filter(d => d && d.deviceId) : []
}

export function saveFanDevices(list: SavedFanDevice[]) {
  write(KEY.fans, list)
}

export function addFanDevice(device: { deviceId: string; name: string; RSSI?: number }): boolean {
  const list = getFanDevices()
  if (list.some(d => d.deviceId === device.deviceId)) return false
  list.push({
    deviceId: device.deviceId,
    name: device.name || '风扇',
    RSSI: device.RSSI,
    connected: false
  })
  saveFanDevices(list)
  return true
}

export function getStoryDevice(): StorySavedDevice | null {
  const device = read<StorySavedDevice | null>(KEY.story, null)
  return device && device.deviceId ? device : null
}

export function setStoryDevice(device: StorySavedDevice) {
  write(KEY.story, device)
}

export function removeStoryDevice() {
  try { Taro.removeStorageSync(KEY.story) } catch (e) {}
}

export function removeBoundDevice(id: string, kind: DeviceKind) {
  if (kind === 'fan') {
    saveFanDevices(getFanDevices().filter(d => d.deviceId !== id))
  } else {
    removeStoryDevice()
  }
  if (getLastUsed()?.id === id) {
    write(KEY.lastUsed, null)
  }
}

/* ---------------- 别名 ---------------- */

function getAliasMap(): Record<string, string> {
  const map = read<Record<string, string>>(KEY.alias, {})
  return map && typeof map === 'object' ? map : {}
}

export function getAlias(id: string): string {
  return getAliasMap()[id] || ''
}

export function setAlias(id: string, name: string) {
  const map = getAliasMap()
  const trimmed = String(name || '').trim()
  if (trimmed) map[id] = trimmed
  else delete map[id]
  write(KEY.alias, map)
}

/* ---------------- 上次连接 / 上次状态 ---------------- */

function getLastSeenMap(): Record<string, number> {
  const map = read<Record<string, number>>(KEY.lastSeen, {})
  return map && typeof map === 'object' ? map : {}
}

export function getLastSeen(id: string): number {
  return Number(getLastSeenMap()[id] || 0)
}

export function touchLastSeen(id: string) {
  const map = getLastSeenMap()
  map[id] = Date.now()
  write(KEY.lastSeen, map)
}

function getLastStateMap(): Record<string, string> {
  const map = read<Record<string, string>>(KEY.lastState, {})
  return map && typeof map === 'object' ? map : {}
}

export function getLastState(id: string): string {
  return getLastStateMap()[id] || ''
}

export function setLastState(id: string, text: string) {
  const map = getLastStateMap()
  if (text) map[id] = text
  else delete map[id]
  write(KEY.lastState, map)
}

/* ---------------- 最近使用 ---------------- */

export function getLastUsed(): { id: string; kind: DeviceKind } | null {
  const used = read<{ id: string; kind: DeviceKind } | null>(KEY.lastUsed, null)
  return used && used.id ? used : null
}

export function setLastUsed(id: string, kind: DeviceKind) {
  write(KEY.lastUsed, { id, kind })
}

/* ---------------- 汇总 ---------------- */

export function loadBoundDevices(): BoundDevice[] {
  const fans = getFanDevices().map<BoundDevice>((d) => ({
    id: d.deviceId,
    kind: 'fan',
    rawName: d.name || '风扇',
    name: getAlias(d.deviceId) || d.name || '风扇',
    lastSeen: getLastSeen(d.deviceId),
    lastState: getLastState(d.deviceId)
  }))

  const story = getStoryDevice()
  if (story) {
    fans.push({
      id: story.deviceId,
      kind: 'story',
      rawName: story.name || '故事机',
      name: getAlias(story.deviceId) || story.name || '故事机',
      lastSeen: getLastSeen(story.deviceId),
      lastState: getLastState(story.deviceId)
    })
  }

  return fans
}

export function formatLastSeen(ts: number): string {
  if (!ts) return '从未连接'
  const diff = Date.now() - ts
  if (diff < 60 * 1000) return '刚刚'
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  return '很久以前'
}

export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000))
  if (min < 1) return '不到 1 分钟'
  if (min < 60) return `${min} 分钟`
  const hour = Math.floor(min / 60)
  return `${hour} 小时 ${min % 60} 分钟`
}
