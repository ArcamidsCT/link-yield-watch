// LINK Yield Watch poller: reads Chainlink Community Staking Pool v0.2 and writes data.json
import fs from 'fs';
const RPC = process.env.RPC || 'https://ethereum-rpc.publicnode.com';
const POOL = '0xBc10f2E862ED4502144c7d632a3459F49DFCDB5e'; // Community Staking Pool (v0.2)
// Selectors = first 4 bytes of keccak256(signature)
const rpc = async (method, params) => { const r = await (await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})})).json(); if (r.error) throw new Error(method+': '+r.error.message); return r.result; };
const sel = async s => (await rpc('web3_sha3',['0x'+Buffer.from(s).toString('hex')])).slice(0,10);
const call = async s => rpc('eth_call',[{to:POOL,data:await sel(s)},'latest']);
const words = h => h.slice(2).match(/.{64}/g).map(w=>BigInt('0x'+w));
const link = b => Number(b)/1e18;
const [max,tot,lim,act,block] = await Promise.all([call('getMaxPoolSize()'),call('getTotalPrincipal()'),call('getStakerLimits()'),call('isActive()'),rpc('eth_blockNumber',[])]);
const d = { readAt:new Date().toISOString(), block:parseInt(block,16), pool:POOL,
  maxPoolSize:link(words(max)[0]), totalStaked:link(words(tot)[0]),
  minPerStaker:link(words(lim)[0]), maxPerStaker:link(words(lim)[1]), active:words(act)[0]===1n };
d.available = d.maxPoolSize - d.totalStaked; d.isOpen = d.active && d.available >= d.minPerStaker;
const prev = fs.existsSync('data.json') ? JSON.parse(fs.readFileSync('data.json')) : null;
// ---- Alerts (dedupe: one email per opening event; flag resets once the pool is full again)
const DRY = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
const SITE = 'https://arcamidsct.github.io/link-yield-watch/';
d.alertSent = d.isOpen ? Boolean(prev?.isOpen && prev?.alertSent) : false;
if (d.isOpen && !d.alertSent && prev) {
  const n = Math.floor(d.available).toLocaleString('en-US');
  const email = { subject: `Chainlink staking spot open: ${n} LINK available`,
    body: `The Chainlink Community Staking Pool has **${n} LINK** of open capacity as of block ${d.block}.\n\nSpots usually fill fast. Stake only via the official site: [staking.chain.link](https://staking.chain.link)\n\nLive status: [LINK Yield Watch](${SITE})\n\n_Never share your seed phrase. Not financial advice._`,
    status: 'about_to_send' };
  if (DRY) { console.log('[dry-run] would send:', email.subject); d.alertSent = true; }
  else if (!process.env.BUTTONDOWN_API_KEY) console.log('No BUTTONDOWN_API_KEY; alert not sent');
  else {
    const r = await fetch('https://api.buttondown.com/v1/emails', { method:'POST', headers:{ Authorization:`Token ${process.env.BUTTONDOWN_API_KEY}`, 'Content-Type':'application/json' }, body: JSON.stringify(email) });
    if (r.ok) { d.alertSent = true; console.log('Alert sent:', email.subject); }
    else { console.error('Alert send failed', r.status, (await r.text()).slice(0,300)); process.exitCode = 1; }
  }
}
const key=o=>o&&JSON.stringify([o.maxPoolSize,o.totalStaked,o.minPerStaker,o.maxPerStaker,o.active,o.alertSent]);
if (!prev || key(prev)!==key(d) || Date.now()-Date.parse(prev.readAt)>3600e3) fs.writeFileSync('data.json', JSON.stringify(d,null,2)); // heartbeat hourly console.log(d);
