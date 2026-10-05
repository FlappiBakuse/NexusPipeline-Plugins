import {resolvePair,validateDefaultHost} from "./inputs.mjs";
import fs from "node:fs";
import path from "node:path";
import {batchName, obligationNames} from "./names.mjs";
import {createScopePlan} from "../runner/scope-plan.mjs";
const root=path.resolve(import.meta.dirname,"../..");
const base=process.env.PR_BASE_SHA,head=process.env.PR_HEAD_SHA;
if(!/^[a-f0-9]{40}$/.test(base??"")||!/^[a-f0-9]{40}$/.test(head??"")||!process.env.SCOPE_RESULT||!process.env.GITHUB_OUTPUT||!/^\d+$/.test(process.env.PR_NUMBER??"")) throw new Error("Complete PR identity required");
const identity={base,head,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,prNumber:Number(process.env.PR_NUMBER)};
const inputPair=resolvePair(root,"FlappiBakuse/NexusPipeline-Plugins",identity);
identity.inputPair=inputPair;
let plan=createScopePlan(root,identity);
const lock=JSON.parse(fs.readFileSync(path.join(root,"tests/inputs.lock.json"))).host;
if(lock.repository!=="FlappiBakuse/NexusPipeline"||!/^[a-f0-9]{40}$/.test(lock.commitSha??"")) throw new Error("Invalid fixed Host lock");
if(!inputPair) validateDefaultHost(root,lock.commitSha);
plan=createScopePlan(root,{...identity,partnerSha:inputPair?.sources[0].testedSha ?? lock.commitSha});
if(plan.dirty||plan.capacityStatus!=="PLANNED") throw new Error("Dirty/CAPACITY_EXCEEDED scope");
const needsPartner=unit=>unit.kind==="partner-jint"||unit.id==="host.partner-contract"||unit.pluginKind==="data-specialized"&&unit.kind==="plugin"||unit.pluginKind==="managed-code"&&(unit.expectedMethodIds.length||unit.expectedScenarioIds.length||unit.id.startsWith("plugins.plugin.package:"));
const registry=JSON.parse(fs.readFileSync(path.join(root,"tests/gates.json")));
const matrix={include:plan.batches.map(batch=>({id:batch.id,name:batchName(batch,registry),partnerRequired:batch.units.some(needsPartner),dotnetRequired:batch.units.some(unit=>unit.preparations.some(name=>name.includes("test-build")||name.includes("component:")||name.includes("production-package:"))||unit.id==="host.architecture.backend")}))};
if(matrix.include.length>5) throw new Error("Sixth batch rejected");
fs.mkdirSync(path.dirname(path.resolve(process.env.SCOPE_RESULT)),{recursive:true});
fs.writeFileSync(process.env.SCOPE_RESULT,JSON.stringify(plan,null,2)+"\n");
fs.appendFileSync(process.env.GITHUB_OUTPUT,`matrix=${JSON.stringify(matrix)}\ncount=${matrix.include.length}\ncontrol=${plan.control.units.length?"true":"false"}\npartnerSha=${plan.partnerSha??""}\n`);

if(process.env.GITHUB_STEP_SUMMARY) {
  const groups=[plan.control,...plan.batches].filter(batch=>batch.units.length);
  const summary=groups.map(batch=>`### ${batch.id==="control"?"Plugins / 控制检查":batchName(batch,registry)}\n\n${obligationNames(batch,registry).map(name=>`- ${name}`).join("\n")}`).join("\n\n");
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+"\n");
}
