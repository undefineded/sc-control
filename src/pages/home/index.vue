<template>
  <view class="page">
    <view class="hero">
      <view class="hero-glow hero-glow-a"></view>
      <view class="hero-glow hero-glow-b"></view>

      <view class="hero-top">
        <view class="hero-copy">
          <text class="hero-kicker">DEVICE HUB</text>
          <text class="hero-title">我的设备</text>
          <text class="hero-subtitle">风扇与故事机，一处轻松管理</text>
        </view>
        <view class="hero-count">
          <text class="hero-count-num">2</text>
          <text class="hero-count-label">类设备</text>
        </view>
      </view>

      <view class="hero-footer">
        <view class="hero-chip">
          <view class="chip-dot chip-dot-online"></view>
          <text class="chip-text">风扇{{ fanCount > 0 ? ' ' + fanCount + ' 台' : ' 待添加' }}</text>
        </view>
        <view class="hero-chip">
          <view class="chip-dot chip-dot-plan"></view>
          <text class="chip-text">故事机 家长控制</text>
        </view>
      </view>
    </view>

    <view class="content">
      <view class="section-head">
        <text class="section-title">设备类型</text>
        <text class="section-extra">共 2 个入口</text>
      </view>

      <view class="device-card fan-card" hover-class="card-hover" @tap="openFan">
        <view class="card-accent card-accent-fan"></view>
        <view class="device-icon device-icon-fan">
          <view class="fan">
            <view class="fan-blade blade-1"></view>
            <view class="fan-blade blade-2"></view>
            <view class="fan-blade blade-3"></view>
            <view class="fan-hub"></view>
          </view>
        </view>

        <view class="device-body">
          <view class="device-title-row">
            <text class="device-title">风扇</text>
            <view class="device-tag tag-online">已支持</view>
          </view>
          <text class="device-desc">BLE 风扇 · 模式与档位控制</text>
          <view class="device-meta">
            <text class="device-meta-strong">{{ fanCount > 0 ? fanCount + ' 台设备' : '还未绑定设备' }}</text>
            <text class="device-meta-dot">·</text>
            <text>{{ fanCount > 0 ? '点击管理' : '点击添加' }}</text>
          </view>
        </view>

        <view class="chevron"></view>
      </view>

      <view class="device-card story-card" hover-class="card-hover" @tap="openStory">
        <view class="card-accent card-accent-story"></view>
        <view class="device-icon device-icon-story">
          <view class="book">
            <view class="book-page book-page-left"></view>
            <view class="book-page book-page-right"></view>
            <view class="book-spine"></view>
            <view class="book-star"></view>
          </view>
        </view>

        <view class="device-body">
          <view class="device-title-row">
            <text class="device-title">故事机</text>
            <view class="device-tag tag-plan">家长控制</view>
          </view>
          <text class="device-desc">故事机 · 家长控制</text>
          <view class="parent-strip">
            <view class="shield">
              <text class="shield-text">护</text>
            </view>
            <text class="parent-strip-text">使用时长 / 内容分级 / 音量范围</text>
          </view>
        </view>

        <view class="chevron"></view>
      </view>

      <view class="tip-card">
        <view class="tip-icon">i</view>
        <text class="tip-text">风扇通过蓝牙连接管理；故事机支持家长控制、内容分级与音量范围。</text>
      </view>
    </view>
  </view>
</template>

<script>
import { ref } from 'vue'
import Taro, { useDidShow } from '@tarojs/taro'
import './index.css'

export default {
  setup() {
    const fanCount = ref(0)

    const loadFanCount = () => {
      try {
        const devices = Taro.getStorageSync('savedDevices') || []
        fanCount.value = Array.isArray(devices) ? devices.length : 0
      } catch (e) {
        console.error('读取风扇数量失败:', e)
        fanCount.value = 0
      }
    }

    const openFan = () => {
      Taro.navigateTo({ url: '/pages/fan/list/index' })
    }

    const openStory = () => {
      Taro.navigateTo({ url: '/pages/story/home/index' })
    }

    useDidShow(loadFanCount)
    loadFanCount()

    return {
      fanCount,
      openFan,
      openStory
    }
  }
}
</script>
