import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { z } from 'zod';
import type { Store } from './store.js';
import { HttpError, hashToken, randomToken } from './security.js';
import { githubGet } from './github.js';

function encryptionKey() { const key = Buffer.from(process.env.INTEGRATION_ENCRYPTION_KEY || '', 'base64'); if (key.length !== 32) throw new HttpError(503, 'Integration encryption key is not configured'); return key; }
export function encryptToken(token: string, key = encryptionKey()) { const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm',key,nonce); const ciphertext = Buffer.concat([cipher.update(token,'utf8'),cipher.final()]); return [nonce,cipher.getAuthTag(),ciphertext].map(x=>x.toString('base64')).join('.'); }
export function decryptToken(value: string, key = encryptionKey()) { const [nonce,tag,ciphertext]=value.split('.').map(x=>Buffer.from(x,'base64')); const decipher=createDecipheriv('aes-256-gcm',key,nonce); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8'); }
export async function githubToken(store: Store, ownerId: string) { const integration=(await store.list('integrations',ownerId)).find(i=>i.provider==='github'); return integration ? decryptToken(integration.encryptedToken) : undefined; }
const frontend = () => process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5173';
const callback = () => `${process.env.PUBLIC_API_ORIGIN || 'http://127.0.0.1:3001'}/api/github/callback`;
const oauthCookie = { httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/api/github/callback',maxAge:600_000 };
export function mountOAuthCallback(app: Express, store: Store) {
  app.get('/api/github/callback',async(req,res)=>{
    const input=z.object({code:z.string().max(500),state:z.string().max(100)}).safeParse(req.query);
    if(!input.success) {res.redirect(frontend()+'/app/settings?github=denied');return;}
    const flow=await store.consume('oauth',input.data.state); const cookie=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('github_state='))?.slice(13);
    res.clearCookie('github_state',oauthCookie);
    if(!flow || Date.parse(flow.expiresAt)<Date.now() || !cookie || hashToken(cookie)!==flow.cookieHash) throw new HttpError(400,'Invalid or expired GitHub authorization state');
    const response=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:process.env.GITHUB_CLIENT_ID,client_secret:process.env.GITHUB_CLIENT_SECRET,code:input.data.code,redirect_uri:callback()}),redirect:'error',signal:AbortSignal.timeout(20_000)});
    const payload=z.object({access_token:z.string(),token_type:z.literal('bearer')}).safeParse(await response.json());
    if(!response.ok || !payload.success) throw new HttpError(502,'GitHub authorization failed');
    const profile=z.object({login:z.string()}).parse(await githubGet('/user',payload.data.access_token));
    const existing=(await store.list('integrations',flow.ownerId)).find(i=>i.provider==='github');
    await store.put('integrations',{id:existing?.id || randomUUID(),ownerId:flow.ownerId,provider:'github',encryptedToken:encryptToken(payload.data.access_token),login:profile.login,createdAt:new Date().toISOString()});
    res.redirect(frontend()+'/app/settings?github=connected');
  });
}
export function mountIntegrationRoutes(app: Express, store: Store) {
  app.get('/api/integrations/github',async(_req,res)=>{ const connected=(await store.list('integrations',res.locals.userId)).find(i=>i.provider==='github'); res.json({configured:!!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET && !!process.env.INTEGRATION_ENCRYPTION_KEY,connected:!!connected,login:connected?.login}); });
  app.post('/api/integrations/github/connect',async(req,res)=>{
    const {privateRepositories,publishing}=z.object({privateRepositories:z.boolean().default(false),publishing:z.boolean().default(false)}).parse(req.body);
    if(!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) throw new HttpError(503,'Configure a GitHub OAuth app on the server'); encryptionKey();
    const state=randomToken(),cookie=randomToken(),scope=privateRepositories?'read:user repo':publishing?'read:user public_repo':'read:user';
    await store.put('oauth',{id:state,ownerId:res.locals.userId,cookieHash:hashToken(cookie),scope,expiresAt:new Date(Date.now()+600_000).toISOString()});res.cookie('github_state',cookie,oauthCookie);
    const query=new URLSearchParams({client_id:process.env.GITHUB_CLIENT_ID,redirect_uri:callback(),scope,state});res.json({url:'https://github.com/login/oauth/authorize?'+query});
  });
  app.delete('/api/integrations/github',async(_req,res)=>{for(const i of await store.list('integrations',res.locals.userId)) await store.remove('integrations',i.id);for(const s of await store.list('subscriptions',res.locals.userId)) await store.remove('subscriptions',s.id);res.status(204).end();});
  app.get('/api/github/repositories',async(_req,res)=>{const token=await githubToken(store,res.locals.userId);if(!token)throw new HttpError(409,'Connect GitHub first');const data=await githubGet('/user/repos?per_page=100&sort=updated',token);res.json(data.map((r:any)=>({name:r.name,owner:r.owner.login,private:r.private,defaultBranch:r.default_branch,url:r.html_url})));});
}
export async function publishComment(endpoint:string,body:unknown,token:string) { const response=await fetch(`https://api.github.com${endpoint}`,{method:'POST',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20_000)});if(!response.ok)throw new HttpError(502,`GitHub could not publish the review (${response.status})`);const result=await response.json() as {html_url:string};return {url:result.html_url}; }
