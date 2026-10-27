# 补传清单：把文件传到 GitHub 的正确方式

## 1. 这些文件在你电脑的哪里

完整路径（复制到资源管理器地址栏回车即可打开）：

```
C:/Users/19353/WorkBuddy/2026-10-26-16-11-08/photosweep/app
```

> 注意：要上传的是这个 `app` 文件夹**里面的内容**，不是把 `app` 文件夹本身拖上去。
> 拖错的效果就是在仓库里多出一层 `app/`，GitHub Actions 在根目录找不到 package.json，就会报你看到的那个 ENOENT。

## 1.5 图标怎么传（自定义图标已做好，必须传这两个 png）

`assets/` 里那 3 个 png **没法用网页「粘贴」上传**（网页编辑器只收纯文本），但**可以拖拽上传**，二进制文件走拖拽完全没问题。

这一次要换桌面图标，所以：

1. 仓库首页 → `Add file` → `Upload files`
2. 把 `assets` 里的 **`icon.png`** 和 **`adaptive-icon.png`** 拖进去
3. 关键一步：文件列表里把这两个文件名改成带路径的形式 —— `assets/icon.png`、`assets/adaptive-icon.png`
   （GitHub 看到 `/` 会自动放进 assets 文件夹；如果你能先进到仓库的 assets 文件夹再点 Upload files，就不用改路径）
4. `Commit changes`
5. 打开 Actions 跑一次构建，在「准备应用图标」这一步的日志里应该看到
   `图标校验通过 ✅ 本次打包会使用 assets/icon.png（约 800000 字节）`。
   如果看到黄色的 `像是旧的占位图标` 警告，说明 png 没传上去，桌面图标不会变。

`assets/splash-icon.png` 可选，不传也不影响。

### 以前遇到过的两个坑（已经修好，留个记录）

- 报 `ENOENT package.json`：传的是 `app` 文件夹本身，多了一层目录。要传的是 `app` **里面的内容**。
- 报 `open './assets/icon.png'` 找不到：当时仓库里没有 `assets/`。现在工作流内置了兜底生成器（`assets/` 缺失时用纯 Python 现场画一个占位图标），保证一定能出包；但兜底图标是朴素的绿色方块，想要自定义图标就必须把 png 传上去。

也可以让 `app.json` 完全不引用本地图片（删掉 `"icon"` 行和整段 `adaptiveIcon`），prebuild 会用 Expo 默认图标，能出包但图标很朴素。

## 2. 仓库根目录必须长这样

打开仓库首页，看到的应该直接是这些文件（而不是一个 app 文件夹）：

```
├── .github/workflows/android.yml   ← 负责云端打包，缺了就没有 Actions 按钮
├── .gitignore
├── App.tsx
├── app.json                        ← App 名称、包名、相册权限声明
├── babel.config.js
├── index.js                        ← 入口，必须叫 index.js
├── package.json                    ← 缺这个就报 ENOENT
├── package-lock.json
├── tsconfig.json
├── assets/                         ← 3 个 png 图标
├── src/                            ← 12 个代码文件（含子目录 screens、components）
└── tools/gen_icons.py              ← 可选，重新生成图标用
```

## 3. 正确的上传动作（关键）

1. 在资源管理器打开上面那个路径
2. 按 `Ctrl+A` 全选（**只选文件夹里面的东西**，不要在上一层选中 app 文件夹）
3. 浏览器打开你的 GitHub 仓库 → `Add file` → `Upload files`
4. 把选中的内容拖进网页虚线框 → 等全部文件列出 → `Commit changes`

> 拖拽时 Windows 会提示「上传 N 个文件」，N 应该是 28 左右。如果只有 5 个，就是没全选。

## 4. 万一拖拽不成功：逐个新建粘贴

仓库页 `Add file` → `Create new file`，文件名照抄下面的标题（带 `/` 会自动建文件夹），内容整段粘贴。

**这一步只需要补 7 个配置文件**，`src/` 里的代码文件没法靠粘贴凑，还是要靠拖拽。

### `package.json`

```json
{
  "name": "photosweep",
  "version": "1.0.0",
  "private": true,
  "main": "index.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "typecheck": "tsc --noEmit",
    "prebuild": "expo prebuild --platform android"
  },
  "dependencies": {
    "expo": "^58.0.19",
    "expo-file-system": "~58.0.11",
    "expo-haptics": "~58.0.7",
    "expo-image": "~58.0.17",
    "expo-linear-gradient": "~58.0.3",
    "expo-media-library": "~58.0.12",
    "expo-status-bar": "~58.0.4",
    "expo-system-ui": "~58.0.6",
    "react": "19.3.0",
    "react-native": "0.88.0",
    "react-native-safe-area-context": "~5.10.1"
  },
  "devDependencies": {
    "@types/react": "^19.3.0",
    "typescript": "^7.0.2"
  }
}
```

### `app.json`

```json
{
  "expo": {
    "name": "PhotoSweep",
    "slug": "photosweep",
    "version": "1.0.1",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "photosweep",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "assetBundlePatterns": ["**/*"],
    "android": {
      "package": "com.photosweep.app",
      "versionCode": 2,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#BBCFBF"
      },
      "permissions": [
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED"
      ]
    },
    "plugins": [
      "expo-status-bar",
      "expo-image",
      [
        "expo-media-library",
        {
          "photosPermission": "PhotoSweep 需要读取相册，才能让你逐张挑选要清理的照片。",
          "savePhotosPermission": "PhotoSweep 需要写入权限，才能在终审确认后删除照片。",
          "isAccessMediaLocationEnabled": false,
          "granularPermissions": ["photo"]
        }
      ]
    ]
  }
}
```

### `tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "skipLibCheck": true
  },
  "include": [
    "**/*.ts",
    "**/*.tsx"
  ],
  "exclude": [
    "node_modules",
    "android",
    "ios",
    "dist"
  ]
}
```

### `babel.config.js`

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

### `index.js`

```javascript
import { registerRootComponent } from 'expo';

import App from './App';

// Expo / React Native 的统一入口
registerRootComponent(App);
```

### `eas.json`

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### `.gitignore`

```text
node_modules/
.expo/
dist/
web-build/
android/
ios/
*.log
.DS_Store
*.jks
*.keystore
.env.local
```

## 5. 传完怎么确认成功了

1. 仓库首页能看到 `package.json`（不是 `app/package.json`）
2. 点 `Actions` 标签 → 左侧有 `Build Android APK`
3. 右侧 `Run workflow` → 绿色按钮 → 等 8~15 分钟
4. 日志里第 2 步 `检查项目文件是否放对位置` 会打印 `文件检查通过 ✅`

## 6. 本次已在本机验证过的内容

- `npm ci`（与 CI 完全相同的安装命令）成功，495 个包
- `tsc --noEmit` 严格模式无报错
- 工作流 YAML 结构解析通过，共 13 个步骤
- `expo export --platform android` 真实打包成功（690 模块）
- 选卡算法 12 项断言全部通过（多轮不重复、新照片优先、撤销回池、畅刷续卡）
- 本地历史存储 10 项断言全部通过（落盘、冷启动读回、撤销、剪枝、脏数据容错、2 万条记录）

## 7. v1.1 改动了哪些文件

只需要更新下面 6 个（其余文件没动）：

| 文件 | 说明 |
| --- | --- |
| `src/decisions.ts` | **新增** 本地处理记录（持久化，决定"绝不重复"） |
| `src/pool.ts` | **新增** 选卡算法纯函数（最新优先 / 自动回溯 / 不重复） |
| `src/useSession.ts` | 重写：队列改为从"未处理池"里取，不再固定取最新 N 张 |
| `src/media.ts` | 相册读取改为分页扫描全册（原来只取前 1000 张） |
| `src/screens/HomeScreen.tsx` | 显示待整理/已整理数量，新增「全部整理完毕」状态 |
| `src/screens/DoneScreen.tsx` | 结算页显示还剩多少张待整理 |

没有新增任何原生依赖，`package.json` 和 `app.json` 都不用改。
不过 JS 变了，**需要重新跑一次 Actions 生成新 APK**，旧的安装包不会自动更新。
