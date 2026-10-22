# -*- coding: utf-8 -*-
"""Generate f2 (idle) / f3 (switch sheet) from f1 so the page markup stays in sync."""
import io
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "f1.html")

FAN = '''<svg class="ic" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="1.9"/>
              <ellipse cx="12" cy="6.4" rx="2.5" ry="4.9"/>
              <ellipse cx="12" cy="6.4" rx="2.5" ry="4.9" transform="rotate(120 12 12)"/>
              <ellipse cx="12" cy="6.4" rx="2.5" ry="4.9" transform="rotate(240 12 12)"/>
            </svg>'''

BOOK = '''<svg class="ic" viewBox="0 0 24 24">
              <path d="M12 6.4C10.5 5 8 4.5 5 4.5v14c3 0 5.5.5 7 2 1.5-1.5 4-2 7-2v-14c-3 0-5.5.5-7 2z"/>
              <path d="M12 6.4v14.1"/>
            </svg>'''

s = io.open(SRC, encoding="utf-8").read()

# ---------------- f2: nothing connected ----------------
s2 = s.replace("已绑定 3 台 · 1 台已连接", "已绑定 3 台 · 未连接")

IDLE = '''<div class="conn idle">
    <div class="conn-top">
      <div class="conn-glyph">
        <svg class="ic" viewBox="0 0 24 24"><path d="M12 3.6l6.2 6.7-6.2 6.7V3.6z"/><path d="M12 20.4l-6.2-6.7 6.2-6.7"/></svg>
      </div>
      <div class="conn-id">
        <div class="conn-name" style="color:#16202f">未连接<span class="conn-badge" style="background:#f1f4f9;color:#8794a6"><i style="background:#b9c3d2"></i>空闲</span></div>
        <div class="conn-mac" style="color:#93a0b2">蓝牙已开启 · 已绑定 3 台</div>
      </div>
    </div>
    <div class="conn-idle-desc" style="margin-top:12px">最近使用「风扇」· 上次连接 12 分钟前。选中一台连接后，这里会直接显示它的状态。</div>
    <div class="conn-foot">
      <span class="conn-time" style="color:#a8b2c1">同一时间只连一台</span>
      <button class="conn-btn ghost">扫描附近</button>
      <button class="conn-btn primary">连接风扇</button>
    </div>
  </div>

  '''
a = s2.index('<div class="conn">')
b = s2.index('<div class="m-sec">')
s2 = s2[:a] + IDLE + s2[b:]

OFFLINE_FAN = '''<div class="mtile">
        <div class="mtile-top">
          <div class="g blue">
            ''' + FAN + '''
          </div>
          <span class="mtile-tag off">未连接</span>
        </div>
        <div>
          <div class="mtile-name">风扇</div>
          <div class="mtile-state">上次运行 · 2 档</div>
        </div>
        <div class="mtile-foot">
          <span class="mtile-meta">上次连接 12 分钟前</span>
          <span class="pill soft">连接</span>
        </div>
      </div>

      '''
a = s2.index('<div class="mtile on">')
b = s2.index('<div class="mtile">')
s2 = s2[:a] + OFFLINE_FAN + s2[b:]
io.open(os.path.join(HERE, "f2.html"), "w", encoding="utf-8", newline="\n").write(s2)

# ---------------- f3: switch confirmation sheet ----------------
SHEET = '''
  <div class="mask"></div>
  <div class="sheet">
    <div class="grab"></div>
    <div class="sheet-title">切换连接？</div>
    <div class="sheet-desc">蓝牙同一时间只能连接一台设备，连接故事机会先断开风扇。</div>

    <div class="switch-pair">
      <div class="pair current">
        <div class="g blue">''' + FAN + '''</div>
        <div style="min-width:0">
          <div class="pair-name">风扇</div>
          <div class="pair-meta">已连接 · 运行中 2 档</div>
        </div>
      </div>
      <span class="pair-arrow">→</span>
      <div class="pair">
        <div class="g orange">''' + BOOK + '''</div>
        <div style="min-width:0">
          <div class="pair-name">故事机</div>
          <div class="pair-meta">上次连接 2 天前</div>
        </div>
      </div>
    </div>

    <div class="sheet-note">
      <svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>
      <span>断开后风扇会保持当前运行状态，随时可以再连回来；故事机连接后需要家长授权才能控制。</span>
    </div>

    <div class="sheet-actions">
      <button class="btn ghost">取消</button>
      <button class="btn primary">断开并连接</button>
    </div>
  </div>
'''

s3 = s.replace("</div>\n</body>", SHEET + "</div>\n</body>")
io.open(os.path.join(HERE, "f3.html"), "w", encoding="utf-8", newline="\n").write(s3)

print("f2/f3 written")
