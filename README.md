# MILES 作品集

线上地址：https://jwnb18346-hub.github.io/miles/

本项目在原 Codex 网站目录中修改。`media/`、`assets/`、`resume.pdf` 原文件没有修改；保留本地原始 .m4v，并额外按仓库已有名称复制同字节 .mp4 供浏览器播放。原来的 styles.css、script.js、fluid-cursor.js、vendor/ 保留在目录中，新的页面使用 site.css / site.js。

## 本机预览与后台

在本目录执行：

```sh
node server.mjs
```

前台：http://127.0.0.1:4318/
后台：http://127.0.0.1:4318/admin/

无需安装依赖。后台只监听本机，可编辑站点名称、介绍、项目中英文标题和说明；保存会备份 content.json 到被 Git 忽略的 .local-backups/，重新生成十个页面。原作品的路径、顺序及规格不能通过后台修改。后台没有上线到 GitHub Pages。在线 admin 页面不能保存内容。

## 构建

```sh
node build.mjs
```

content.json 为内容源，build.mjs 生成首页、work、about、studio 和六个案例页，以及 sitemap.xml / robots.txt / 404.html。直接改生成的 HTML 会在下一次构建时被覆盖。字体为自托管 Barlow Condensed，许可见 fonts/OFL.txt；没有使用参考站的字体文件或美术资源。

## 发布

检查变更后提交 site.css、site.js、build.mjs、content.json、server.mjs、admin/ 和生成的页面；GitHub Pages 从 main 分支根目录构建。后台的保存按钮只更新本机，发布须显式 git commit / git push。

## 参考与边界

公开视觉与交互参考：https://www.kenjilambert.com/
参考站公开脚本路径及页面请求表明它使用 Next.js；私有管理后台和服务端源码没有获取，也不声称已复刻。实现了黑底奶油色大字、红蓝点缀、四角导航、可拖动的二维工作证、横向作品图带、搜索分类、案例页、语言切换、图片放大与资产翻页。未复制参考站的 WebGL 三维挂绳模拟或其完整动画系统。

GitHub Pages 的静态托管说明：https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
