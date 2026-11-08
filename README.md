# MILES 本地重做版

分支 `kenji-rebuild`，基于 `7df5336972d90cfd4ae79cd809cd45b05c6d7ff5`。本轮没有 push、部署或修改 Pages 设置。

## 本地运行

```sh
npm ci
npm run build
npm run preview
```

预览：<http://127.0.0.1:4326/>。只监听本机。当前依赖已经安装，直接执行后两条即可。

页面：首页、work、about、studio 和六个案例页。`content.json` 保持基线版本，原作者、项目标题、说明、视频、图片没有改写。`build.mjs` 生成页面；不要直接编辑生成的 HTML。

## 实现

- `src/core.js`：Lenis 及带速度的滚动总线。
- `src/home.js`、`src/words.js`、`src/ui.js`：标题、介绍区、作品图带、进退场、页面转场。
- `src/lanyard.js`：three.js + Rapier + MeshLine 挂绳；模型、卡面与绳带在本地代码生成。
- `src/ribbon.js`：粗指针设备的 canvas Verlet 吊牌。
- `src/book.js`：骨骼蒙皮翻书、逐页贴图、拾取、跳转和上下文恢复。
- `src/pages.js`：筛选、搜索、视频、灯箱、对比滑块。
- `src/site.css`：布局、字体与 CSS 动画。

运行库打包在 `bundle/`，不从 CDN 加载。首次运行 `npm ci` 需要 npm 网络；已有构建可由任意静态服务器预览。运行库许可证全文见 `THIRD_PARTY_NOTICES.txt`，字体许可见 `fonts/*OFL*`。

参考站的代码、图片、视频、GLB 模型、卡片贴图、logo、文案及 PP 商用字体均未放入新实现。参考资料和取证文件在仓库之外的 `../rea-re/`、`../rebuild-qa/`，不参与打包。开源替代字体为 Hanken Grotesk、Instrument Serif；Anton、Archivo 为开源字体。

## 降级与无障碍

系统设置“减弱动态效果”时停用平滑滚动与大型空间动效，工作室显示可直接访问的资产列表。`?nowebgl` 可手动检查吊牌与作品列表。WebGL 丢失后尝试重建，累计三次后降级。工作室可点封面翻页；Tab 聚焦翻页按钮时显示键盘控件，Enter 翻页。

## 原文件与测试

媒体基准为 `../site-qa/original-media-sha256.json`。其中四个 `.m4v` 在早期 Git 基线已更名为同字节 `.mp4`，本轮没有再改名或转码。工作副本的简历与这个最初备份不同：本轮保留旧副本到 `../rebuild-qa/baseline/resume-at-7df5336.pdf`，并恢复最初备份，使 22 项基准全部匹配。

```sh
python3 -I ../rebuild-qa/tools/verify_media.py . ../site-qa/original-media-sha256.json ../rebuild-qa/media-hash.md
node ../rebuild-qa/tools/functest.mjs http://127.0.0.1:4326/ ../rebuild-qa/functional-final
```

完整证据、并排图、运行记录和未验证项见 `../rebuild-qa/验收报告.md`。

原版本 `server.mjs`、`admin/` 等仍保留。本轮交付以 4326 的静态预览为准；没有操作旧的 4318 服务，也没有重新验证后台保存。
