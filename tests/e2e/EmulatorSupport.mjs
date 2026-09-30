import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runtime, preparePlugin, report } from "./owned-host.mjs";

const records = [];
try {
  await preparePlugin();
  const owned = path.join(runtime.runtimeDir, "controlled-console"); fs.mkdirSync(owned);
  const consolePath = path.join(owned, "ld-console.cmd"), adb = path.join(owned, "adb.cmd"), mumu = path.join(owned, "mumu.cmd");
  fs.writeFileSync(consolePath, ["@echo off", 'echo %*>>"%~dp0console.log"',
    'if "%~1"=="list2" (', "echo 0,OwnedZero,0,0,1,0,0", "echo 1,OwnedOne,0,0,1,0,0", "exit /b 0", ")",
    'if not "%~3"=="1" exit /b 19',
    'if "%~1"=="launch" (', 'if exist "%~dp0offline" del "%~dp0offline"', "exit /b 0", ")",
    'if "%~1"=="quit" (', '>"%~dp0offline" echo offline', "exit /b 0", ")", "exit /b 18"].join("\r\n"));
  fs.writeFileSync(mumu, "@echo off\r\necho {}\r\nexit /b 0\r\n");
  fs.writeFileSync(adb, ["@echo off", 'echo %*>>"%~dp0adb.log"',
    'if exist "%~dp0offline" (', "echo error: device offline", "exit /b 1", ")",
    'if "%~1"=="connect" (', 'if not "%~2"=="127.0.0.1:5557" exit /b 19', "echo connected", "exit /b 0", ")",
    'if not "%~2"=="127.0.0.1:5557" exit /b 19',
    'if "%~4"=="dumpsys" (', "echo mCurrentFocus=Window{owned u0 com.owned.game/.MainActivity}", "exit /b 0", ")",
    'if "%~4"=="echo" (', "echo nexus-probe", "exit /b 0", ")",
    'if "%~4"=="am" (', "echo Success", "exit /b 0", ")", "exit /b 18"].join("\r\n"));
  runtime.startRuntime(["service"], { NEXUS_LD_CONSOLE_EXE: consolePath, NEXUS_ADB_EXE: adb, NEXUS_MUMU_MANAGER_EXE: mumu });
  await runtime.waitForService(null, 5000);
  if (process.env.NEXUS_TEST_HOST_UI === "false") {
    assert.ok(!fs.existsSync(path.join(runtime.runtimeDir, "wwwroot/index.html")));
    assert.equal((await runtime.api("GET", "index.html")).status, 404);
  }
  for (let index = 0; index < 2; index++) {
    if (fs.existsSync(path.join(owned, "offline"))) fs.unlinkSync(path.join(owned, "offline"));
    const fixture = runtime.makeFixture(`emulator-${index}`);
    runtime.writeBatch(fixture, ["echo OWNED_COMPLETE"]);
    const response = await runtime.api("POST", "api/scripts", { name: `Owned emulator ${index}`, rootPath: fixture.dir,
      mainExe: fixture.exe, configPath: fixture.cfg, logPath: fixture.log, launchGame: true, gameMode: "emulator",
      gameExe: "127.0.0.1:5557", gameArgs: "-n com.owned.game/.MainActivity", gameWaitSeconds: 1,
      forceCloseGame: true, maxAttempts: 1, totalTimeoutMinutes: 10, logStallTimeoutMinutes: 5,
      judgeScriptEnabled: true, judgeScriptLanguage: "javascript",
      judgeScript: "console.log(JSON.stringify({status:'success',reason:'owned-console'}));" });
    assert.equal(response.status, 200, await response.clone().text()); const script = await response.json();
    await runtime.createUserBinding(script.id, `Owned emulator user ${index}`);
    const started = await runtime.api("POST", "api/dispatch/script", { scriptId: script.id });
    assert.equal(started.status, 200, await started.clone().text()); await started.arrayBuffer();
    assert.equal(await runtime.waitNoRunning(6000), true);
    const record = await runtime.waitForHistory(script.id, 1000);
    assert.equal(record.status, "success", JSON.stringify(record)); records.push(record.id);
  }
  const calls = fs.readFileSync(path.join(owned, "console.log"), "utf8").trim().split(/\r?\n/).map(line => line.replaceAll('"', '').trim());
  assert.ok(calls.filter(line => line === "list2").length >= 2);
  assert.equal(calls.filter(line => line === "launch --index 1").length, 2);
  assert.equal(calls.filter(line => line === "quit --index 1").length, 2);
  assert.ok(!calls.some(line => line.includes("--index 0")));
  const adbCalls = fs.readFileSync(path.join(owned, "adb.log"), "utf8").replaceAll('"', '');
  assert.ok(adbCalls.includes("am start -n com.owned.game/.MainActivity"));
  assert.ok(!adbCalls.includes("127.0.0.1:5555"));
} finally { await runtime.stopRuntime(); }
report({ scenarioId: "P-G04", historyIds: records,
  real: ["Host dispatch and plugin provider selection", "EmulatorSupport LD discovery, launch and shutdown", "owned instance identity and history"],
  substituted: ["LD console and ADB external processes with two synthetic instance records", "no MuMu instance"] });
