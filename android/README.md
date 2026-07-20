# 母乳亲喂记录 · 安卓 APK 工程

把网页版（PWA）整体打包进一个安卓 App，完全离线、不依赖服务器，数据保存在本机。

## 工程结构
```
android/
├── build.gradle / settings.gradle / gradle.properties   # Gradle 配置
└── app/
    ├── build.gradle
    ├── src/main/AndroidManifest.xml
    ├── src/main/java/.../MainActivity.java   # WebView 加载本地页面
    ├── src/main/res/...                      # 图标 / 主题 / 名称
    └── src/main/assets/index.html            # 打包进 APK 的网页
.github/workflows/build-apk.yml              # 云端一键构建
```

## 方式一：云端一键构建（推荐，免装 Android Studio）

把本仓库推送到你自己的 GitHub，用 GitHub Actions 自动生成 APK：

1. 在 GitHub 新建一个**空仓库**（不要勾选 README/.gitignore）。
2. 在本机（或这里）初始化并提交：
   ```bash
   git init
   git add android .github
   git commit -m "add breastfeed tracker android project"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
3. 打开仓库页面 → **Actions** → 找到 `Build APK` → **Run workflow**。
4. 等待约 3–5 分钟，进入该次运行 → 在 **Artifacts** 区域下载 `breastfeed-tracker-apk`（里面是 `app-debug.apk`）。
5. 用手机浏览器打开该下载链接，或直接把 apk 传到手机，点击安装。
   - 安装时需允许「未知来源 / 安装未知应用」。

> Debug 签名即可安装使用，无需自己生成密钥。

## 方式二：用 Android Studio 本地构建

1. 安装 [Android Studio](https://developer.android.com/studio)。
2. `File → Open` 选择本目录下的 `android/` 文件夹。
3. 等待 Gradle 同步完成（首次会下载 SDK 与依赖）。
4. 菜单 `Build → Build Bundle(s) / APK(s) → Build APK(s)`。
5. 构建完成后，右下角提示里点 `locate` 找到
   `android/app/build/outputs/apk/debug/app-debug.apk`，传到手机安装。

## 安装到手机
- 安卓允许从「未知来源」安装：设置 → 安全 → 安装未知应用，对使用的浏览器/文件管理器授权。
- 应用数据保存在 App 自身的 WebView 存储中；「设置 → 应用 → 母乳亲喂记录 → 清除数据」会清空记录。

## 修改页面后重新打包
网页逻辑在根目录 `index.html`。改完后重新复制到 assets 再构建：
```bash
cp index.html android/app/src/main/assets/index.html
```
