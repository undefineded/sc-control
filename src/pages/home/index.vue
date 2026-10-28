<template>
  <view class="page">
    <!-- 顶部 -->
    <view class="m-head">
      <view>
        <view class="m-title">我的设备</view>
        <view class="m-sub">已绑定 {{ devices.length }} 台 · {{ connected ? '1 台已连接' : '未连接' }}</view>
      </view>
      <view :class="['m-bt', btOff ? 'off' : '']">
        <view :class="['dot', btOff ? 'off' : 'on']"></view>
        <text>{{ btOff ? '蓝牙未开启' : '蓝牙已开启' }}</text>
      </view>
    </view>

    <!-- 当前连接 -->
    <view v-if="connected" class="conn">
      <view class="conn-top">
        <view class="conn-glyph">
          <view v-if="link.kind === 'fan'" class="fan-g">
            <view class="blade b1"></view>
            <view class="blade b2"></view>
            <view class="blade b3"></view>
            <view class="hub"></view>
          </view>
          <view v-else class="book-g">
            <view class="book-page left"></view>
            <view class="book-page right"></view>
            <view class="book-spine"></view>
          </view>
        </view>
        <view class="conn-id">
          <view class="conn-name">
            {{ connName }}
            <view class="conn-badge"><view class="bdot"></view>已连接</view>
          </view>
          <view class="conn-mac">{{ connMac }}</view>
        </view>
      </view>

      <view class="conn-state">
        <text class="conn-big">{{ connBig }}</text>
        <text class="conn-unit">{{ connUnit }}</text>
      </view>

      <view class="conn-foot">
        <text class="conn-time">{{ connMeta }}</text>
        <view class="conn-btn ghost" @tap="onDisconnect">断开</view>
        <view class="conn-btn primary" @tap="openConnected">进入控制 ›</view>
      </view>
    </view>

    <!-- 未连接 / 蓝牙关闭 -->
    <view v-else class="conn idle">
      <view class="conn-top">
        <view class="conn-glyph">
          <view class="bt-g">
            <view class="bt-ring a"></view>
            <view class="bt-ring b"></view>
          </view>
        </view>
        <view class="conn-id">
          <view class="conn-name">
            {{ btOff ? '蓝牙未开启' : '未连接' }}
            <view class="conn-badge idle-badge"><view class="bdot"></view>{{ btOff ? '需要开启' : '空闲' }}</view>
          </view>
          <view class="conn-mac">{{ btOff ? '打开手机蓝牙后才能发现设备' : '已绑定 ' + devices.length + ' 台设备' }}</view>
        </view>
      </view>

      <view class="conn-desc">{{ idleDesc }}</view>

      <view class="conn-foot">
        <text class="conn-time">同一时间只连一台</text>
        <view class="conn-btn ghost" @tap="onIdleSecondary">{{ btOff ? '重新检测' : '扫描附近' }}</view>
        <view v-if="!btOff && lastUsed" class="conn-btn primary" @tap="onQuickConnect">连接</view>
      </view>
    </view>

    <!-- 设备矩阵 -->
    <view class="m-sec">
      <view class="m-sec-head">
        <view class="m-sec-title">设备 <text class="m-sec-count">{{ devices.length }} 台</text></view>
        <text class="m-sec-hint">长按可重命名</text>
      </view>

      <view class="grid">
        <view
          v-for="d in devices"
          :key="d.id"
          :class="['tile', tileClass(d)]"
          hover-class="tile-hover"
          :hover-stay-time="60"
          @tap="onTileTap(d)"
          @longpress="onLongPress(d)"
        >
          <view class="tile-top">
            <view :class="['glyph', d.kind]">
              <view v-if="d.kind === 'fan'" class="fan-g">
                <view class="blade b1"></view>
                <view class="blade b2"></view>
                <view class="blade b3"></view>
                <view class="hub"></view>
              </view>
              <view v-else class="book-g">
                <view class="book-page left"></view>
                <view class="book-page right"></view>
                <view class="book-spine"></view>
              </view>
            </view>
            <view :class="['tag', tagClass(d)]">{{ tagText(d) }}</view>
          </view>

          <view class="tile-name">{{ d.name }}</view>
          <view class="tile-state">{{ stateText(d) }}</view>

          <view class="tile-foot">
            <text class="tile-meta">{{ metaText(d) }}</text>
            <view v-if="tileState(d) === 'offline'" class="pill" @tap.stop="onConnectTap(d)">连接</view>
            <view v-else-if="tileState(d) === 'connecting'" class="spinner"></view>
            <view
              v-else-if="d.kind === 'fan' && link.fan"
              :class="['switch', link.fan.progress > 0 ? 'on' : '']"
              @tap.stop="onFanToggle(d)"
            >
              <view class="knob"></view>
            </view>
            <text v-else class="tile-link" @tap.stop="openDevice(d)">控制 ›</text>
          </view>
        </view>

        <view class="add-tile" hover-class="tile-hover" @tap="onAddDevice">
          <view class="add-plus">+</view>
          <text class="add-name">添加设备</text>
          <text class="add-sub">蓝牙扫描</text>
        </view>
      </view>
    </view>

    <!-- 附近设备 -->
    <view class="near">
      <view class="near-head" @tap="onScanTap">
        <view class="near-dot"></view>
        <text class="near-title">附近设备</text>
        <text v-if="nearby.list.length" class="near-count">{{ nearby.list.length }} 台</text>
        <text class="near-action">{{ nearby.scanning ? '停止' : (nearby.open ? '重新扫描' : '扫描') }}</text>
      </view>

      <view v-if="nearby.scanning" class="near-scanning">正在扫描附近设备…</view>
      <view v-else-if="nearby.open && !nearby.list.length" class="near-empty">
        没有发现新设备，确认设备已开启并在附近
      </view>

      <view v-if="nearby.list.length" class="near-list">
        <view v-for="item in nearby.list" :key="item.deviceId" class="near-row">
          <view :class="['near-glyph', item.kind]">
            <view v-if="item.kind === 'fan'" class="fan-g sm">
              <view class="blade b1"></view>
              <view class="blade b2"></view>
              <view class="blade b3"></view>
              <view class="hub"></view>
            </view>
            <view v-else class="book-g sm">
              <view class="book-page left"></view>
              <view class="book-page right"></view>
              <view class="book-spine"></view>
            </view>
          </view>
          <view class="near-id">
            <view class="near-name">{{ item.name || '未命名设备' }}</view>
            <view class="near-mac">{{ item.RSSI }} dBm · 可接入</view>
          </view>
          <text class="near-rssi">{{ item.kind === 'story' ? '故事机' : '风扇' }}</text>
          <view class="pill" @tap.stop="onAdopt(item)">接入</view>
        </view>
      </view>
    </view>

    <view class="m-tip">
      <view class="m-tip-icon">i</view>
      <text class="m-tip-text">蓝牙同一时间只能连接一台设备；切换连接会先断开当前设备，设备保持原有运行状态。</text>
    </view>

    <!-- 切换连接确认 -->
    <view v-if="sheet.show" class="mask" @tap="closeSheet"></view>
    <view v-if="sheet.show" class="sheet" catch-move @tap.stop>
      <view class="grab"></view>
      <view class="sheet-title">切换连接？</view>
      <view class="sheet-desc">
        蓝牙同一时间只能连接一台设备，连接「{{ sheet.target ? sheet.target.name : '新设备' }}」会先断开「{{ connName }}」。
      </view>

      <view class="pair-wrap">
        <view class="pair current">
          <view :class="['pair-glyph', link.kind]">
            <view v-if="link.kind === 'fan'" class="fan-g xs">
              <view class="blade b1"></view>
              <view class="blade b2"></view>
              <view class="blade b3"></view>
              <view class="hub"></view>
            </view>
            <view v-else class="book-g xs">
              <view class="book-page left"></view>
              <view class="book-page right"></view>
              <view class="book-spine"></view>
            </view>
          </view>
          <view class="pair-info">
            <view class="pair-name">{{ connName }}</view>
            <view class="pair-meta">已连接 · {{ connBig }}</view>
          </view>
        </view>

        <text class="pair-arrow">→</text>

        <view class="pair">
          <view :class="['pair-glyph', sheet.target ? sheet.target.kind : 'fan']">
            <view v-if="!sheet.target || sheet.target.kind === 'fan'" class="fan-g xs">
              <view class="blade b1"></view>
              <view class="blade b2"></view>
              <view class="blade b3"></view>
              <view class="hub"></view>
            </view>
            <view v-else class="book-g xs">
              <view class="book-page left"></view>
              <view class="book-page right"></view>
              <view class="book-spine"></view>
            </view>
          </view>
          <view class="pair-info">
            <view class="pair-name">{{ sheet.target ? sheet.target.name : '' }}</view>
            <view class="pair-meta">{{ sheet.target && sheet.target.lastSeen ? '上次连接 ' + formatLastSeen(sheet.target.lastSeen) : '还未连接过' }}</view>
          </view>
        </view>
      </view>

      <view class="sheet-note">
        断开后设备会保持当前运行状态，随时可以再连回来；故事机连接后需要家长授权才能控制。
      </view>

      <view class="sheet-actions">
        <view class="btn ghost" @tap="closeSheet">取消</view>
        <view class="btn primary" @tap="confirmSwitch">断开并连接</view>
      </view>
    </view>

    <!-- 重命名 -->
    <view v-if="rename.show" class="mask" @tap="closeRename"></view>
    <view v-if="rename.show" class="dialog">
      <view class="dialog-title">重命名设备</view>
      <view class="dialog-desc">名称只保存在本机，允许重名</view>
      <input
        class="dialog-input"
        :value="rename.value"
        :focus="rename.show"
        :maxlength="12"
        placeholder="例如：客厅风扇"
        confirm-type="done"
        @input="onRenameInput"
        @confirm="saveRename"
      />
      <view class="dialog-actions">
        <view class="btn ghost" @tap="closeRename">取消</view>
        <view class="btn primary" @tap="saveRename">保存</view>
      </view>
    </view>
  </view>
</template>

<script>
import { computed, ref, watch } from 'vue'
import Taro, { useDidShow, useDidHide, useUnload } from '@tarojs/taro'
import { bleManager } from '../../utils/ble'
import {
  getLink,
  subscribeLink,
  connectDevice,
  disconnectDevice,
  needsSwitch,
  isConnectedTo,
  syncLink,
  applyFanOptimistic
} from '../../utils/link'
import {
  loadBoundDevices,
  getLastUsed,
  setAlias,
  removeBoundDevice,
  addFanDevice,
  formatLastSeen,
  formatDuration
} from '../../utils/deviceStore'
import './index.css'

export default {
  setup() {
    const devices = ref([])
    const link = ref(getLink())
    const btOff = ref(false)
    const sheet = ref({ show: false, target: null })
    const rename = ref({ show: false, id: '', value: '' })
    const nearby = ref({ open: false, scanning: false, list: [] })

    let unsubscribe = null
    let scanTimer = null
    let scanStopTimer = null
    let lastLongPressAt = 0
    const lastOnProgress = {}

    const connected = computed(() => link.value.status === 'connected')
    const connectedDevice = computed(() => {
      if (!connected.value) return null
      return devices.value.find(d => d.id === link.value.deviceId) || null
    })
    const connName = computed(() => {
      if (connectedDevice.value) return connectedDevice.value.name
      return link.value.kind === 'story' ? '故事机' : '设备'
    })
    const connMac = computed(() => {
      const d = connectedDevice.value
      if (!d) return '蓝牙设备'
      if (d.rawName && d.rawName !== d.name) return d.rawName
      return d.kind === 'fan' ? 'BLE 风扇' : 'BLE 故事机'
    })
    const connBig = computed(() => {
      if (link.value.kind === 'story') {
        return link.value.story && link.value.story.play ? '播放中' : '待机'
      }
      const fan = link.value.fan
      if (!fan) return '已连接'
      return fan.progress > 0 ? '运行中' : '已停止'
    })
    const connUnit = computed(() => {
      if (link.value.kind === 'story') {
        if (!link.value.authed) return '待家长授权'
        return link.value.story && link.value.story.title ? '《' + link.value.story.title + '》' : ''
      }
      const fan = link.value.fan
      if (!fan) return ''
      const mode = fan.mode === 0 ? 'ESC 模式' : 'PWM 模式'
      return fan.progress + '% · ' + mode
    })
    const connMeta = computed(() => {
      const elapsed = formatDuration(link.value.elapsedMs)
      if (link.value.kind === 'story') {
        return link.value.authed ? '已连接 ' + elapsed : '已连接 ' + elapsed + ' · 需家长授权'
      }
      const fan = link.value.fan
      const power = fan ? Number(fan.v) * Number(fan.i) : 0
      return '已连接 ' + elapsed + (power > 0.05 ? ' · ' + power.toFixed(1) + 'W' : '')
    })
    const lastUsed = computed(() => {
      const used = getLastUsed()
      if (used) {
        const hit = devices.value.find(d => d.id === used.id)
        if (hit) return hit
      }
      return devices.value[0] || null
    })
    const idleDesc = computed(() => {
      if (btOff.value) return '打开手机蓝牙后，才能发现并连接设备。'
      if (lastUsed.value && lastUsed.value.lastSeen) {
        return '最近使用「' + lastUsed.value.name + '」· 上次连接 ' + formatLastSeen(lastUsed.value.lastSeen) + '。连上后这里会直接显示它的状态。'
      }
      if (devices.value.length) return '从下面选择一台设备连接，同一时间只会连接一台。'
      return '还没有绑定设备，先从附近扫描接入第一台。'
    })

    watch(
      () => link.value.fan && link.value.fan.progress,
      (progress) => {
        if (progress && progress > 0 && link.value.deviceId) {
          lastOnProgress[link.value.deviceId] = progress
        }
      }
    )

    /* 连接切换后把已连接设备排到第一位 */
    watch(
      () => link.value.status + '|' + link.value.deviceId,
      () => reload()
    )

    /* ---------------- 数据 ---------------- */

    const reload = () => {
      const current = getLink()
      const connectedId = current.status === 'connected' ? current.deviceId : ''
      const list = loadBoundDevices()
      list.sort((a, b) => {
        if (a.id === connectedId && b.id !== connectedId) return -1
        if (b.id === connectedId && a.id !== connectedId) return 1
        return (b.lastSeen || 0) - (a.lastSeen || 0)
      })
      devices.value = list
    }

    const ensureBluetooth = async () => {
      try {
        await Taro.openBluetoothAdapter()
        btOff.value = false
      } catch (e) {
        const message = String((e && (e.errMsg || e.message)) || '')
        /* 已经打开时部分机型会抛 already opened，不算失败 */
        btOff.value = message.indexOf('already') === -1
      }
    }

    /* ---------------- 连接 ---------------- */

    const doConnect = async (device) => {
      const ok = await connectDevice(device.id, device.kind, device.rawName)
      if (!ok) {
        const message = getLink().error || '连接失败，请重试'
        Taro.showToast({ title: message, icon: 'none', duration: 2400 })
      }
      reload()
    }

    const onTileTap = (device) => {
      /* 长按会先触发 longpress 再触发 tap, 这里压掉, 避免弹完菜单又跳页 */
      if (Date.now() - lastLongPressAt < 800) return
      if (isConnectedTo(device.id, device.kind)) {
        openDevice(device)
        return
      }
      if (link.value.status === 'connecting' || link.value.status === 'switching') return
      if (needsSwitch(device.id, device.kind)) {
        sheet.value = { show: true, target: device }
        return
      }
      doConnect(device)
    }

    const onConnectTap = (device) => {
      onTileTap(device)
    }

    const onQuickConnect = () => {
      const target = lastUsed.value
      if (!target) return
      onTileTap(target)
    }

    const onDisconnect = async () => {
      await disconnectDevice()
      reload()
    }

    const confirmSwitch = async () => {
      const target = sheet.value.target
      sheet.value = { show: false, target: null }
      if (target) await doConnect(target)
    }

    const closeSheet = () => {
      sheet.value = { show: false, target: null }
    }

    const openDevice = (device) => {
      if (!device) return
      if (device.kind === 'fan') {
        Taro.navigateTo({
          url: '/pages/fan/control/index?deviceId=' + encodeURIComponent(device.id) + '&name=' + encodeURIComponent(device.name)
        })
      } else {
        Taro.navigateTo({ url: '/pages/story/home/index' })
      }
    }

    const openConnected = () => {
      if (connectedDevice.value) openDevice(connectedDevice.value)
    }

    /* ---------------- 风扇快捷开关 ---------------- */

    const onFanToggle = async (device) => {
      if (!isConnectedTo(device.id, 'fan')) return
      const fan = link.value.fan
      const current = fan ? Number(fan.progress) : 0
      const mode = fan ? Number(fan.mode) : 0
      const nextOn = current > 0 ? 0 : (lastOnProgress[device.id] || 50)
      const ok = await bleManager.sendData('M=' + mode + '&P=' + nextOn)
      if (!ok) {
        Taro.showToast({ title: '指令发送失败，请重试', icon: 'none' })
        return
      }
      applyFanOptimistic(nextOn)
      Taro.showToast({ title: nextOn > 0 ? '风速 ' + nextOn + '%' : '已关闭', icon: 'none' })
      setTimeout(() => {
        if (isConnectedTo(device.id, 'fan')) {
          bleManager.readStatus().catch(() => {})
        }
      }, 500)
    }

    /* ---------------- 附近设备 ---------------- */

    const refreshNearby = () => {
      const bound = {}
      devices.value.forEach((d) => { bound[d.id] = true })
      nearby.value.list = bleManager.getDiscoveredDevices()
        .filter(d => d.deviceId && !bound[d.deviceId])
        .map(d => ({
          ...d,
          kind: (d.name || '').indexOf('StoryBox-') === 0 ? 'story' : 'fan'
        }))
    }

    const stopScan = async () => {
      if (scanTimer) {
        clearInterval(scanTimer)
        scanTimer = null
      }
      if (scanStopTimer) {
        clearTimeout(scanStopTimer)
        scanStopTimer = null
      }
      try { await bleManager.stopScan() } catch (e) {}
      nearby.value.scanning = false
    }

    const startScan = async () => {
      if (nearby.value.scanning) {
        await stopScan()
        return
      }
      await ensureBluetooth()
      if (btOff.value) {
        Taro.showModal({
          title: '蓝牙未开启',
          content: '请到系统设置里打开蓝牙，然后回到小程序重试。',
          showCancel: false
        })
        return
      }
      nearby.value.open = true
      nearby.value.list = []
      nearby.value.scanning = true
      if (scanTimer) { clearInterval(scanTimer); scanTimer = null }
      if (scanStopTimer) { clearTimeout(scanStopTimer); scanStopTimer = null }
      try {
        await bleManager.startScan()
      } catch (e) {}
      refreshNearby()
      scanTimer = setInterval(refreshNearby, 800)
      scanStopTimer = setTimeout(() => { stopScan() }, 12000)
    }

    const onScanTap = () => {
      if (nearby.value.scanning) {
        stopScan()
      } else {
        startScan()
      }
    }

    const onAddDevice = () => {
      nearby.value.open = true
      if (!nearby.value.scanning) startScan()
    }

    const onIdleSecondary = () => {
      if (btOff.value) {
        ensureBluetooth().then(() => {
          if (!btOff.value) Taro.showToast({ title: '蓝牙已就绪', icon: 'none' })
        })
        return
      }
      startScan()
    }

    const onAdopt = async (item) => {
      if (item.kind === 'story') {
        Taro.showModal({
          title: '绑定故事机',
          content: '故事机需要先绑定并完成家长授权，去故事机页面继续。',
          confirmText: '去绑定',
          success: (res) => {
            if (res.confirm) Taro.navigateTo({ url: '/pages/story/home/index' })
          }
        })
        return
      }

      const added = addFanDevice({
        deviceId: item.deviceId,
        name: item.name || '风扇',
        RSSI: item.RSSI
      })
      await stopScan()
      nearby.value.open = false
      reload()
      if (added) Taro.showToast({ title: '已添加', icon: 'success' })
      const target = devices.value.find(d => d.id === item.deviceId)
      if (target) onTileTap(target)
    }

    /* ---------------- 重命名 / 删除 ---------------- */

    const onLongPress = (device) => {
      lastLongPressAt = Date.now()
      Taro.showActionSheet({
        itemList: ['重命名', '删除设备'],
        success: (res) => {
          if (res.tapIndex === 0) openRename(device)
          if (res.tapIndex === 1) confirmDelete(device)
        }
      })
    }

    const openRename = (device) => {
      rename.value = { show: true, id: device.id, value: device.name }
    }

    const onRenameInput = (e) => {
      rename.value = { ...rename.value, value: e.detail.value }
    }

    const closeRename = () => {
      rename.value = { show: false, id: '', value: '' }
    }

    const saveRename = () => {
      const name = String(rename.value.value || '').trim().slice(0, 12)
      if (!name) {
        Taro.showToast({ title: '请输入设备名称', icon: 'none' })
        return
      }
      setAlias(rename.value.id, name)
      closeRename()
      reload()
      Taro.showToast({ title: '已重命名', icon: 'none' })
    }

    const confirmDelete = (device) => {
      Taro.showModal({
        title: '删除设备',
        content: '删除「' + device.name + '」后，需要重新扫描才能接入。',
        confirmText: '删除',
        confirmColor: '#e85a5a',
        success: async (res) => {
          if (!res.confirm) return
          if (isConnectedTo(device.id)) {
            await disconnectDevice(true)
          }
          removeBoundDevice(device.id, device.kind)
          reload()
          Taro.showToast({ title: '已删除', icon: 'none' })
        }
      })
    }

    /* ---------------- 模板辅助 ---------------- */

    const tileState = (device) => {
      if (link.value.status === 'connected' && link.value.deviceId === device.id) return 'connected'
      if (link.value.status === 'connecting' && link.value.deviceId === device.id) return 'connecting'
      return 'offline'
    }
    const tileClass = (device) => {
      const state = tileState(device)
      return state === 'connected' ? 'on' : state === 'connecting' ? 'busy' : ''
    }
    const tagClass = (device) => {
      const state = tileState(device)
      return state === 'connected' ? 'live' : state === 'connecting' ? 'busy' : 'off'
    }
    const tagText = (device) => {
      const state = tileState(device)
      return state === 'connected' ? '已连接' : state === 'connecting' ? '连接中' : '未连接'
    }
    const stateText = (device) => {
      const state = tileState(device)
      if (state === 'connecting') return '正在建立连接…'
      if (state === 'connected') {
        if (device.kind === 'fan') {
          const fan = link.value.fan
          if (!fan) return '已连接'
          return fan.progress > 0 ? '运行中 · 风速 ' + fan.progress + '%' : '已停止'
        }
        if (!link.value.authed) return '已连接 · 待家长授权'
        const story = link.value.story
        if (!story) return '已连接 · 待机'
        return story.play ? '播放中 · ' + (story.title || '故事') : '已连接 · 待机'
      }
      return device.lastState || '还没有连接过'
    }
    const metaText = (device) => {
      const state = tileState(device)
      if (state === 'connected') return '已连接 ' + formatDuration(link.value.elapsedMs)
      if (state === 'connecting') return '请稍候'
      return device.lastSeen ? '上次连接 ' + formatLastSeen(device.lastSeen) : '从未连接'
    }

    /* ---------------- 生命周期 ---------------- */

    useDidShow(() => {
      reload()
      syncLink()
      link.value = getLink()
      ensureBluetooth()
      if (!unsubscribe) {
        unsubscribe = subscribeLink((snapshot) => {
          link.value = snapshot
        })
      }
    })

    useDidHide(() => {
      stopScan()
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
    })

    const onUnload = () => {
      stopScan()
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
    }
    useUnload(onUnload)

    return {
      devices,
      link,
      btOff,
      sheet,
      rename,
      nearby,
      connected,
      connName,
      connMac,
      connBig,
      connUnit,
      connMeta,
      lastUsed,
      idleDesc,
      formatLastSeen,
      onTileTap,
      onConnectTap,
      onQuickConnect,
      onDisconnect,
      confirmSwitch,
      closeSheet,
      openDevice,
      openConnected,
      onFanToggle,
      onScanTap,
      onAddDevice,
      onIdleSecondary,
      onAdopt,
      onLongPress,
      onRenameInput,
      saveRename,
      closeRename,
      tileClass,
      tagClass,
      tagText,
      stateText,
      metaText,
      tileState
    }
  }
}
</script>
