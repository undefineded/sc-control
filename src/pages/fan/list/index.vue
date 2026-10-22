<template>
  <view class="page">
    <view class="header-bg">
      <view class="header-content">
        <text class="header-title">风扇</text>
        <text class="header-desc">BLE 风扇管理中心</text>
      </view>
    </view>

    <view class="content-area">
      <view class="add-btn" @tap="toggleScan">
        <text class="add-btn-icon">+</text>
        <text class="add-btn-text">添加设备</text>
      </view>

      <view class="device-list" v-if="savedDevices.length > 0">
        <view
          v-for="device in savedDevices"
          :key="device.deviceId"
          class="device-card"
          @tap="goToDevice(device)"
        >
          <view class="device-card-left">
            <view class="device-icon">
              <text class="device-icon-text">BLE</text>
            </view>
            <view class="device-info">
              <text class="device-name">{{ device.displayName || device.name }}</text>
              <text class="device-id">{{ device.deviceId }}</text>
            </view>
          </view>
          <view class="device-card-right">
            <view class="device-status">
              <view :class="['status-dot', { connected: device.connected }]"></view>
              <text :class="['status-text', { connected: device.connected }]">
                {{ device.connected ? '在线' : '离线' }}
              </text>
            </view>
            <view class="device-actions">
              <view
                :class="['action-btn', device.connected ? 'disconnect-btn' : 'connect-btn']"
                @tap.stop="toggleConnect(device)"
              >
                <text class="action-btn-text">{{ device.connected ? '断开' : '连接' }}</text>
              </view>
              <view
                class="action-btn delete-btn"
                @tap.stop="deleteDevice(device)"
              >
                <text class="action-btn-text">删除</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="empty-card" v-else>
        <view class="empty-icon">
          <text class="empty-icon-text">+</text>
        </view>
        <text class="empty-title">暂无设备</text>
        <text class="empty-desc">点击上方"添加设备"按钮扫描并连接风扇</text>
      </view>

      <view class="scan-card" v-if="showScan">
        <view class="scan-header">
          <text class="scan-title">附近设备</text>
          <view
            :class="['scan-toggle', { active: isScanning }]"
            @tap="toggleScan"
          >
            <text class="scan-toggle-text">{{ isScanning ? '停止' : '扫描' }}</text>
          </view>
        </view>

        <view class="scanning-tip" v-if="isScanning">
          <text class="scanning-text">正在扫描...</text>
        </view>

        <view class="scan-list" v-if="scannedDevices.length > 0">
          <view
            v-for="device in scannedDevices"
            :key="device.deviceId"
            class="scan-item"
          >
            <view class="scan-info">
              <text class="scan-name">{{ device.name || '未知设备' }}</text>
              <text class="scan-id">{{ device.deviceId }}</text>
            </view>
            <view class="scan-right">
              <text class="scan-rssi">{{ device.RSSI }}dBm</text>
              <view class="add-btn-small" @tap="addDevice(device)">
                <text class="add-btn-small-text">添加</text>
              </view>
            </view>
          </view>
        </view>

        <view class="empty-scan" v-else-if="!isScanning">
          <text class="empty-scan-text">未发现附近设备，请确保设备已开启</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import Taro from '@tarojs/taro'
import { bleManager } from '../../../utils/ble'
import './index.css'
import { connectDevice, disconnectDevice, isConnectedTo, needsSwitch, getLink } from '../../../utils/link'
import { getAlias } from '../../../utils/deviceStore'

export default {
  setup() {
    const savedDevices = ref([])
    const scannedDevices = ref([])
    const showScan = ref(false)
    const isScanning = ref(false)
    let scanTimer = null

    const loadSavedDevices = () => {
      try {
        const devices = Taro.getStorageSync('savedDevices') || []
        savedDevices.value = devices.map((d) => ({
          ...d,
          displayName: getAlias(d.deviceId) || d.name,
          connected: isConnectedTo(d.deviceId)
        }))
      } catch (e) {
        console.error('加载设备列表失败:', e)
      }
    }

    const saveDevices = () => {
      try {
        const raw = savedDevices.value.map(d => ({
          deviceId: d.deviceId,
          name: d.name,
          RSSI: d.RSSI,
          connected: false
        }))
        Taro.setStorageSync('savedDevices', raw)
      } catch (e) {
        console.error('保存设备列表失败:', e)
      }
    }

    const toggleScan = async () => {
      if (isScanning.value) {
        await bleManager.stopScan()
        isScanning.value = false
        if (scanTimer) {
          clearInterval(scanTimer)
          scanTimer = null
        }
      } else {
        showScan.value = true
        scannedDevices.value = []
        isScanning.value = true
        await bleManager.startScan()

        scanTimer = setInterval(() => {
          scannedDevices.value = bleManager.getDiscoveredDevices()
        }, 1000)

        setTimeout(async () => {
          if (isScanning.value) {
            await bleManager.stopScan()
            isScanning.value = false
            if (scanTimer) {
              clearInterval(scanTimer)
              scanTimer = null
            }
          }
        }, 30000)
      }
    }

    const addDevice = (device) => {
      const exists = savedDevices.value.find(d => d.deviceId === device.deviceId)
      if (!exists) {
        savedDevices.value.push({
          deviceId: device.deviceId,
          name: device.name || '未知设备',
          RSSI: device.RSSI,
          connected: false
        })
        saveDevices()
        Taro.showToast({ title: '添加成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '设备已存在', icon: 'none' })
      }
    }

    const deleteDevice = (device) => {
      Taro.showModal({
        title: '确认删除',
        content: `确定要删除设备"${device.displayName || device.name}"吗？`,
        success: async (res) => {
          if (res.confirm) {
            if (isConnectedTo(device.deviceId)) {
              await disconnectDevice(true)
            }
            savedDevices.value = savedDevices.value.filter(
              d => d.deviceId !== device.deviceId
            )
            saveDevices()
            loadSavedDevices()
            Taro.showToast({ title: '删除成功', icon: 'success' })
          }
        }
      })
    }

    const toggleConnect = async (device) => {
      if (isConnectedTo(device.deviceId)) {
        await disconnectDevice()
        loadSavedDevices()
        return
      }

      if (needsSwitch(device.deviceId, 'fan')) {
        const res = await Taro.showModal({
          title: '切换连接',
          content: '蓝牙同一时间只能连接一台设备，连接这台会先断开当前设备。',
          confirmText: '继续连接'
        })
        if (!res.confirm) return
      }

      Taro.showLoading({ title: '连接中...' })
      const ok = await connectDevice(device.deviceId, 'fan', device.name)
      Taro.hideLoading()

      if (ok) {
        Taro.showToast({ title: '连接成功', icon: 'success' })
      } else {
        Taro.showToast({
          title: getLink().error || '连接失败，请确认设备已开启',
          icon: 'none',
          duration: 2500
        })
      }
      loadSavedDevices()
    }

    const goToDevice = async (device) => {
      if (!isConnectedTo(device.deviceId)) {
        const res = await Taro.showModal({
          title: '提示',
          content: '设备未连接，是否先连接？'
        })
        if (!res.confirm) return
        await toggleConnect(device)
        if (!isConnectedTo(device.deviceId)) return
      }
      Taro.navigateTo({
        url: `/pages/fan/control/index?deviceId=${encodeURIComponent(device.deviceId)}&name=${encodeURIComponent(device.displayName || device.name)}`
      })
    }

    onMounted(() => {
      loadSavedDevices()
    })

    onUnmounted(() => {
      if (isScanning.value) {
        bleManager.stopScan()
      }
      if (scanTimer) {
        clearInterval(scanTimer)
      }
    })

    return {
      savedDevices,
      scannedDevices,
      showScan,
      isScanning,
      toggleScan,
      addDevice,
      deleteDevice,
      toggleConnect,
      goToDevice
    }
  }
}
</script>
