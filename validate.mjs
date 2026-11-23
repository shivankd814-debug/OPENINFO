import fs from 'node:fs';
const cats=JSON.parse(fs.readFileSync(new URL('../data/categories.json',import.meta.url)));
const agents=JSON.parse(fs.readFileSync(new URL('../server/agents.json',import.meta.url)));
const errors=[];
if(cats.length!==30)errors.push(`Expected 30 departments, found ${cats.length}`);
if(cats.some(c=>c.subs.length!==5))errors.push('Every department must have exactly five subcategories');
if(agents.length!==20)errors.push(`Expected 20 specialist roles, found ${agents.length}`);
if(!fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8').includes('Created by'))errors.push('Footer creator credit missing');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`Validated: ${cats.length} departments, ${cats.reduce((n,c)=>n+c.subs.length,0)} subcategories, ${agents.length} agent roles.`);
