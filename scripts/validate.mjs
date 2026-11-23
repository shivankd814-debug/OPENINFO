
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(new URL("..", import.meta.url).pathname);
const cats = JSON.parse(fs.readFileSync(path.join(root, "data/categories.json"), "utf8"));
const agents = JSON.parse(fs.readFileSync(path.join(root, "data/agents.json"), "utf8"));
const required = ["public/index.html","public/styles.css","public/app.js","server/index.js","server/collectors.js","server/store.js"];
const errors = [];
if (cats.length !== 12) errors.push(`Expected 12 departments, got ${cats.length}`);
if (cats.some(c => c.subs.length !== 6)) errors.push("Every department should have six focus areas");
if (agents.length < 10) errors.push("Agent registry incomplete");
for (const p of required) if (!fs.existsSync(path.join(root,p))) errors.push(`Missing ${p}`);
const html = fs.readFileSync(path.join(root,"public/index.html"),"utf8");
for (const term of ["student","roadmap","academy","Created by"]) if (!html.includes(`data-i18n="${term}"`) && !html.includes(term)) errors.push(`Missing UI content key: ${term}`);
const app = fs.readFileSync(path.join(root,"public/app.js"),"utf8");
for (const term of ["Student Universe","roadmap","Build & Launch Academy"]) if (!app.includes(term)) errors.push(`Missing learning view: ${term}`);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`OPENINFO validated: ${cats.length} departments, ${cats.reduce((n,c)=>n+c.subs.length,0)} focus areas, ${agents.length} agent roles.`);
