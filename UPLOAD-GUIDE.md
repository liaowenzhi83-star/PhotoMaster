# 补传清单：把文件传到 GitHub 的正确方式

## 1. 这些文件在你电脑的哪里

完整路径（复制到资源管理器地址栏回车即可打开）：

```
C:/Users/19353/WorkBuddy/2026-10-26-16-11-08/photosweep/app
```

> 注意：要上传的是这个 `app` 文件夹**里面的内容**，不是把 `app` 文件夹本身拖上去。
> 拖错的效果就是在仓库里多出一层 `app/`，GitHub Actions 在根目录找不到 package.json，就会报你看到的那个 ENOENT。

## 1.5 如果报错「open './assets/icon.png'」找不到

原因是 `assets/` 里那 3 个 png **没法通过 GitHub 网页粘贴上传**（网页编辑器只接受纯文本）。
现在有两条路，任选一条即可：

**方案 A（推荐，不用传图片）**：把本目录最新的 `.github/workflows/android.yml` 重新覆盖到仓库，
工作流里已经内置了图标生成器——检测到 `assets/` 缺失时会在 prebuild 之前用纯 Python 现场画出图标，
耗时约 10 秒，打包流程完全不受影响。

**方案 B（不想改工作流）**：让 `app.json` 不引用本地图片。把文件里的这两段删掉即可：

```jsonc
    "icon": "./assets/icon.png",          // ← 删掉这一行
```
```jsonc
      "adaptiveIcon": {                    // ← 删掉整个 adaptiveIcon 块
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0A1A15"
      },
```

删完 `app.json` 依然合法，prebuild 会用 Expo 的默认图标，能正常出包，只是图标比较朴素。
（这条我已经在本机实测：无 `assets/` + 不引用图标 → prebuild 成功。）

想保留自定义图标又想省事：把 `assets` 文件夹里的 3 个 png 单独拖到仓库的 `Upload files` 页面即可，
二进制文件走拖拽上传是没问题的，只是不能「粘贴」。

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
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "photosweep",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "assetBundlePatterns": ["**/*"],
    "android": {
      "package": "com.photosweep.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0A1A15"
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
- 工作流 YAML 结构解析通过，共 12 个步骤
