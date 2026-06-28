# WordSprint Android 内测包构建说明

当前 Android 内测 APK 优先使用原生 WebView 方案，以保证国内安卓手机能稳定安装、打开和登录。

之前的 TWA 方案依赖手机里存在 Chrome 或支持 Trusted Web Activity 的浏览器。部分国内安卓机没有 Chrome，或者默认浏览器不支持 TWA，可能出现闪退、无法打开、降级为浏览器栏等问题。因此当前内测阶段先使用 WebView APK；后续正式上架前可以再评估 TWA、Capacitor 或更完整的原生封装方案。

## 当前配置

- App 名称：WordSprint
- 包名：`com.plshealme.wordsprint`
- 启动地址：`https://43.128.23.159.sslip.io`
- 方向：portrait
- versionName：`1.2.0`
- versionCode：`12`
- 权限：仅 `INTERNET`
- Android 项目目录：`android/`
- 当前封装方式：Android WebView

## WebView 行为

当前 WebView APK 会：

- 打开 `https://43.128.23.159.sslip.io`
- 启用 JavaScript
- 启用 DOM storage / localStorage
- 使用 HTTPS 加载页面
- User-Agent 追加 `WordSprintApp/1.2.0`
- 支持返回键：WebView 可后退时先后退，否则退出 App
- 加载中显示简单 loading
- 加载失败显示“网络连接失败，请检查网络后重试”和重试按钮

不会申请：

- 定位
- 相机
- 麦克风
- 通讯录
- 存储

## 本地环境准备

推荐安装：

1. JDK 17 或 JDK 21
2. Android Studio 或 Android command line tools
3. Android SDK Platform 35
4. Android SDK Build-Tools
5. Android SDK Platform-Tools

如果使用 Android Studio：

1. 打开 `android/` 目录。
2. 等待 Gradle Sync。
3. 连接 Android 手机并开启 USB 调试。

## Gradle Wrapper

项目已包含 Gradle Wrapper。优先使用：

```bash
cd android
./gradlew assembleDebug
./gradlew bundleRelease
```

Windows PowerShell：

```powershell
cd android
.\gradlew.bat assembleDebug
.\gradlew.bat bundleRelease
```

## GitHub Actions 自动构建 debug APK

workflow 路径：

```text
.github/workflows/android-build.yml
```

手动触发：

1. 打开 GitHub 仓库。
2. 进入 `Actions`。
3. 选择 `Android Debug APK`。
4. 点击 `Run workflow`。
5. 等待构建完成。

下载 APK：

1. 进入本次 workflow run。
2. 找到页面底部 `Artifacts`。
3. 下载 `WordSprint-debug-apk`。
4. 解压后得到 debug APK。

Artifact 名称：

```text
WordSprint-debug-apk
```

Debug APK 产物路径：

```text
android/app/build/outputs/apk/debug/*.apk
```

## 给同学安装 debug APK

1. 从 GitHub Actions 下载 `WordSprint-debug-apk`。
2. 解压 artifact。
3. 把 APK 发给测试同学。
4. 安卓手机允许安装未知来源应用。
5. 安装后打开 WordSprint。
6. 验证登录、Practice、Exam、Review、Mistakes 是否正常。

## Release keystore

生成 release keystore：

```bash
keytool -genkeypair \
  -v \
  -keystore android/wordsprint-release.jks \
  -alias wordsprint \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

创建 `android/key.properties`：

```properties
storeFile=wordsprint-release.jks
storePassword=你的 keystore 密码
keyAlias=wordsprint
keyPassword=你的 key 密码
```

不要提交：

- `.jks`
- `.keystore`
- `key.properties`
- 签名密码

这些已加入 `.gitignore`。

## 构建 release APK

```bash
cd android
./gradlew assembleRelease
```

Windows：

```powershell
cd android
.\gradlew.bat assembleRelease
```

产物通常在：

```text
android/app/build/outputs/apk/release/
```

## 构建 AAB

```bash
cd android
./gradlew bundleRelease
```

Windows：

```powershell
cd android
.\gradlew.bat bundleRelease
```

产物通常在：

```text
android/app/build/outputs/bundle/release/
```

AAB 主要用于 Google Play。内测分发给同学时，APK 更直接。

## 关于 TWA / Digital Asset Links

项目仍保留了 TWA 相关说明和 `public/.well-known/assetlinks.json`，但当前内测 APK 已优先使用 WebView。

TWA 要想全屏无浏览器栏，需要站点和 Android 包互相验证：

- Android 包名：`com.plshealme.wordsprint`
- Web 文件：`/.well-known/assetlinks.json`
- 签名证书：debug 或 release keystore 的 SHA-256 fingerprint

可以同时放 debug 和 release 两个 fingerprint：

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.plshealme.wordsprint",
      "sha256_cert_fingerprints": [
        "DEBUG_SHA256",
        "RELEASE_SHA256"
      ]
    }
  }
]
```

修改 `assetlinks.json` 后必须重新部署 Web 站点。

## 后续换正式域名

正式域名上线后需要同步修改：

1. `android/app/src/main/res/values/strings.xml`
   - `launch_url`
2. `android/app/src/main/AndroidManifest.xml`
   - intent-filter 里的 `android:host`
3. `android/twa-manifest.json`
   - `host`
   - `webManifestUrl`
4. Web 端正式域名下的 `public/.well-known/assetlinks.json`
5. 重新构建 APK / AAB

## 后续上架 Google Play / 国内安卓商店前还需要

- 使用正式域名，避免临时 IP 域名。
- 使用长期保存的 release keystore。
- 准备应用截图、隐私政策、应用介绍、分类和内容评级。
- 检查登录、注册、忘记密码在国内网络下是否稳定。
- 国内商店可能要求软著、ICP备案、隐私合规材料。

## 注意事项

- 不要提交 keystore。
- 不要提交签名密码。
- 不要把 Supabase service role key 或任何 `.env` 写入 Android 项目。
- WordSprint 学习记录仍保存在 WebView 的 localStorage 中。

## APK 内置词库

当前内测 APK 使用 WebView + Android assets 内置词库方案，减少国内安卓机进入 Practice / Exam / Review / Mistakes 时反复从网络下载词库的等待。

Web 端统一请求：

```text
/data/words/u01.json
/data/words/u02.json
...
/data/words/u30.json
/data/words/index.json
```

浏览器版本会从站点的 `public/data/words/` 读取这些 JSON。Android WebView APK 会在 `shouldInterceptRequest` 中拦截同源 `/data/words/*.json` 请求，并从 APK assets 中读取：

```text
assets/words/u01.json
assets/words/u02.json
...
assets/words/u30.json
assets/words/index.json
```

词库内容仍然以 `public/data/words/` 为唯一来源。构建 APK 时会自动同步到 Android assets：

- `android/app/build.gradle` 的 `syncWordAssets` 会在 `preBuild` 前复制词库到 generated assets。
- GitHub Actions 的 Android workflow 也会在 `assembleDebug` 前复制 `public/data/words/*.json` 到 `android/app/src/main/assets/words/`。

不要手动长期维护 `android/app/src/main/assets/words/` 中的第二份词库；该目录已加入 `.gitignore`，避免误提交重复数据。

WebView 只拦截词库静态 JSON，不会缓存或拦截：

- `/api/auth/*`
- `/api/admin/*`
- Supabase 请求
- 带 Authorization header 的请求
- 登录、注册、管理员接口响应
