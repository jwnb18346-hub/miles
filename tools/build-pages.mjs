// 只输出静态站。GitHub Pages 根目录、原媒体及原发布设置保持不变。
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validatePages} from './validate-pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const media = JSON.parse(readFileSync(path.join(root, 'cloudflare/media.json'), 'utf8'));
for (const [file, expected] of Object.entries(media.sha256)) {
  const actual = createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
  if (actual !== expected) throw new Error(`视频已变更，需重新压缩与验收：${file}`);
}
const origin = new URL(process.env.SITE_URL || process.env.CF_PAGES_URL || 'http://localhost:4326/');
if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
  throw new Error('SITE_URL 必须是网站根地址，例如 https://你的项目.pages.dev');
}
const stage = mkdtempSync(path.join(root, '.pages-build-'));
for (const dir of ['assets', 'fonts']) cpSync(path.join(root, dir), path.join(stage, dir), {recursive: true});
mkdirSync(path.join(stage, 'media'));
for (const name of readdirSync(path.join(root, 'media'))) {
  const source = name === 'october-27.mp4' ? path.join(root, 'cloudflare/media', name) : path.join(root, 'media', name);
  cpSync(source, path.join(stage, 'media', name), {recursive: true});
}
for (const name of ['resume.pdf', 'THIRD_PARTY_NOTICES.txt']) cpSync(path.join(root, name), path.join(stage, name));
execFileSync(process.execPath, [path.join(root, 'build.mjs')], {
  cwd: root, stdio: 'inherit',
  env: {...process.env, MILES_OUTPUT_DIR: stage, MILES_SITE_ORIGIN: origin.href},
});
const projects = JSON.parse(readFileSync(path.join(root, 'content.json'), 'utf8')).projects;
for (const project of projects) {
  for (const file of [`work/${project.slug}/index.html`, project.video, project.poster, ...project.assets].filter(Boolean)) {
    if (!existsSync(path.join(stage, file))) throw new Error(`作品文件缺失：${file}`);
  }
}
const result = validatePages(stage);
// 验证通过才替换输出；上一次输出移到忽略目录保存，原作品不会被删除。
const dist = path.join(root, 'dist');
if (existsSync(dist)) {
  const backup = mkdtempSync(path.join(root, '.pages-build-'));
  renameSync(dist, path.join(backup, 'previous-dist'));
}
renameSync(stage, dist);
console.log(JSON.stringify({output: 'dist', origin: origin.href, projects: projects.length, ...result}, null, 2));
