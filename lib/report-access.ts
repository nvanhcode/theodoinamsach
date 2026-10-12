import {has,office,canSee,canReport} from './domain';
export const reportingOnly=(u:any)=>has(u,'editor','partner','head')&&!has(u,'admin','deputy','clerk','secretary','standing','chair','council','inspector','tech');
export const reportingUnits=(u:any,t:any)=>canReport(u,t)?[t.unit,...(t.partners||[])].filter((x:string,i:number,a:string[])=>a.indexOf(x)===i&&(office(u)||u.units.includes(x))):[];
export const canReadReport=(u:any,t:any,r:any)=>canSee(u,t)&&(r.state!=='draft'||office(u)||r.author===u.id||u.units.includes(r.unit));
export const evidenceLabels:Record<string,string>={none:'Không bắt buộc minh chứng',any:'Cần có tệp minh chứng',image:'Cần có ảnh minh chứng',document:'Cần có văn bản minh chứng'};

export const assignmentNoticeTitle=(title:string)=>title.replace(/^Giao nhiệm vụ từ (?:excel|exel)\s*:/i,'Nhiệm vụ được giao:');
