# `.github` 没上传成功时，用这个文件手动创建构建流程

只有在仓库里看不到 `.github/workflows/android.yml` 时才需要这一步。

操作：仓库页面 → `Add file` → **Create new file** → 文件名填
`.github/workflows/android.yml` → 把下面整段内容（从 `name: Build Android APK` 到最后一个 `--latest`）粘进去 → `Commit changes`。

```yaml
name: Build Android APK

# 触发方式（两种都行，互不干扰）：
# 1) 仓库页面 → Actions → 左侧「Build Android APK」→ 右侧 Run workflow（手动一键）
# 2) 推到 main / master 分支时自动构建
on:
  workflow_dispatch:
  push:
    branches: [main, master]

permissions:
  contents: write

# 同一分支只保留最新一次构建，避免排队堆积
concurrency:
  group: apk-${{ github.ref }}
  cancel-in-progress: true

jobs:
  apk:
    name: 编译可安装的 APK
    runs-on: ubuntu-latest
    timeout-minutes: 45

    steps:
      - name: 拉取代码
        uses: actions/checkout@v4

      # ---------------------------------------------------------------
      # 这一 step 专门用来「把文件放错位置」的情况讲清楚
      # 常见原因：把 app 文件夹整个传上来（多了层 app/），或漏传配置文件
      # ---------------------------------------------------------------
      - name: 检查项目文件是否放对位置
        run: |
          missing=""
          for f in package.json app.json index.js App.tsx tsconfig.json; do
            [ -f "$f" ] || missing="$missing $f"
          done

          if [ -n "$missing" ]; then
            echo "::error::仓库根目录缺少文件:$missing"
            echo ""
            echo "===== 当前仓库根目录内容 ====="
            ls -la
            echo ""
            echo "===== 全部文件（最多 100 条）====="
            find . -type f -not -path "./.git/*" | sort | head -100
            echo ""
            echo "排查提示："
            echo "  1) package.json 必须直接在仓库根目录，不能是 app/package.json"
            echo "  2) 请把 photosweep/app 文件夹「里面的内容」全选上传，而不是上传 app 文件夹本身"
            echo "  3) 上传前确认 .github、src、assets 三个文件夹也在"
            exit 1
          fi

          echo "文件检查通过 ✅"
          ls -la
          if [ -d assets ]; then
            echo "assets/ 目录已上传，图标直接使用仓库里的文件"
          else
            echo "::warning::assets/ 目录不存在（二进制图片没法在网页粘贴上传），下一步会自动生成图标，不影响打包"
          fi

      - name: 准备 Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: 准备 JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - name: 准备 Android SDK
        uses: android-actions/setup-android@v3

      - name: 安装依赖
        run: |
          if [ -f package-lock.json ]; then
            npm ci || npm install
          else
            npm install
          fi

      - name: 准备应用图标（缺失时云端自动生成）
        run: |
          need=0
          for f in assets/icon.png assets/adaptive-icon.png assets/splash-icon.png; do
            [ -f "$f" ] || need=1
          done
          if [ "$need" -eq 0 ]; then
            echo "图标文件已存在，跳过生成"
            exit 0
          fi
          echo "assets/ 里缺少图标，正在用内置脚本生成（约 10 秒）..."
          python3 - <<'PY'
          import math
          import os
          import struct
          import zlib

          OUT = "assets"
          TOP = (0x16, 0x3E, 0x31)
          BOT = (0x05, 0x11, 0x0E)
          CARD = (0xED, 0xF7, 0xF3)
          BACK = (0x7F, 0xB3, 0xA0)
          CHECK = (0x2F, 0xD1, 0x8E)


          def sd_rr(px, py, cx, cy, hw, hh, r):
              qx = abs(px - cx) - (hw - r)
              qy = abs(py - cy) - (hh - r)
              return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


          def sd_seg(px, py, ax, ay, bx, by, r):
              pax, pay = px - ax, py - ay
              bax, bay = bx - ax, by - ay
              den = bax * bax + bay * bay
              h = 0.0 if den == 0 else max(0.0, min(1.0, (pax * bax + pay * bay) / den))
              return math.hypot(pax - bax * h, pay - bay * h) - r


          def cov(d):
              return min(1.0, max(0.0, 0.5 - d))


          def render(size, opaque, scale):
              rgb = bytearray(size * size * 3)
              alpha = bytearray(size * size)
              c = size / 2.0
              hw = size * 0.285 * scale
              hh = size * 0.222 * scale
              rad = hw * 0.30
              off = size * 0.030 * scale
              stroke = max(1.5, size * 0.026 * scale)
              p1 = (c - hw * 0.40, c + hh * 0.04)
              p2 = (c - hw * 0.10, c + hh * 0.36)
              p3 = (c + hw * 0.44, c - hh * 0.38)
              x0 = max(0, int(c - hw - off - 10))
              x1 = min(size, int(c + hw + off + 10))
              y0 = max(0, int(c - hh - off - 10))
              y1 = min(size, int(c + hh + off + 10))
              for y in range(size):
                  base = y * size * 3
                  t = y / float(size - 1) if size > 1 else 0.0
                  bg = (TOP[0] + (BOT[0] - TOP[0]) * t,
                        TOP[1] + (BOT[1] - TOP[1]) * t,
                        TOP[2] + (BOT[2] - TOP[2]) * t)
                  band = y0 <= y < y1
                  for x in range(size):
                      if opaque:
                          r, g, b = bg
                          a = 1.0
                      else:
                          r = g = b = 0.0
                          a = 0.0
                      if band and x0 <= x < x1:
                          k = cov(sd_rr(x, y, c + off, c - off * 0.85, hw, hh, rad)) * 0.5
                          if k > 0:
                              r += (BACK[0] - r) * k
                              g += (BACK[1] - g) * k
                              b += (BACK[2] - b) * k
                              a = max(a, k)
                          k = cov(sd_rr(x, y, c, c, hw, hh, rad))
                          if k > 0:
                              r += (CARD[0] - r) * k
                              g += (CARD[1] - g) * k
                              b += (CARD[2] - b) * k
                              a = max(a, k)
                          k = cov(min(sd_seg(x, y, p1[0], p1[1], p2[0], p2[1], stroke),
                                      sd_seg(x, y, p2[0], p2[1], p3[0], p3[1], stroke)))
                          if k > 0:
                              r += (CHECK[0] - r) * k
                              g += (CHECK[1] - g) * k
                              b += (CHECK[2] - b) * k
                              a = max(a, k)
                      i = base + x * 3
                      rgb[i] = int(min(255, max(0, round(r))))
                      rgb[i + 1] = int(min(255, max(0, round(g))))
                      rgb[i + 2] = int(min(255, max(0, round(b))))
                      alpha[y * size + x] = int(min(255, max(0, round(a * 255))))
              return rgb, alpha


          def write_png(path, size, rgb, alpha=None):
              raw = bytearray()
              for y in range(size):
                  raw.append(0)
                  s = y * size * 3
                  raw += rgb[s:s + size * 3]
                  if alpha is not None:
                      raw += alpha[y * size:(y + 1) * size]
              ctype = 6 if alpha is not None else 2

              def chunk(tag, data):
                  return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

              png = b"\x89PNG\r\n\x1a\n"
              png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, ctype, 0, 0, 0))
              png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
              png += chunk(b"IEND", b"")
              with open(path, "wb") as f:
                  f.write(png)
              print("  " + path, len(png), "bytes")


          os.makedirs(OUT, exist_ok=True)
          write_png(OUT + "/icon.png", 1024, render(1024, True, 0.86)[0])
          rgb, al = render(1024, False, 0.72)
          write_png(OUT + "/adaptive-icon.png", 1024, rgb, al)
          rgb, al = render(512, False, 1.0)
          write_png(OUT + "/splash-icon.png", 512, rgb, al)
          print("图标生成完成")
          PY
          ls -lh assets/
          echo "图标准备完成"

      - name: 生成原生 Android 工程（expo prebuild）
        env:
          CI: "1"
        run: npx expo prebuild --platform android --no-install

      - name: 确认 SDK 组件齐备
        run: |
          yes | sdkmanager --licenses > /dev/null 2>&1 || true
          for pkg in "platforms;android-36" "build-tools;36.0.0" "platform-tools"; do
            sdkmanager "$pkg" > /dev/null 2>&1 || echo "跳过 $pkg（使用镜像自带版本）"
          done

      - name: 用 Gradle 编译 Release APK
        working-directory: android
        run: |
          chmod +x gradlew
          ./gradlew :app:assembleRelease --no-daemon --stacktrace

      - name: 重命名安装包
        run: |
          mkdir -p out
          cp android/app/build/outputs/apk/release/app-release.apk out/PhotoSweep.apk
          ls -lh out/

      - name: 上传 APK（Artifacts 里下载）
        uses: actions/upload-artifact@v4
        with:
          name: PhotoSweep-APK
          path: out/PhotoSweep.apk
          if-no-files-found: error

      - name: 发布到 Release（手机点链接直接下载安装）
        if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
        continue-on-error: true
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release create "v1.0.${{ github.run_number }}" out/PhotoSweep.apk \
            --title "PhotoSweep v1.0.${{ github.run_number }}" \
            --notes "自动构建的 Android 安装包（个人测试签名，可直接安装）。" \
            --latest
```

> 提示：`secrets.GITHUB_TOKEN` 是 GitHub 自动提供的，不用你配置任何密钥。
> 这份内容与仓库里的 `.github/workflows/android.yml` 完全一致，包含两步关键容错：
> 「检查项目文件是否放对位置」——缺文件时直接告诉你缺哪个，而不是裸 ENOENT；
> 「准备应用图标」——`assets/` 没上传时用内置纯 Python 脚本现场生成图标，打包不受影响。
