import path from "node:path";
import { verify as bettergi } from "./bettergi.test.mjs";
import { verify as zzz } from "./zzz.test.mjs";
import { verify as maastellasora } from "./maastellasora.test.mjs";
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--root")) throw new Error("Expected --root repository");
const root = args.length ? path.resolve(args[1]) : path.resolve(import.meta.dirname, "../..");
for (const verify of [bettergi, zzz, maastellasora]) verify(root);
console.log("Config editor behavior verified: 3 projects");
