# PhotoSweep · 安卓真机版（Expo / React Native）

一个真的能读你手机相册、真的能删照片的 Tinder 式清理应用。
**不需要在本机装 JDK / Android SDK**：APK 由 GitHub 的云端机器编译。

---

## 一、5 分钟拿到可安装的 APK（推荐路线）

全程只用浏览器，不装任何开发工具。

### 第 1 步：注册 GitHub
打开 <https://github.com/signup>，用邮箱注册一个免费账号（已有就跳过）。

### 第 2 步：新建一个空仓库
1. 右上角 `+` → **New repository**
2. Repository name 随便填，比如 `photosweep`
3. 选 **Public**（Private 也能构建，但免费额度用完会停）
4. **不要**勾选 `Add a README file`、`.gitignore`、`license`
5. 点 **Create repository**

### 第 3 步：把本项目上传上去
在新建好的仓库页面点 **uploading an existing file**（或 `Add file` → `Upload files`），
然后把你电脑上 **`photosweep/app` 文件夹里的所有内容**拖进上传框：

```
✔ App.tsx            ✔ package.json        ✔ .github/           ← 关键
✔ index.js           ✔ package-lock.json   ✔ assets/
✔ app.json           ✔ tsconfig.json       ✔ src/
✔ eas.json           ✔ babel.config.js     ✔ tools/
```

⚠️ 两个注意点：
- **不要把 `node_modules` 拖进去**（交付包里已经删掉了；它是几百 MB 的依赖缓存，网页上传会卡死）
- **`.github` 这个文件夹一定要传上去**，构建流程就写在里面。以点开头的文件夹在拖拽上传时可能被漏掉，
  如果上传后仓库里看不到 `.github`，用下面「第 3 步补」的方式手动创建。

### 第 3 步补（只有 `.github` 漏了才需要）
仓库页面 → `Add file` → **Create new file** → 文件名填：

```
.github/workflows/android.yml
```

（输入 `/` 会自动变成目录层级）然后把 `BUILD-FALLBACK.md` 里的内容整段粘进去，
底部点 **Commit changes**。

### 第 4 步：点一下，开始云端编译
1. 仓库顶部点 **Actions** 标签
2. 左侧列表点 **Build Android APK**
3. 右边点 **Run workflow** → 绿色按钮 **Run workflow**
4. 等 6~12 分钟（第一次要下载 Gradle 和依赖，会久一点），刷新页面能看到进度

### 第 5 步：下载并安装
编译完成后有两条下载途径：

- **手机上直接装**：进仓库右侧 **Releases** → 最新那条 → 点 `PhotoSweep.apk` 下载
- **或者**：Actions → 这次运行记录 → 页面底部 **Artifacts** → 下载 `PhotoSweep-APK.zip`，解压得到 APK

下载后点开 APK，安卓会提示「未知来源应用」——允许一次即可安装。
安装包用的是个人测试签名（不是上架用的正式签名），自己装完全没问题。

---

## 二、这个 APK 能做什么（和网页版的关键区别）

| 能力 | 网页/PWA 版 | 本版本 |
| --- | --- | --- |
| 读取整个相册 | ✘ 只能手选文件 | ✔ MediaStore 全量索引 |
| 物理删除照片 | ✘ 浏览器禁止 | ✔ `MediaStore.createDeleteRequest` |
| 系统级删除确认框 | ✘ | ✔ 安卓 11+ 强制弹出 |
| 触感反馈 | ✘ | ✔ 原生振动马达 |

删除链路是这样的（这也是它敢做"一键清理"的原因）：

```
右滑标记 → 只进内存待删列表（文件纹丝不动）
        ↓
终审九宫格 → 逐张可"移回"
        ↓
点「彻底清理」→ 系统弹窗「是否删除这 N 张照片？」
        ↓
用户点「允许」→ MediaStore 才真正物理删除
        ↓
回查 MediaStore 逐个确认，按真实结果结算
```

---

## 三、目录结构

```
app/
├─ App.tsx                    入口：主题 + 会话状态 + 页面切换
├─ index.js                   registerRootComponent
├─ app.json                   Expo 配置（包名、图标、相册权限文案）
├─ eas.json                   EAS 云构建配置（备用路线）
├─ .github/workflows/
│  └─ android.yml             云端编译 APK 的流水线
├─ assets/                    图标 / 自适应图标 / 启动图
├─ tools/gen_icons.py         图标生成脚本（纯 Python，无依赖）
└─ src/
   ├─ media.ts                ★ 原生桥接：MediaStore 读取 + 系统级删除
   ├─ photos.ts               真实 uri / 文件大小惰性解析 + 缓存
   ├─ useSession.ts           会话状态机（home → swipe → review → done）
   ├─ theme.tsx               深色/浅色主题（跟随系统）
   ├─ types.ts                数据契约
   ├─ format.ts               日期 / 体积格式化
   ├─ components/
   │  ├─ SwipeDeck.tsx        ★ 卡片堆 + 手势 + 物理反馈
   │  └─ ui.tsx               按钮 / 进度条 / 确认弹层 / Toast
   └─ screens/
      ├─ HomeScreen.tsx       批次模式选择 + 相册授权
      ├─ SwipeScreen.tsx      左右滑卡片流
      ├─ ReviewScreen.tsx     终审九宫格
      └─ DoneScreen.tsx       清理结算
```

---

## 四、想改代码？两条路

### A. 只想改完再出个包
改完代码 → 在 GitHub 网页上重新上传改动过的文件 → Actions → Run workflow。
**完全不需要本机环境。**

### B. 本机有 Node.js（想边改边看效果）
```bash
cd app
npm install
npx expo start          # 手机装 Expo Go，扫码即可预览
```
> Expo Go 里也能读取相册并测试删除流程，但如果哪天 Expo Go 的版本落后于项目 SDK，
> 用 `npx expo run:android`（需要本机装 Android SDK）或继续走云端构建。

---

## 五、备用路线：Expo 官方云构建（EAS）

如果你以后要上架、或者要给正式签名，用 EAS 更方便。需要一个 Expo 账号，
并且**在任意一台有 Node.js 的电脑上**（或 GitHub 网页里开一个 Codespace 终端）执行：

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

`eas.json` 里已经配好 `preview` 档：输出的是可以直接安装的 `.apk`（不是 `.aab`）。
构建在 Expo 云端的 Android 机器上完成，本机同样不需要 JDK。

---

## 六、常见问题

**Q：Actions 运行失败，红叉怎么办？**
点进失败的那次运行，展开红色步骤看报错。最常见两种：
- `Install dependencies` 失败 → 忘了传 `package-lock.json`，补传后重跑
- `assembleRelease` 失败 → 展开日志搜 `error:`，通常是 SDK 组件缺失，重跑一次基本能过

**Q：装的时候提示"应用未安装 / 包解析错误"？**
先卸载手机里同名的旧版本再装（测试签名变了会冲突）。

**Q：能不能删掉系统相册里"最近删除"里的照片？**
不能。安卓的回收站是系统保护的，App 只能把照片移进回收站，彻底抹掉要用户自己在系统相册里清空。

**Q：照片会被上传到服务器吗？**
不会。整个 App 没有网络请求，权限里也只有 `INTERNET`（Expo 开发期默认带上，运行时并不联网）。
所有数据只在你手机的 MediaStore 里流转。

**Q：为什么只索引了 1000 张？**
为了首屏速度和内存。`src/useSession.ts` 里的 `LIBRARY_LIMIT` 可以调大，
索引走的是 MediaStore 游标，只取轻量字段，加大到 5000 也不会明显卡。
