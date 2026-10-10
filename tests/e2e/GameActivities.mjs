import assert from "node:assert/strict";
import { runtime, preparePlugin, launchBrowser, report } from "./owned-host.mjs";
let browser;
const observations=[];
try {
  const manifest=await preparePlugin();runtime.startRuntime(["service"]);await runtime.waitForService(null,5000);
  const route=`api/plugin-api/${manifest.name}/`;
  const read=async()=>{const response=await runtime.api("GET",route+"state");assert.equal(response.status,200,await response.clone().text());return response.json();};
  const initial=await read();assert.equal(initial.settingsRevision,0);assert.deepEqual(initial.settings.selectedGames,[]);
  const catalogResponse=await runtime.api("GET","api/dashboard/layout");assert.equal(catalogResponse.status,200,await catalogResponse.clone().text());
  const catalog=await catalogResponse.json();assert.equal(catalog.cards.filter(card=>card.cardId==="plugin:game-activities:carousel").length,1);
  const settings={...initial.settings,onboardingCompleted:true,progressions:{"blue-archive":"jp","neverness-to-everness":"global"}};
  const saved=await runtime.api("PUT",route+"settings",{expectedRevision:0,settings});assert.equal(saved.status,200,await saved.clone().text());await saved.arrayBuffer();
  const conflict=await runtime.api("PUT",route+"settings",{expectedRevision:0,settings:initial.settings});assert.equal(conflict.status,409);await conflict.arrayBuffer();
  const invalid=await runtime.api("PUT",route+"settings",{expectedRevision:1,settings:{...settings,selectedGames:["blue-archive","blue-archive"]}});assert.equal(invalid.status,400);await invalid.arrayBuffer();
  assert.deepEqual((await read()).settings,settings);
  browser=await launchBrowser();const page=await browser.newPage({locale:"zh-CN"});page.setDefaultTimeout(5000);
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  for(let index=0;index<3;index++) {
    await page.goto(runtime.serviceUrl()+"#/dashboard");await page.getByRole("heading",{name:"游戏活动",exact:true}).waitFor();
    await page.getByRole("button",{name:"活动设置",exact:true}).click();
    await page.getByRole("switch",{name:"原神",exact:true}).click();
    await page.getByRole("button",{name:"取消",exact:true}).click();
    assert.deepEqual((await read()).settings,settings);
    await page.goto(runtime.serviceUrl()+"#/settings");observations.push({index,cancelPreservedRevision:(await read()).settingsRevision});
  }
  assert.deepEqual(errors,[]);
  await browser.close();browser=null;await runtime.stopRuntime();runtime.startRuntime(["service"]);await runtime.waitForService(null,5000);
  assert.deepEqual((await read()).settings,settings);assert.equal((await read()).settingsRevision,1);
} finally {await browser?.close();await runtime.stopRuntime();}
report({scenarioId:"P-G05",observations,real:["actual Test Host plugin registration and private API", "settings CAS, validation, cancel and restart persistence", "browser card mount and route disposal"],substituted:["No live source qualification: subscriptions remain empty for deterministic lifecycle checks"]});
