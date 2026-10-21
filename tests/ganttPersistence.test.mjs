import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/components/ProjectsManager.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('ProjectsManager.tsx',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX);
function productionFunction(name,dependencies){
  let initializer;
  const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name)initializer=node.initializer?.getText(ast);ts.forEachChild(node,visit);};visit(ast);
  assert.ok(initializer,`Missing production function ${name}`);
  const code=ts.transpileModule(`const fn=${initializer};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  return new Function(...Object.keys(dependencies),`${code};return fn;`)(...Object.values(dependencies));
}
const ganttText={saveError:'Save failed',scheduled:'Scheduled',targetError:'Target failed'};
function client(responses){return {from(table){assert.equal(table,'project_tasks');return {update(){return {eq(column,id){assert.equal(column,'id');return {async select(columns){assert.equal(columns,'id');const result=responses[id];if(result instanceof Error)throw result;return result;}};}};}};}};}
test('actual bulk scheduling reconciles only confirmed writes before reporting partial failure',async()=>{
  let state={project:[{id:'a',due_date:null},{id:'b',due_date:null},{id:'c',due_date:'2026-10-01'}]};const notices=[];
  const save=productionFunction('bulkUpdateGanttDates',{supabase:client({a:{data:[{id:'a'}],error:null},b:{data:[],error:null},c:new Error('Network failed')}),setProjectTasks:update=>{state=update(state);},toast:{error:text=>notices.push(text),success:()=>assert.fail('Must not report full success')},ganttText});
  await assert.rejects(save([{id:'a',due_date:'2026-11-01'},{id:'b',due_date:'2026-11-02'},{id:'c',due_date:'2026-11-03'}]));
  assert.equal(state.project[0].due_date,'2026-11-01');assert.equal(state.project[1].due_date,null);assert.equal(state.project[2].due_date,'2026-10-01');assert.deepEqual(notices,['Save failed']);
});
test('actual single-task changes do not alter the UI after a zero-row or rejected update',async()=>{
  let changed=false;const save=productionFunction('updateGanttTask',{supabase:client({a:{data:[],error:null}}),toast:{error(){}},ganttText,handleTaskUpdate(){changed=true;}});
  await assert.rejects(save('a',{completed:true}),/not updated/);assert.equal(changed,false);
});
test('actual successful scheduling keeps unrelated projects and tasks unchanged',async()=>{
  let state={one:[{id:'a',due_date:null},{id:'other',due_date:'2026-10-01'}],two:[{id:'b',due_date:'2026-10-02'}]};let succeeded=false;
  const save=productionFunction('bulkUpdateGanttDates',{supabase:client({a:{data:[{id:'a'}],error:null}}),setProjectTasks:update=>{state=update(state);},toast:{error:()=>assert.fail('No error expected'),success:()=>{succeeded=true;}},ganttText});
  await save([{id:'a',due_date:'2026-11-01'}]);assert.equal(succeeded,true);assert.equal(state.one[1].due_date,'2026-10-01');assert.equal(state.two[0].due_date,'2026-10-02');
});
