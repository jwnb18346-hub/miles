import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const LIMIT = 25 * 1024 * 1024;
export function validatePages(root) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) files.push(file);
      else throw new Error(`不支持的输出文件：${file}`);
    }
  }
  walk(root);
  for (const file of files) {
    if (statSync(file).size >= LIMIT) throw new Error(`文件达到或超过 25 MiB：${path.relative(root, file)}`);
  }
  if (files.length > 20000) throw new Error('输出超过 20,000 个文件');
  let references = 0;
  const localOrigin = 'https://pages-check.invalid';
  function check(ref, base, from) {
    ref = ref.replaceAll('&amp;', '&');
    if (!ref || /^(data:|mailto:|tel:|#)/i.test(ref)) return;
    const url = new URL(ref, base);
    if (url.origin !== localOrigin) return;
    const destination = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!destination.startsWith(root + path.sep) && destination !== root) throw new Error(`路径越界：${ref}`);
    if (!existsSync(destination) || (statSync(destination).isDirectory() && !existsSync(path.join(destination, 'index.html')))) {
      throw new Error(`缺失链接：${path.relative(root, from)} → ${ref}`);
    }
    references++;
  }
  for (const file of files.filter(f => /\.(html|css|js)$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    const page = new URL('/' + path.relative(root, file), localOrigin);
    if (file.endsWith('.html')) {
      const base = new URL(text.match(/<base\s+href="([^"]+)"/)?.[1] || './', page);
      for (const match of text.matchAll(/\b(?:href|src|poster|data-image)="([^"]+)"/g)) check(match[1], base, file);
    } else if (file.endsWith('.css')) {
      for (const match of text.matchAll(/url\(["']?([^\s)"']+)["']?\)/g)) check(match[1], page, file);
    } else {
      for (const match of text.matchAll(/(?:from\s*|import\s*\()["'](\.\.?\/[^"']+)["']/g)) check(match[1], page, file);
    }
  }
  return {files: files.length, references, largest: files.map(f => ({path: path.relative(root, f), bytes: statSync(f).size})).sort((a,b) => b.bytes-a.bytes).slice(0, 3)};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(validatePages(path.resolve(process.argv[2] || 'dist')), null, 2));
}
