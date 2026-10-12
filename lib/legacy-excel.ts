// BIFF8 keeps genuine Excel 97–2003 compatibility. Add the presentation records
// omitted by the community writer without changing cell values or number formats.
export async function legacyExcel(book:any,headerRows:number[]){
 const module:any=await import('xlsx');const X:any=module.CFB?module:module.default;
 for(const name of book.SheetNames){const r=X.utils.decode_range(book.Sheets[name]['!ref']||'A1');if(r.e.r>=65536||r.e.c>=256)throw new Error('Excel 97–2003 hỗ trợ tối đa 65.536 dòng và 256 cột. Hãy thu hẹp kỳ báo cáo.');}
 const cfb=X.CFB.read(new Uint8Array(X.write(book,{bookType:'biff8',type:'array'})),{type:'array'});const entry=X.CFB.find(cfb,'Workbook');const raw=new Uint8Array(entry.content);
 const u16=(b:Uint8Array,o:number)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint16(o,true);
 const put=(b:Uint8Array,o:number,n:number)=>new DataView(b.buffer,b.byteOffset,b.byteLength).setUint16(o,n,true);
 const parts:{type:number,b:Uint8Array,old?:number}[]=[];for(let o=0;o+4<=raw.length;){const type=u16(raw,o),n=u16(raw,o+2);if(!type&&!n)break;parts.push({type,b:raw.slice(o+4,o+4+n),old:o});o+=4+n;}
 const xfs=parts.filter(p=>p.type===0xe0).map(p=>p.b);const extra:any[]=[];
 const font=(bold:boolean)=>{const name='Times New Roman',b=new Uint8Array(16+name.length*2);put(b,0,bold?260:220);put(b,2,bold?1:0);put(b,4,0x7fff);put(b,6,bold?700:400);b[14]=name.length;b[15]=1;[...name].forEach((c,i)=>put(b,16+i*2,c.charCodeAt(0)));return b;};
 for(let variant=0;variant<3;variant++)for(const xf of xfs){const b=xf.slice();put(b,0,variant?1:0);put(b,4,0);b[6]=variant?0x1a:0x08;b[9]=0xfc;if(variant!==1){put(b,10,0x1111);put(b,12,0);put(b,14,0);if(variant===2){b[17]=4;put(b,18,22|(64<<7));}}extra.push({type:0xe0,b});}
 const result:any[]=[];let sheet=-1,global=true,inserted=false;
 for(const part of parts){
  if(part.type===0x809&&u16(part.b,2)===0x10){sheet++;global=false;}
  if(global&&part.type===0x31){result.push({...part,b:font(false)},{type:0x31,b:font(true)});continue;}
  if(global&&part.type===0x0a&&!inserted){result.push(...extra);inserted=true;}
  if(!global&&[0xfd,0x204,0x203,0x201,0x205,0x6,0x27e].includes(part.type)){
   const row=u16(part.b,0),variant=row<headerRows[sheet]?1:row===headerRows[sheet]?2:0;put(part.b,4,xfs.length+variant*xfs.length+u16(part.b,4));
  }
  result.push(part);
  if(!global&&part.type===0x80){
   const wsbool=new Uint8Array(2);put(wsbool,0,0x0100);result.push({type:0x81,b:wsbool});
   const setup=new Uint8Array(34);put(setup,0,book.Sheets[book.SheetNames[sheet]]['!cols'].length>10?8:9);put(setup,2,100);put(setup,4,1);put(setup,6,1);put(setup,8,0);put(setup,10,0);put(setup,12,300);put(setup,14,300);new DataView(setup.buffer).setFloat64(16,.3,true);new DataView(setup.buffer).setFloat64(24,.3,true);put(setup,32,1);result.push({type:0xa1,b:setup});
   for(const type of [0x26,0x27,0x28,0x29]){const b=new Uint8Array(8);new DataView(b.buffer).setFloat64(0,.4,true);result.push({type,b});}
  }
  if(!global&&part.type===0x200){
   const ws=book.Sheets[book.SheetNames[sheet]],range=X.utils.decode_range(ws['!ref']);
   for(let r=0;r<=range.e.r;r++){let lines=1;if(r>headerRows[sheet])for(let c=0;c<=range.e.c;c++){const v=String(ws[X.utils.encode_cell({r,c})]?.v||'');lines=Math.max(lines,...v.split('\n').map((s:string)=>Math.ceil(s.length/Math.max(6,(ws['!cols'][c]?.wch||20)-3))));}const b=new Uint8Array(16);put(b,0,r);put(b,4,range.e.c+1);put(b,6,Math.min(8190,(r===headerRows[sheet]?44:r<headerRows[sheet]?26:Math.max(32,lines*15+10))*20));put(b,12,0x40);result.push({type:0x208,b});}
  }
 }
 const offsets=new Map<number,number>();let length=0;for(const p of result){if(p.old!==undefined)offsets.set(p.old,length);length+=4+p.b.length;}
 const out=new Uint8Array(length);let offset=0;for(const p of result){if(p.type===0x85){const v=new DataView(p.b.buffer,p.b.byteOffset,p.b.byteLength);v.setUint32(0,offsets.get(v.getUint32(0,true))!,true);}put(out,offset,p.type);put(out,offset+2,p.b.length);out.set(p.b,offset+4);offset+=4+p.b.length;}
 X.CFB.utils.cfb_add(cfb,'Workbook',out);return new Uint8Array(X.CFB.write(cfb,{type:'array'}));
}
