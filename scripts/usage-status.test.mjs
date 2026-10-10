import test from 'node:test';
import assert from 'node:assert/strict';
import {usageSnapshotSchema,usagePercent,effectiveAiRemaining,renewalLabel} from '../lib/usage-status.ts';
const limit={bucket:'ai-call',windowSeconds:3600,limit:60,used:59,remaining:1,resetsAt:'2026-10-11T01:00:00.000Z'};
test('available AI calls respect both the hourly and daily limits',()=>{
 assert.equal(effectiveAiRemaining([limit,{...limit,windowSeconds:86400,limit:200,remaining:100}]),1);assert.equal(effectiveAiRemaining([{...limit,remaining:0}]),0);assert.equal(effectiveAiRemaining([]),0);assert.equal(usagePercent({...limit,used:90}),100);
});
test('renewal dates use Brasilia and invalid counter responses cannot be displayed as available',()=>{
 assert.match(renewalLabel(limit.resetsAt),/10\/10, 22:00:00/);assert.equal(usageSnapshotSchema.safeParse({generatedAt:limit.resetsAt,limits:[limit]}).success,true);
 assert.equal(usageSnapshotSchema.safeParse({generatedAt:'2026-10-10T17:00:00+00:00',limits:[{...limit,resetsAt:'2026-10-11T01:00:00+00:00'}]}).success,true);
 for(const changed of [{remaining:-1},{bucket:'other'},{resetsAt:'tomorrow'}])assert.equal(usageSnapshotSchema.safeParse({generatedAt:limit.resetsAt,limits:[{...limit,...changed}]}).success,false);
});
