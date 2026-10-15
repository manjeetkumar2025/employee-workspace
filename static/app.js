const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const CSRF=$('meta[name=csrf]').content,ME=JSON.parse($('#me').textContent),TZS=JSON.parse($('#tzs').textContent),TZ=ME.timezone;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const P={grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
check:'<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',code:'<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
sliders:'<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>',
out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
menu:'<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',bug:'<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M8 10H4M16 10h4M8 15H4M16 15h4M9 3l2 3M15 3l-2 3"/>',
list:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>'};
const ico=n=>`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
async function api(p,m='GET',b){const r=await fetch('/api/'+p,{method:m,headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},body:b?JSON.stringify(b):undefined});let d={};try{d=await r.json()}catch(e){}
 if(!r.ok){if(r.status===401)location='/login';throw new Error(d.error||'Request failed. Please try again.')}return d}
function toast(m,t=''){const e=document.createElement('div');e.className='toast '+t;e.textContent=m;$('#toasts').append(e);setTimeout(()=>e.remove(),4200)}
const slug=s=>String(s).toLowerCase().replace(/\s+/g,'-'),badge=s=>`<span class="badge ${slug(s)}">${esc(s)}</span>`,demo=r=>'';
const fdt=i=>i?new Intl.DateTimeFormat('en-IN',{timeZone:TZ,day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(new Date(i)):'—';
const dayKey=d=>new Date(d).toLocaleDateString('en-CA',{timeZone:TZ});
const dur=s=>s==null?'—':`${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m`;
const mt=m=>new Date(m.start+':00+05:30'),IST={timeZone:'Asia/Kolkata'};
const fIST=(d,o)=>new Intl.DateTimeFormat('en-IN',{...IST,...o}).format(d);
let S={tasks:[],projects:[],bugs:[],meetings:[],att:{rows:[],open:null},act:[]},F={q:'',status:'',priority:'',department:'',sort:'new'},view=(location.hash||'#dashboard').slice(1);
const ST=['Pending','In Progress','Completed'],LV=['Low','Medium','High'],DEP=['Operations','Support','Finance','HR','Logistics','Web Development'],CAT=['General','Planning','Reporting','Review','Maintenance'],TECH=['HTML','CSS','JavaScript','React','Node.js'];
const NAV=[['dashboard','grid','Overview'],['ops','check','Operations'],['dev','code','Web Developer'],['attendance','clock','Attendance'],['meetings','cal','Meetings'],['settings','sliders','Settings']];
// ---- clock & countdown
let h12=localStorage.getItem('h12')!=='0';
const nextMtg=()=>S.meetings.filter(m=>m.status!=='Cancelled'&&mt(m)>Date.now()).sort((a,b)=>mt(a)-mt(b))[0];
function countdown(){const m=nextMtg();if(!m)return 'No upcoming meetings';let s=Math.floor((mt(m)-Date.now())/1e3);const d=Math.floor(s/86400);s%=86400;const p=n=>String(n).padStart(2,'0');return `${d?d+'d ':''}${p(Math.floor(s/3600))}:${p(Math.floor(s%3600/60))}:${p(s%60)}`}
function tick(){const n=new Date();$('#clockTime').textContent=n.toLocaleTimeString('en-IN',{timeZone:TZ,hour12:h12,hour:'2-digit',minute:'2-digit',second:'2-digit'}).toUpperCase();
 $('#clockDate').textContent=n.toLocaleDateString('en-IN',{timeZone:TZ,weekday:'long',day:'numeric',month:'long',year:'numeric'})+' · '+TZ;$$('.cd').forEach(e=>e.textContent=countdown())}
// ---- helpers
const stats=a=>`<div class="stats">${a.map(([l,v,i,c])=>`<div class="card stat"><div class="si ${c||''}">${ico(i)}</div><div><b>${v}</b><span>${l}</span></div></div>`).join('')}</div>`;
const empty=(t,b)=>`<div class="empty">${t}${b?`<div style="margin-top:10px">${b}</div>`:''}</div>`;
const seedBtn='<button class="btn sm" data-a="seed">Load work schedule</button>';
function csv(rows,name){const q=v=>{v=String(v??'');if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};const b=new Blob(['\ufeff'+rows.map(r=>r.map(q).join(',')).join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();URL.revokeObjectURL(a.href)}
function fld(f,v){v=v??f.d??'';const id='f_'+f.n;let i;
 if(f.t==='select')i=`<select id="${id}" name="${f.n}">${f.o.map(o=>`<option ${o==v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
 else if(f.t==='area')i=`<textarea id="${id}" name="${f.n}" rows="3" maxlength="500">${esc(v)}</textarea>`;
 else if(f.t==='checks'){const s=String(v).split(',');return `<div class="f wide"><span>${f.l}</span><div class="checks">${f.o.map(o=>`<label><input type="checkbox" name="${f.n}" value="${o}" ${s.includes(o)?'checked':''}> ${o}</label>`).join('')}</div></div>`}
 else i=`<input id="${id}" name="${f.n}" type="${f.t||'text'}" value="${esc(v)}" ${f.r?'required':''} ${f.t==='range'?'min="0" max="100"':''} ${f.t==='url'?'placeholder="https://"':''}>`;
 return `<div class="f${f.w?' wide':''}"><label for="${id}">${f.l}</label>${i}</div>`}
function form(title,fields,vals,save){const m=document.createElement('div');m.className='modal';
 m.innerHTML=`<form class="card mbox" novalidate><h3>${esc(title)}</h3><div class="fgrid">${fields.map(f=>fld(f,vals[f.n])).join('')}</div><div class="err" role="alert"></div><div class="row end"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save</button></div></form>`;
 document.body.append(m);const first=$('input,textarea',m);first&&first.focus();
 m.onclick=e=>{if(e.target===m||e.target.hasAttribute('data-x'))m.remove()};
 $('form',m).onsubmit=async e=>{e.preventDefault();const d={};fields.forEach(f=>d[f.n]=f.t==='checks'?$$(`[name=${f.n}]:checked`,m).map(x=>x.value).join(','):e.target.elements[f.n].value);
  try{await save(d);m.remove();await load();toast('Saved')}catch(x){$('.err',m).textContent=x.message}}}
const taskF=[{n:'title',l:'Title',r:1,w:1},{n:'description',l:'Description',t:'area',w:1},{n:'status',l:'Status',t:'select',o:ST},{n:'priority',l:'Priority',t:'select',o:LV,d:'Medium'},{n:'department',l:'Department',t:'select',o:DEP},{n:'category',l:'Category',t:'select',o:CAT},{n:'due',l:'Due date',t:'date'}];
const projF=[{n:'name',l:'Project name',r:1,w:1},{n:'description',l:'Description',t:'area',w:1},{n:'status',l:'Status',t:'select',o:['Active','Completed','On Hold']},{n:'progress',l:'Progress (%)',t:'number',d:0},{n:'techs',l:'Technologies',t:'checks',o:TECH},{n:'repo_url',l:'GitHub repository URL',t:'url',w:1},{n:'deadline',l:'Deadline',t:'date'}];
const bugF=[{n:'title',l:'Bug title',r:1,w:1},{n:'severity',l:'Severity',t:'select',o:LV,d:'Medium'},{n:'status',l:'Status',t:'select',o:['Open','In Progress','Resolved']},{n:'project',l:'Project',w:1}];
const mtgF=[{n:'title',l:'Meeting title',r:1,w:1},{n:'start',l:'Start date and time (IST)',t:'datetime-local',r:1},{n:'status',l:'Status',t:'select',o:['Scheduled','Cancelled']},{n:'agenda',l:'Agenda',t:'area',w:1},{n:'participants',l:'Attendees / team',w:1},{n:'link',l:'Meeting link (optional)',t:'url',w:1}];
const byId=(L,id)=>L.find(x=>x.id===id);
const rm=(r)=>async id=>{if(confirm('Delete this record? This cannot be undone.')){await api(r+'/'+id,'DELETE');await load();toast('Deleted')}};
const ACT={
 seed:async()=>{await api('seed','POST');await load();toast('Work schedule loaded')},
 unseed:async()=>{if(confirm('Remove the preloaded work schedule? Your own records stay.')){await api('seed','DELETE');await load();toast('Preloaded work schedule removed')}},
 newTask:()=>form('New task',taskF,{},d=>api('tasks','POST',{...d,area:'ops'})),
 editTask:id=>form('Edit task',taskF,byId(S.tasks,id),d=>api('tasks/'+id,'PUT',d)),delTask:rm('tasks'),
 newDev:()=>form('New coding task',taskF,{department:'Web Development'},d=>api('tasks','POST',{...d,area:'dev'})),
 newProj:()=>form('New project',projF,{},d=>api('projects','POST',d)),editProj:id=>form('Edit project',projF,byId(S.projects,id),d=>api('projects/'+id,'PUT',d)),delProj:rm('projects'),
 newBug:()=>form('Report bug',bugF,{},d=>api('bugs','POST',d)),editBug:id=>form('Edit bug',bugF,byId(S.bugs,id),d=>api('bugs/'+id,'PUT',d)),delBug:rm('bugs'),
 newMtg:()=>form('Schedule meeting',mtgF,{},d=>api('meetings','POST',d)),editMtg:id=>form('Edit meeting',mtgF,byId(S.meetings,id),d=>api('meetings/'+id,'PUT',d)),delMtg:rm('meetings'),
 expTasks:()=>csv([['Title','Status','Priority','Department','Category','Due','Created','Updated'],...S.tasks.filter(t=>t.area==='ops').map(t=>[t.title,t.status,t.priority,t.department,t.category,t.due,t.created_at,t.updated_at])],'daily-work-tasks.csv'),
 expReport:()=>{const r=report();csv([['Daily work report',r.day],['Tasks created today',r.created],['Tasks completed today',r.done],['Open tasks',r.open],['Attendance today',dur(r.secs)],[],['Activity'],...r.acts.map(a=>[fdt(a.at),a.text])],'daily-work-report.csv')},
 print:()=>print(),
 checkin:async()=>{let p={};if($('#geo')?.checked){try{const pos=await new Promise((ok,no)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(ok,no,{timeout:10000}):no({code:0}));p={lat:pos.coords.latitude,lon:pos.coords.longitude}}
  catch(e){toast(e.code===1?'Location permission denied. Checking in without location.':e.code===3?'Location request timed out. Checking in without location.':'Location unavailable. Checking in without location.','warn')}}
  await api('attendance/checkin','POST',p);await load();toast('Checked in')},
 checkout:async()=>{await api('attendance/checkout','POST');await load();toast('Checked out')}};
document.addEventListener('click',async e=>{const b=e.target.closest('[data-a]');if(!b)return;try{await ACT[b.dataset.a](+b.dataset.id||0)}catch(x){toast(x.message,'err')}});
document.addEventListener('change',async e=>{const t=e.target,k=t.dataset.ch;if(!k)return;try{await api(k+'/'+t.dataset.id,'PUT',{status:t.value});await load();toast('Status updated')}catch(x){toast(x.message,'err')}});
document.addEventListener('submit',async e=>{const f=e.target,k=f.dataset.f;if(!k)return;e.preventDefault();const d=Object.fromEntries(new FormData(f));
 try{if(k==='profile'){await api('profile','PUT',d);toast('Profile saved');setTimeout(()=>location.reload(),500)}else{await api('password','POST',d);f.reset();toast('Password changed')}}catch(x){$('.err',f).textContent=x.message}});
// ---- views
function report(){const day=dayKey(Date.now()),T=S.tasks.filter(t=>t.area==='ops');
 return{day,created:T.filter(t=>dayKey(t.created_at)===day).length,done:T.filter(t=>t.status==='Completed'&&dayKey(t.updated_at)===day).length,open:T.filter(t=>t.status!=='Completed').length,
 secs:S.att.rows.filter(r=>r.day===day).reduce((a,r)=>a+(r.duration||0),0),acts:S.act.filter(a=>dayKey(a.at)===day)}}
const overdue=t=>t.due&&t.status!=='Completed'&&t.due<dayKey(Date.now());
const V={};
V.dashboard=()=>{const T=S.tasks.filter(t=>t.area==='ops'),o=S.att.open,n=nextMtg();
 return `<div class="head"><h2>Welcome, ${esc(ME.name.split(' ')[0])}</h2><div class="grow"></div>${S.tasks.length+S.projects.length?'':seedBtn}</div>`+
 stats([['Total tasks',T.length,'list'],['Pending',T.filter(t=>t.status==='Pending').length,'clock','y'],['Completed',T.filter(t=>t.status==='Completed').length,'check','g'],['Active projects',S.projects.filter(p=>p.status==='Active').length,'code'],['Open bugs',S.bugs.filter(b=>b.status!=='Resolved').length,'bug','r']])+
 `<div class="grid2"><div class="card"><h3>Next meeting</h3>${n?`<div class="cd">${countdown()}</div><b>${esc(n.title)}</b><div class="muted">${fIST(mt(n),{dateStyle:'medium',timeStyle:'short'})} IST</div>`:empty('No upcoming meetings.','<a href="#meetings">Schedule one</a>')}</div>
 <div class="card"><h3>Attendance</h3><p>${o?badge('Checked in')+' since '+fdt(o.check_in):badge('Checked out')+' Not currently checked in'}</p><a href="#attendance">Open attendance</a></div></div>
 <div class="card"><h3>Recent activity</h3>${S.act.length?`<ul class="tl">${S.act.slice(0,8).map(a=>`<li>${esc(a.text)}<div class="muted small">${fdt(a.at)}</div></li>`).join('')}</ul>`:empty('No activity yet.')}</div>`};
function opsList(){let L=S.tasks.filter(t=>t.area==='ops'&&(!F.status||t.status===F.status)&&(!F.priority||t.priority===F.priority)&&(!F.department||t.department===F.department)&&(!F.q||(t.title+t.description+t.category).toLowerCase().includes(F.q.toLowerCase())));
 const pr={High:0,Medium:1,Low:2};L.sort({new:(a,b)=>b.id-a.id,due:(a,b)=>(a.due||'9')<(b.due||'9')?-1:1,priority:(a,b)=>pr[a.priority]-pr[b.priority],title:(a,b)=>a.title.localeCompare(b.title)}[F.sort]);
 if(!L.length)return empty('No tasks match your filters.',S.tasks.length?'':seedBtn);
 return `<div class="tablewrap"><table><thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>Department</th><th>Due</th><th></th></tr></thead><tbody>${L.map(t=>`<tr><td><b>${esc(t.title)}</b>${demo(t)}<div class="muted small">${esc(t.category)}</div></td><td>${badge(t.priority)}</td>
 <td><select data-ch="tasks" data-id="${t.id}" aria-label="Status">${ST.map(s=>`<option ${s===t.status?'selected':''}>${s}</option>`).join('')}</select></td><td>${esc(t.department)}</td><td>${esc(t.due||'—')} ${overdue(t)?badge('Overdue'):''}</td>
 <td class="row"><button class="btn ghost sm" data-a="editTask" data-id="${t.id}">Edit</button><button class="btn danger sm" data-a="delTask" data-id="${t.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>`}
V.ops=()=>{const T=S.tasks.filter(t=>t.area==='ops'),r=report(),opt=(a,v)=>a.map(x=>`<option ${x===v?'selected':''}>${x}</option>`).join('');
 return `<div class="head"><h2>Operations</h2><div class="grow"></div><button class="btn ghost" data-a="expTasks">Export tasks (CSV)</button><button class="btn" data-a="newTask">New task</button></div>`+
 stats([['Total tasks',T.length,'list'],['Pending',T.filter(t=>t.status!=='Completed').length,'clock','y'],['Completed',T.filter(t=>t.status==='Completed').length,'check','g'],['Done today',r.done,'check']])+
 `<div class="card" style="margin-bottom:18px"><div class="row"><h3 style="margin:0">Daily work report · ${r.day}</h3><div class="grow"></div><button class="btn ghost sm" data-a="expReport">Export CSV</button><button class="btn ghost sm" data-a="print">Print</button></div>
 <p class="muted">Created today: <b>${r.created}</b> · Completed today: <b>${r.done}</b> · Open: <b>${r.open}</b> · Attendance today: <b>${dur(r.secs)}</b></p>
 <details><summary>Personal activity history (${r.acts.length} today)</summary><ul class="tl" style="margin-top:10px">${S.act.slice(0,15).map(a=>`<li>${esc(a.text)}<div class="muted small">${fdt(a.at)}</div></li>`).join('')||'<li>No activity</li>'}</ul></details></div>
 <div class="card"><div class="filters"><input id="fq" placeholder="Search tasks…" value="${esc(F.q)}" aria-label="Search"><select id="fs" aria-label="Status"><option value="">All statuses</option>${opt(ST,F.status)}</select>
 <select id="fp" aria-label="Priority"><option value="">All priorities</option>${opt(LV,F.priority)}</select><select id="fd" aria-label="Department"><option value="">All departments</option>${opt(DEP,F.department)}</select>
 <select id="fo" aria-label="Sort"><option value="new">Newest</option><option value="due" ${F.sort==='due'?'selected':''}>Due date</option><option value="priority" ${F.sort==='priority'?'selected':''}>Priority</option><option value="title" ${F.sort==='title'?'selected':''}>Title</option></select></div><div id="opsList">${opsList()}</div></div>`};
V.dev=()=>{const P_=S.projects,D=S.tasks.filter(t=>t.area==='dev'),dl=P_.filter(p=>p.deadline&&p.status!=='Completed').sort((a,b)=>a.deadline<b.deadline?-1:1);
 return `<div class="head"><h2>Web Developer</h2><div class="grow"></div><button class="btn ghost" data-a="newDev">New coding task</button><button class="btn ghost" data-a="newBug">Report bug</button><button class="btn" data-a="newProj">New project</button></div>`+
 stats([['Projects',P_.length,'code'],['Active',P_.filter(p=>p.status==='Active').length,'clock','y'],['Completed',P_.filter(p=>p.status==='Completed').length,'check','g'],['Open bugs',S.bugs.filter(b=>b.status!=='Resolved').length,'bug','r']])+
 `<div class="card" style="margin-bottom:18px"><h3>Technologies in use</h3><div class="chips">${TECH.map(t=>`<span class="chip">${t} · ${P_.filter(p=>p.techs.split(',').includes(t)).length}</span>`).join('')}</div></div>`+
 (P_.length?`<div class="cards">${P_.map(p=>`<div class="card"><div class="row"><b>${esc(p.name)}</b>${demo(p)}<div class="grow"></div>${badge(p.status)}</div><p class="muted">${esc(p.description)}</p>
 <div class="row small"><span>Progress</span><div class="grow"></div><b>${p.progress}%</b></div><div class="bar"><i style="width:${p.progress}%"></i></div>
 <div class="chips">${p.techs.split(',').filter(Boolean).map(t=>`<span class="chip">${esc(t)}</span>`).join('')}</div>
 <p class="small muted">Deadline: ${esc(p.deadline||'—')}${p.repo_url?` · <a href="${esc(p.repo_url)}" target="_blank" rel="noopener noreferrer">Repository</a>`:''}</p>
 <div class="row"><button class="btn ghost sm" data-a="editProj" data-id="${p.id}">Edit</button><button class="btn danger sm" data-a="delProj" data-id="${p.id}">Delete</button></div></div>`).join('')}</div>`:`<div class="card" style="margin-bottom:18px">${empty('No projects yet.',seedBtn)}</div>`)+
 `<div class="grid2"><div class="card"><h3>Coding task tracker</h3>${D.length?`<table><tbody>${D.map(t=>`<tr><td>${esc(t.title)}${demo(t)}<div class="muted small">Due ${esc(t.due||'—')}</div></td><td><select data-ch="tasks" data-id="${t.id}" aria-label="Status">${ST.map(s=>`<option ${s===t.status?'selected':''}>${s}</option>`).join('')}</select></td>
 <td class="row"><button class="btn ghost sm" data-a="editTask" data-id="${t.id}">Edit</button><button class="btn danger sm" data-a="delTask" data-id="${t.id}">Delete</button></td></tr>`).join('')}</tbody></table>`:empty('No coding tasks yet.')}</div>
 <div class="card"><h3>Project deadlines</h3>${dl.length?dl.map(p=>`<div class="row"><span>${esc(p.name)}</span><div class="grow"></div><span class="muted">${esc(p.deadline)}</span></div>`).join(''):empty('No upcoming deadlines.')}</div></div>
 <div class="grid2"><div class="card"><h3>Bug tracker</h3>${S.bugs.length?`<div class="tablewrap"><table><tbody>${S.bugs.map(b=>`<tr><td>${esc(b.title)}${demo(b)}<div class="muted small">${esc(b.project)}</div></td><td>${badge(b.severity)}</td>
 <td><select data-ch="bugs" data-id="${b.id}" aria-label="Status">${['Open','In Progress','Resolved'].map(s=>`<option ${s===b.status?'selected':''}>${s}</option>`).join('')}</select></td>
 <td class="row"><button class="btn ghost sm" data-a="editBug" data-id="${b.id}">Edit</button><button class="btn danger sm" data-a="delBug" data-id="${b.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>`:empty('No bugs reported.')}</div>
 <div class="card"><h3>Development activity</h3><ul class="tl">${S.act.slice(0,10).map(a=>`<li>${esc(a.text)}<div class="muted small">${fdt(a.at)}</div></li>`).join('')||'<li>No activity</li>'}</ul></div></div>`};
V.attendance=()=>{const o=S.att.open;
 return `<div class="head"><h2>Attendance</h2></div><div class="card" style="margin-bottom:18px"><p>${o?badge('Checked in')+' since '+fdt(o.check_in):badge('Checked out')+' You are not checked in.'}</p>
 <label class="check"><input type="checkbox" id="geo"> Attach my location (browser will ask for permission; optional)</label>
 <div class="row"><button class="btn" data-a="checkin" ${o?'disabled':''}>Check in</button><button class="btn ghost" data-a="checkout" ${o?'':'disabled'}>Check out</button></div>
 <p class="muted small">Attendance entries are recorded locally using the server clock.</p></div>
 <div class="card"><h3>History</h3>${S.att.rows.length?`<div class="tablewrap"><table><thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Duration</th><th>Location</th><th>Source</th></tr></thead><tbody>${S.att.rows.map(r=>`<tr><td>${r.day}</td><td>${fdt(r.check_in)}</td><td>${fdt(r.check_out)}</td><td>${r.check_out?dur(r.duration):badge('Checked in')}</td>
 <td>${r.lat!=null?`${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}`:'Not shared'}</td><td><span class="badge">Local record</span></td></tr>`).join('')}</tbody></table></div>`:empty('No attendance records yet. Use Check in to create one.')}</div>`};
V.meetings=()=>{const M=[...S.meetings].sort((a,b)=>mt(a)-mt(b)),up=M.filter(m=>mt(m)>Date.now()),past=M.filter(m=>mt(m)<=Date.now()).reverse(),n=nextMtg();
 const item=m=>`<div class="mt"><div class="row"><b>${esc(m.title)}</b>${demo(m)}${badge(m.status==='Cancelled'?'Cancelled':mt(m)>Date.now()?'Upcoming':'Completed')}<div class="grow"></div><span>${fIST(mt(m),{timeStyle:'short'})}</span></div>
  ${m.agenda?`<div class="muted small">Agenda: ${esc(m.agenda)}</div>`:''}${m.participants?`<div class="muted small">With: ${esc(m.participants)}</div>`:''}${m.link?`<div class="small"><a href="${esc(m.link)}" target="_blank" rel="noopener noreferrer">Open meeting link</a></div>`:''}
  <div class="row" style="margin-top:6px"><button class="btn ghost sm" data-a="editMtg" data-id="${m.id}">Edit</button><button class="btn danger sm" data-a="delMtg" data-id="${m.id}">Delete</button></div></div>`;
 const group=L=>{const g={};L.forEach(m=>(g[m.start.slice(0,10)]??=[]).push(m));return Object.entries(g).map(([d,a])=>{const dt=new Date(d+'T00:00:00+05:30');return `<div class="cal"><div class="d"><b>${fIST(dt,{day:'2-digit'})}</b><span class="small muted">${fIST(dt,{month:'short'})}<br>${fIST(dt,{weekday:'short'})}</span></div><div>${a.map(item).join('')}</div></div>`}).join('')};
 return `<div class="head"><h2>Meetings</h2><div class="grow"></div><button class="btn" data-a="newMtg">Schedule meeting</button></div>
 <div class="card" style="margin-bottom:18px"><h3>Next meeting</h3>${n?`<div class="cd">${countdown()}</div><b>${esc(n.title)}</b> <span class="muted">· ${fIST(mt(n),{dateStyle:'full',timeStyle:'short'})} IST</span>`:empty('Nothing scheduled.')}
 <p class="muted small">Times are in Asia/Kolkata (IST). Meeting links are saved for reference; no video-call integration is connected.</p></div>
 <div class="grid2"><div class="card"><h3>Upcoming</h3>${up.length?group(up):empty('No upcoming meetings.',seedBtn)}</div><div class="card"><h3>Past</h3>${past.length?group(past):empty('No past meetings.')}</div></div>`};
V.settings=()=>`<div class="head"><h2>Profile and settings</h2></div><div class="grid2"><form class="card" data-f="profile"><h3>Profile</h3><div class="row" style="margin-bottom:12px"><span class="avatar">${ini(ME.name)}</span><span class="muted">Profile initials</span></div>
 ${fld({n:'name',l:'Display name',r:1},ME.name)}${fld({n:'email',l:'Email address',t:'email',r:1},ME.email)}${fld({n:'timezone',l:'Timezone',t:'select',o:TZS},ME.timezone)}${fld({n:'theme',l:'Theme',t:'select',o:['dark','light']},ME.theme)}
 <div class="err" role="alert"></div><button class="btn">Save changes</button></form>
 <form class="card" data-f="password"><h3>Change password</h3>${fld({n:'current',l:'Current password',t:'password',r:1})}${fld({n:'new',l:'New password',t:'password',r:1})}<div class="err" role="alert"></div><button class="btn">Change password</button></form></div>
 <div class="card"><h3>Work schedule setup</h3><p class="muted">Load a structured work schedule with example tasks and team meetings. Your own records are kept separate.</p><div class="row"><button class="btn ghost" data-a="seed">Load work schedule</button><button class="btn danger" data-a="unseed">Remove work schedule</button></div></div>`;
const ini=n=>n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
function notes(){const L=[];S.tasks.filter(overdue).forEach(t=>L.push('Overdue task: '+t.title));
 S.meetings.filter(m=>m.status!=='Cancelled'&&mt(m)>Date.now()&&mt(m)-Date.now()<864e5).forEach(m=>L.push('Meeting within 24h: '+m.title));
 S.bugs.filter(b=>b.severity==='High'&&b.status!=='Resolved').forEach(b=>L.push('High-severity bug: '+b.title));
 if(S.att.open)L.push('You are currently checked in.');return L}
function render(){if(!V[view])view='dashboard';$('#nav').innerHTML=NAV.map(([k,i,l])=>`<a class="navlink ${k===view?'on':''}" href="#${k}">${ico(i)}${l}</a>`).join('');
 $('#view').innerHTML=V[view]();const n=notes();$('#dot').hidden=!n.length;$('#dot').textContent=n.length;$('#notes').innerHTML=n.length?n.map(x=>`<div>${esc(x)}</div>`).join(''):'<div class="muted">You are all caught up.</div>';tick()}
async function load(){const[a,b,c,d,e,f]=await Promise.all(['tasks','projects','bugs','meetings','attendance','activity'].map(x=>api(x)));S={tasks:a,projects:b,bugs:c,meetings:d,att:e,act:f};render()}
$('#view').addEventListener('input',e=>{const m={fq:'q',fs:'status',fp:'priority',fd:'department',fo:'sort'}[e.target.id];if(m){F[m]=e.target.value;$('#opsList').innerHTML=opsList()}});
window.addEventListener('hashchange',()=>{view=location.hash.slice(1);document.body.classList.remove('nav');render()});
$('#menuBtn').innerHTML=ico('menu');$('#menuBtn').onclick=()=>document.body.classList.toggle('nav');$('#bell').innerHTML=ico('bell');$('#bell').onclick=()=>{$('#notes').hidden=!$('#notes').hidden};
$('#icLogout').innerHTML=ico('out');$('#avatar').textContent=ini(ME.name);$('#uname').textContent=ME.name;$('#uemail').textContent=ME.email;
$('#fmtBtn').onclick=()=>{h12=!h12;localStorage.setItem('h12',h12?'1':'0');tick()};
setInterval(tick,1000);tick();load().catch(x=>toast(x.message,'err'));
