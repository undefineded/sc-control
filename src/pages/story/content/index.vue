<template>
  <view class="page">
    <view class="top-card">
      <view class="top-copy">
        <text class="top-kicker">CONTENT GUARD</text>
        <text class="top-title">内容管理</text>
        <text class="top-sub">关闭的内容会在故事机上隐藏</text>
      </view>
      <view class="top-badge">
        <text class="top-badge-num">{{ enabled ? 'ON' : 'OFF' }}</text>
        <text class="top-badge-text">内容限制</text>
      </view>
    </view>

    <view class="content">
      <view class="enable-card">
        <view class="enable-copy">
          <text class="enable-title">启用内容限制</text>
          <text class="enable-desc">开启后只显示勾选的故事和音乐分类</text>
        </view>
        <switch :checked="enabled" color="#ff9f43" @change="onEnableChange" />
      </view>

      <view class="info-banner">
        新增内容默认不开放，需要家长手动勾选。位图保存在故事机，换卡后仍然生效。
      </view>

      <view class="tabs">
        <view :class="['tab', { active: tab === 'story' }]" @tap="tab = 'story'">
          <text>故事</text>
          <text class="tab-count">{{ storySelected }}/{{ stories.length }}</text>
        </view>
        <view :class="['tab', { active: tab === 'music' }]" @tap="tab = 'music'">
          <text>音乐分类</text>
          <text class="tab-count">{{ catSelected }}/{{ categories.length }}</text>
        </view>
      </view>

      <view class="bulk-row">
        <text class="bulk-count">已选 {{ tab === 'story' ? storySelected : catSelected }} 项</text>
        <view class="bulk-actions">
          <view class="bulk-btn" @tap="selectAll">全选</view>
          <view class="bulk-btn" @tap="clearAll">全不选</view>
        </view>
      </view>

      <view v-if="loading" class="empty-card">正在读取故事机内容...</view>

      <block v-else>
        <view v-if="tab === 'story'" class="list">
          <view v-if="!stories.length" class="empty-card">故事机里还没有故事</view>
          <view
            v-for="item in stories"
            :key="item.i"
            class="item-row"
            @tap="toggleStory(item)"
          >
            <view :class="['check', { on: item.a }]"></view>
            <image class="content-icon" :src="storyIcon" mode="aspectFill" />
            <view class="item-copy">
              <text class="item-name">{{ item.n }}</text>
              <text class="item-meta">故事</text>
            </view>
            <text class="item-tag">{{ item.a ? '开放' : '隐藏' }}</text>
          </view>
        </view>

        <view v-else class="list">
          <view v-if="!categories.length" class="empty-card">故事机里还没有音乐分类</view>
          <view
            v-for="item in categories"
            :key="item.i"
            class="item-row"
            @tap="toggleCategory(item)"
          >
            <view :class="['check', { on: item.a }]"></view>
            <image class="content-icon" :src="folderIcon" mode="aspectFill" />
            <view class="item-copy">
              <text class="item-name">{{ item.n }}</text>
              <text class="item-meta">音乐分类 · {{ item.c }} 首</text>
            </view>
            <text class="item-tag">{{ item.a ? '开放' : '隐藏' }}</text>
          </view>
        </view>
      </block>

      <view class="note">
        内容限制只影响设备上的显示与播放，不会删除 TF 卡里的文件。
      </view>

      <view class="primary-btn" @tap="save">
        <text>{{ saving ? '同步中...' : '保存并同步到故事机' }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { computed, ref } from 'vue'
import Taro, { useDidShow } from '@tarojs/taro'
import { storyBle } from '../../../utils/storyBle'
import folderIcon from '../../../assets/story-icons/folder.png'
import storyIcon from '../../../assets/story-icons/story.png'
import './index.css'

export default {
  setup() {
    const loading = ref(true)
    const saving = ref(false)
    const enabled = ref(false)
    const tab = ref('story')
    const stories = ref([])
    const categories = ref([])

    const storySelected = computed(() => stories.value.filter((item) => item.a).length)
    const catSelected = computed(() => categories.value.filter((item) => item.a).length)

    const toast = (title) => Taro.showToast({ title, icon: 'none', duration: 1800 })

    const load = async () => {
      loading.value = true
      try {
        const cfg = await storyBle.getConfig()
        const [st, cat] = await Promise.all([storyBle.getStories(), storyBle.getCategories()])
        enabled.value = !!cfg.allowlistEnabled
        stories.value = st.map((item) => ({ ...item, a: !!item.a }))
        categories.value = cat.map((item) => ({ ...item, a: !!item.a }))
      } catch (e) {
        toast(e.message || '读取内容失败')
      } finally {
        loading.value = false
      }
    }

    const onEnableChange = (e) => {
      enabled.value = !!e.detail.value
    }

    const toggleStory = (item) => {
      item.a = !item.a
    }

    const toggleCategory = (item) => {
      item.a = !item.a
    }

    const selectAll = () => {
      if (tab.value === 'story') stories.value.forEach((item) => { item.a = true })
      else categories.value.forEach((item) => { item.a = true })
    }

    const clearAll = () => {
      if (tab.value === 'story') stories.value.forEach((item) => { item.a = false })
      else categories.value.forEach((item) => { item.a = false })
    }

    const save = async () => {
      if (saving.value) return
      saving.value = true
      try {
        const allowStories = stories.value.filter((item) => item.a).map((item) => item.i)
        const allowCats = categories.value.filter((item) => item.a).map((item) => item.i)
        await storyBle.setConfig({
          allowlistEnabled: enabled.value,
          allowStories,
          allowCats
        })
        toast('已同步到故事机')
        setTimeout(() => Taro.navigateBack(), 700)
      } catch (e) {
        toast(e.message || '保存失败')
      } finally {
        saving.value = false
      }
    }

    useDidShow(async () => {
      if (!storyBle.isConnected() || !storyBle.isAuthed()) {
        loading.value = false
        toast('故事机未连接，请先返回连接')
        return
      }
      await load()
    })

    return {
      loading,
      saving,
      enabled,
      tab,
      stories,
      categories,
      storySelected,
      catSelected,
      folderIcon,
      storyIcon,
      onEnableChange,
      toggleStory,
      toggleCategory,
      selectAll,
      clearAll,
      save
    }
  }
}
</script>
