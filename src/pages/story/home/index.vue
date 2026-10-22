<template>
  <view class="page">
    <view class="hero">
      <view class="hero-glow hero-glow-a"></view>
      <view class="hero-glow hero-glow-b"></view>
      <view class="hero-top">
        <view class="hero-copy">
          <text class="hero-kicker">STORY BOX</text>
          <text class="hero-title">{{ deviceName || '故事机' }}</text>
          <view class="hero-status">
            <view :class="['status-dot', { on: connected }]"></view>
            <text>{{ connected ? '已连接 · 蓝牙' : '未连接' }}</text>
          </view>
        </view>
        <view :class="['hero-badge', { on: connected }]">
          <text class="hero-badge-num">{{ connected ? 'ON' : 'OFF' }}</text>
          <text class="hero-badge-text">{{ connected ? '在线' : '离线' }}</text>
        </view>
      </view>
      <text class="hero-tip" v-if="connected">家长守护已开启 · 今日还可听 {{ remainingText }}</text>
      <text class="hero-tip" v-else>靠近故事机，连接后开始播放</text>
    </view>

    <view class="content">
      <!-- 未连接 -->
      <block v-if="!connected">
        <view class="connect-card">
          <view class="connect-icon">+</view>
          <text class="connect-title">添加故事机</text>
          <text class="connect-desc">打开故事机，靠近手机后扫描附近设备</text>
          <view class="primary-btn" @tap="startScan">
            <text>{{ scanning ? '正在扫描附近设备...' : '扫描故事机' }}</text>
          </view>
          <view v-if="savedDevice" class="saved-row" @tap="connectTo(savedDevice.deviceId, savedDevice.name)">
            <text class="saved-text">上次连接：{{ savedDevice.name }}</text>
            <text class="saved-link">重新连接</text>
          </view>
        </view>

        <view v-if="scanList.length" class="scan-card">
          <view class="section-head">
            <text class="section-title">附近的设备</text>
            <text class="section-extra">{{ scanList.length }} 台</text>
          </view>
          <view
            v-for="item in scanList"
            :key="item.deviceId"
            class="scan-item"
            @tap="connectTo(item.deviceId, item.name)"
          >
            <view class="scan-info">
              <text class="scan-name">{{ item.name }}</text>
              <text class="scan-id">{{ item.deviceId }}</text>
            </view>
            <text class="scan-rssi">{{ item.RSSI }}dBm</text>
          </view>
        </view>

        <view v-if="!scanList.length && !scanning" class="tip-card">
          <text>故事机开机后会广播 StoryBox-XXXX，请确认设备已开启。</text>
        </view>
      </block>

      <!-- 已连接 -->
      <block v-else>
        <view v-if="!authed" class="notice-card">
          <text class="notice-title">{{ hello && hello.bound ? '需要家长授权' : '首次绑定故事机' }}</text>
          <text class="notice-desc" v-if="!hello || !hello.bound">
            请查看故事机屏幕上的 6 位绑定码，输入后完成绑定。绑定码只在首次配对时显示。
          </text>
          <text class="notice-desc" v-else-if="hello.hasPin">
            这台故事机已绑定其他手机。输入家长密码即可授权本机，或先在设备端恢复出厂设置后重新绑定。
          </text>
          <text class="notice-desc" v-else>
            这台故事机已绑定，但还没有设置家长密码，直接授权即可继续。
          </text>

          <view v-if="hello && !hello.bound" class="bind-box">
            <view v-if="hello.code" class="bind-code-row">
              <text class="bind-code-label">设备绑定码</text>
              <text class="bind-code-value">{{ hello.code }}</text>
              <text class="bind-code-use" @tap="useBindCode">填入</text>
            </view>
            <input
              class="bind-input"
              type="number"
              maxlength="6"
              placeholder="输入 6 位绑定码"
              :value="bindCode"
              @input="onBindInput"
            />
            <view class="primary-btn" @tap="doBind">
              <text>{{ binding ? '绑定中...' : '完成绑定' }}</text>
            </view>
          </view>

          <view v-else-if="hello && hello.bound" class="bind-box">
            <block v-if="hello.hasPin">
              <input
                class="bind-input"
                type="password"
                maxlength="6"
                placeholder="输入家长密码"
                :value="authPin"
                @input="onAuthPinInput"
              />
              <view class="primary-btn" @tap="authByPin">
                <text>{{ authing ? '验证中...' : '验证并连接' }}</text>
              </view>
            </block>
            <view v-else class="primary-btn" @tap="authNoPin">
              <text>{{ authing ? '授权中...' : '直接授权' }}</text>
            </view>
          </view>

          <view class="secondary-btn" @tap="disconnect">
            <text>断开连接</text>
          </view>
        </view>

        <block v-else>
          <view v-if="locked" class="lock-card">
            <view class="lock-icon">护</view>
            <view class="lock-copy">
              <text class="lock-title">{{ lockTitle }}</text>
              <text class="lock-desc">故事机已锁定，可在家长控制中解锁</text>
            </view>
            <view class="lock-link" @tap="goParent">去解锁</view>
          </view>

          <view class="now-card">
            <view class="cover">
              <view class="cover-moon"></view>
              <view class="cover-stars"></view>
              <view class="cover-hill hill-a"></view>
              <view class="cover-hill hill-b"></view>
            </view>
            <view class="now-main">
              <view class="now-top">
                <text class="now-label">正在播放 · {{ status.mode === 'story' ? '故事' : '音乐' }}</text>
                <view :class="['live-dot', { paused: !status.play }]"></view>
              </view>
              <text class="now-title">{{ status.title || '选择一个故事' }}</text>
              <text class="now-sub">
                {{ status.dur ? formatTime(status.cur) + ' / ' + formatTime(status.dur) : '等待播放' }}
              </text>
              <view class="progress">
                <view class="progress-fill" :style="{ width: progress + '%' }"></view>
              </view>
              <view class="transport">
                <view class="ctrl-btn" @tap="prev">
                  <view class="tri tri-prev"></view>
                </view>
                <view class="play-btn" @tap="togglePlay">
                  <text>{{ status.play ? '暂停' : '播放' }}</text>
                </view>
                <view class="ctrl-btn" @tap="next">
                  <view class="tri tri-next"></view>
                </view>
                <text class="transport-note">{{ status.paused ? '已暂停' : '播放中' }}</text>
              </view>
            </view>
          </view>

          <view class="parent-banner" @tap="goParent">
            <view class="shield">护</view>
            <view class="parent-copy">
              <text class="parent-title">家长控制</text>
              <text class="parent-sub">{{ remainingText }} · 内容与音量已守护</text>
            </view>
            <view class="chevron"></view>
          </view>

          <view class="volume-card">
            <view class="card-head">
              <text class="card-title">音量</text>
              <text class="card-value">{{ status.vol }} / 范围 {{ status.volMin }}–{{ status.volMax }}</text>
            </view>
            <slider
              class="volume-slider"
              :min="status.volMin"
              :max="status.volMax"
              :value="status.vol"
              :disabled="locked"
              active-color="#ff9f43"
              background-color="#eef1f6"
              block-size="20"
              @changing="onVolumeChanging"
              @change="onVolumeChange"
            />
            <text class="volume-hint">家长设置的范围内可调，设备旋钮同样受限</text>
          </view>

          <view class="library-head">
            <text class="section-title">内容库</text>
            <view class="library-tabs">
              <view
                :class="['library-tab', { active: activeTab === 'story' }]"
                @tap="activeTab = 'story'"
              >
                <text>故事 {{ stories.length }}</text>
              </view>
              <view
                :class="['library-tab', { active: activeTab === 'music' }]"
                @tap="activeTab = 'music'"
              >
                <text>音乐 {{ music.length }}</text>
              </view>
              <view
                :class="['library-tab', { active: activeTab === 'fav' }]"
                @tap="activeTab = 'fav'"
              >
                <text>收藏 {{ favorites.length }}</text>
              </view>
            </view>
          </view>

          <block v-if="activeTab === 'story'">
            <view v-if="!stories.length" class="empty-card">
              <text class="empty-title">暂无开放的故事</text>
              <text class="empty-desc">请到「家长控制 → 内容管理」中勾选</text>
            </view>

            <view
              v-for="item in stories"
              :key="item.i"
              class="story-row"
              @tap="playStory(item)"
            >
              <image class="story-thumb" :src="storyIcon" mode="aspectFill" />
              <view class="story-copy">
                <text class="story-name">{{ item.n }}</text>
                <text class="story-meta">故事 · 点击播放</text>
              </view>
              <text :class="['story-state', { playing: status.title === item.n }]">
                {{ status.title === item.n ? '播放中' : '播放' }}
              </text>
            </view>
          </block>

          <block v-else-if="activeTab === 'music'">
            <view v-if="!music.length" class="empty-card">
              <text class="empty-title">暂无开放的音乐</text>
              <text class="empty-desc">请到「家长控制 → 内容管理」中勾选音乐分类</text>
            </view>

            <!-- 第一层: SD 卡 /music 下的文件夹 -->
            <block v-else-if="!currentFolder">
              <view
                v-for="group in musicGroups"
                :key="group.ci"
                class="folder-row"
                @tap="enterFolder(group)"
              >
                <image class="folder-icon" :src="groupIcon(group.name)" mode="aspectFill" />
                <view class="story-copy">
                  <text class="story-name">{{ group.name }}</text>
                  <text class="story-meta">文件夹 · {{ group.items.length }} 首</text>
                </view>
                <view class="chevron"></view>
              </view>
            </block>

            <!-- 第二层: 该文件夹里的歌曲 -->
            <block v-else>
              <view class="folder-back" @tap="leaveFolder">
                <text class="folder-back-text">‹ {{ currentFolder.name }}</text>
                <text class="group-count">{{ currentFolder.items.length }} 首</text>
              </view>
              <view
                v-for="item in currentFolder.items"
                :key="item.i"
                class="story-row"
                @tap="playMusic(item)"
              >
                <image class="story-thumb" :src="musicIcon" mode="aspectFill" />
                <view class="story-copy">
                  <text class="story-name">{{ musicName(item.n) }}</text>
                  <text class="story-meta">{{ status.title === item.n ? '播放中' : '点击播放' }}</text>
                </view>
                <view class="fav-btn" @tap.stop="toggleFav(item)">
                  <text :class="['fav-icon', { on: item.f }]">{{ item.f ? '★' : '☆' }}</text>
                </view>
              </view>
            </block>
          </block>

          <block v-else>
            <view v-if="!favorites.length" class="empty-card">
              <text class="empty-title">还没有收藏的歌曲</text>
              <text class="empty-desc">在音乐列表点 ☆，或在故事机歌曲列表长按 OK 收藏</text>
            </view>

            <view
              v-for="item in favorites"
              :key="item.i"
              class="story-row"
              @tap="playMusic(item)"
            >
              <image class="story-thumb" :src="musicIcon" mode="aspectFill" />
              <view class="story-copy">
                <text class="story-name">{{ musicName(item.n) }}</text>
                <text class="story-meta">{{ item.c }} · {{ status.title === item.n ? '播放中' : '点击播放' }}</text>
              </view>
              <view class="fav-btn" @tap.stop="toggleFav(item)">
                <text class="fav-icon on">★</text>
              </view>
            </view>
          </block>

          <view class="footer-actions">
            <view class="ghost-btn" @tap="refreshAll">刷新状态</view>
            <view class="ghost-btn danger" @tap="disconnect">断开连接</view>
          </view>
        </block>
      </block>

      <view v-if="connecting || syncing" class="loading-mask">
        <view class="loading-card">
          <view class="loading-spinner"></view>
          <text>{{ connecting ? '正在连接故事机...' : '数据同步中...' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { computed, ref } from 'vue'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { storyBle } from '../../../utils/storyBle'
import folderIcon from '../../../assets/story-icons/folder.png'
import musicIcon from '../../../assets/story-icons/music.png'
import nurseryRhymeIcon from '../../../assets/story-icons/nursery-rhyme.png'
import storyIcon from '../../../assets/story-icons/story.png'
import './index.css'

const emptyStatus = {
  play: false,
  paused: true,
  vol: 10,
  volMin: 3,
  volMax: 12,
  mode: 'idle',
  title: '',
  cur: 0,
  dur: 0,
  used: 0,
  limit: 0,
  lock: 0,
  reason: '',
  rem: 0,
  bedtime: false,
  remote: false,
  bound: true,
  timeSynced: false,
  dayKey: 0
}

export default {
  setup() {
    const savedDevice = ref(null)
    const connected = ref(false)
    const authed = ref(false)
    const hello = ref(null)
    const deviceName = ref('')
    const status = ref({ ...emptyStatus })
    const config = ref(null)
    const stories = ref([])
    const music = ref([])
    const activeTab = ref('story')
    const scanList = ref([])
    const scanning = ref(false)
    const connecting = ref(false)
    const syncing = ref(false)
    const binding = ref(false)
    const bindCode = ref('')
    const authPin = ref('')
    const authing = ref(false)

    /* 音乐按原始文件夹(分类)分组: ci=0 是 /music 根目录下的散曲 */
    const musicGroups = computed(() => {
      const groups = []
      const index = new Map()
      music.value.forEach((item) => {
        const ci = Number(item.ci || 0)
        if (!index.has(ci)) {
          const group = { ci, name: ci ? item.c : '根目录', items: [] }
          index.set(ci, group)
          groups.push(group)
        }
        index.get(ci).items.push(item)
      })
      return groups
    })
    const favorites = computed(() => music.value.filter((item) => item.f))

    const groupIcon = (name) => /童谣|儿歌|童歌/.test(name) ? nurseryRhymeIcon : folderIcon

    /* 音乐 tab: 先列 SD 卡里的文件夹, 点进去再看该文件夹的歌曲 */
    const folderCi = ref(null)
    const currentFolder = computed(() => {
      if (folderCi.value === null) return null
      return musicGroups.value.find((group) => group.ci === folderCi.value) || null
    })
    const enterFolder = (group) => { folderCi.value = group.ci }
    const leaveFolder = () => { folderCi.value = null }

    const locked = computed(() => Number(status.value.lock) !== 0)
    const progress = computed(() => {
      const dur = Number(status.value.dur || 0)
      if (!dur) return 0
      return Math.min(100, (Number(status.value.cur || 0) / dur) * 100)
    })
    const remainingText = computed(() => {
      const limit = Number(status.value.limit || 0)
      if (!limit) return '今日时长不限'
      const rem = Math.max(0, Number(status.value.rem || 0))
      return '今日还可听 ' + Math.ceil(rem / 60) + ' 分钟'
    })
    const lockTitle = computed(() => {
      const reason = status.value.reason
      if (reason === 'daily') return '今日故事时间已用完'
      if (reason === 'bedtime') return '该睡觉啦'
      if (reason === 'remote') return '家长已暂停'
      return '家长控制中'
    })

    const formatTime = (seconds) => {
      const s = Math.max(0, Math.floor(Number(seconds) || 0))
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
    }

    const toast = (title) => Taro.showToast({ title, icon: 'none', duration: 1800 })

    const loadSavedDevice = () => {
      try {
        savedDevice.value = Taro.getStorageSync('storyDevice') || null
      } catch {
        savedDevice.value = null
      }
    }

    const saveDevice = (deviceId, name) => {
      const device = { deviceId, name }
      savedDevice.value = device
      try { Taro.setStorageSync('storyDevice', device) } catch {}
    }

    const handleStatus = (next) => {
      if (!next) return
      status.value = { ...status.value, ...next }
    }

    const handleConnection = (online) => {
      if (!online) {
        connected.value = false
        authed.value = false
      }
    }

    const loadAll = async () => {
      if (!storyBle.isConnected() || !storyBle.isAuthed()) {
        authed.value = false
        return
      }
      authed.value = true
      syncing.value = true                       // 首次同步 110 首要轮询 28 页, 给个明确反馈
      try {
        /* 顺序读取: 协议是单条字节流, 并发发请求会让分片交错 */
        const st = await storyBle.refreshState()
        const cfg = await storyBle.getConfig()
        const list = await storyBle.getStories()
        const musicList = await storyBle.getMusic()
        status.value = { ...status.value, ...st }
        config.value = cfg
        stories.value = cfg.allowlistEnabled ? list.filter((item) => item.a) : list
        music.value = cfg.allowlistEnabled ? musicList.filter((item) => item.a) : musicList
        if (!stories.value.length && music.value.length) activeTab.value = 'music'
        if (!music.value.length && stories.value.length) activeTab.value = 'story'
      } finally {
        syncing.value = false
      }
    }

    const startScan = async () => {
      if (scanning.value) return
      scanning.value = true
      scanList.value = []
      try {
        const list = await storyBle.scan(8000)
        scanList.value = list
        if (!list.length) toast('没有发现故事机，请确认设备已开启')
      } catch (e) {
        toast(e.message || '扫描失败')
      } finally {
        scanning.value = false
      }
    }

    const connectTo = async (deviceId, name) => {
      if (connecting.value) return
      connecting.value = true
      let ok = false
      try {
        const info = await storyBle.connect(deviceId, name)
        connected.value = true
        hello.value = info
        deviceName.value = info.name || name || '故事机'
        saveDevice(storyBle.getDeviceId() || deviceId, deviceName.value)
        scanList.value = []
        authed.value = storyBle.isAuthed()
        ok = true
      } catch (e) {
        console.error('连接故事机失败:', e)
        toast(e.message || e.errMsg || '连接失败，请靠近故事机重试')
        connected.value = false
        authed.value = false
      } finally {
        connecting.value = false
      }
      /* 连接成功后再同步内容, 期间显示"数据同步中" */
      if (ok && authed.value) {
        try {
          await loadAll()
        } catch (e) {
          console.warn('已连接，但内容加载失败:', e)
          toast('已连接，内容加载超时，点「刷新状态」重试')
        }
      }
    }

    const onBindInput = (e) => {
      bindCode.value = String(e.detail.value || '').replace(/\D/g, '').slice(0, 6)
    }

    const doBind = async () => {
      if (binding.value) return
      if (!/^\d{6}$/.test(bindCode.value)) {
        toast('请输入故事机屏幕上的 6 位绑定码')
        return
      }
      binding.value = true
      try {
        await storyBle.bind(bindCode.value)
        hello.value = storyBle.getHello()
        authed.value = true
        bindCode.value = ''
        await loadAll()
        toast('绑定成功')
      } catch (e) {
        toast(e.message || '绑定失败')
      } finally {
        binding.value = false
      }
    }

    const onAuthPinInput = (e) => {
      authPin.value = String(e.detail.value || '').replace(/\D/g, '').slice(0, 6)
    }

    const useBindCode = () => {
      if (hello.value && hello.value.code) {
        bindCode.value = String(hello.value.code)
      }
    }

    const authByPin = async () => {
      if (authing.value) return
      if (authPin.value.length < 4) {
        toast('请输入家长密码')
        return
      }
      authing.value = true
      try {
        await storyBle.authWithPin(authPin.value)
        authed.value = true
        authPin.value = ''
        await loadAll()
        toast('验证成功')
      } catch (e) {
        toast(e.message || '家长密码不正确')
      } finally {
        authing.value = false
      }
    }

    /* 设备没设家长密码时: 不需要密码, 直接授权 */
    const authNoPin = async () => {
      if (authing.value) return
      authing.value = true
      try {
        await storyBle.authWithPin('')
        authed.value = true
        await loadAll()
        toast('已授权')
      } catch (e) {
        toast(e.message || '授权失败')
      } finally {
        authing.value = false
      }
    }

    const disconnect = async () => {
      await storyBle.disconnect()
      connected.value = false
      authed.value = false
      status.value = { ...emptyStatus }
      stories.value = []
      music.value = []
      hello.value = null
    }

    const togglePlay = async () => {
      if (locked.value) { toast(lockTitle.value); return }
      try {
        await storyBle.ctrl(status.value.play ? 'pause' : 'play')
        await storyBle.refreshState()
      } catch (e) {
        toast(e.message || '操作失败')
      }
    }

    const prev = async () => {
      if (locked.value) { toast(lockTitle.value); return }
      try {
        await storyBle.ctrl('prev')
        await storyBle.refreshState()
      } catch (e) {
        toast(e.message || '操作失败')
      }
    }

    const next = async () => {
      if (locked.value) { toast(lockTitle.value); return }
      try {
        await storyBle.ctrl('next')
        await storyBle.refreshState()
      } catch (e) {
        toast(e.message || '操作失败')
      }
    }

    const playStory = async (item) => {
      if (locked.value) { toast(lockTitle.value); return }
      try {
        await storyBle.ctrl('story', item.i)
        await storyBle.refreshState()
      } catch (e) {
        toast(e.message || '播放失败')
      }
    }

    const musicName = (name) => String(name || '').replace(/\.mp3$/i, '')

    const playMusic = async (item) => {
      if (locked.value) { toast(lockTitle.value); return }
      try {
        await storyBle.ctrl('music', item.i)
        await storyBle.refreshState()
      } catch (e) {
        toast(e.message || '播放失败')
      }
    }

    /* 收藏/取消收藏: 先乐观更新, 失败再回滚 */
    const toggleFav = async (item) => {
      if (!storyBle.isConnected() || !storyBle.isAuthed()) {
        toast('请先连接故事机')
        return
      }
      const want = !item.f
      item.f = want
      try {
        item.f = await storyBle.setFavorite(item.i)
      } catch (e) {
        item.f = !want
        toast(e.message || '收藏失败')
      }
    }

    const onVolumeChanging = (e) => {
      status.value.vol = e.detail.value
    }

    const onVolumeChange = async (e) => {
      const value = e.detail.value
      status.value.vol = value
      try {
        await storyBle.ctrl('volume', value)
      } catch (err) {
        toast(err.message || '音量设置失败')
      }
    }

    const refreshAll = async () => {
      try {
        await storyBle.syncTime()
        await loadAll()
        toast('已刷新')
      } catch (e) {
        toast(e.message || '刷新失败')
      }
    }

    const goParent = () => {
      if (!authed.value) return
      Taro.navigateTo({ url: '/pages/story/parent/index' })
    }

    useDidShow(async () => {
      storyBle.onStatus(handleStatus)
      storyBle.onConnection(handleConnection)
      loadSavedDevice()

      if (storyBle.isConnected()) {
        connected.value = true
        authed.value = storyBle.isAuthed()
        hello.value = storyBle.getHello()
        deviceName.value = storyBle.getDeviceName() || savedDevice.value?.name || '故事机'
        if (authed.value) {
          try { await loadAll() } catch (e) { console.warn(e) }
        }
      } else if (savedDevice.value && !connecting.value) {
        await connectTo(savedDevice.value.deviceId, savedDevice.value.name)
      }
    })

    useDidHide(() => {
      storyBle.onStatus(null)
      storyBle.onConnection(null)
    })

    return {
      savedDevice,
      connected,
      authed,
      hello,
      deviceName,
      status,
      config,
      stories,
      music,
      activeTab,
      scanList,
      scanning,
      connecting,
      syncing,
      musicGroups,
      favorites,
      groupIcon,
      musicIcon,
      storyIcon,
      currentFolder,
      enterFolder,
      leaveFolder,
      binding,
      bindCode,
      authPin,
      authing,
      locked,
      progress,
      remainingText,
      lockTitle,
      formatTime,
      startScan,
      connectTo,
      onBindInput,
      doBind,
      useBindCode,
      onAuthPinInput,
      authByPin,
      authNoPin,
      disconnect,
      togglePlay,
      prev,
      next,
      playStory,
      musicName,
      playMusic,
      toggleFav,
      onVolumeChanging,
      onVolumeChange,
      refreshAll,
      goParent
    }
  }
}
</script>
