export function discoverCases(listing, methods) {
  const prefixes=new Set(methods.map(id=>id.slice(0,id.lastIndexOf("."))));
  const cases=listing.split(/\r?\n/).map(line=>line.trim()).filter(line=>[...prefixes].some(prefix=>line.startsWith(prefix+".")));
  if(!cases.length||new Set(cases).size!==cases.length||JSON.stringify([...new Set(cases.map(id=>id.split("(")[0]))].sort())!==JSON.stringify([...methods].sort()))
    throw new Error("Pre-run native discovery differs from registered component methods");
  return cases.sort();
}
