import setup from '../electron/setup-ai.cjs';
await setup.install(p=>console.log(p.message+(p.percent==null?'':' '+p.percent+'%')));
