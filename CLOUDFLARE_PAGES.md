# Cloudflare Pages（免费 pages.dev 域名）

在 Cloudflare 中新建 **Pages** 项目，连接 `jwnb18346-hub/miles`：

| 配置项 | 值 |
| --- | --- |
| 生产分支 | `main` |
| 框架预设 | `None` |
| 根目录 | 留空（仓库根目录） |
| 构建命令 | `npm run build:pages` |
| 构建输出目录 | `dist` |
| 环境变量 | `NODE_VERSION=22`（建议） |
| 域名 | 使用创建项目时获得的 `<项目名>.pages.dev` |

不需要自定义域名、付费存储、Functions 或 Worker。不要把仓库根目录当作输出目录：原素材和开发文件不属于 Cloudflare 发布包。Pages 会安装 package-lock.json 中锁定的 npm 依赖；云端构建不需要 ffmpeg。

`CF_PAGES_URL` 由 Cloudflare 提供，构建用它生成 canonical、分享图片、站点地图和 404 返回链接。如果希望这些地址固定到正式域名，在项目生产环境设置 `SITE_URL=https://<实际项目名>.pages.dev`。不要原样使用占位值；项目名是否可用由 Cloudflare 决定。本地未设置地址时用 `http://localhost:4326/`。

## 本地构建与检查

```sh
npm ci
SITE_URL=https://<实际项目名>.pages.dev npm run build:pages
node tools/validate-pages.mjs dist
```

构建由 `tools/build-pages.mjs` 调用原站生成器，输出全部 11 个作品、首页、work、about 和 studio；资源地址保持相对路径，可在域名根目录访问。输出只有静态页面、媒体、图片、字体、简历、运行包和许可证，不包含 admin、开发服务器、node_modules 或 .git。

构建会验证视频来源 SHA-256、所有作品文件、页面/样式/模块的本地引用、20,000 文件数及 25 MiB 单文件限制。任一条件失败即退出，不发布半成品。重新构建会把已有 dist 移到 `.pages-build-*/previous-dist` 留存，再换入通过检查的新目录。这些生成目录不提交到 Git。

## 超限视频

- `media/october-27.mp4`：原片 64,025,787 字节（61.06 MiB），原样保留，GitHub Pages 继续使用。
- `cloudflare/media/october-27.mp4`：压缩版 24,290,274 字节（23.16 MiB）；构建时放到 `dist/media/october-27.mp4`，作品地址不变。
- H.264/yuv420p，1920×1080，27.478333 秒；全部 1,647 个可解码视频帧及时间戳保留，AAC 音轨直接复制，moov 前置供网络播放。
- 编码：libx264 slow、CRF 18、maxrate/bufsize 6800k。整段 VMAF 均值 92.71（有损压缩，不宣称无损）。
- 原片文件头帧数包含不可见编辑帧；验收按实际解码帧及时间戳对齐，约 59.94 fps。
- `cloudflare/media.json` 固定原片与压缩片哈希；任一视频更新后必须重新压缩、验收，再更新对应哈希，避免误用旧压缩版本。

需要重新生成时，先用短样片测试，输出到一个新文件：

```sh
python3 -I tools/compress-video.py media/october-27.mp4 /tmp/october-sample.mp4 --start 8 --duration 6
python3 -I tools/compress-video.py media/october-27.mp4 /tmp/october-pages-new.mp4
```

脚本不会覆盖已有文件，不在每次云端构建中重新编码。其他九条视频、全部作品文案与素材保持不变。

## GitHub Pages 保留方式

GitHub Pages 继续使用 main 根目录，保留原来的 `npm run build` 行为和 `/miles/` 地址。此修改不改变已有根目录 HTML、bundle、媒体、图片、content.json、Pages 分支或发布设置；main 提交可能触发 GitHub 自动重建，但既有站点文件内容保持相同。无需关闭 GitHub Pages。

本文件提供构建配置，不代表已在 Cloudflare 创建项目或发布。公网部署后还需在实际 pages.dev 域名复核深层作品链接、视频拖动、手机浏览器和 404 页面。
