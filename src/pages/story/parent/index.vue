<template>
  <view class="page">
    <view class="hero">
      <view class="hero-glow"></view>
      <view class="hero-top">
        <view class="hero-copy">
          <text class="hero-kicker">PARENT CONTROL</text>
          <text class="hero-title">家长控制</text>
          <text class="hero-sub">{{ deviceName || '故事机' }} · {{ connected ? '已连接' : '未连接' }}</text>
        </view>
        <view class="hero-shield">护</view>
      </view>
      <view class="hero-stats" v-if="connected">
        <view class="stat">
          <text class="stat-num">{{ usedMin }}</text>
          <text class="stat-label">今日分钟</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat">
          <text class="stat-num">{{ limit ? Math.ceil(remaining / 60) : '不限' }}</text>
          <text class="stat-label">剩余分钟</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat">
          <text class="stat-num">{{ remoteLocked ? '已锁定' : '正常' }}</text>
          <text class="stat-label">设备状态</text>
        </view>
      </view>
    </view>

    <view class="content">
      <view v-if="!connected" class="connect-tip">
        <text class="tip-title">还未连接故事机</text>
        <text class="tip-desc">请先在故事机主页连接设备，再进入家长控制。</text>
        <view class="primary-btn" @tap="goHome">去连接</view>
      </view>

      <block v-else>
        <view v-if="needPin" class="pin-gate">
          <view class="pin-icon">护</view>
          <text class="pin-title">家长验证</text>
          <text class="pin-desc">请输入家长密码后继续</text>
          <input
            class="pin-input"
            type="number"
            maxlength="6"
            placeholder="••••"
            :value="pin"
            @input="onPinInput"
          />
          <text class="pin-error" v-if="pinError">{{ pinError }}</text>
          <view class="primary-btn" @tap="verifyPin">
            <text>进入家长控制</text>
          </view>
        </view>

        <block v-else>
          <view class="overview">
            <view class="overview-copy">
              <text class="overview-label">今日已使用</text>
              <view class="overview-value">
                <text class="overview-num">{{ usedMin }}</text>
                <text class="overview-unit">分钟</text>
              </view>
              <text class="overview-hint">{{ limit ? '剩余 ' + Math.ceil(remaining / 60) + ' 分钟 · 上限 ' + limit / 60 + ' 分钟' : '今日不限制时长' }}</text>
            </view>
            <view
              class="overview-ring"
              :style="{ background: 'conic-gradient(#ff9f43 ' + percent + '%, #f4eadf 0)' }"
            >
              <text>{{ limit ? percent + '%' : '∞' }}</text>
              <text class="ring-label">已用</text>
            </view>
          </view>

          <view class="group">
            <view class="group-head">
              <text class="group-title">每日时长</text>
              <text class="group-extra">次日 00:00 重置</text>
            </view>
            <view class="chips">
              <view
                v-for="item in limitOptions"
                :key="item.value"
                :class="['chip', { active: dailyLimit === item.value }]"
                @tap="setDailyLimit(item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
            <text class="hint">只统计故事机播放时间，到点自动暂停并锁定。</text>
          </view>

          <view class="group row-group">
            <view class="row-icon moon">月</view>
            <view class="row-copy">
              <text class="row-title">睡眠时段</text>
              <text class="row-desc">到点自动停播并锁定</text>
            </view>
            <switch
              :checked="bedtimeEnabled"
              color="#ff9f43"
              @change="onBedtimeToggle"
            />
          </view>

          <view class="group" v-if="bedtimeEnabled">
            <view class="time-row">
              <view class="time-col">
                <text class="time-label">开始</text>
                <picker mode="time" :value="bedStart" @change="onBedStartChange">
                  <view class="time-value">{{ bedStart }}</view>
                </picker>
              </view>
              <text class="time-arrow">→</text>
              <view class="time-col">
                <text class="time-label">结束</text>
                <picker mode="time" :value="bedEnd" @change="onBedEndChange">
                  <view class="time-value">{{ bedEnd }}</view>
                </picker>
              </view>
            </view>
            <text class="hint">跨午夜也可以，例如 20:30 → 07:00。</text>
          </view>

          <view class="group">
            <view class="group-head">
              <text class="group-title">音量范围</text>
              <text class="group-value">{{ volMin }} – {{ volMax }} / 21</text>
            </view>
            <view class="volume-row">
              <text class="volume-label">最低 {{ volMin }}</text>
              <slider
                class="volume-slider"
                :min="0"
                :max="21"
                :value="volMin"
                active-color="#ff9f43"
                background-color="#eef1f6"
                block-size="18"
                @changing="onVolMinChanging"
                @change="onVolMinChange"
              />
            </view>
            <view class="volume-row">
              <text class="volume-label">最高 {{ volMax }}</text>
              <slider
                class="volume-slider"
                :min="0"
                :max="21"
                :value="volMax"
                active-color="#ff9f43"
                background-color="#eef1f6"
                block-size="18"
                @changing="onVolMaxChanging"
                @change="onVolMaxChange"
              />
            </view>
            <text class="hint">孩子旋钮和手机控制只能在范围内调节，超出自动拉回。</text>
          </view>

          <view class="group row-group">
            <view class="row-icon pause">Ⅱ</view>
            <view class="row-copy">
              <text class="row-title">远程暂停</text>
              <text class="row-desc">立即暂停并锁定设备</text>
            </view>
            <switch
              :checked="remoteLocked"
              color="#ff9f43"
              @change="onRemoteLockChange"
            />
          </view>

          <view class="group row-group">
            <view class="row-icon child">锁</view>
            <view class="row-copy">
              <text class="row-title">童锁</text>
              <text class="row-desc">{{ childLock ? '实体按键和旋钮已锁定，手机仍可控制' : '防止孩子误触实体按键和旋钮' }}</text>
            </view>
            <switch
              :checked="childLock"
              color="#ff9f43"
              @change="onChildLockChange"
            />
          </view>

          <view class="group link-group" @tap="goContent">
            <view class="row-icon grid">选</view>
            <view class="row-copy">
              <text class="row-title">内容管理</text>
              <text class="row-desc">{{ allowlistEnabled ? '已开启内容限制' : '当前开放全部内容' }}</text>
            </view>
            <view class="chevron"></view>
          </view>

          <view class="inline-tip" v-if="!config || !config.hasPin">
            <text>尚未设置家长密码，建议先设置，防止孩子打开家长控制。</text>
          </view>

          <view class="group">
            <view class="group-head">
              <text class="group-title">家长密码</text>
              <text class="group-extra">{{ config && config.hasPin ? '已设置' : '未设置' }}</text>
            </view>
            <view v-if="!showPinEditor" class="pin-action" @tap="showPinEditor = true">
              <text>{{ config && config.hasPin ? '修改家长密码' : '设置家长密码' }}</text>
              <view class="chevron"></view>
            </view>
            <view v-else class="pin-editor">
              <input
                class="pin-input small"
                type="number"
                maxlength="6"
                placeholder="输入 4–6 位数字"
                :value="newPin"
                @input="onNewPinInput"
              />
              <view class="pin-editor-actions">
                <view class="ghost-btn" @tap="cancelPinEditor">取消</view>
                <view class="primary-btn mini" @tap="savePin">保存密码</view>
              </view>
            </view>
          </view>

          <view class="group">
            <view class="group-head">
              <text class="group-title">近 7 天使用</text>
              <text class="group-extra">分钟</text>
            </view>
            <view class="chart">
              <view v-for="item in reportItems" :key="item.day" class="chart-col">
                <view class="chart-bar" :style="{ height: item.height + 'rpx' }"></view>
                <text :class="['chart-label', { today: item.today }]">{{ item.label }}</text>
              </view>
            </view>
            <text class="hint" v-if="!reportItems.length">暂时没有使用记录。</text>
          </view>

          <view class="secure-note">
            <text class="secure-icon">锁</text>
            <text>策略保存在故事机本地，断开蓝牙或断电后仍然生效。</text>
          </view>

          <view class="primary-btn save-btn" @tap="saveConfig">
            <text>{{ saving ? '保存中...' : '保存家长设置' }}</text>
          </view>
        </block>
      </block>
    </view>
  </view>
</template>

<script>
import { computed, ref } from 'vue'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { storyBle } from '../../../utils/storyBle'
import './index.css'

const limitOptions = [
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 45, label: '45 分钟' },
  { value: 60, label: '60 分钟' },
  { value: 90, label: '90 分钟' },
  { value: 0, label: '不限' }
]

const toTime = (minutes) => {
  const m = Math.max(0, Math.min(1439, Number(minutes) || 0))
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
}

const toMinutes = (time) => {
  const parts = String(time || '00:00').split(':')
  return Number(parts[0] || 0) * 60 + Number(parts[1] || 0)
}

const dayLabel = (dayKey) => {
  const date = new Date(Number(dayKey) * 86400000)
  return (date.getMonth() + 1) + '/' + date.getDate()
}

export default {
  setup() {
    const connected = ref(false)
    const deviceName = ref('')
    const config = ref(null)
    const status = ref(null)
    const report = ref(null)
    const pinVerified = ref(false)
    const pin = ref('')
    const pinError = ref('')
    const showPinEditor = ref(false)
    const newPin = ref('')
    const saving = ref(false)

    const dailyLimit = ref(30)
    const bedtimeEnabled = ref(false)
    const bedStart = ref('20:30')
    const bedEnd = ref('07:00')
    const volMin = ref(3)
    const volMax = ref(12)
    const remoteLocked = ref(false)
    const childLock = ref(false)
    const allowlistEnabled = ref(false)

    /* 固件下发的 used / limit 都是"秒", 显示时再换成分钟 */
    const used = computed(() => Number(status.value?.used ?? config.value?.used ?? 0))
    const limit = computed(() => Number(status.value?.limit ?? config.value?.limit ?? 0))
    const remaining = computed(() => Math.max(0, limit.value - used.value))
    const usedMin = computed(() => Math.floor(used.value / 60))
    const percent = computed(() => (limit.value ? Math.min(100, Math.round((used.value / limit.value) * 100)) : 0))
    const needPin = computed(() => !!(config.value && config.value.hasPin) && !pinVerified.value)

    const reportItems = computed(() => {
      const data = report.value
      if (!data) return []
      const entries = [{ day: data.day, used: data.today, today: true }].concat(
        (data.history || []).map((item) => ({ day: item.day, used: item.used, today: false }))
      )
      /* 同一天只保留第一条 (今天优先), 避免图上出现重复日期 */
      const seen = new Set()
      const unique = []
      entries.forEach((item) => {
        const key = Number(item.day) || 0
        if (seen.has(key)) return
        seen.add(key)
        unique.push(item)
      })
      const max = Math.max(1, ...unique.map((item) => Number(item.used) || 0))
      /* 横轴从左到右 = 从旧到新, 今天排最右边 */
      return unique.slice(0, 7).reverse().map((item) => ({
        day: item.day,
        label: item.today ? '今' : dayLabel(item.day),
        today: item.today,
        height: Math.max(8, Math.round((Number(item.used) / max) * 120))
      }))
    })

    const toast = (title) => Taro.showToast({ title, icon: 'none', duration: 1800 })

    const loadSavedDevice = () => {
      try { return Taro.getStorageSync('storyDevice') || null } catch { return null }
    }

    const loadData = async () => {
      await storyBle.syncTime()
      const [cfg, st, rp] = await Promise.all([
        storyBle.getConfig(),
        storyBle.refreshState(),
        storyBle.getReport()
      ])
      config.value = cfg
      status.value = st
      report.value = rp
      dailyLimit.value = Number(cfg.dailyLimitMin || 0)
      bedtimeEnabled.value = !!cfg.bedtimeEnabled
      bedStart.value = toTime(cfg.bedStartMin)
      bedEnd.value = toTime(cfg.bedEndMin)
      volMin.value = Number(cfg.volMin || 0)
      volMax.value = Number(cfg.volMax || 21)
      remoteLocked.value = !!cfg.remoteLocked
      /* 旧固件还没有 childLock 字段: 保持当前开关, 不清零 */
      if (typeof cfg.childLock === 'boolean') childLock.value = cfg.childLock
      allowlistEnabled.value = !!cfg.allowlistEnabled
      pinVerified.value = !cfg.hasPin ? true : pinVerified.value
    }

    const handleStatus = (next) => {
      if (!next) return
      status.value = next
      if (typeof next.remote === 'boolean') remoteLocked.value = next.remote
      if (typeof next.childLock === 'boolean') childLock.value = next.childLock
      if (config.value && typeof next.bound === 'boolean') config.value.bound = next.bound
    }

    const connectSaved = async () => {
      const saved = loadSavedDevice()
      if (!saved) return false
      try {
        const info = await storyBle.connect(saved.deviceId, saved.name)
        deviceName.value = info.name || saved.name
        connected.value = true
        if (!storyBle.isAuthed()) {
          toast('需要在故事机主页完成绑定')
          return false
        }
        await loadData()
        return true
      } catch (e) {
        toast(e.message || '连接故事机失败')
        return false
      }
    }

    const goHome = () => Taro.navigateTo({ url: '/pages/story/home/index' })
    const goContent = () => Taro.navigateTo({ url: '/pages/story/content/index' })

    const onPinInput = (e) => {
      pin.value = String(e.detail.value || '').replace(/\D/g, '').slice(0, 6)
      pinError.value = ''
    }

    const onNewPinInput = (e) => {
      newPin.value = String(e.detail.value || '').replace(/\D/g, '').slice(0, 6)
    }

    const verifyPin = async () => {
      if (pin.value.length < 4) { pinError.value = '请输入 4–6 位家长密码'; return }
      try {
        const ok = await storyBle.verifyPin(pin.value)
        if (ok) {
          pinVerified.value = true
          pinError.value = ''
        } else {
          pinError.value = '密码不正确，请重试'
        }
      } catch (e) {
        pinError.value = e.message || '验证失败'
      }
    }

    const setDailyLimit = (value) => { dailyLimit.value = value }

    const onBedtimeToggle = (e) => { bedtimeEnabled.value = e.detail.value }

    const onBedStartChange = (e) => { bedStart.value = e.detail.value }
    const onBedEndChange = (e) => { bedEnd.value = e.detail.value }

    const onVolMinChanging = (e) => {
      volMin.value = Math.min(Number(e.detail.value), volMax.value - 1)
    }
    const onVolMinChange = (e) => {
      volMin.value = Math.max(0, Math.min(Number(e.detail.value), volMax.value - 1))
    }
    const onVolMaxChanging = (e) => {
      volMax.value = Math.max(Number(e.detail.value), volMin.value + 1)
    }
    const onVolMaxChange = (e) => {
      volMax.value = Math.min(21, Math.max(Number(e.detail.value), volMin.value + 1))
    }

    const onRemoteLockChange = async (e) => {
      const value = !!e.detail.value
      remoteLocked.value = value
      try {
        await storyBle.setConfig({ remoteLocked: value })
        toast(value ? '已暂停并锁定故事机' : '已解除暂停')
      } catch (err) {
        remoteLocked.value = !value
        toast(err.message || '操作失败')
      }
    }

    const onChildLockChange = async (e) => {
      const value = !!e.detail.value
      const previous = childLock.value
      childLock.value = value
      try {
        const cfg = await storyBle.setChildLock(value)
        if (cfg && typeof cfg.childLock === 'boolean') childLock.value = cfg.childLock
        toast(value ? '童锁已开启' : '童锁已关闭')
      } catch (err) {
        childLock.value = previous
        toast(err.message || '操作失败')
      }
    }

    const saveConfig = async () => {
      if (saving.value) return
      saving.value = true
      try {
        const cfg = await storyBle.setConfig({
          dailyLimitMin: dailyLimit.value,
          bedtimeEnabled: bedtimeEnabled.value,
          bedStartMin: toMinutes(bedStart.value),
          bedEndMin: toMinutes(bedEnd.value),
          volMin: volMin.value,
          volMax: volMax.value,
          childLock: childLock.value
        })
        config.value = cfg
        toast('家长设置已保存')
        await loadData()
      } catch (e) {
        toast(e.message || '保存失败')
      } finally {
        saving.value = false
      }
    }

    const savePin = async () => {
      if (!/^\d{4,6}$/.test(newPin.value)) {
        toast('家长密码需要 4–6 位数字')
        return
      }
      try {
        await storyBle.setPin(newPin.value)
        if (config.value) config.value.hasPin = true
        pinVerified.value = true
        newPin.value = ''
        showPinEditor.value = false
        toast('家长密码已保存')
      } catch (e) {
        toast(e.message || '保存失败')
      }
    }

    const cancelPinEditor = () => {
      showPinEditor.value = false
      newPin.value = ''
    }

    useDidShow(async () => {
      storyBle.onStatus(handleStatus)
      const saved = loadSavedDevice()
      deviceName.value = storyBle.getDeviceName() || saved?.name || ''

      if (storyBle.isConnected() && storyBle.isAuthed()) {
        connected.value = true
        try { await loadData() } catch (e) { toast(e.message || '读取配置失败') }
      } else {
        connected.value = await connectSaved()
      }
    })

    useDidHide(() => {
      storyBle.onStatus(null)
    })

    return {
      connected,
      deviceName,
      config,
      status,
      report,
      pinVerified,
      pin,
      pinError,
      showPinEditor,
      newPin,
      saving,
      dailyLimit,
      bedtimeEnabled,
      bedStart,
      bedEnd,
      volMin,
      volMax,
      remoteLocked,
      childLock,
      allowlistEnabled,
      limitOptions,
      used,
      usedMin,
      limit,
      remaining,
      percent,
      needPin,
      reportItems,
      goHome,
      goContent,
      onPinInput,
      onNewPinInput,
      verifyPin,
      setDailyLimit,
      onBedtimeToggle,
      onBedStartChange,
      onBedEndChange,
      onVolMinChanging,
      onVolMinChange,
      onVolMaxChanging,
      onVolMaxChange,
      onRemoteLockChange,
      onChildLockChange,
      saveConfig,
      savePin,
      cancelPinEditor
    }
  }
}
</script>
