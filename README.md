# sc-control · 故事机小程序

微信小程序（Taro 4 + Vue 3 + TypeScript），一个入口管理两类 BLE 设备：

- **风扇**：扫描 / 连接 / 模式与档位控制
- **故事机**：播放控制、内容库（故事 / 音乐 / 收藏）、家长控制（时长、睡眠时段、音量范围、内容分级、家长密码）

> 故事机固件在另一个 PlatformIO 工程里，本仓库只包含小程序代码。

## 页面

| 路径 | 说明 |
| --- | --- |
| `pages/home/index` | 我的设备（入口页） |
| `pages/fan/list/index` | 风扇列表 |
| `pages/fan/control/index` | 风扇控制 |
| `pages/story/home/index` | 故事机主页（内容库三个 tab） |
| `pages/story/parent/index` | 家长控制 |
| `pages/story/content/index` | 内容管理 |

## 开发

```bash
npm install
npm run dev:weapp       # 监听构建到 dist/
npm run build:weapp     # 生产构建
```

用微信开发者工具导入本目录即可：`project.config.json` 里 `miniprogramRoot` 指向 `dist/`。
`dist/` 与 `node_modules/` 不入库，克隆后先构建。

## 故事机 BLE 协议（摘要）

- 服务 `6b7a0001-3c4d-4e5f-8a9b-0c1d2e3f4a5b`
- 写特征 `6b7a0002-...`，通知特征 `6b7a0003-...`
- 文本行协议：UTF-8 JSON，以 `\n` 结尾；设备回复同样按行推送
- 常用命令：`hello` / `bind` / `auth` / `sync` / `get` / `set` / `ctrl` / `pin`
- 收藏：`ctrl {"action":"fav","value":<曲目下标>}`，返回 `{ok, f, n}`

客户端实现见 `src/utils/storyBle.ts`，连接失败会重置蓝牙适配器并重试，写入串行化，通知按字节流拼行（设备按 MTU 分片发送）。
