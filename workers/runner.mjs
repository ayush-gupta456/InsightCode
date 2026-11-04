import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ESLint} from 'eslint';
import ts from 'typescript';

const mode=process.argv[2];
async function walk(directory){const entries=await fs.readdir(directory,{withFileTypes:true});const result=[];for(const entry of entries){const name=path.join(directory,entry.name);if(entry.isDirectory())result.push(...await walk(name));else if(entry.isFile())result.push(name);}return result;}
const files=await walk('/source');
const run=(command,args,valid=[0,1])=>{const result=spawnSync(command,args,{cwd:'/work',encoding:'utf8',timeout:45_000,maxBuffer:1_500_000,env:{...process.env,SEMGREP_SEND_METRICS:'off'}});if(result.error || !valid.includes(result.status))throw new Error(`${command} failed`);return result;};
const sarif=data=>(data.runs||[]).flatMap(run=>(run.results||[]).flatMap(r=>{const location=r.locations?.[0]?.physicalLocation;const line=location?.region?.startLine;if(!line)return [];return [{file:location.artifactLocation.uri,line,endLine:location.region.endLine||line,message:r.message?.text||r.ruleId,rule:r.ruleId||'',severity:r.level==='error'?'high':r.level==='note'?'low':'medium',category:['semgrep','gitleaks','osv'].includes(mode)?'security':'reliability'}];}));
let result=[];
switch(mode){
  case 'eslint': {
    const eslint=new ESLint({overrideConfigFile:true,ignore:false,overrideConfig:[{files:['**/*.{js,mjs,cjs,jsx}'],languageOptions:{ecmaVersion:'latest',sourceType:'module'},rules:{'no-eval':'error','no-debugger':'warn','no-unreachable':'error','no-dupe-args':'error','no-constant-condition':'warn','no-empty':'warn'}}]});
    for(const file of files.filter(f=>/\.(js|mjs|cjs|jsx)$/.test(f))){const text=await fs.readFile(file,'utf8');const reports=await eslint.lintText(text,{filePath:path.relative('/source',file),warnIgnored:false});for(const report of reports)for(const m of report.messages)if(m.line)result.push({file,line:m.line,endLine:m.endLine||m.line,message:m.message,rule:m.ruleId||'parse-error',severity:m.severity===2?'high':'medium',category:m.ruleId==='no-eval'?'security':'reliability'});}break;
  }
  case 'typescript': {
    for(const file of files.filter(f=>/\.(ts|tsx)$/.test(f))){const source=ts.createSourceFile(file,await fs.readFile(file,'utf8'),ts.ScriptTarget.Latest,true);for(const d of source.parseDiagnostics){const line=source.getLineAndCharacterOfPosition(d.start||0).line+1;result.push({file,line,message:ts.flattenDiagnosticMessageText(d.messageText,'\n'),rule:`TS${d.code}`,severity:'high',category:'reliability'});}}break;
  }
  case 'ruff':result=JSON.parse(run('ruff',['check','--isolated','--no-cache','--output-format','json','/source']).stdout).map(d=>({file:d.filename,line:d.location.row,endLine:d.end_location?.row||d.location.row,message:d.message,rule:d.code||'ruff',severity:'medium',category:'maintainability'}));break;
  case 'bandit':result=JSON.parse(run('bandit',['-r','/source','--ini','/dev/null','-f','json','--ignore-nosec']).stdout).results.map(d=>({file:d.filename,line:d.line_number,message:d.issue_text,rule:d.test_id,severity:d.issue_severity.toLowerCase(),category:'security'}));break;
  case 'semgrep':result=sarif(JSON.parse(run('semgrep',['scan','--config','/opt/rules/semgrep.yml','--sarif','--metrics=off','--disable-version-check','--no-git-ignore','/source']).stdout));break;
  case 'gitleaks':run('gitleaks',['dir','/source','--config','/opt/rules/gitleaks.toml','--no-banner','--report-format','sarif','--report-path','/tmp/gitleaks.sarif']);result=sarif(JSON.parse(await fs.readFile('/tmp/gitleaks.sarif','utf8')));break;
  case 'checkstyle':result=sarif(JSON.parse(run('java',['-jar','/opt/tools/checkstyle.jar','-c','/opt/rules/checkstyle.xml','-f','sarif',...files.filter(f=>f.endsWith('.java'))],Array.from({length:100},(_,i)=>i)).stdout));break;
  case 'spotbugs': {
    await fs.mkdir('/work/classes');run('javac',['-proc:none','-d','/work/classes',...files.filter(f=>f.endsWith('.java'))],[0]);run('/opt/tools/spotbugs/bin/spotbugs',['-textui','-sarif','-output','/tmp/spotbugs.sarif','/work/classes'],[0]);result=sarif(JSON.parse(await fs.readFile('/tmp/spotbugs.sarif','utf8')));break;
  }
  case 'osv':result=sarif(JSON.parse(run('osv-scanner',['scan','source','--offline','--format=sarif','--config=/opt/rules/osv.toml','-r','/source']).stdout));break;
  case 'tests': {
    // No package installation or repository-provided lifecycle scripts. Runtime tests are contained here.
    const nodeTests=files.filter(f=>/\.(test|spec)\.(js|mjs|cjs)$/.test(f));
    if(!nodeTests.length){console.log(JSON.stringify({status:'skipped',exitCode:0,output:'No Node built-in test files found. Other test runners require a dedicated trusted worker image.',runner:'node:test'}));process.exit(0);}
    const execution=run('node',['--test',...nodeTests],[0,1]);console.log(JSON.stringify({status:execution.status===0?'passed':'failed',exitCode:execution.status,output:(execution.stdout+'\n'+execution.stderr).slice(0,200_000),runner:'node:test'}));process.exit(0);
  }
  default:throw new Error('Unsupported analyzer');
}
console.log(JSON.stringify(result));
