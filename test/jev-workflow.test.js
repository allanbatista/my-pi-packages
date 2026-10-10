const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
test('contratos e orçamento dos checks JEV',()=>{
 const result=spawnSync('python3',['-B','skills/batista-jev/scripts/test_workflow.py'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
