/* global process, console, URL, Buffer */
import http from 'node:http'
import { loadEnv,createServer as createViteServer } from 'vite'

const root=process.cwd()
Object.assign(process.env,loadEnv('development',root,''))
process.env.ALLOWED_ORIGINS=[process.env.ALLOWED_ORIGINS,'http://localhost:3000','http://127.0.0.1:3000'].filter(Boolean).join(',')

const vite=await createViteServer({root,server:{middlewareMode:true},appType:'spa'})
const apiModules={
  '/api/dashboard':'/api/dashboard.ts',
  '/api/export':'/api/export.ts',
  '/api/history':'/api/history.ts',
  '/api/inspection-form':'/api/inspection-form.ts',
  '/api/inspection-types':'/api/inspection-types.ts',
  '/api/inspectors':'/api/inspectors.ts',
  '/api/master-items':'/api/master-items.ts',
  '/api/submissions':'/api/submissions.ts',
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url??'/',`http://${req.headers.host??'localhost'}`)
  const modulePath=apiModules[url.pathname]
  if(!modulePath){vite.middlewares(req,res);return}
  try{
    req.query={}
    for(const [key,value] of url.searchParams){
      const existing=req.query[key]
      req.query[key]=existing===undefined?value:Array.isArray(existing)?[...existing,value]:[existing,value]
    }
    if(!['GET','HEAD'].includes(req.method??''))req.body=await readJson(req)
    res.status=(code)=>{res.statusCode=code;return res}
    res.json=(body)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));return res}
    const module=await vite.ssrLoadModule(modulePath)
    await module.default(req,res)
  }catch(error){
    vite.ssrFixStacktrace(error)
    console.error(error)
    if(!res.headersSent){res.statusCode=500;res.setHeader('Content-Type','application/json; charset=utf-8')}
    if(!res.writableEnded)res.end(JSON.stringify({error:'Local development server error'}))
  }
})

server.listen(3000,'127.0.0.1',()=>console.log('Local app ready at http://127.0.0.1:3000'))

function readJson(req){
  return new Promise((resolve,reject)=>{
    const chunks=[];let length=0
    req.on('data',chunk=>{length+=chunk.length;if(length>100_000){reject(new Error('Request too large'));req.destroy();return}chunks.push(chunk)})
    req.on('end',()=>{if(!chunks.length){resolve(undefined);return}try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{reject(new Error('Invalid JSON'))}})
    req.on('error',reject)
  })
}
