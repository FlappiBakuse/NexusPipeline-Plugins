"use strict";

const selected = String(nexus.input.configInputValue || "").trim();
if (!/^\d{2}$/.test(selected)) {
  throw new Error("实例序号必须是两位数字");
}

const extra = nexus.input.extras && nexus.input.extras[0];
const file = extra && extra.files && extra.files[0] && extra.files[0].path;
if (!file) {
  throw new Error("one_dragon.yml 工作副本不存在");
}
const source = nexus.readFile("@extra0/" + file);
if (source === null) {
  throw new Error("无法读取 one_dragon.yml 工作副本");
}

const newline = source.includes("\r\n") ? "\r\n" : "\n";
const hasFinalNewline = source.endsWith("\n");
const lines = source.split(/\r?\n/);
if (hasFinalNewline && lines[lines.length - 1] === "") {
  lines.pop();
}

const sectionPattern = /^(\s*)instance_list\s*:\s*(?:#.*)?$/;
let sectionStart = -1;
let sectionIndent = 0;
for (let index = 0; index < lines.length; index += 1) {
  if (sectionPattern.test(lines[index])) {
    if (sectionStart >= 0) {
      throw new Error("one_dragon.yml 存在重复 instance_list");
    }
    sectionStart = index;
    sectionIndent = lines[index].match(sectionPattern)[1].length;
  }
}
if (sectionStart < 0) {
  throw new Error("one_dragon.yml 缺少 instance_list");
}

let firstContent = sectionStart + 1;
while (firstContent < lines.length && /^\s*(?:#.*)?$/.test(lines[firstContent])) {
  firstContent += 1;
}
if (firstContent >= lines.length) {
  throw new Error("instance_list 为空");
}
const firstMatch = lines[firstContent].match(/^(\s*)-\s*(.*)$/);
if (!firstMatch || firstMatch[1].length < sectionIndent) {
  throw new Error("instance_list 格式无效");
}
const itemIndent = firstMatch[1].length;

let sectionEnd = lines.length;
for (let index = firstContent; index < lines.length; index += 1) {
  if (/^\s*(?:#.*)?$/.test(lines[index])) {
    continue;
  }
  const lineMatch = lines[index].match(/^(\s*)-\s*(.*)$/);
  const indent = lines[index].match(/^\s*/)[0].length;
  if (indent < itemIndent
      || (indent === itemIndent && !lineMatch)) {
    sectionEnd = index;
    break;
  }
}

const itemStarts = [];
for (let index = firstContent; index < sectionEnd; index += 1) {
  const match = lines[index].match(/^(\s*)-\s*(.*)$/);
  if (match && match[1].length === itemIndent) {
    itemStarts.push(index);
  } else if (!/^\s*(?:#.*)?$/.test(lines[index])
      && lines[index].match(/^\s*/)[0].length < itemIndent) {
    throw new Error("instance_list 条目缩进不一致");
  }
}
if (itemStarts.length === 0) {
  throw new Error("instance_list 没有有效条目");
}

const entries = [];
for (let index = 0; index < itemStarts.length; index += 1) {
  const start = itemStarts[index];
  const end = index + 1 < itemStarts.length ? itemStarts[index + 1] : sectionEnd;
  const block = lines.slice(start, end);
  let idxValue = null;
  let idxCount = 0;
  let idxIndent = itemIndent + 2;
  const inlineIdx = block[0].match(/^\s*-\s*idx\s*:\s*(.*?)\s*(?:#.*)?$/);
  if (inlineIdx) {
    idxCount += 1;
    idxValue = normalizeInstanceIndex(inlineIdx[1]);
  }
  for (const line of block.slice(1)) {
    const match = line.match(/^(\s*)idx\s*:\s*(.*?)\s*(?:#.*)?$/);
    if (!match) {
      continue;
    }
    idxCount += 1;
    idxIndent = match[1].length;
    idxValue = normalizeInstanceIndex(match[2]);
  }
  if (idxCount !== 1 || !/^\d{2}$/.test(idxValue || "")) {
    throw new Error("instance_list 存在缺失或重复的 idx");
  }
  entries.push({ start, end, block, idx: idxValue, idxIndent });
}

const selectedEntries = entries.filter(entry => entry.idx === selected);
if (selectedEntries.length !== 1) {
  throw new Error(selectedEntries.length === 0
    ? "instance_list 中找不到选定实例"
    : "instance_list 中存在重复的选定实例");
}

const selectedEntry = selectedEntries[0];
const fields = new Set();
for (let index = 1; index < selectedEntry.block.length; index += 1) {
  const line = selectedEntry.block[index];
  const activeMatch = line.match(/^(\s*)(active|active_in_od)\s*:\s*.*$/);
  if (!activeMatch) {
    continue;
  }
  const name = activeMatch[2];
  fields.add(name);
  selectedEntry.block[index] = activeMatch[1] + name + ": true";
}
if (!fields.has("active")) {
  selectedEntry.block.push(" ".repeat(selectedEntry.idxIndent) + "active: true");
}
if (!fields.has("active_in_od")) {
  selectedEntry.block.push(" ".repeat(selectedEntry.idxIndent) + "active_in_od: true");
}

const output = lines
  .slice(0, firstContent)
  .concat(selectedEntry.block)
  .concat(lines.slice(sectionEnd))
  .join(newline) + (hasFinalNewline ? newline : "");
if (!nexus.writeFile("@extra0/" + file, output)) {
  throw new Error("无法写回 one_dragon.yml 工作副本");
}

function normalizeInstanceIndex(raw) {
  const value = String(raw || "").replace(/^['"]|['"]$/g, "");
  return /^\d{1,2}$/.test(value) ? value.padStart(2, "0") : value;
}
