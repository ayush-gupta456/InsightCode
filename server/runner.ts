import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { filesSchema, HttpError } from './security.js';
import type { Finding, SourceFile } from '../shared/types.js';

export const analyzerNames = ['eslint','typescript','ruff','bandit','semgrep','gitleaks','checkstyle','spotbugs','osv'] as const;
export type AnalyzerName = typeof analyzerNames[number];
export function configuredAnalyzers(): AnalyzerName[] { if(!process.env.ANALYZER_IMAGE)return [];return (process.env.ANALYZERS || 'eslint,typescript,ruff,bandit').split(',').map(s=>z.enum(analyzerNames).parse(s.trim())); }
export function dockerArgs(directory:string,name:string,mode:string,image:string) {
  return ['run','--rm','--pull=never','--name',name,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--memory=512m','--memory-swap=512m','--cpus=1','--pids-limit=128','--user=65534:65534','--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--tmpfs','/work:rw,nosuid,size=64m','--mount',`type=bind,src=${directory},dst=/source,readonly`,'--workdir=/work','--env','HOME=/tmp','--env','PYTHONDONTWRITEBYTECODE=1','--entrypoint=node',image,'/opt/insightcode/runner.mjs',mode];
}
function command(args:string[],timeout=60_000):Promise<{code:number;stdout:string;stderr:string}> {
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',bytes=0,done=false;
    const fail=(error:Error)=>{if(done)return;done=true;child.kill();clearTimeout(timer);reject(error);};
    const timer=setTimeout(()=>fail(new Error('Analyzer timeout exceeded')),timeout);
    child.stdout.on('data',data=>{bytes+=data.length;if(bytes>2_000_000)fail(new Error('Analyzer output limit exceeded'));else stdout+=data;});
    child.stderr.on('data',data=>{bytes+=data.length;if(bytes>2_000_000)fail(new Error('Analyzer output limit exceeded'));else stderr+=data;});
    child.on('error',fail);child.on('close',code=>{if(done)return;done=true;clearTimeout(timer);resolve({code:code??-1,stdout,stderr});});
  });
}
export async function isolatedRun(files:SourceFile[],mode:string) {
  filesSchema.parse(files);const image=process.env.ANALYZER_IMAGE;if(!image)throw new HttpError(503,'Configure the isolated analyzer image first');
  const root=path.resolve(process.env.WORKER_TEMP_DIR || os.tmpdir());await fs.mkdir(root,{recursive:true});const directory=await fs.mkdtemp(path.join(root,'insightcode-worker-'));const container='insightcode-'+randomUUID();
  try {
    await fs.chmod(directory,0o755);
    for(const file of files){const target=path.resolve(directory,...file.path.split('/'));if(!target.startsWith(directory+path.sep))throw new Error('Source escaped isolation directory');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,file.content,{mode:0o644});}
    return await command(dockerArgs(directory,container,mode,image));
  } finally {
    // Removing a named container is required even when the Docker CLI is killed on timeout.
    await command(['rm','-f',container],10_000).catch(()=>{});
    const resolved=path.resolve(directory);if(resolved.startsWith(root+path.sep) && path.basename(resolved).startsWith('insightcode-worker-'))await fs.rm(resolved,{recursive:true,force:true});
  }
}
const diagnosticSchema=z.array(z.object({file:z.string(),line:z.number().int().positive(),endLine:z.number().int().positive().optional(),message:z.string().min(1).max(5000),rule:z.string().max(300),severity:z.enum(['critical','high','medium','low']).default('medium'),category:z.enum(['security','reliability','maintainability','performance']).default('maintainability')})).max(2000);
export function normalizeDiagnostics(raw:unknown,files:SourceFile[],engine:string):Finding[] {
  return diagnosticSchema.parse(raw).flatMap(d=>{
    let name=d.file.replaceAll('\\','/').replace(/^file:\/\//,'').replace(/^\/(source|work)\//,'');
    let file=files.find(f=>f.path===name);
    if(!file){const matches=files.filter(f=>f.path.split('/').at(-1)===name);if(matches.length===1)file=matches[0];}
    if(!file)return [];const lines=file.content.split(/\r?\n/);const end=d.endLine??d.line;if(d.line>lines.length || end<d.line || end>lines.length)return [];
    return [{id:randomUUID(),title:d.rule?`${d.rule}: ${d.message.slice(0,120)}`:d.message.slice(0,150),category:d.category,severity:d.severity,confidence:.9,file:file.path,startLine:d.line,endLine:end,description:d.message,impact:'Reported by a deterministic analyzer. Assess the surrounding code and execution path.',recommendation:`Review ${d.rule || 'this diagnostic'} and rerun ${engine} after making a change.`,evidence:lines.slice(d.line-1,end).join('\n'),engine,verification:d.category==='security'?'hotspot' as const:'static-evidence' as const,status:'open' as const}];
  });
}
export async function runAnalyzers(files:SourceFile[],log:(message:string)=>Promise<void>) {
  const findings:Finding[]=[];
  for(const name of configuredAnalyzers()){
    const relevant=name==='ruff'||name==='bandit'?files.some(f=>f.path.endsWith('.py')):name==='eslint'?files.some(f=>/\.(js|jsx|mjs|cjs)$/.test(f.path)):name==='typescript'?files.some(f=>/\.(ts|tsx)$/.test(f.path)):name==='checkstyle'||name==='spotbugs'?files.some(f=>f.path.endsWith('.java')):true;
    if(!relevant){await log(`${name}: skipped (no supported source files).`);continue;}
    try {await log(`${name}: starting network-disabled container.`);const result=await isolatedRun(files,name);if(result.code!==0)throw new Error('Analyzer process failed');const parsed=JSON.parse(result.stdout);const validated=normalizeDiagnostics(parsed,files,name);findings.push(...validated);await log(`${name}: completed with ${validated.length} source-backed findings.`);}
    catch{await log(`${name}: failed or unavailable. No successful coverage claimed.`);}
  }
  return findings;
}
export async function validateInContainer(files:SourceFile[]) {
  const result=await isolatedRun(files,'tests');
  if(result.code!==0)throw new HttpError(502,'Test worker failed or timed out');
  return z.object({status:z.enum(['passed','failed','skipped']),exitCode:z.number().int(),output:z.string().max(200_000),runner:z.string()}).parse(JSON.parse(result.stdout));
}
