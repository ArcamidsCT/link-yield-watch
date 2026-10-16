import fs from 'fs';
const d=(await (await fetch('https://yields.llama.fi/pools')).json()).data;
const r=d.filter(p=>p.symbol.toUpperCase().endsWith('LINK')&&p.tvlUsd>1e6).map(p=>({project:p.project,chain:p.chain,symbol:p.symbol,apy:Math.round((p.apy||0)*100)/100,tvlUsd:Math.round(p.tvlUsd)})).sort((a,b)=>b.tvlUsd-a.tvlUsd).slice(0,12);
if(!r.length) throw new Error('no rates');
const old=fs.existsSync('rates.json')?fs.readFileSync('rates.json','utf8'):'';const s=JSON.stringify(r,null,1);
if(old!==s) fs.writeFileSync('rates.json',s);
