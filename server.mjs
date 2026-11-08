import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,stat,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4318);
const address=`http://127.0.0.1:${port}`;
const token=randomUUID(); // Process-local CSRF token, never embedded into deployed pages.
const contentPath=path.join(root,'content.json');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf','.mp4':'video/mp4','.m4v':'video/mp4','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.xml':'application/xml'};
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
function validate(next,original){
 if(!next||typeof next!=='object'||Array.isArray(next))throw Error('内容必须是对象。');
 const mutable=new Set(['name','intro','enIntro']);
 if(JSON.stringify(Object.keys(next).sort())!==JSON.stringify(Object.keys(original).sort()))throw Error('不能增加或移除字段。');
 for(const key of Object.keys(next)){
  if(key==='projects')continue;
  if(mutable.has(key)){if(typeof next[key]!=='string'||!next[key].trim()||next[key].length>1200)throw Error('名称或简介长度不正确。')}
  else if(JSON.stringify(next[key])!==JSON.stringify(original[key]))throw Error('原始资料字段受保护。');
 }
 if(!Array.isArray(next.projects)||next.projects.length!==original.projects.length)throw Error('必须保留全部项目。');
 const projectMutable=new Set(['title','enTitle','description','enDescription']);
 next.projects.forEach((project,i)=>{
  const before=original.projects[i];
  if(JSON.stringify(Object.keys(project).sort())!==JSON.stringify(Object.keys(before).sort()))throw Error('不能增加或移除项目字段。');
  for(const key of Object.keys(project)){
   if(projectMutable.has(key)){if(typeof project[key]!=='string'||!project[key].trim()||project[key].length>1200)throw Error('项目文案长度不正确。')}
   else if(JSON.stringify(project[key])!==JSON.stringify(before[key]))throw Error('原作品路径、顺序与规格受保护。');
  }
 });
}
let saving=false;
http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`)return send(res,403,{error:'仅允许本机访问。'});
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options',req.url.startsWith('/admin')||req.url.startsWith('/api')?'DENY':'SAMEORIGIN');res.setHeader('Referrer-Policy','same-origin');
  const pathname=decodeURIComponent(new URL(req.url,address).pathname);
  if(pathname==='/api/health')return send(res,200,{ok:true,name:'MILES local content service',mode:'local-only'});
  if(pathname==='/api/content'&&req.method==='GET')return send(res,200,JSON.parse(await readFile(contentPath,'utf8')));
  if(pathname==='/api/session'&&req.method==='GET'){
   if(req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'不允许跨站访问。'});
   return send(res,200,{token});
  }
  if(pathname==='/api/content'&&req.method==='PUT'){
   if(req.headers.origin!==address&&req.headers.origin!==`http://localhost:${port}`)return send(res,403,{error:'仅允许同源编辑。'});
   if(req.headers['x-miles-token']!==token)return send(res,403,{error:'请刷新后台后再保存。'});
   if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'只接受 JSON。'});
   if(saving)return send(res,409,{error:'正在保存，请稍后重试。'});
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>128000)return send(res,413,{error:'内容过大。'})}
   let next,originalText;try{next=JSON.parse(body);originalText=await readFile(contentPath,'utf8');validate(next,JSON.parse(originalText))}catch(e){return send(res,400,{error:e.message})}
   saving=true;try{
    const backupDir=path.join(root,'.local-backups');await mkdir(backupDir,{recursive:true});await writeFile(path.join(backupDir,Date.now()+'.json'),originalText);
    await writeFile(contentPath,JSON.stringify(next,null,2)+'\n');
    try{execFileSync(process.execPath,[path.join(root,'build.mjs')],{cwd:root,stdio:'pipe',timeout:20000})}catch(e){await writeFile(contentPath,originalText);execFileSync(process.execPath,[path.join(root,'build.mjs')],{cwd:root,stdio:'pipe',timeout:20000});throw e}
    return send(res,200,{ok:true,message:'已保存到本机，预览已更新。GitHub 线上版本尚未发布。'});
   }finally{saving=false}
  }
  if(pathname.startsWith('/api/'))return send(res,404,{error:'接口不存在。'});
  if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'不支持此方法。'});
  const relative=pathname.replace(/^\/+/,''),parts=relative.split('/');
  if(parts.some(p=>p.startsWith('.'))||parts.includes('node_modules')||relative.endsWith('.mjs'))return send(res,404,{error:'文件不存在。'});
  let target=path.resolve(root,relative||'index.html');if(!target.startsWith(root+path.sep)&&target!==root)return send(res,403,{error:'路径不允许。'});
  let info=await stat(target);if(info.isDirectory()){if(!pathname.endsWith('/')){res.writeHead(302,{Location:pathname+'/'});return res.end()}target=path.join(target,'index.html');info=await stat(target)}
  const actual=await realpath(target);if(!actual.startsWith(root+path.sep))return send(res,403,{error:'路径不允许。'});
  const headers={'Content-Type':types[path.extname(target)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
  const range=req.headers.range;
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end()}
   const suffix=match[1]==='',start=suffix?Math.max(0,info.size-Number(match[2])):Number(match[1]),end=suffix?info.size-1:Math.min(info.size-1,match[2]?Number(match[2]):info.size-1);
   if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end()}
   res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1});if(req.method==='HEAD')return res.end();return createReadStream(target,{start,end}).pipe(res);
  }
  res.writeHead(200,{...headers,'Content-Length':info.size});if(req.method==='HEAD')return res.end();createReadStream(target).pipe(res);
 }catch(e){if(!res.headersSent)send(res,e.code==='ENOENT'?404:500,{error:e.code==='ENOENT'?'文件不存在。':'本机服务发生错误。请查看终端。'});else res.end();console.error(e.code||e.message)}
}).listen(port,'127.0.0.1',()=>console.log(`MILES preview: ${address}\nContent editor: ${address}/admin/\nOnly this computer can connect. Originals are read-only in the editor.`));
