<template>
  <view class="page">
    <view class="hero">
      <view class="hero-glow hero-glow-a"></view>
      <view class="hero-glow hero-glow-b"></view>

      <view class="hero-top">
        <view class="hero-copy">
          <text class="hero-kicker">FAN CONTROL</text>
          <text class="hero-title">{{ deviceName }}</text>
          <text class="hero-mac">{{ deviceId }}</text>
          <view class="hero-status">
            <view :class="['status-dot', { online: isConnected }]"></view>
            <text :class="['status-text', { online: isConnected }]">
              {{ isConnected ? '在线 · 蓝牙已连接' : '离线 · 等待连接' }}
            </text>
          </view>
        </view>
        <view :class="['status-pill', { online: isConnected }]">
          <text>{{ isConnected ? 'ON' : 'OFF' }}</text>
        </view>
      </view>

      <view class="hero-stage">
        <view class="fan-orb">
          <view class="fan-rotor" :style="fanStyle">
            <view class="fan-blade blade-a"></view>
            <view class="fan-blade blade-b"></view>
            <view class="fan-blade blade-c"></view>
            <view class="fan-hub"></view>
          </view>
        </view>

        <view class="hero-metrics">
          <view class="metric">
            <text class="metric-label">工作模式</text>
            <text class="metric-value">{{ modeLabel }}</text>
          </view>
          <view class="metric">
            <text class="metric-label">目标转速</text>
            <text class="metric-value">{{ targetProgress }}%</text>
          </view>
          <view class="metric">
            <text class="metric-label">实时功率</text>
            <text class="metric-value">{{ power }}<text class="metric-unit">W</text></text>
          </view>
        </view>
      </view>
    </view>

    <view class="content">
      <view v-if="!isConnected" class="offline-banner">
        <view class="offline-dot"></view>
        <text>设备已离线，当前数据可能不是最新</text>
      </view>

      <view class="control-card">
        <view class="card-head">
          <text class="card-title">运行控制</text>
          <view :class="['live-badge', { offline: !isConnected }]">
            <view class="live-dot"></view>
            <text>{{ isConnected ? '实时' : '离线' }}</text>
          </view>
        </view>

        <view class="field-head">
          <text class="field-label">工作模式</text>
          <text class="field-current">{{ modeLabel }}</text>
        </view>

        <view class="mode-switch">
          <view
            :class="['mode-option', { active: currentMode === 0 }]"
            @tap.stop="setMode(0)"
          >
            <text class="mode-name">{{ modes[0].label }}</text>
            <text class="mode-desc">响应更快</text>
          </view>
          <view
            :class="['mode-option', { active: currentMode === 1 }]"
            @tap.stop="setMode(1)"
          >
            <text class="mode-name">{{ modes[1].label }}</text>
            <text class="mode-desc">运行更平滑</text>
          </view>
        </view>
        <text class="mode-hint">
          {{ currentMode === 0 ? 'ESC 电调信号，适合快速响应与高转速' : 'PWM 占空比调速，低速运行更平稳' }}
        </text>

        <view class="card-divider"></view>

        <view class="speed-head">
          <text class="field-label">目标速度</text>
          <text class="speed-value">{{ targetProgress }}<text class="speed-unit">%</text></text>
        </view>

        <view class="custom-slider-container">
          <view
            class="capsule-slider"
            @touchstart="onSliderTouchStart"
            @touchmove.stop.prevent="onSliderTouchMove"
            @touchend="onSliderTouchEnd"
          >
            <view class="capsule-slider-track">
              <view class="capsule-slider-fill" :style="{ width: targetProgress + '%' }"></view>
            </view>
            <view class="capsule-slider-thumb-area">
              <view class="capsule-slider-thumb" :style="{ left: targetProgress + '%' }"></view>
            </view>
          </view>
          <view class="slider-scale">
            <text>0</text>
            <text>50</text>
            <text>100</text>
          </view>
        </view>

        <view class="preset-row">
          <view
            v-for="preset in [25, 50, 75, 100]"
            :key="preset"
            :class="['preset-chip', { active: targetProgress === preset }]"
            @tap="setSpeedPreset(preset)"
          >
            <text>{{ preset }}%</text>
          </view>
        </view>

        <view class="primary-btn" @tap="sendCommand">
          <text>确认下发</text>
          <text class="btn-arrow">→</text>
        </view>
        <text class="control-hint">调整模式或速度后，点「确认下发」设备才会执行</text>
      </view>

      <view class="section-head">
        <text class="section-title">实时数据</text>
        <text class="section-extra">每 5 秒刷新</text>
      </view>

      <view class="telemetry-row">
        <view class="data-card">
          <view class="data-icon data-icon-v">V</view>
          <text class="data-label">电压</text>
          <view class="data-value-row">
            <text class="data-value">{{ status.v.toFixed(2) }}</text>
            <text class="data-unit">V</text>
          </view>
        </view>
        <view class="data-card">
          <view class="data-icon data-icon-a">A</view>
          <text class="data-label">电流</text>
          <view class="data-value-row">
            <text class="data-value">{{ status.i.toFixed(2) }}</text>
            <text class="data-unit">A</text>
          </view>
        </view>
        <view class="data-card">
          <view class="data-icon data-icon-w">W</view>
          <text class="data-label">功率</text>
          <view class="data-value-row">
            <text class="data-value">{{ power }}</text>
            <text class="data-unit">W</text>
          </view>
        </view>
      </view>

      <view class="action-row">
        <view class="ghost-btn" @tap="refreshStatus">
          <view class="refresh-icon"></view>
          <text>刷新状态</text>
        </view>
        <view class="ghost-btn danger" @tap="disconnect">
          <view class="power-icon"></view>
          <text>断开连接</text>
        </view>
      </view>

      <view class="log-card">
        <view class="log-head" @tap="toggleLog">
          <view class="log-title-wrap">
            <view class="log-dot"></view>
            <text class="log-title">通信日志</text>
            <text class="log-count">{{ logCount }}</text>
          </view>
          <text class="log-toggle">{{ showLog ? '收起' : '展开' }}</text>
        </view>

        <view class="log-list" v-if="showLog && logs.length > 0">
          <view
            v-for="(log, index) in logs"
            :key="index"
            class="log-item"
          >
            <text class="log-time">{{ log.time }}</text>
            <text class="log-msg">{{ log.message }}</text>
          </view>
        </view>
        <view class="empty-log" v-else-if="showLog">
          <text class="empty-log-text">暂无通信记录</text>
        </view>
      </view>

      <view class="footer-note">蓝牙连接 · 风扇控制台</view>
    </view>
  </view>
</template>

<script>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { bleManager } from '../../../utils/ble'
import './index.css'

export default {
  setup() {
    const router = useRouter()
    const deviceId = ref('')
    const deviceName = ref('')
    const isConnected = ref(false)
    const status = ref({
      v: 0,
      i: 0,
      mode: 0,
      progress: 0
    })
    const currentMode = ref(0)
    const targetProgress = ref(50)
    const logs = ref([])
    const showLog = ref(true)
    let hasLocalChanges = false

    const modes = [
      { label: 'ESC 电调', value: 0 },
      { label: 'PWM 模式', value: 1 }
    ]

    const modeLabel = computed(() => modes.find(m => m.value === currentMode.value)?.label || '未知')
    const power = computed(() => (Number(status.value.v) * Number(status.value.i)).toFixed(1))
    const logCount = computed(() => logs.value.length)
    const fanStyle = computed(() => {
      const speed = Math.min(100, Math.max(0, Number(targetProgress.value) || 0))
      return {
        animationDuration: Math.max(0.9, 4.2 - speed * 0.032) + 's',
        animationPlayState: speed > 0 ? 'running' : 'paused'
      }
    })

    const addLog = (message) => {
      const now = new Date()
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      logs.value.unshift({ time, message })
      if (logs.value.length > 50) {
        logs.value.pop()
      }
    }

    const setMode = (mode) => {
      currentMode.value = mode
      hasLocalChanges = true
      addLog(`设置模式: ${modes.find(m => m.value === mode)?.label}`)
    }

    const toggleMode = () => {
      currentMode.value = currentMode.value === 0 ? 1 : 0
      hasLocalChanges = true
      addLog(`切换模式: ${modes.find(m => m.value === currentMode.value)?.label}`)
    }

    const onProgressChange = (e) => {
      targetProgress.value = e.detail.value
      hasLocalChanges = true
    }

    const setSpeedPreset = (value) => {
      targetProgress.value = value
      hasLocalChanges = true
      addLog(`设置速度: ${value}%`)
    }

    const toggleLog = () => {
      showLog.value = !showLog.value
    }

    let sliderRect = null

    const getSliderRect = async () => {
      return new Promise((resolve) => {
        Taro.createSelectorQuery()
          .select('.capsule-slider-thumb-area')
          .boundingClientRect((rect) => {
            sliderRect = rect
            resolve(rect)
          })
          .exec()
      })
    }

    const calcProgressFromTouch = (touchX) => {
      if (!sliderRect) return targetProgress.value
      const ratio = (touchX - sliderRect.left) / sliderRect.width
      const clamped = Math.min(1, Math.max(0, ratio))
      return Math.round(clamped * 100)
    }

    const onSliderTouchStart = async (e) => {
      await getSliderRect()
      if (sliderRect && e.touches[0]) {
        const newVal = calcProgressFromTouch(e.touches[0].clientX)
        if (newVal !== targetProgress.value) {
          targetProgress.value = newVal
          hasLocalChanges = true
        }
      }
    }

    const onSliderTouchMove = (e) => {
      if (sliderRect && e.touches[0]) {
        const newVal = calcProgressFromTouch(e.touches[0].clientX)
        if (newVal !== targetProgress.value) {
          targetProgress.value = newVal
          hasLocalChanges = true
        }
      }
    }

    const onSliderTouchEnd = () => {
      sliderRect = null
    }

    const sendCommand = async () => {
      const data = `M=${currentMode.value}&P=${targetProgress.value}`
      addLog(`发送: ${data}`)

      const success = await bleManager.sendData(data)
      if (success) {
        hasLocalChanges = false
        Taro.showToast({ title: '已确认', icon: 'success' })
        addLog('发送成功')
      } else {
        Taro.showToast({ title: '发送失败', icon: 'none' })
        addLog('发送失败')
      }
    }

    let pollTimer = null

    const startPolling = () => {
      stopPolling()
      pollTimer = setInterval(async () => {
        if (!bleManager.isConnected()) return
        try {
          await bleManager.readStatus()
        } catch {}
      }, 5000)
    }

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    const requestStatusWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        addLog(`查询状态 (${i + 1}/${retries})...`)

        try {
          await bleManager.readStatus()
        } catch {}

        const success = await bleManager.sendHeartbeat()
        if (success) {
          addLog('心跳已发送')
        } else {
          addLog('发送失败，重试...')
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        }

        const beforeV = status.value.v
        const beforeI = status.value.i
        await new Promise(resolve => setTimeout(resolve, 1500))

        if (status.value.v !== beforeV || status.value.i !== beforeI) {
          addLog(`收到设备响应: V=${status.value.v}V, I=${status.value.i}A`)
          return
        }

        if (i < retries - 1) {
          addLog('未收到响应，重试...')
        }
      }
      addLog('多次查询未收到设备响应')
    }

    const refreshStatus = async () => {
      await requestStatusWithRetry(3)
    }

    const disconnect = async () => {
      Taro.showModal({
        title: '确认断开',
        content: '确定要断开设备连接吗？',
        success: async (res) => {
          if (res.confirm) {
            await bleManager.disconnect(deviceId.value)
            isConnected.value = false
            addLog('设备已断开')
            Taro.showToast({ title: '已断开', icon: 'success' })
            setTimeout(() => {
              Taro.navigateBack()
            }, 1500)
          }
        }
      })
    }

    const handleStatusUpdate = (newStatus) => {
      status.value.v = newStatus.v
      status.value.i = newStatus.i
      if (!hasLocalChanges) {
        status.value.mode = newStatus.mode
        status.value.progress = newStatus.progress
        currentMode.value = newStatus.mode
        targetProgress.value = newStatus.progress
      }
      addLog(`收到: V=${newStatus.v}V, I=${newStatus.i}A, 模式=${modes.find(m => m.value === newStatus.mode)?.label || newStatus.mode}, 进度=${newStatus.progress}%`)
    }

    onMounted(async () => {
      deviceId.value = decodeURIComponent(router.params.deviceId || '')
      deviceName.value = decodeURIComponent(router.params.name || '未知设备')
      isConnected.value = bleManager.isConnected()

      bleManager.onStatusChange(handleStatusUpdate)

      addLog('页面已打开')
      if (isConnected.value) {
        addLog(`已连接: ${deviceId.value}`)

        addLog('刷新BLE订阅...')
        const subOk = await bleManager.refreshNotifySubscription()
        addLog(subOk ? 'BLE订阅已刷新' : 'BLE订阅刷新失败')

        setTimeout(() => {
          requestStatusWithRetry(3)
        }, 500)

        startPolling()
      } else {
        addLog('设备未连接')
      }
    })

    onUnmounted(() => {
      bleManager.onStatusChange(null)
      stopPolling()
    })

    return {
      deviceId,
      deviceName,
      isConnected,
      status,
      currentMode,
      targetProgress,
      logs,
      showLog,
      logCount,
      modeLabel,
      power,
      fanStyle,
      modes,
      setMode,
      toggleMode,
      onProgressChange,
      setSpeedPreset,
      toggleLog,
      onSliderTouchStart,
      onSliderTouchMove,
      onSliderTouchEnd,
      sendCommand,
      refreshStatus,
      disconnect
    }
  }
}
</script>
