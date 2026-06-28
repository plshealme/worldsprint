# WordSprint 国内友好访问版部署说明

本说明用于在保留 Vercel 版本的同时，新增一套香港 Node.js 服务器部署方案。目标是让国内同学尽量无需 VPN 访问 WordSprint。

当前版本定位：

- App 版本：1.0 正式版
- 词库：考研英语大纲词汇
- 当前词数：2499
- 当前正式支持题型：英译汉
- 登录 / 注册：继续使用现有 Supabase Auth
- 学习记录：localStorage 本地保存
- 数据备份：导出 / 导入 JSON
- 不做云同步

## 为什么推荐香港轻量服务器

香港服务器通常不需要大陆备案，访问延迟比欧美节点更适合国内手机网络，部署流程也比大陆服务器更快。WordSprint 前端部署到香港服务器后，网页打开速度会更适合国内用户。

但需要特别注意：登录 / 注册仍然依赖 Supabase。香港服务器只能改善网页资源加载速度，不能保证 Supabase Auth 在国内所有网络下稳定可用。部署完成后，必须用国内手机流量测试注册和登录。如果 Supabase 登录仍不稳定，后续再考虑 auth proxy 或自建后端，现在不要为了部署重构认证系统。

## 为什么暂时不推荐大陆服务器备案

大陆服务器通常要求域名完成 ICP 备案后才能正式提供 Web 服务。备案周期、材料和审核流程会拖慢 1.0 验证节奏。WordSprint 当前更适合先用香港轻量服务器验证国内访问体验，等产品稳定、访问量明确后，再评估是否迁移或新增大陆备案节点。

## 服务器环境建议

- 系统：Ubuntu 22.04 LTS 或 24.04 LTS
- CPU / 内存：1 核 1G 可起步，建议 2 核 2G
- Node.js：20 LTS 或更新的 LTS 版本
- 包管理器：pnpm
- 进程管理：PM2
- 反向代理：Nginx

## 安装 Node.js 和 pnpm

```bash
sudo apt update
sudo apt install -y curl git nginx

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

corepack enable
corepack prepare pnpm@latest --activate

node -v
pnpm -v
```

## 拉取代码

```bash
cd /var/www
sudo git clone https://github.com/plshealme/worldsprint.git wordsprint
sudo chown -R $USER:$USER /var/www/wordsprint
cd /var/www/wordsprint
```

后续如果仓库地址变化，以实际 GitHub 仓库为准。

## 配置环境变量

在项目根目录创建 `.env.production`：

```bash
nano .env.production
```

写入以下变量，不要提交到 Git：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon / publishable key
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_ANON_KEY=你的 Supabase anon / publishable key
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service role key
```

注意：

- `SUPABASE_SERVICE_ROLE_KEY` 只能用于服务端 API route，不能以 `NEXT_PUBLIC_` 开头
- 不要把 service role key 提交到 Git
- 不要写 `AUTH_MODE=dev`
- 不要写 `DEV_AUTH_BYPASS`
- 不要写 `NEXT_PUBLIC_AUTH_MODE=dev`
- 不要写 `NEXT_PUBLIC_DEV_AUTH_BYPASS`
- Supabase URL 必须是项目根地址，不要带 `/rest/v1/`

## Supabase Auth Redirect URLs

在 Supabase Dashboard 中进入 Authentication -> URL Configuration，把以下地址加入 Redirect URLs：

```text
http://43.128.23.159/reset-password
https://worldsprint-zeta.vercel.app/reset-password
https://你的域名/reset-password
```

以后绑定正式域名后，也需要继续补充正式域名的 `/reset-password` 地址。

## 安装依赖与构建

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

## 前台启动测试

```bash
pnpm start
```

默认会监听 `3000` 端口。服务器本机可以测试：

```bash
curl http://127.0.0.1:3000
curl http://127.0.0.1:3000/api/auth/diagnostics
```

诊断接口只返回安全信息，例如：

```json
{
  "hasSupabaseUrl": true,
  "hasSupabaseAnonKey": true,
  "nodeEnv": "production"
}
```

如果任一 Supabase 环境变量为 `false`，请先修正 `.env.production` 并重新启动服务。

## 使用 PM2 后台运行

```bash
sudo npm install -g pm2

cd /var/www/wordsprint
pm2 start pnpm --name wordsprint -- start
pm2 save
pm2 startup
```

常用命令：

```bash
pm2 status
pm2 logs wordsprint
pm2 restart wordsprint
pm2 stop wordsprint
```

登录问题排查时，重点查看：

```bash
pm2 logs wordsprint
```

搜索日志前缀：

```text
[wordsprint-auth]
```

日志只会显示 Supabase URL / anon key 是否存在、错误类型、错误 message 和 status，不会输出密码、token 或完整密钥。

## Nginx 反向代理示例

假设域名是 `wordsprint.example.com`：

```nginx
server {
    listen 80;
    server_name wordsprint.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

保存为：

```bash
sudo nano /etc/nginx/sites-available/wordsprint
sudo ln -s /etc/nginx/sites-available/wordsprint /etc/nginx/sites-enabled/wordsprint
sudo nginx -t
sudo systemctl reload nginx
```

## 域名解析

在域名 DNS 控制台添加：

- 类型：A
- 主机记录：`wordsprint` 或 `@`
- 记录值：香港服务器公网 IP

等待 DNS 生效后访问：

```text
http://wordsprint.example.com
```

## HTTPS 配置

推荐使用 Let’s Encrypt：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d wordsprint.example.com
```

配置完成后测试：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Let’s Encrypt 通常会自动配置续期，可以检查：

```bash
sudo systemctl status certbot.timer
```

## 后续更新部署流程

```bash
cd /var/www/wordsprint
git pull
pnpm install
pnpm run typecheck
pnpm run build
pm2 restart wordsprint
```

如果环境变量有变化，修改 `.env.production` 后也需要：

```bash
pm2 restart wordsprint
```

## 国内手机端验收清单

请使用国内手机流量和常见 Wi-Fi 分别测试：

- Home 是否能快速打开
- Login 页面是否能打开
- Register 是否能提交
- Supabase 登录是否成功
- `/api/auth/diagnostics` 是否显示 Supabase env 存在
- Practice 是否能开始 10 / 20 / 50 题
- Exam 是否能开始正式测试并提交
- Review 是否能打开单词列表和卡片复习
- Mistakes 是否能显示易错词
- Stats 是否能显示学习统计
- Profile 是否能打开
- Settings 是否能打开
- Data Backup 是否能导出 / 导入 JSON
- 刷新页面后 localStorage 学习记录是否保留
- PWA 添加到桌面后是否能再次打开

如果网页打开速度正常，但注册 / 登录失败，请先查看 PM2 或 Vercel 中的 `[wordsprint-auth]` 日志。如果确认 Supabase Auth 在国内网络不稳定，后续再考虑 auth proxy 或自建后端，不要在本部署阶段重构核心认证。

## 更新后预热

每次 `git pull`、`pnpm run build`、`pm2 restart wordsprint` 之后，建议在服务器本机执行一次轻量预热。这样可以让 Next.js 常用页面先完成冷启动，国内手机用户第一次打开时更稳一些。

```bash
curl -fsS http://127.0.0.1:3000/ > /dev/null || true
curl -fsS http://127.0.0.1:3000/login > /dev/null || true
curl -fsS http://127.0.0.1:3000/practice > /dev/null || true
curl -fsS http://127.0.0.1:3000/review > /dev/null || true
curl -fsS http://127.0.0.1:3000/mistakes > /dev/null || true
curl -fsS http://127.0.0.1:3000/profile > /dev/null || true
```

说明：
- 更新后的第一次访问变慢是正常的，因为新构建的 JS、CSS 和页面缓存需要重新建立。
- 预热不会登录用户，也不会加载用户本地学习记录。
- 词库 JSON 不会在登录页首屏预加载，Practice / Review / Mistakes 首次需要词库时才会运行时请求并缓存。
