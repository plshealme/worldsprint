# WordSprint Android TWA 内测包构建说明

WordSprint Android 内测版使用 Google 推荐的 Trusted Web Activity (TWA) 方案。Android App 只做受信任外壳，实际内容来自：

```text
https://43.128.23.159.sslip.io
```

这不是普通 WebView。

## 当前配置

- App 名称：WordSprint
- 包名：`com.plshealme.wordsprint`
- 启动地址：`https://43.128.23.159.sslip.io`
- 方向：portrait
- versionName：`1.2.0`
- versionCode：`12`
- 权限：仅 `INTERNET`
- Android 项目目录：`android/`
- 构建方式：Gradle Wrapper + Android Browser Helper TWA

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

已新增 workflow：

```text
.github/workflows/android-build.yml
```

手动触发方式：

1. 打开 GitHub 仓库。
2. 进入 `Actions`。
3. 选择 `Android Debug APK`。
4. 点击 `Run workflow`。
5. 等待构建完成。

构建完成后下载 APK：

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

如果打开后出现浏览器栏，说明 TWA 的 Digital Asset Links 指纹还没有匹配；App 仍可测试，但还不是完全受信任的全屏 TWA。

## Digital Asset Links

TWA 要想全屏无浏览器栏，需要网站和 Android 包互相验证。

Web 端文件：

```text
public/.well-known/assetlinks.json
```

线上地址：

```text
https://43.128.23.159.sslip.io/.well-known/assetlinks.json
```

当前 `assetlinks.json` 里仍有占位：

```text
REPLACE_WITH_RELEASE_SHA256_FINGERPRINT
```

需要替换为实际签名证书的 SHA-256 fingerprint。

## debug keystore fingerprint

Debug APK 使用 debug keystore 签名。如果想让 GitHub Actions 构建出的 debug APK 也通过 TWA 验证，需要把 debug keystore 的 SHA-256 也加入 `assetlinks.json`。

本地 debug keystore 指纹：

Windows：

```powershell
keytool -list -v -keystore $env:USERPROFILE\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

macOS / Linux：

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

GitHub Actions 的 debug keystore 是 CI 环境生成的，不建议长期依赖它做正式验证。内测如果必须验证全屏 TWA，更推荐使用 release keystore 构建测试包。

## release keystore fingerprint

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

查看 release SHA-256：

```bash
keytool -list -v -keystore android/wordsprint-release.jks -alias wordsprint
```

把输出中的 `SHA256` 写入 `public/.well-known/assetlinks.json`。

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

## 配置 release 签名

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

## 后续换正式域名

正式域名上线后需要同步修改：

1. `android/app/src/main/res/values/strings.xml`
   - `launch_url`
   - `asset_statements`
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
- 确认 `assetlinks.json` 里的 SHA-256 是 release keystore 指纹。
- 准备应用截图、隐私政策、应用介绍、分类和内容评级。
- 检查登录、注册、忘记密码在国内网络下是否稳定。
- 国内商店可能要求软著、ICP备案、隐私合规材料。

## 注意事项

- 不要提交 keystore。
- 不要提交签名密码。
- 不要把 Supabase service role key 或任何 `.env` 写入 Android 项目。
- WordSprint 学习记录仍保存在浏览器 localStorage 中；TWA 打开的是同一 HTTPS 站点。
