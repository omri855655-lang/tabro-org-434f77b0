import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/printDocument.ts', import.meta.url), 'utf8');
const module = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`);

function harness() {
  const state={printed:false,shown:false,removed:false,focused:false,html:'',listeners:{},events:{},attributes:{}};
  class FocusTarget { isConnected=true; focus(){state.focused=true;} }
  globalThis.HTMLElement=FocusTarget;
  const report={setAttribute(k,v){state.attributes[k]=v;},set innerHTML(value){state.html=value;},querySelector(id){return {addEventListener(event,fn){state.listeners[id]=fn;}};},addEventListener(event,fn){state.events[event]=fn;},showModal(){state.shown=true;},close(){state.events.close();},remove(){state.removed=true;}};
  globalThis.document={title:'Original app',activeElement:new FocusTarget(),createElement(tag){assert.equal(tag,'dialog');return report;},body:{append(node){assert.equal(node,report);}}};
  globalThis.window={print(){state.printed=true;},open(){throw new Error('Reports must not require popups');}};
  return {state,report,cleanup(){delete globalThis.document;delete globalThis.window;delete globalThis.HTMLElement;}};
}

test('print report previews event text in a native dialog and escapes supplied HTML', () => {
  const {state,cleanup}=harness();
  try {
    assert.equal(module.printDocument('יומן', ['אירוע', 'פרטים'], [['פגישה', '<script>alert(1)</script>']]),true);
    assert.equal(state.shown,true);assert.equal(state.printed,false);
    state.listeners['#tabro-print-report']();assert.equal(state.printed,true);
    assert.ok(state.html.includes('פגישה'));assert.ok(state.html.includes('&lt;script&gt;'));assert.ok(!state.html.includes('<script>'));
    assert.ok(state.html.includes('body:has([data-tabro-report]) > *:not([data-tabro-report]){display:none!important}'));
    assert.ok(state.html.includes('position:static!important'));
  } finally {cleanup();}
});

test('print report respects selected language, direction and escaped empty-state text', () => {
  const {state,report,cleanup}=harness();
  try {
    module.printDocument('Plan', ['Task'], [], '', { lang: 'es', dir: 'ltr', emptyMessage: '<Empty>' });
    assert.equal(report.lang,'es');assert.equal(report.dir,'ltr');
    assert.ok(state.html.includes('&lt;Empty&gt;'));assert.ok(!state.html.includes('<Empty>'));
    assert.ok(state.html.includes('Imprimir / Guardar como PDF'));
  } finally {cleanup();}
});

test('closing the visible report restores the app title and focus and removes print styles',()=>{
  const {state,cleanup}=harness();
  try {
    module.printDocument('Plan',['Task'],[]);
    assert.equal(document.title,'Plan');state.listeners['#tabro-close-report']();
    assert.equal(state.removed,true);assert.equal(state.focused,true);assert.equal(document.title,'Original app');
  } finally {cleanup();}
});
