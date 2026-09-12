import{describe,expect,it}from'vitest';import type{Entity}from'../../workspace/types';import{containmentGate}from'./DomainDepthPanel';const e=(id:string,kind:string,status:string,fields:Entity['fields']):Entity=>({id,kind,status,title:id,revision:1,fields});describe('containmentGate',()=>{it('combines response, custody, and owner blockers',()=>{const incident=e('i','incident','investigating',{}),rows=[e('p','playbook','pending',{incident:'i',required:'yes'}),e('x','evidence','analyzed',{incident:'i'})];expect(containmentGate(incident,rows).blockers).toHaveLength(3);});it('accepts sealed evidence and completed required steps',()=>expect(containmentGate(e('i','incident','investigating',{owner:'A'}),[e('p','playbook','complete',{incident:'i',required:'yes'}),e('x','evidence','sealed',{incident:'i'})]).ready).toBe(true));});

import { product } from '../../product/definition';
import { execute, fresh } from '../../workspace/engine';
import type { Snapshot, Value } from '../../workspace/types';
function act(state:Snapshot,operation:string,entityId:string,input:Record<string,Value>={},actorId='actor-0') {return execute(state,{id:operation+String(state.revision),type:'operate',operation,entityId,actorId,input,expectedRevision:state.revision},product,'2026-09-12T12:00:00Z');}
function recovered(){let state=act(fresh(product),'analyze','evidence-1',{},'actor-2');state=act(state,'seal','evidence-1');state=act(state,'complete','playbook-1');return act(act(state,'contain','incident-1'),'recover','incident-1');}
it('preserves detached custody evidence on closure and explicit reopening',()=>{
 let state=act(recovered(),'close-incident','incident-1',{note:'Endpoint recovered and custody evidence reviewed.'});const closure=structuredClone(state.entities.find(item=>item.kind==='closure'));
 expect(()=>act(state,'link','alert-1',{incident:'incident-1',reason:'New indicator requires review.'})).toThrow('Reopen');
 state=act(state,'reopen-incident','incident-1',{note:'New threat evidence requires further investigation.'});state=act(state,'link','alert-1',{incident:'incident-1',reason:'New indicator requires review.'});
 expect(state.entities.find(item=>item.id===closure?.id)).toEqual(closure);expect(state.entities.filter(item=>item.kind==='closure')).toHaveLength(2);
 expect(state.entities.find(item=>item.id==='incident-1')?.status).toBe('investigating');
});
it('requires accountable ownership and completed custody transfers',()=>{
 let state=recovered();state=act(state,'request-transfer','evidence-1',{recipient:'Omar Saleh',reason:'Transfer for independent custody review.'});
 expect(()=>act(state,'close-incident','incident-1',{note:'Endpoint recovered and custody evidence reviewed.'})).toThrow('pending custody');
 const transfer=state.entities.find(item=>item.kind==='transfer');if(!transfer)throw new Error('Missing transfer');state=act(state,'accept-transfer',transfer.id,{note:'Received sealed evidence with digest verified.'},'actor-1');
 const incident=state.entities.find(item=>item.id==='incident-1');if(!incident)throw new Error('Missing incident');incident.fields['owner']='Omar Saleh';
 expect(()=>act(state,'close-incident','incident-1',{note:'Endpoint recovered and custody evidence reviewed.'})).toThrow('accountable');
});
