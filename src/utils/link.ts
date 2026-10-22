import Taro from '@tarojs/taro'
import { bleManager } from './ble'
import { storyBle } from './storyBle'
import type { DeviceKind } from './deviceStore'
import {
  setLastUsed,
  setLastState,
  touchLastSeen
} from './deviceStore'

/* 统一连接层: 全 App 同一时间只保留一条 BLE 链路。
   风扇和故事机原本各自持有一条连接, 这里负责:
   1) 连接新设备前先断开旧设备;
   2) 连接过程中上锁, 防止连点/并发;
   3) 轮询链路存活, 被动断开时把 UI 拉回未连接;
   4) 对外只暴露一个 snapshot。 */

export type LinkStatus = 'idle' | 'connecting' | 'connected' | 'switching'

export interface FanLive {
  progress: number
  mode: number
  v: number
  i: number
}

export interface StoryLive {
  play: boolean
  title: string
  vol: number
  used: number
  limit: number
  lock: number
}

export interface LinkSnapshot {
  status: LinkStatus
  deviceId: string
  kind: DeviceKind | ''
  since: number
  error: string
  authed: boolean
  fan: FanLive | null
  story: StoryLive | null
  elapsedMs: number
}

type Listener = (snapshot: LinkSnapshot) => void

const IDLE: LinkSnapshot = {
  status: 'idle',
  deviceId: '',
  kind: '',
  since: 0,
  error: '',
  authed: false,
  fan: null,
  story: null,
  elapsedMs: 0
}

let state: LinkSnapshot = { ...IDLE }
const listeners = new Set<Listener>()
let watchdog: ReturnType<typeof setInterval> | null = null
let lastSignature = ''

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function signature() {
  return [
    state.status,
    state.deviceId,
    state.since,
    state.authed,
    state.fan ? `${state.fan.progress}/${state.fan.mode}` : '-',
    state.story ? `${state.story.play}/${state.story.title}/${state.story.vol}` : '-',
    Math.floor(state.elapsedMs / 60000)
  ].join('|')
}

function emit(force = false) {
  const sig = signature()
  if (!force && sig === lastSignature) return
  lastSignature = sig
  const snapshot: LinkSnapshot = { ...state }
  listeners.forEach((fn) => {
    try { fn(snapshot) } catch (e) { console.warn('link listener error', e) }
  })
}

export function getLink(): LinkSnapshot {
  return { ...state }
}

export function subscribeLink(fn: Listener): () => void {
  listeners.add(fn)
  fn({ ...state })
  return () => listeners.delete(fn)
}

export function isConnectedTo(deviceId: string, kind?: DeviceKind): boolean {
  return state.status === 'connected' && state.deviceId === deviceId && (!kind || state.kind === kind)
}

export function needsSwitch(deviceId: string, kind?: DeviceKind): boolean {
  return state.status === 'connected' &&
    (state.deviceId !== deviceId || (!!kind && state.kind !== kind))
}

/* ---------------- 底层开关 ---------------- */

async function closeCurrent(): Promise<void> {
  const { deviceId, kind } = state
  try {
    if (kind === 'fan') {
      await bleManager.disconnect(deviceId)
    } else if (kind === 'story') {
      await storyBle.disconnect()
    }
  } catch (e) {
    console.warn('断开当前设备失败:', e)
  }
  captureLastState()
  if (deviceId) touchLastSeen(deviceId)
}

function captureLastState() {
  if (!state.deviceId) return
  if (state.kind === 'fan' && state.fan) {
    const { progress } = state.fan
    setLastState(state.deviceId, progress > 0 ? `上次运行 · 风速 ${progress}%` : '上次已停止')
  }
  if (state.kind === 'story' && state.story) {
    const { play, title } = state.story
    setLastState(state.deviceId, play && title ? `上次播放 · ${title}` : '上次待机')
  }
}

function readLive() {
  if (state.kind === 'fan') {
    const st = bleManager.getLastStatus()
    state.fan = st ? { progress: st.progress, mode: st.mode, v: st.v, i: st.i } : state.fan
  } else if (state.kind === 'story') {
    const st = storyBle.getStatus()
    if (st) {
      state.story = {
        play: !!st.play,
        title: st.title || '',
        vol: Number(st.vol) || 0,
        used: Number(st.used) || 0,
        limit: Number(st.limit) || 0,
        lock: Number(st.lock) || 0
      }
    }
    state.authed = storyBle.isAuthed()
  }
  state.elapsedMs = state.since ? Date.now() - state.since : 0
}

function isAlive(): boolean {
  if (state.kind === 'fan') {
    return bleManager.isConnected() && bleManager.getConnectedDeviceId() === state.deviceId
  }
  if (state.kind === 'story') {
    return storyBle.isConnected() && storyBle.getDeviceId() === state.deviceId
  }
  return false
}

function startWatchdog() {
  stopWatchdog()
  watchdog = setInterval(() => {
    if (state.status !== 'connected') {
      stopWatchdog()
      return
    }
    if (!isAlive()) {
      const lostId = state.deviceId
      captureLastState()
      if (lostId) touchLastSeen(lostId)
      state = { ...IDLE, error: '连接已断开' }
      stopWatchdog()
      emit(true)
      Taro.showToast({ title: '设备连接已断开', icon: 'none' })
      return
    }
    readLive()
    emit()
  }, 1200)
}

function stopWatchdog() {
  if (watchdog) {
    clearInterval(watchdog)
    watchdog = null
  }
}

/* ---------------- 对外动作 ---------------- */

export async function connectDevice(deviceId: string, kind: DeviceKind, name = ''): Promise<boolean> {
  if (state.status === 'connecting' || state.status === 'switching') return false
  if (isConnectedTo(deviceId, kind)) return true

  try {
    if (bleManager.isScanningNow()) await bleManager.stopScan()
  } catch (e) {}

  stopWatchdog()

  if (state.status === 'connected') {
    state = { ...state, status: 'switching', error: '' }
    emit(true)
    await closeCurrent()
    /* 部分安卓刚 close 就 create 会直接失败, 留一点间隔 */
    await sleep(300)
  }

  state = {
    ...IDLE,
    status: 'connecting',
    deviceId,
    kind
  }
  emit(true)

  try {
    if (kind === 'fan') {
      const ok = await bleManager.connect(deviceId)
      if (!ok) throw new Error('连接失败，请靠近风扇后重试')
    } else {
      await storyBle.connect(deviceId, name)
      if (!storyBle.isConnected()) throw new Error('连接失败，请重启故事机后重试')
    }

    state = {
      ...IDLE,
      status: 'connected',
      deviceId,
      kind,
      since: Date.now(),
      authed: kind === 'story' ? storyBle.isAuthed() : true
    }
    if (kind === 'story') {
      const st = storyBle.getStatus()
      state.story = st
        ? {
            play: !!st.play,
            title: st.title || '',
            vol: Number(st.vol) || 0,
            used: Number(st.used) || 0,
            limit: Number(st.limit) || 0,
            lock: Number(st.lock) || 0
          }
        : null
    }
    readLive()
    setLastUsed(deviceId, kind)
    touchLastSeen(deviceId)
    emit(true)
    startWatchdog()
    return true
  } catch (e: any) {
    const message = (e && (e.message || e.errMsg)) || '连接失败，请重试'
    state = { ...IDLE, error: message }
    emit(true)
    return false
  }
}

export async function disconnectDevice(silent = false): Promise<void> {
  if (state.status === 'idle') return
  stopWatchdog()
  await closeCurrent()
  state = { ...IDLE }
  emit(true)
  if (!silent) {
    Taro.showToast({ title: '已断开连接', icon: 'none' })
  }
}

/* 故事机页面自己走 storyBle.connect 之前调用: 若当前连着别的设备, 先释放链路 */
export async function releaseLinkFor(kind: DeviceKind, deviceId: string): Promise<void> {
  if (state.status !== 'connected') return
  if (state.kind === kind && state.deviceId === deviceId) return
  await disconnectDevice(true)
}

/* 首页快捷开关: 指令发出后先本地点亮, 再靠设备状态回读纠正 */
export function applyFanOptimistic(progress: number): void {
  if (state.kind !== 'fan') return
  const base = state.fan || { progress: 0, mode: 0, v: 0, i: 0 }
  state.fan = { ...base, progress }
  emit(true)
}

/* 从二级页返回首页时, 把页面自己建立的连接接管到统一状态里 */
export function syncLink(): void {
  if (state.status === 'connected') {
    if (isAlive()) {
      readLive()
      emit()
      return
    }
    const lostId = state.deviceId
    stopWatchdog()
    captureLastState()
    if (lostId) touchLastSeen(lostId)
    state = { ...IDLE, error: '连接已断开' }
    emit(true)
    return
  }

  if (state.status === 'connecting' || state.status === 'switching') return

  if (storyBle.isConnected() && storyBle.getDeviceId()) {
    const id = storyBle.getDeviceId()
    state = {
      ...IDLE,
      status: 'connected',
      deviceId: id,
      kind: 'story',
      since: Date.now(),
      authed: storyBle.isAuthed()
    }
    readLive()
    setLastUsed(id, 'story')
    touchLastSeen(id)
    emit(true)
    startWatchdog()
    return
  }

  if (bleManager.isConnected() && bleManager.getConnectedDeviceId()) {
    const id = bleManager.getConnectedDeviceId()
    state = {
      ...IDLE,
      status: 'connected',
      deviceId: id,
      kind: 'fan',
      since: Date.now(),
      authed: true
    }
    readLive()
    setLastUsed(id, 'fan')
    touchLastSeen(id)
    emit(true)
    startWatchdog()
  }
}
