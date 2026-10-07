import {controlManifest as readControlManifest,sourceFingerprint} from "../ci/control-inputs.mjs";
import {validatePairCheckout} from "../ci/inputs.mjs";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {coreUnits,allocateUnits,digest} from "./core-plan.mjs";
import {readRegistry,policyDigest,planForChanges,createScopePlan} from "./scope-plan.mjs";
import os from "node:os";
import {Budget} from "../support/budget.mjs";
import {runProcess,getProcessRunnerState} from "../support/process-runner.mjs";
import {stageWorkspace} from "../support/workspace.mjs";
import {runPluginCore} from "./plugin-core.mjs";
import {validateInventory} from "./selection.mjs";
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());

export function loadBatch(root,args) {
  const options={};
  for(let i=0;i<args.length;i++) {
    const flag=args[i],value=args[++i];
    if(!["--plan","--batch","--host-root"].includes(flag)||Object.hasOwn(options,flag)||!value||value.startsWith("--"))
      throw new Error("Usage: batch --plan <plan> --batch <control|batch-NN> [--host-root <fixed Host>]");
    options[flag]=value;
  }
  if(!options["--plan"]||!options["--batch"]) throw new Error("Missing batch input");
  const file=path.resolve(options["--plan"]);
  if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>4*1024*1024) throw new Error("Unsafe plan file");
  const bytes=fs.readFileSync(file);policyDigest(bytes);
  const plan=JSON.parse(bytes);
  if(plan.schemaVersion!==2||plan.repository!=="Plugins"||plan.capacityStatus!=="PLANNED")
    throw new Error("Invalid or CAPACITY_EXCEEDED batch plan");
  const policy=JSON.parse(fs.readFileSync(path.join(root,"tests/policy.json")));
  const {registry}=readRegistry(root);
  const actualManifest=readControlManifest(root);
  if(digest(actualManifest)!==digest(plan.controlManifest)||hash(JSON.stringify(actualManifest))!==plan.policyDigest) throw new Error("Control input fingerprint differs from plan");
  const partnerRoot=options["--host-root"] ? path.resolve(options["--host-root"]) : process.env.NEXUS_HOST_ROOT;
  validatePairCheckout(root,file,plan,partnerRoot);
  const partnerPolicy=null;
  const basePolicy=JSON.parse(execFileSync("git",["-C",root,"show",`${plan.baseSha}:tests/policy.json`],{encoding:"utf8"}));
  policy.retiredPlugins=Object.fromEntries(Object.entries(basePolicy.plugins).filter(([name])=>!Object.hasOwn(policy.plugins,name)));
  const routing=plan.diagnosticSelection?planForChanges(root,plan.changes,registry,policy):createScopePlan(root,{base:plan.baseSha,head:plan.headSha,inputPair:plan.inputPair,partnerSha:plan.partnerSha,includeWorkingTree:!process.env.CI});
  if(!same(routing.selected.map(item=>item.id),plan.selected.map(item=>item.id))) throw new Error("Selected obligations differ from semantic plan");
  const identity={baseSha:plan.baseSha,headSha:plan.headSha,mergeBase:plan.mergeBase,testedSha:plan.testedSha,dirty:plan.dirty,changes:plan.changes,
    partnerSha:plan.partnerSha,...(plan.inputPair ? {inputPair:plan.inputPair} : {}),controlManifest:plan.controlManifest};
  const expected=allocateUnits(coreUnits(plan.selected,registry,policy,partnerPolicy),identity,policy.ciBatchPolicy);
  for(const field of ["units","batches","control","requiredObligations","capacityStatus","estimatedTotalJobs"])
    if(digest(expected[field])!==digest(plan[field])) throw new Error(`Altered batch plan: ${field}`);
  if(sourceFingerprint(root)!==plan.sourceFingerprint) throw new Error("Source bytes differ from scope plan");
  const sourceSha=execFileSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
  if(sourceSha!==plan.testedSha) throw new Error("Tested source commit differs from plan");
  if(partnerRoot&&plan.partnerSha&&execFileSync("git",["-C",partnerRoot,"rev-parse","HEAD"],{encoding:"utf8"}).trim()!==plan.partnerSha) throw new Error("Partner commit differs from plan");
  if(process.env.CI) {
    if(plan.diagnosticSelection) throw new Error("Diagnostic selection cannot qualify Actions");
    if(plan.dirty||String(plan.runId)!==process.env.GITHUB_RUN_ID||String(plan.attempt)!==process.env.GITHUB_RUN_ATTEMPT) throw new Error("CI run/attempt/clean identity mismatch");
    const current=createScopePlan(root,{base:plan.baseSha,head:plan.headSha,inputPair:plan.inputPair,partnerSha:plan.partnerSha,partnerRoot});
    if(digest(current.changes)!==digest(plan.changes)) throw new Error("CI source diff differs from plan");
  }
  const batch=options["--batch"]==="control"?plan.control:plan.batches.find(item=>item.id===options["--batch"]);
  if(!batch?.units.length) throw new Error("Unknown or empty batch");
  if(batch.units.some(unit=>unit.kind==="partner-jint"&&!unit.partnerPlugins.length)) throw new Error("Missing fixed partner native obligations");
  if(batch.units.some(unit=>unit.kind==="plugin"&&(unit.pluginKind==="data-specialized"||unit.expectedMethodIds.length||unit.expectedScenarioIds.length)||unit.id.startsWith("plugins.plugin.package:")&&unit.pluginKind==="managed-code")&&!partnerRoot) throw new Error("Runtime/managed package requires --host-root");
  if(process.env.CI&&!plan.inputPair&&partnerRoot&&execFileSync("git",["-C",partnerRoot,"rev-parse","HEAD"],{encoding:"utf8"}).trim()!==JSON.parse(fs.readFileSync(path.join(root,"tests/inputs.lock.json"))).host.commitSha) throw new Error("CI Host differs from fixed lock");
  return {plan,batch,partnerRoot,planDigest:hash(bytes)};
}

export function saveBatch(context,runRoot,workspace,units,exitCode,elapsedMs,cleanup) {
  const artifacts=[];
  const visit=directory=>{
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
      const file=path.join(directory,entry.name);
      if(entry.isSymbolicLink()) throw new Error("Linked batch evidence");
      if(entry.isDirectory()) visit(file);
      else if(entry.name!=="batch-report.json") {
        const bytes=fs.readFileSync(file);
        artifacts.push({path:path.relative(runRoot,file).replaceAll("\\","/"),sha256:hash(bytes),sizeBytes:bytes.length});
      }
    }
  };
  fs.mkdirSync(runRoot,{recursive:true});visit(runRoot);
  const report={schemaVersion:2,scope:"LOCAL_BATCH_RESULT",qualification:process.env.CI?"CI_PRODUCER_PENDING_AUDIT":"LOCAL_DIAGNOSTIC",
    batchId:context.batch.id,identity:{repository:"FlappiBakuse/NexusPipeline-Plugins",prNumber:context.plan.prNumber,baseSha:context.plan.baseSha,
      headSha:context.plan.headSha,mergeBaseSha:context.plan.mergeBase,testedSha:context.plan.testedSha,runId:context.plan.runId,attempt:context.plan.attempt,
      inputMode:context.plan.inputMode??"default",inputPair:context.plan.inputPair??null,partnerSha:context.plan.partnerSha,partner:context.partnerSource??null,partnerFingerprint:context.partnerFingerprint??null,source:workspace?.source??null,sourceFingerprint:workspace?.sourceFingerprint??null,
      workingTreeDirty:workspace?.source.workingTreeDirty??null,toolchain:{...workspace?.toolchain,platform:process.platform,arch:process.arch,rid:"win-x64",buildModes:["production","test-host"]},
      toolchainFingerprint:hash(JSON.stringify({...workspace?.toolchain,platform:process.platform,arch:process.arch,rid:"win-x64",buildModes:["production","test-host"]}))},policyDigest:context.plan.policyDigest,planDigest:context.planDigest,
    status:exitCode?"FAIL":"PASS",exitCode,timing:{qualificationMs:null,hardTimeoutMs:null,processElapsedMs:elapsedMs,preparationElapsedMs:context.setupElapsedMs??0,completeJobMs:null},
    cleanupComplete:cleanup.cleanupComplete,units:units.map(unit=>({real:[],substituted:[],...unit})),artifacts};
  fs.writeFileSync(path.join(runRoot,"batch-report.json"),JSON.stringify(report,null,2)+"\n");
  return report;
}

function copyEvidence(source,target,list,runRoot) {
    fs.mkdirSync(target,{recursive:true});
    for(const entry of fs.readdirSync(source,{withFileTypes:true})) {
      const from=path.join(source,entry.name),to=path.join(target,entry.name);
      if(entry.isSymbolicLink()) throw new Error("Linked evidence");
      if(entry.isDirectory()&&!["test-host","runtime","worker","owned-window","wwwroot","plugins"].includes(entry.name)) copyEvidence(from,to,list,runRoot);
      else if(entry.isFile()&&/\.(json|trx|tap|log|txt)$/.test(entry.name)) {fs.copyFileSync(from,to);list.push(path.relative(runRoot,to).replaceAll("\\","/"));}
    }
}

export function collectRuntimeResult(unit,core,runRoot) {
  const actual=core.reports.find(item=>item.plugin===unit.artifact);
  const result={id:unit.id,providedObligations:unit.provides,status:actual?.status??"NOT_RUN",exitCode:actual?.exitCode??4,
          completedCaseIds:actual?.completedCaseIds??[],completedMethodIds:unit.pluginKind==="managed-code"?[...new Set((actual?.completedCaseIds??[]).map(id=>id.split("(")[0]))].sort():[],
          completedScenarioIds:actual?.completedScenarioIds??[],completedEditorCaseIds:actual?.completedEditorCaseIds??[],rawEvidence:[],real:actual?.boundaries.real??[],substituted:actual?.boundaries.substituted??[]};
  if (actual) copyEvidence(path.join(core.runRoot,unit.artifact),path.join(runRoot,"evidence",unit.id.replaceAll(/[.:]/g,"-")),result.rawEvidence,runRoot);
  return result;
}

export async function runBatch(root,args) {
  const context=loadBatch(root,args);
  const artifactRoot=path.resolve(process.env.NEXUS_TEST_ARTIFACT_ROOT||path.join(process.env.RUNNER_TEMP||os.tmpdir(),"NexusPipeline.Tests"));
  const marker=path.join(artifactRoot,".nxp-test-artifact-root.json");
  if(!fs.existsSync(artifactRoot)) {
    fs.mkdirSync(artifactRoot,{recursive:true});fs.writeFileSync(marker,JSON.stringify({schemaVersion:1,owner:"NexusPipeline.Tests",directory:artifactRoot}),{flag:"wx"});
  }
  const owner=JSON.parse(fs.readFileSync(marker));
  if(owner.owner!=="NexusPipeline.Tests"||path.resolve(owner.directory)!==artifactRoot) throw new Error("Unowned artifact directory");
  const runId=process.env.NEXUS_TEST_RUN_ID||`plugins-batch-${Date.now()}-${process.pid}`;
  if(!/^[A-Za-z0-9_-]+$/.test(runId)) throw new Error("Unsafe run identity");
  const runRoot=path.join(artifactRoot,"runs",runId);fs.mkdirSync(runRoot,{recursive:true});
  const jobStarted=Number(process.env.NEXUS_TEST_JOB_STARTED_AT_MS||Date.now());
  if(!Number.isFinite(jobStarted)||jobStarted>Date.now()) throw new Error("Invalid job start time");
  const elapsedSetup=Date.now()-jobStarted;
  context.setupElapsedMs=elapsedSetup;
  const budget=new Budget("Plugins batch",null);
  const tmp=path.join(artifactRoot,"tmp");fs.mkdirSync(tmp,{recursive:true});
  const env={...process.env,NEXUS_TEST_ARTIFACT_ROOT:artifactRoot,TEMP:tmp,TMP:tmp,PYTHONDONTWRITEBYTECODE:"1",PYTHONUTF8:"1",
    NUGET_PACKAGES:process.env.NUGET_PACKAGES||path.join(artifactRoot,"cache/nuget"),npm_config_cache:process.env.npm_config_cache||path.join(artifactRoot,"cache/npm"),
    DOTNET_CLI_HOME:process.env.DOTNET_CLI_HOME||path.join(artifactRoot,"cache/dotnet"),DOTNET_CLI_USE_MSBUILD_SERVER:"0"};
  const python=process.platform==="win32"?"python":"python3";
  const policyBytes=fs.readFileSync(path.join(root,"tests/policy.json")),policy=JSON.parse(policyBytes);
  let workspace=null,reportWorkspace=null,host=null,primary=0;
  const results=[];
  const run=async(command,args,cwd)=>{
    budget.check();fs.appendFileSync(path.join(runRoot,"commands.log"),JSON.stringify([command,...args])+"\n");
    const code=await runProcess(command,args,{cwd,budget,env,onOutput:text=>fs.appendFileSync(path.join(runRoot,"commands.log"),text)});
    if(code) throw Object.assign(new Error(`Batch command exit ${code}`),{exitCode:code});
  };
  try {
    const runtime=context.batch.units.filter(unit=>unit.kind==="plugin"&&(unit.pluginKind==="data-specialized"||unit.expectedMethodIds.length||unit.expectedScenarioIds.length));
    if(runtime.length) {
      const previous={artifact:process.env.NEXUS_TEST_ARTIFACT_ROOT,run:process.env.NEXUS_TEST_RUN_ID,native:process.env.NEXUS_MAA_NATIVE_ROOT};
      process.env.NEXUS_TEST_ARTIFACT_ROOT=artifactRoot;process.env.NEXUS_TEST_RUN_ID=`${runId}-runtime`;
      if(env.NEXUS_MAA_NATIVE_ROOT) process.env.NEXUS_MAA_NATIVE_ROOT=env.NEXUS_MAA_NATIVE_ROOT;
      let core;
      try {core=await runPluginCore({root,policyBytes,input:{command:"daily",options:{"--host-root":context.partnerRoot,"--all-core":true}},batch:context,parentBudget:budget});}
      finally {
        for(const [key,value] of [["NEXUS_TEST_ARTIFACT_ROOT",previous.artifact],["NEXUS_TEST_RUN_ID",previous.run],["NEXUS_MAA_NATIVE_ROOT",previous.native]])
          if(value===undefined) delete process.env[key];else process.env[key]=value;
      }
      reportWorkspace=core.plugins;context.partnerSource=core.host?.source;context.partnerFingerprint=core.host?.sourceFingerprint;
      primary ||=core.code;
      for(const unit of runtime) {
        results.push(collectRuntimeResult(unit,core,runRoot));
      }
      fs.copyFileSync(path.join(core.runRoot,"commands.log"),path.join(runRoot,"runtime-commands.log"));
      workspace=null;
    }
    const remaining=context.batch.units.filter(unit=>!runtime.includes(unit));
    if(remaining.length) workspace=stageWorkspace(root,artifactRoot,budget,"Plugins",{dotnetRequired:remaining.some(unit=>unit.pluginKind==="managed-code")});
    for(const unit of remaining) {
      const directory=path.join(runRoot,"evidence",unit.id.replaceAll(/[.:]/g,"-"));fs.mkdirSync(directory,{recursive:true});
      const result={id:unit.id,providedObligations:unit.provides,status:"NOT_RUN",exitCode:4,completedCaseIds:[],completedMethodIds:[],completedScenarioIds:[],completedEditorCaseIds:[],rawEvidence:[]};results.push(result);
      try {
        if(unit.kind==="plugin") {
          const npm=process.platform==="win32"?"npm.cmd":"npm";
          const frontend=path.join(workspace.directory,policy.plugins[unit.artifact].root,"frontend");
          await run(npm,["ci","--workspace",`${policy.plugins[unit.artifact].root}/frontend`,"--include-workspace-root","--no-audit","--no-fund"],workspace.directory);
          await run(npm,["run","typecheck"],frontend);await run(npm,["run","build"],frontend);
          const built=path.join(workspace.directory,policy.plugins[unit.artifact].root,"web/main.js");
          if(!fs.statSync(built).size) throw new Error("Missing frontend output");
          fs.copyFileSync(built,path.join(directory,"frontend-main.js"));
        } else if(unit.id==="plugins.inventory") {
          validateInventory(workspace.directory,policy);
          await run(python,["tools/repo.py", "check", "source"],workspace.directory);
          await run(python,["tests/architecture/check.py","--root",workspace.directory,"--report",path.join(directory,"architecture.json")],workspace.directory);
          await run(python,["-m","tests.tooling.unittest_runner","--root",workspace.directory,"--suite","architecture","--report",path.join(directory,"python-architecture.json")],workspace.directory);
        } else if(unit.id==="plugins.docs") {
          for(const file of ["README.md","docs/TESTING.md"]) if(!fs.statSync(path.join(workspace.directory,file)).size) throw new Error("Missing documentation");
          await run(process.execPath,["tools/docs/check-links.mjs"],workspace.directory);
        } else if(unit.id==="plugins.ci-policy") {
          await run(process.execPath,["--test","tests/runner/selection.test.mjs","tests/runner/scope-plan.test.mjs","tests/runner/core-plan.test.mjs","tests/runner/batch-plan.test.mjs","tests/runner/component-discovery.test.mjs","tests/runner/runtime-evidence.test.mjs","tests/support/budget.test.mjs"],workspace.directory);
          await run(python,["-m","tests.tooling.unittest_runner","--root",workspace.directory,"--suite","ci","--report",path.join(directory,"python-ci.json")],workspace.directory);
        } else if(unit.id==="plugins.release-contract") {
          await run(python,["-m","tests.tooling.unittest_runner","--root",workspace.directory,"--suite","tooling","--report",path.join(directory,"python-tooling.json")],workspace.directory);
        } else if(unit.id.startsWith("plugins.plugin.package:")) {
          if(unit.pluginKind==="managed-code") host??=stageWorkspace(context.partnerRoot,artifactRoot,budget);
          await run(python,["tools/repo.py", "package","--root",workspace.directory,"--artifact",unit.artifact,"--output",path.join(directory,"package"),"--report",path.join(directory,"package-report.json"),
            ...(host?["--host-root",host.directory]:[])],workspace.directory);
        } else throw new Error(`No batch executor: ${unit.id}`);
        result.exitCode=0;result.status="PASS";
      } catch(error) {result.exitCode=error.exitCode??1;result.status="FAIL";result.failure=error.message;primary ||=result.exitCode;}
      const receipt=path.join(directory,"unit-receipt.json");fs.writeFileSync(receipt,JSON.stringify({unitId:unit.id,provides:unit.provides,status:result.status,exitCode:result.exitCode,source:workspace.source,elapsedMs:budget.elapsedMs},null,2));
      for(const file of fs.readdirSync(directory)) if(fs.statSync(path.join(directory,file)).isFile()) result.rawEvidence.push(path.relative(runRoot,path.join(directory,file)).replaceAll("\\","/"));
    }
  } catch(error) {primary ||=error.exitCode??1;console.error(error.stack||error.message);}
  finally {
    if(host) {context.partnerSource=host.source;context.partnerFingerprint=host.sourceFingerprint;}
    const cleanup=getProcessRunnerState();if(!cleanup.cleanupComplete) primary ||=6;
    if(cleanup.cleanupComplete) {workspace?.release();host?.release();}
    saveBatch(context,runRoot,workspace??reportWorkspace,results,primary,budget.elapsedMs,cleanup);
  }
  return primary;
}
