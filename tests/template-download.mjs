import {pathToFileURL} from 'node:url';
import {build} from 'vite';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import * as X from 'xlsx';
await build({configFile:false,build:{ssr:'lib/task-excel.ts',outDir:'.sites-runtime/download-flow-test',rollupOptions:{output:{entryFileNames:'parser.mjs'}}}});
const {parseTaskExcel}=await import(pathToFileURL(process.cwd()+'/.sites-runtime/download-flow-test/parser.mjs'));
await build({configFile:false,build:{ssr:'lib/save-import.ts',outDir:'.sites-runtime/save-import-test',rollupOptions:{output:{entryFileNames:'save.mjs'}}}});
const {saveImportRows}=await import(pathToFileURL(process.cwd()+'/.sites-runtime/save-import-test/save.mjs'));
const dir=mkdtempSync(path.join(tmpdir(),'ns-template-')),port=3192,origin='http://localhost:'+port,token=randomBytes(24).toString('hex'),pass='Download-test-'+randomBytes(16).toString('hex');
const server=spawn(process.execPath,['selfhost-dist/server/server.mjs'],{env:{...process.env,PORT:String(port),DATA_DIR:dir,SETUP_TOKEN:token,APP_ORIGIN:origin},stdio:['ignore','pipe','pipe']});
async function call(route,body,cookie=''){const r=await fetch(origin+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{cookie,...(body===undefined?{}:{'Content-Type':'application/json','X-NS-Request':'1'})},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());return {data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie};}
try{
 await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('ready'))resolve()});server.on('error',reject);server.on('exit',c=>reject(new Error('Exit '+c)));});
 const ready=await fetch(origin+'/api/task-template-ready');assert.equal(ready.status,200);assert.match(ready.headers.get('content-disposition'),/attachment; filename="Mau-nhap-nhiem-vu-Nam-Sach.xlsx"/);const readyBytes=new Uint8Array(await ready.arrayBuffer());assert.deepEqual(Buffer.from(readyBytes),readFileSync('public/templates/Mau-nhap-nhiem-vu-Nam-Sach.xlsx'));
 console.log('PASS public direct attachment: exact ready workbook, no login/session/static redirect required');
 assert.equal((await fetch(origin+'/api/task-template?month=2026-10')).status,401);
 await call('bootstrap',{token,username:'admin',name:'Admin',password:pass});const cookie=(await call('login',{username:'admin',password:pass})).cookie;
 await call('unit',{name:'Đơn vị mới kiểm thử',group:'Khối Đảng',active:true},cookie);
 for(const month of ['2026-10','2026-11']){
 const r=await fetch(origin+'/api/task-template?month='+month,{headers:{cookie}});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');assert.equal(r.headers.get('content-disposition'),'attachment; filename="Mau-nhap-nhiem-vu-'+month+'.xlsx"');
 const bytes=new Uint8Array(await r.arrayBuffer());assert.deepEqual([...bytes.slice(0,2)],[80,75]);const wb=X.read(bytes,{type:'array'});assert.deepEqual(wb.SheetNames,['Nhap nhiem vu','Danh muc don vi','Huong dan']);const headers=X.utils.sheet_to_json(wb.Sheets['Nhap nhiem vu'],{header:1})[0];assert.ok(headers.includes('Nội dung nhiệm vụ'));assert.ok(headers.includes('Đơn vị chủ trì'));assert.ok(X.utils.sheet_to_json(wb.Sheets['Danh muc don vi'],{header:1}).some(row=>row[0]==='Đơn vị mới kiểm thử'));assert.equal(X.utils.sheet_to_json(wb.Sheets['Huong dan'],{header:1})[1][1],month);
 console.log('PASS authenticated HTTP attachment: '+month+', filename, valid XLSX and live unit directory');
 }
 assert.equal((await fetch(origin+'/api/task-template?month=2026-99',{headers:{cookie}})).status,400);
 assert.equal((await call('data',undefined,cookie)).data.tasks.length,0);
 const grant=(await call('task-template-download',{month:'2026-10'},cookie)).data;
 const response=await fetch(origin+grant.url);assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/Mau-nhap-nhiem-vu-2026-10.xlsx/);let wb=X.read(new Uint8Array(await response.arrayBuffer()),{type:'array'});
 const head=X.utils.sheet_to_json(wb.Sheets['Nhap nhiem vu'],{header:1})[0];const values={'Mã nhập':'E2E-001','Tháng theo dõi':'2026-10','Nội dung nhiệm vụ':'Nhập Excel đầu cuối','Đơn vị chủ trì':'Phòng Kinh tế','Người phụ trách':'Cán bộ kiểm thử','Ngày giao':'11/10/2026','Thời hạn hoàn thành':'31/10/2026'};X.utils.sheet_add_aoa(wb.Sheets['Nhap nhiem vu'],[head.map(h=>values[h]||'')],{origin:'A2'});
 const fd=new FormData();fd.set('month','2026-10');fd.set('file',new Blob([X.write(wb,{type:'array',bookType:'xlsx'})]),'mau-da-dien.xlsx');const preview=await fetch(origin+'/api/task-import-preview',{method:'POST',headers:{cookie,'X-NS-Request':'1'},body:fd});assert.equal(preview.status,200);const parsed=await preview.json();assert.deepEqual(parsed.rows[0].errors,[]);assert.equal(parsed.rows[0].payload.assignedDate,'2026-10-11');
 const saved=(await call('task',{...parsed.rows[0].payload,importAction:'assign'},cookie)).data;assert.equal(saved.status,'assigned');assert.equal((await call('data',undefined,cookie)).data.tasks.length,1);
 assert.equal((await fetch(origin+'/api/task-template-file?token=bad')).status,400);assert.equal((await fetch(origin+'/api/task-template-file?token='+'a'.repeat(72))).status,410);
 console.log('PASS download grant without third-party cookie → fill downloaded template → multipart preview → save/assign shared task');
 let readyBook=X.read(readyBytes,{type:'array'});const readyHeaders=X.utils.sheet_to_json(readyBook.Sheets['Nhap nhiem vu'],{header:1})[0];X.utils.sheet_add_aoa(readyBook.Sheets['Nhap nhiem vu'],[readyHeaders.map(h=>h==='Mã nhập'?'BROWSER-001':values[h]||'')],{origin:'A2'});const fresh=(await call('data',undefined,cookie)).data;const browserRows=await parseTaskExcel(X.write(readyBook,{type:'array',bookType:'xlsx'}),fresh,'2026-10');assert.equal(browserRows.length,1);assert.deepEqual(browserRows[0].errors,[]);const browserSaved=(await call('task',{...browserRows[0].payload,importAction:'assign'},cookie)).data;assert.equal(browserSaved.status,'assigned');const updated=(await call('data',undefined,cookie)).data;assert.equal(updated.tasks.length,2);assert.ok(updated.tasks.some(t=>t.id===browserSaved.id&&t.unit===browserRows[0].payload.unit));
 console.log('PASS ready download → fill workbook → browser-shared parser → JSON save/assign → shared data refresh');
 const batchRows=Array.from({length:20},(_,i)=>({payload:{...browserRows[0].payload,importCode:'FAST-'+i,title:'Lưu đồng thời '+i},errors:[],saved:false}));batchRows.push({payload:{...browserRows[0].payload,importCode:'FAST-RETRY',unit:'missing-unit'},errors:[],saved:false});
 let inflight=0,maxInflight=0,progress=0;const save=async payload=>{inflight++;maxInflight=Math.max(maxInflight,inflight);try{const r=await fetch(origin+'/api/task',{method:'POST',headers:{cookie,'Content-Type':'application/json','X-NS-Request':'1'},body:JSON.stringify({...payload,importAction:'assign'})});const result=await r.json();if(!r.ok)throw new Error(result.error);return result;}finally{inflight--;}};
 let batchResult=await saveImportRows(batchRows,save,(_,finished)=>progress=finished);assert.equal(maxInflight,4);assert.equal(progress,21);assert.equal(batchResult.filter(r=>r.saved).length,20);assert.equal((await call('data',undefined,cookie)).data.tasks.length,22);
 batchResult[20].payload.unit=browserRows[0].payload.unit;batchResult=await saveImportRows(batchResult,save,()=>{});assert.ok(batchResult.every(r=>r.saved));assert.equal((await call('data',undefined,cookie)).data.tasks.length,23);
 console.log('PASS 4 simultaneous saves, per-row progress, partial failure and retry without duplicate writes');
 const login=await fetch(origin+'/api/login',{method:'POST',headers:{'Content-Type':'application/json','X-NS-Request':'1'},body:JSON.stringify({username:'admin',password:pass})});assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/SameSite=None/);assert.match(login.headers.get('set-cookie'),/Secure; Partitioned/);
 const page=readFileSync('app/page.tsx','utf8');assert.equal((page.match(/onClick={downloadTemplate}/g)||[]).length,2);assert.ok(!page.includes('downloadTaskTemplate'));
 console.log('PASS template controls, invalid month/auth rejection and shared task persistence');
}finally{server.kill();await new Promise(r=>server.once('exit',r));rmSync(dir,{recursive:true,force:true});}
