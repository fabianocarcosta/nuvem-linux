import './style.css'

const icons = {
  cloud: '<path d="M20 16.2A4.5 4.5 0 0 0 18 7.5h-1.3A7 7 0 1 0 4 15.25"/><path d="M12 12v9m-4-4 4-4 4 4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  drive: '<path d="m8 3-7 13 4 5 7-13-4-5Zm8 0 7 13h-6L9 3h7Zm-9 13h15l-4 5H4l3-5Z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1L13 7.3h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 2Z"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5-5 5 5m-5-5v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
}
const icon = (name, cls='') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.file}</svg>`
const fmt = n => {if(n<1024)return `${Math.round(n)} B`;const units=['KB','MB','GB','TB','PB'];let value=n/1024,index=0;while(value>=1024&&index<units.length-1){value/=1024;index++}return `${value.toFixed(1)} ${units[index]}`}
const load = () => []
function seed() {
  const now=Date.now(); return [
    {id:'f1',name:'Projetos',type:'folder',parent:'root',modified:now-3600000,color:'#4886f5'},
    {id:'f2',name:'Fotos de viagem',type:'folder',parent:'root',modified:now-86400000,color:'#ec6f8d'},
    {id:'f3',name:'Documentos',type:'folder',parent:'root',modified:now-172800000,color:'#34a853'},
    {id:'d1',name:'Apresentação do projeto.pdf',type:'file',mime:'application/pdf',size:2480000,parent:'root',modified:now-3600000,color:'#ef5350'},
    {id:'d2',name:'Planejamento 2026.xlsx',type:'file',mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',size:582000,parent:'root',modified:now-7200000,color:'#34a853'},
    {id:'d3',name:'Notas da reunião.docx',type:'file',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:146000,parent:'root',modified:now-86400000,color:'#4285f4'},
    {id:'d4',name:'Ideias para o produto.txt',type:'file',mime:'text/plain',size:3200,parent:'root',modified:now-172800000,color:'#7b8794'},
    {id:'d5',name:'Capa do projeto.png',type:'file',mime:'image/png',size:1840000,parent:'f1',modified:now-300000,color:'#a66ce8',preview:'linear-gradient(135deg,#a6c0fe,#f68084)'},
    {id:'d6',name:'Briefing.txt',type:'file',mime:'text/plain',size:4200,parent:'f1',modified:now-3600000,color:'#7b8794'},
  ]
}
let items=load(), current='root', section='drive', query='', grid=true, sortByModified=false,sortOldestFirst=false,starred=new Set(JSON.parse(localStorage.getItem('nuvem-stars')||'[]'))
let drivePath='', driveRemote='', driveLoading=false, driveError='', driveWarning='', driveAccounts=[], driveConnected=false, syncFolders=[], driveQuota=null
const save=()=>localStorage.setItem('nuvem-items',JSON.stringify(items))
const dateLabel=t=>{const d=new Date(t),today=new Date();return d.toDateString()===today.toDateString()?`Hoje, ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}
const fileIcon=f=>f.type==='folder'?'folder':f.mime?.startsWith('image/')?'image':'file'
function visibleItems(){let rows=section==='drive'?items.filter(x=>x.parent===current):[];if(query)rows=rows.filter(x=>x.name.toLowerCase().includes(query.toLowerCase()));if(sortByModified)rows.sort((a,b)=>sortOldestFirst?a.modified-b.modified:b.modified-a.modified);return rows}
function quotaSummaryHtml(){const used=Number(driveQuota?.usage||0),limit=Number(driveQuota?.limit||0),driveUsed=Number(driveQuota?.usageInDrive||0),free=Math.max(0,limit-used),percent=limit?Math.min(100,used/limit*100):0;return `<div class="quota-summary-content"><div class="quota-summary-copy"><span>Espaço disponível na conta Google</span><b>${limit?`${fmt(free)} livres de ${fmt(limit)}`:'Cota indisponível'}</b><small>${limit?`${fmt(used)} usados na conta${driveUsed?` · ${fmt(driveUsed)} no Google Drive`:''}`:driveConnected?'Não foi possível consultar o armazenamento da conta.':'Conecte o Google Drive para consultar sua cota.'}</small></div><div class="quota-summary-meter" role="progressbar" aria-label="Armazenamento usado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}"><i style="width:${percent}%"></i></div></div>`}
function render(){const rows=visibleItems();const title=section==='drive'?(current==='root'?'Meu Drive':drivePath.split('/').filter(Boolean).at(-1)||items.find(x=>x.id===current)?.name||'Meu Drive'):section==='sync'?'Pastas sincronizadas':'Meu Drive';document.querySelector('#app').innerHTML=`
<aside class="sidebar"><a class="brand" href="#">${icon('cloud')}<span>Nuvem</span></a><button class="new-button" id="new">${icon('plus')}<span>Nova sincronização</span></button><nav class="nav">${[['drive','drive','Meu Drive'],['sync','cloud','Pastas sincronizadas']].map(([id,ic,label])=>`<button class="nav-item ${section===id?'active':''}" data-section="${id}">${icon(ic)}<span>${label}</span></button>`).join('')}</nav><div class="storage"><div class="storage-title">Armazenamento</div><div class="progress"><i style="width:18%"></i></div><div class="storage-info"><b>1,8 GB</b> de 15 GB usados</div><button class="upgrade">Gerenciar armazenamento</button></div><div class="profile"><div class="avatar">F</div><div><b id="profileName">Minha conta</b><span id="profileEmail">Não conectado</span></div><button class="profile-settings" id="profileSettings" type="button" title="Conta e conexão" aria-label="Conta e conexão">${icon('settings')}</button></div></aside>
<main class="main"><header class="topbar"><label class="search">${icon('search')}<input id="search" placeholder="Pesquisar no Drive" value="${query}"><kbd>⌘ K</kbd></label><button id="syncSettings" class="connect-drive">${icon('cloud')} Google Drive</button><button class="help" id="help" title="Ajuda" aria-label="Ajuda">?</button><div class="avatar top-avatar">F</div></header><section class="content ${section==='sync'?'sync-page':''}"><div class="heading"><div><div class="breadcrumbs">${section==='drive'?`<button data-root>Meu Drive</button>${current!=='root'?`<span>›</span><span>${title}</span>`:''}`:'Nuvem'}</div><h1>${title}</h1></div><div class="heading-actions"><button class="icon-button ${grid?'selected':''}" id="grid" aria-label="Exibir em ícones" aria-pressed="${grid}">${icon('grid')}</button><button class="icon-button ${!grid?'selected':''}" id="list" aria-label="Exibir em lista" aria-pressed="${!grid}">${icon('list')}</button><button class="filter" id="sortModified" aria-label="Ordenar por data de modificação">${sortByModified?(sortOldestFirst?'Mais antigas':'Mais recentes'):'Última modificação'} ${icon('clock')}</button></div></div><section class="quota-summary" id="quotaSummary" aria-label="Cota do Google Drive">${quotaSummaryHtml()}</section>${syncFoldersHtml()}${driveWarning?`<div class="drive-warning">${esc(driveWarning)}</div>`:''}${section==='drive'&&current==='root'&&!query?`<h2>Pastas</h2><div class="folder-grid ${grid?'grid':'list'}">${rows.filter(x=>x.type==='folder').map(folderCard).join('')}</div><div class="file-heading"><h2>Arquivos</h2><span>${rows.filter(x=>x.type==='file').length} itens</span></div>`:`${rows.some(x=>x.type==='folder')?`<h2>Pastas</h2><div class="folder-grid ${grid?'grid':'list'}">${rows.filter(x=>x.type==='folder').map(folderCard).join('')}</div>`:''}<div class="file-heading"><h2>Arquivos</h2><span>${rows.filter(x=>x.type==='file').length} itens</span></div>`}<div class="file-list ${grid?'grid':''}"><div class="list-header"><span>Nome</span><span>Proprietário</span><span>Última modificação</span><span>Tamanho</span><span></span></div>${rows.filter(x=>x.type==='file').map(fileRow).join('')}${rows.length===0?`<div class="empty"><div class="empty-icon">${icon('cloud')}</div><b>${driveLoading?'Carregando seu Google Drive…':driveError?'Não foi possível carregar o Drive':query?'Nenhum arquivo encontrado':'Esta pasta está vazia'}</b><span>${esc(driveError|| (driveConnected?'Não há itens nesta pasta.':'Conecte sua conta Google Drive para ver seus arquivos.'))}</span></div>`:''}</div></section><button class="fab" id="uploadFab">${icon('upload')}<span>Fazer upload</span></button><input id="fileInput" type="file" multiple hidden><div id="toast" class="toast"></div><div class="modal-backdrop" id="syncModal" hidden><section class="sync-modal"><button class="modal-close" id="closeSync">×</button><div class="modal-cloud">${icon('cloud')}</div><h2>Sincronizar pastas</h2><p class="modal-description">Gerencie suas contas Google e configure pastas locais para manter em sincronia com o Drive.</p><div id="syncState" class="sync-state">Verificando conexão…</div><div id="accountsSection" class="accounts-section" hidden><div class="accounts-header"><b>Contas Google Conectadas</b><button type="button" class="add-account-toggle" id="toggleAddAccount">+ Adicionar outra conta</button></div><div id="accountsList" class="accounts-list"></div></div><div id="connectActions" class="connect-actions"><label>Nome desta conexão<input id="newRemoteName" value="meu-drive" maxlength="40" placeholder="ex: pessoal, trabalho"></label><button id="connectGoogle" class="primary-button">Continuar com Google</button><button id="cancelConnect" class="cancel-connect" hidden>Cancelar conexão</button><a id="oauthLink" hidden target="_blank" rel="noopener noreferrer">Abrir autorização do Google</a><small>O Google mostrará o acesso solicitado. Para sincronizar pastas existentes, o rclone precisa acessar seu Drive inteiro.</small></div><div class="sync-form" id="syncForm" hidden><label>Conta Google Drive<select id="remoteName"></select></label><label>Pasta no computador<div class="input-with-button"><input id="localPath" placeholder="Escolha uma pasta"><button id="pickFolder" type="button">Procurar…</button></div></label><label>Pasta de destino no Drive<div class="input-with-button"><input id="remotePath" placeholder="Nuvem/Projeto" value="Nuvem"><button id="pickDriveFolder" type="button">Procurar…</button></div></label><button id="addSyncFolder" class="primary-button">Revisar sincronização</button></div><div id="syncFolders" class="sync-folders"></div><div id="trashItems"></div><details class="connect-help"><summary>Problemas para conectar?</summary><p>A autorização automática pode não estar disponível. Nesse caso, crie um OAuth Client ID do tipo <b>App para computador</b> no Google Cloud, ative a Drive API e configure o remoto com <code>rclone config</code>. O app precisa de acesso ao Drive para sincronizar arquivos que já existem. Leia a tela de consentimento antes de autorizar.</p></details></section></div><div class="modal-backdrop drive-picker-backdrop" id="drivePickerModal" hidden><section class="sync-modal drive-picker-modal"><button class="modal-close" id="closeDrivePicker">×</button><div class="modal-cloud">${icon('folder')}</div><h2>Selecionar pasta no Google Drive</h2><p class="modal-description">Navegue pelas pastas do seu Google Drive ou crie uma nova para a sincronização.</p><div class="drive-picker-breadcrumbs" id="drivePickerBreadcrumbs"></div><div class="drive-picker-toolbar"><div class="drive-picker-selected-info"><span>Destino selecionado:</span> <b id="drivePickerSelectedLabel">Nuvem</b></div><button type="button" class="secondary-button" id="drivePickerNewFolderBtn">${icon('plus')} Nova pasta</button></div><div class="drive-picker-list" id="drivePickerList"></div><div class="drive-picker-footer"><button type="button" class="secondary-button" id="cancelDrivePicker">Cancelar</button><button type="button" class="primary-button" id="confirmDrivePicker">Selecionar esta pasta</button></div></section></div></main>`;updateStorage();bind()}
function syncFoldersHtml(){return `<section id="sync-overview" class="sync-overview"><div class="sync-overview-title"><b>Pastas sincronizadas deste computador</b><button class="secondary-button" id="manageSync">Gerenciar</button></div>${syncFolders.length?syncFolders.map(f=>`<div class="sync-overview-row"><div><b>${esc(f.localPath)}</b><span>→ ${esc(f.remote)}:${esc(f.remotePath)}</span></div><span class="sync-badge ${f.paused?'paused':f.status?.state==='error'?'error':f.initialized?'ok':'review'}">${f.paused?'Pausada':f.status?.state==='error'?'Erro':f.status?.state==='syncing'?'Sincronizando':f.initialized?'Atualizada':'Prévia pendente'}</span><small>${esc(f.status?.lastSuccess?`Último sucesso ${new Date(f.status.lastSuccess).toLocaleString('pt-BR')}`:f.status?.message||'')}</small></div>`).join(''):`<div class="sync-empty">${driveConnected?'Nenhuma pasta local configurada para sincronizar.':'Conecte o Drive para configurar pastas locais.'}</div>`}</section>`}
function updateStorage(){const quota=driveQuota;const used=Number(quota?.usage||quota?.usageInDrive||0),limit=Number(quota?.limit||0),bar=document.querySelector('.progress i'),title=document.querySelector('.storage-title'),info=document.querySelector('.storage-info');if(title)title.textContent='Armazenamento da conta Google';if(bar)bar.style.width=limit?`${Math.min(100,used/limit*100)}%`:'0%';if(info)info.innerHTML=limit?`<b>${fmt(used)}</b> usados · ${fmt(Math.max(0,limit-used))} livres de ${fmt(limit)}${quota?.usageInDrive?`<br>Google Drive: ${fmt(quota.usageInDrive)}`:''}`:'Cota indisponível';const quotaCard=document.querySelector('#quotaSummary');if(quotaCard)quotaCard.innerHTML=quotaSummaryHtml();const profile=document.querySelector('#profileEmail');if(profile)profile.textContent=driveAccounts[0]?.email||'Não conectado';const name=document.querySelector('#profileName');if(name)name.textContent=driveAccounts[0]?.email||'Minha conta'}
function folderCard(f){return `<div class="folder-card" data-open="${f.id}" role="button" tabindex="0"><div class="folder-top">${icon('folder')}<button class="more" data-more="${f.id}" aria-label="Mais opções">${icon('more')}</button></div><b>${esc(f.name)}</b><span>Acessar pasta</span></div>`}
function fileRow(f){return `<div class="file-row" data-open="${f.id}" role="button" tabindex="0"><div class="file-name"><div class="file-type" style="--file-color:${f.color||'#78909c'}">${f.preview?`<i style="background:${f.preview}"></i>`:icon(fileIcon(f))}</div><div><b>${esc(f.name)}</b><small>${f.mime||'Arquivo'}</small></div></div><div class="owner"><div class="tiny-avatar">F</div>eu</div><span class="modified">${dateLabel(f.modified)}</span><span class="size">${fmt(Math.max(0,f.size||0))}</span><button class="more" data-more="${f.id}" aria-label="Mais opções">${icon('more')}</button></div>`}
async function updateDriveFile(id,changes){const response=await fetch(`/api/drive/files/${encodeURIComponent(id)}?remote=${encodeURIComponent(driveRemote)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(changes)});const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível atualizar o arquivo.');return data}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
let toastTimer,syncPollTimer;function toast(s){const el=document.querySelector('#toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
let pickerCurrentPath='',pickerSelectedPath=''
async function openDrivePicker(){
  if(!driveConnected||!driveRemote){toast('Conecte o Google Drive antes de selecionar a pasta.');return}
  const currentRemote=document.querySelector('#remoteName')?.value||driveRemote
  const currentVal=document.querySelector('#remotePath')?.value?.trim()||'Nuvem'
  pickerSelectedPath=currentVal
  const parts=currentVal.split('/').filter(Boolean)
  pickerCurrentPath=parts.length>1?parts.slice(0,-1).join('/'):''
  const modal=document.querySelector('#drivePickerModal')
  if(modal)modal.hidden=false
  await loadPickerFolders(pickerCurrentPath,currentRemote)
}
function closeDrivePicker(){const modal=document.querySelector('#drivePickerModal');if(modal)modal.hidden=true}
async function loadPickerFolders(browsePath,targetRemote){
  pickerCurrentPath=browsePath||''
  const activeRemote=targetRemote||document.querySelector('#remoteName')?.value||driveRemote
  const breadcrumbsEl=document.querySelector('#drivePickerBreadcrumbs'),listEl=document.querySelector('#drivePickerList'),labelEl=document.querySelector('#drivePickerSelectedLabel')
  if(labelEl)labelEl.textContent=pickerSelectedPath||(pickerCurrentPath||'Nenhuma (raiz)')
  if(breadcrumbsEl){
    const parts=pickerCurrentPath?pickerCurrentPath.split('/').filter(Boolean):[]
    let crumbs=[`<button type="button" data-picker-nav="">Meu Drive</button>`]
    let accumulated=''
    for(let i=0;i<parts.length;i++){
      accumulated=accumulated?`${accumulated}/${parts[i]}`:parts[i]
      crumbs.push(`<span>›</span><button type="button" data-picker-nav="${esc(accumulated)}">${esc(parts[i])}</button>`)
    }
    breadcrumbsEl.innerHTML=crumbs.join(' ')
    breadcrumbsEl.querySelectorAll('[data-picker-nav]').forEach(btn=>{btn.onclick=()=>loadPickerFolders(btn.dataset.pickerNav,activeRemote)})
  }
  if(listEl)listEl.innerHTML=`<div class="drive-picker-status">Carregando pastas do Google Drive…</div>`
  try{
    const params=new URLSearchParams({remote:activeRemote,path:pickerCurrentPath})
    const res=await fetch(`/api/drive/folders?${params}`)
    const data=await res.json()
    if(!res.ok)throw new Error(data.error||'Falha ao listar pastas do Google Drive.')
    const folders=data.folders||[]
    let html=''
    if(pickerCurrentPath){
      const isCurrentSelected=pickerSelectedPath===pickerCurrentPath
      html+=`<div class="drive-picker-item ${isCurrentSelected?'active':''}" data-picker-select="${esc(pickerCurrentPath)}"><div class="drive-picker-item-main">${icon('folder')}<span><b>[Usar esta pasta]</b> ${esc(pickerCurrentPath)}</span></div><span style="font-size:11px;color:#1a73e8">${isCurrentSelected?'✓ Selecionada':'Selecionar'}</span></div>`
    }
    if(folders.length===0){
      html+=`<div class="drive-picker-empty">Nenhuma subpasta encontrada aqui. Você pode usar a pasta atual ou clicar em “+ Nova pasta”.</div>`
    }else{
      for(const folder of folders){
        const isSelected=pickerSelectedPath===folder.path
        html+=`<div class="drive-picker-item ${isSelected?'active':''}" data-picker-select="${esc(folder.path)}"><div class="drive-picker-item-main">${icon('folder')}<span>${esc(folder.name)}</span></div><div style="display:flex;align-items:center;gap:6px"><button type="button" class="drive-picker-open-btn" data-picker-enter="${esc(folder.path)}" title="Abrir pasta para ver subpastas">Abrir ›</button></div></div>`
      }
    }
    if(listEl){
      listEl.innerHTML=html
      listEl.querySelectorAll('[data-picker-select]').forEach(item=>{
        item.onclick=e=>{
          if(e.target.closest('[data-picker-enter]'))return
          pickerSelectedPath=item.dataset.pickerSelect
          if(labelEl)labelEl.textContent=pickerSelectedPath
          listEl.querySelectorAll('.drive-picker-item').forEach(el=>el.classList.remove('active'))
          item.classList.add('active')
        }
      })
      listEl.querySelectorAll('[data-picker-enter]').forEach(btn=>{
        btn.onclick=e=>{
          e.stopPropagation()
          loadPickerFolders(btn.dataset.pickerEnter,activeRemote)
        }
      })
    }
  }catch(err){
    if(listEl)listEl.innerHTML=`<div class="drive-picker-empty" style="color:#b42318">${esc(err.message)}</div>`
  }
}
function bind(){document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{section=b.dataset.section;if(section==='drive'){current='root';drivePath='';loadDrive()}else render()});document.querySelector('[data-root]')?.addEventListener('click',()=>{current='root';drivePath='';section='drive';loadDrive()});document.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('[data-more]'))return;const x=items.find(i=>i.id===el.dataset.open);if(x?.type==='folder'){current=x.id;drivePath=x.path||'';section='drive';loadDrive()}else if(x){const a=document.createElement('a');a.href=x.url||`/api/drive/download/${encodeURIComponent(x.id)}?remote=${encodeURIComponent(driveRemote)}`;a.download=x.name;a.click()} }));document.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('[data-more]')){e.preventDefault();el.click()}}));document.querySelectorAll('[data-more]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const x=items.find(i=>i.id===b.dataset.more);if(!x)return;const isStarred=x.starred===true||starred.has(x.id);const act=prompt(`Ação para “${x.name}”:\n1 — Renomear\n2 — ${isStarred?'Remover estrela':'Adicionar estrela'}\n3 — Mover para a lixeira`);try{if(act==='1'){const name=prompt('Novo nome:',x.name);if(name?.trim()){if(x.url){x.name=name.trim();save();render()}else{await updateDriveFile(x.id,{name:name.trim()});await loadDrive();toast('Nome atualizado no Google Drive.')}}}if(act==='2'){if(x.url){isStarred?starred.delete(x.id):starred.add(x.id);localStorage.setItem('nuvem-stars',JSON.stringify([...starred]));render()}else{await updateDriveFile(x.id,{starred:!isStarred});isStarred?starred.delete(x.id):starred.add(x.id);localStorage.setItem('nuvem-stars',JSON.stringify([...starred]));await loadDrive();toast(isStarred?'Estrela removida.':'Arquivo adicionado aos favoritos.')}}if(act==='3'&&confirm(`Mover “${x.name}” para a lixeira do Google Drive?`)){await updateDriveFile(x.id,{trashed:true});await loadDrive();toast('Arquivo movido para a lixeira do Google Drive.')}}catch(error){toast(error.message)}});document.querySelector('#search').oninput=e=>{query=e.target.value;render();const el=document.querySelector('#search');el.focus();el.setSelectionRange(query.length,query.length)};document.querySelector('#grid').onclick=()=>{grid=true;render()};document.querySelector('#list').onclick=()=>{grid=false;render()};document.querySelector('#sortModified').onclick=()=>{if(!sortByModified){sortByModified=true;sortOldestFirst=false}else sortOldestFirst=!sortOldestFirst;render()};document.querySelector('#help').onclick=()=>toast('Use a busca para localizar arquivos, os botões de grade e lista para mudar a exibição e “Pastas sincronizadas” para revisar a sincronização do computador.');document.querySelector('#profileSettings').onclick=()=>{document.querySelector('#syncModal').hidden=false;refreshSync()};document.querySelectorAll('.upgrade').forEach(button=>button.onclick=()=>window.open('https://one.google.com/storage','_blank','noopener,noreferrer'));window.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.querySelector('#search')?.focus()}};document.querySelector('#new').onclick=()=>{document.querySelector('#syncModal').hidden=false;refreshSync()};document.querySelector('#uploadFab').onclick=()=>document.querySelector('#fileInput').click();document.querySelector('#fileInput').onchange=async e=>{const files=[...e.target.files];try{if(!driveConnected||!driveRemote)throw Error('Conecte uma conta Google Drive antes de enviar arquivos.');for(const file of files){const params=new URLSearchParams({remote:driveRemote,path:drivePath,name:file.name});const response=await fetch(`/api/drive/upload?${params}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});const data=await response.json();if(!response.ok)throw Error(`${file.name}: ${data.error||'upload não concluído'}`)}await loadDrive();toast(files.length===1?'Arquivo enviado para o Google Drive.':`${files.length} arquivos enviados para o Google Drive.`)}catch(error){toast(error.message)}finally{e.target.value=''}};
  const modal=document.querySelector('#syncModal');document.querySelector('#syncSettings').onclick=()=>{modal.hidden=false;refreshSync()};document.querySelector('#manageSync')?.addEventListener('click',()=>{modal.hidden=false;refreshSync()});document.querySelector('#closeSync').onclick=()=>modal.hidden=true;modal.onclick=e=>{if(e.target===modal)modal.hidden=true};document.querySelector('#cancelConnect').onclick=async()=>{await fetch('/api/connect/cancel',{method:'POST'});await refreshSync()};document.querySelector('#toggleAddAccount')?.addEventListener('click',()=>{const ca=document.querySelector('#connectActions');if(ca){ca.hidden=!ca.hidden;ca.dataset.forceShow=ca.hidden?'':'true';if(!ca.hidden)document.querySelector('#newRemoteName')?.focus()}});document.querySelector('#connectGoogle').onclick=async()=>{const button=document.querySelector('#connectGoogle');button.disabled=true;button.textContent='Abrindo autorização…';try{const remoteCandidate=document.querySelector('#newRemoteName')?.value?.trim()||document.querySelector('#remoteName')?.value||'meu-drive';const r=await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({remote:remoteCandidate})});const d=await r.json();if(!r.ok)throw Error(d.error);await refreshSync()}catch(e){const state=document.querySelector('#syncState');state.textContent=e.message;state.className='sync-state error';button.disabled=false;button.textContent='Tentar novamente'}};document.querySelector('#pickFolder').onclick=async()=>{try{const r=await fetch('/api/pick-folder',{method:'POST'});if(r.status===204)return;const d=await r.json();if(!r.ok)throw Error(d.error);document.querySelector('#localPath').value=d.path}catch(e){toast(e.message)}};document.querySelector('#pickDriveFolder')?.addEventListener('click',openDrivePicker);document.querySelector('#closeDrivePicker')?.addEventListener('click',closeDrivePicker);document.querySelector('#cancelDrivePicker')?.addEventListener('click',closeDrivePicker);const drivePickerModalEl=document.querySelector('#drivePickerModal');if(drivePickerModalEl)drivePickerModalEl.onclick=e=>{if(e.target===drivePickerModalEl)closeDrivePicker()};document.querySelector('#confirmDrivePicker')?.addEventListener('click',()=>{let chosen=pickerSelectedPath||pickerCurrentPath;if(!chosen){toast('Selecione ou crie uma pasta no Google Drive (não é permitido sincronizar a raiz completa).');return}const input=document.querySelector('#remotePath');if(input)input.value=chosen;closeDrivePicker();toast('Pasta do Drive selecionada: '+chosen)});document.querySelector('#drivePickerNewFolderBtn')?.addEventListener('click',async()=>{const name=prompt('Nome da nova pasta no Google Drive:');if(!name||!name.trim())return;const activeRemote=document.querySelector('#remoteName')?.value||driveRemote;try{const r=await fetch('/api/drive/mkdir',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({remote:activeRemote,path:pickerCurrentPath,name:name.trim()})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Erro ao criar pasta no Drive');pickerSelectedPath=data.path;toast('Pasta criada: '+data.name);await loadPickerFolders(pickerCurrentPath,activeRemote)}catch(err){toast(err.message)}});document.querySelector('#addSyncFolder').onclick=async()=>{const button=document.querySelector('#addSyncFolder');button.disabled=true;button.textContent='Preparando simulação…';try{const r=await fetch('/api/folders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({localPath:document.querySelector('#localPath').value,remote:document.querySelector('#remoteName').value,remotePath:document.querySelector('#remotePath').value})});const d=await r.json();if(!r.ok)throw Error(d.error);toast('Simulação pronta. Revise antes de aplicar.');await refreshSync()}catch(e){const state=document.querySelector('#syncState');state.textContent=e.message;state.classList.add('error')}finally{button.disabled=false;button.textContent='Revisar sincronização'}};
}
async function refreshSync(){
  const state=document.querySelector('#syncState'),list=document.querySelector('#syncFolders'),accountsEl=document.querySelector('#accountsList'),accountsSection=document.querySelector('#accountsSection'),connectActions=document.querySelector('#connectActions'),syncForm=document.querySelector('#syncForm'),selectRemote=document.querySelector('#remoteName'),newRemoteInput=document.querySelector('#newRemoteName')
  try{
    const r=await fetch('/api/status'),d=await r.json(),job=d.connectJob||{}
    driveAccounts=d.accounts||[]
    driveConnected=d.connected
    syncFolders=d.folders||[]
    const savedRemote=localStorage.getItem('nuvem-active-remote')
    if(!driveRemote||!d.remotes?.includes(driveRemote)){
      driveRemote=(savedRemote&&d.remotes?.includes(savedRemote))?savedRemote:(d.remotes?.[0]||'')
    }
    driveQuota=driveAccounts.find(a=>a.remote===driveRemote)?.storage||null
    updateStorage()
    updateProfile(driveAccounts,driveConnected)

    const busy=job.state==='authorizing'
    const activeAcc=driveAccounts.find(a=>a.remote===driveRemote)||driveAccounts[0]

    state.className=`sync-state ${d.connected?'connected':job.state==='error'?'error':''}`
    state.textContent=d.connected?`Conectado ao Google Drive · ${driveAccounts.length} conta(s) · Ativa: ${activeAcc?.email||driveRemote}`:job.message||'Conecte sua conta Google para continuar.'

    if(accountsSection)accountsSection.hidden=driveAccounts.length===0
    if(accountsEl){
      accountsEl.innerHTML=driveAccounts.map(acc=>{
        const isActive=acc.remote===driveRemote
        const used=Number(acc.storage?.usage||0),limit=Number(acc.storage?.limit||0)
        const storageText=limit?`${fmt(used)} de ${fmt(limit)}`:'Cota indisponível'
        return `<div class="account-card ${isActive?'active':''}">
          <div class="account-card-info">
            <div class="avatar">${(acc.email||acc.remote)[0].toUpperCase()}</div>
            <div class="account-card-text">
              <b>${esc(acc.email||acc.remote)}</b>
              <span>${esc(acc.remote)} · ${storageText}</span>
            </div>
          </div>
          <div class="account-card-actions">
            ${isActive?'<span class="account-badge-active">Ativa</span>':`<button type="button" class="account-switch-btn" data-switch-account="${esc(acc.remote)}">Usar</button>`}
            <button type="button" class="account-disconnect-btn" data-disconnect-account="${esc(acc.remote)}" title="Desconectar esta conta">Deslogar</button>
          </div>
        </div>`
      }).join('')

      accountsEl.querySelectorAll('[data-switch-account]').forEach(btn=>{
        btn.onclick=async()=>{
          driveRemote=btn.dataset.switchAccount
          localStorage.setItem('nuvem-active-remote',driveRemote)
          current='root';drivePath=''
          driveQuota=driveAccounts.find(a=>a.remote===driveRemote)?.storage||null
          updateStorage()
          updateProfile(driveAccounts,driveConnected)
          await loadDrive()
          await refreshSync()
          toast('Conta ativa: '+driveRemote)
        }
      })

      accountsEl.querySelectorAll('[data-disconnect-account]').forEach(btn=>{
        btn.onclick=async()=>{
          const target=btn.dataset.disconnectAccount
          const acc=driveAccounts.find(a=>a.remote===target)
          if(!confirm(`Deseja realmente deslogar da conta ${acc?.email||target}?`))return
          btn.disabled=true;btn.textContent='Saindo…'
          try{
            const res=await fetch(`/api/accounts/${encodeURIComponent(target)}`,{method:'DELETE'})
            const resData=await res.json()
            if(!res.ok)throw new Error(resData.error||'Erro ao deslogar')
            toast('Conta desconectada com sucesso.')
            if(driveRemote===target){
              localStorage.removeItem('nuvem-active-remote')
              driveRemote=''
            }
            await loadDashboard()
            await refreshSync()
          }catch(err){
            toast(err.message)
            btn.disabled=false;btn.textContent='Deslogar'
          }
        }
      })
    }

    if(connectActions){
      if(!busy){
        connectActions.hidden=driveAccounts.length>0&&!connectActions.dataset.forceShow
      }else{
        connectActions.hidden=false
      }
    }
    if(newRemoteInput&&!newRemoteInput.value){
      newRemoteInput.value=driveAccounts.some(a=>a.remote==='meu-drive')?`drive-${driveAccounts.length+1}`:'meu-drive'
    }

    if(syncForm)syncForm.hidden=!d.connected
    if(selectRemote){
      selectRemote.innerHTML=driveAccounts.map(acc=>{
        return `<option value="${esc(acc.remote)}" ${acc.remote===driveRemote?'selected':''}>${esc(acc.email||acc.remote)} (${esc(acc.remote)})</option>`
      }).join('')
    }

    const link=document.querySelector('#oauthLink')
    if(link){link.hidden=!busy||!job.url;if(job.url)link.href=job.url}
    const cancelBtn=document.querySelector('#cancelConnect')
    if(cancelBtn)cancelBtn.hidden=!busy
    const connectButton=document.querySelector('#connectGoogle')
    if(connectButton){connectButton.disabled=busy;connectButton.textContent=busy?'Aguardando o Google…':'Continuar com Google'}

    const trashData=await fetch('/api/trash').then(response=>response.json()).catch(()=>({items:[]}))
    const trashEl=document.querySelector('#trashItems')
    if(trashEl){
      trashEl.innerHTML=`<details class="connect-help"><summary>Itens removidos recentemente</summary>${trashData.items?.length?trashData.items.map(item=>`<p>${esc(item.name)} · ${item.side==='linux'?'Lixeira do Linux':'Lixeira do Drive'} <button data-restore-trash="${item.id}">Restaurar</button></p>`).join(''):'<p>Nenhum item removido pelo app.</p>'}<p><a href="${trashData.googleTrashUrl||'https://drive.google.com/drive/trash'}" target="_blank" rel="noopener noreferrer">Abrir lixeira do Google Drive</a></p></details>`
      trashEl.querySelectorAll('[data-restore-trash]').forEach(b=>b.onclick=async()=>{
        b.disabled=true
        const res=await fetch(`/api/trash/${b.dataset.restoreTrash}/restore`,{method:'POST'})
        const result=await res.json()
        if(!res.ok)toast(result.error||'Não foi possível restaurar')
        await refreshSync()
      })
    }

    if(busy&&!syncPollTimer)syncPollTimer=setInterval(refreshSync,1800)
    if(!busy&&syncPollTimer){clearInterval(syncPollTimer);syncPollTimer=null}

    if(list){
      list.innerHTML=d.folders.map(f=>`<div class="sync-folder"><div><b>${esc(f.localPath)}</b><span>→ ${esc(f.remote)}:${esc(f.remotePath)} · ${esc(f.status.message)}${f.status.lastSuccess?` · Último sucesso: ${new Date(f.status.lastSuccess).toLocaleString('pt-BR')}`:''}</span>${!f.initialized&&f.preview?`<pre class="sync-preview">${esc(formatPreview(f.preview))}</pre>`:''}</div><button data-sync-now="${f.id}">${f.initialized?'Sincronizar agora':'Aplicar plano inicial'}</button><button data-toggle-pause="${f.id}">${f.paused?'Retomar':'Pausar'}</button><button data-remove-sync="${f.id}" aria-label="Remover">×</button></div>`).join('')
      list.querySelectorAll('[data-sync-now]').forEach(b=>b.onclick=async()=>{
        b.disabled=true
        const folder=d.folders.find(f=>f.id===b.dataset.syncNow)
        if(!folder.initialized&&folder.preview?.summary?.conflicts&&!confirm(`Há ${folder.preview.summary.conflicts} conflito(s). A versão do Drive será preservada com outro nome. Aplicar?`)){
          b.disabled=false;return
        }
        const r=await fetch(`/api/folders/${b.dataset.syncNow}/sync`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({previewId:folder.preview?.id})})
        const result=await r.json()
        if(!r.ok)toast(result.message||result.error||'A sincronização falhou')
        await refreshSync()
      })
      list.querySelectorAll('[data-toggle-pause]').forEach(b=>b.onclick=async()=>{
        b.disabled=true
        const action=b.textContent==='Pausar'?'pause':'resume'
        const r=await fetch(`/api/folders/${b.dataset.togglePause}/${action}`,{method:'POST'})
        const result=await r.json()
        if(!r.ok)toast(result.error||'Não foi possível alterar o estado')
        await refreshSync()
      })
      list.querySelectorAll('[data-remove-sync]').forEach(b=>b.onclick=async()=>{
        if(confirm('Remover esta configuração de sincronização? Os arquivos locais e no Drive serão mantidos.')){
          await fetch(`/api/folders/${b.dataset.removeSync}`,{method:'DELETE'})
          await refreshSync()
        }
      })
    }

    if(!window.syncStatusPoll)window.syncStatusPoll=setInterval(()=>{if(!document.querySelector('#syncModal').hidden)refreshSync()},5000)
  }catch{
    state.className='sync-state error'
    state.textContent='Servidor local não respondeu.'
  }
}
function formatPreview(preview){const s=preview.summary||{};const lines=[`Enviar ao Drive: ${s.upload||0}`,`Baixar do Drive: ${s.download||0}`,`Já iguais: ${s.identical||0}`,`Conflitos preservados: ${s.conflicts||0}`,...(preview.rows||[]).map(r=>`${r.action==='upload'?'↑ Enviar':r.action==='download'?'↓ Baixar':'⚠ Conflito'} · ${r.path}`)];if(preview.truncated)lines.push('Prévia resumida: há mais itens do que os exibidos.');return lines.join('\n')}
function updateProfile(accounts,connected){
  const cur=accounts.find(a=>a.remote===driveRemote)||accounts[0]
  const email=cur?.email
  const name=document.querySelector('#profileName')
  const profEmail=document.querySelector('#profileEmail')
  if(name)name.textContent=email||(cur?cur.remote:'Google Drive')
  if(profEmail)profEmail.textContent=email?(connected?(accounts.length>1?`Ativa (${accounts.length} contas)`:'Conta conectada'):''):(connected?'E-mail não disponível':'Não conectado')
  if(email||cur?.remote){
    const initial=(email||cur.remote)[0].toUpperCase()
    document.querySelectorAll('.avatar').forEach(a=>a.textContent=initial)
  }
}
async function loadDrive(){
  if(!driveConnected||!driveRemote){items=[];render();return}
  driveLoading=true;driveWarning='';render()
  try{
    const params=new URLSearchParams({remote:driveRemote,path:drivePath})
    const response=await fetch(`/api/drive/files?${params}`)
    const data=await response.json()
    if(!response.ok)throw new Error(data.error||'Falha ao consultar o Google Drive.')
    driveWarning=data.warning||''
    items=(data.files||[]).map(entry=>({id:entry.id,path:entry.path,name:entry.name,type:entry.isDir?'folder':'file',parent:current,mime:entry.mimeType,size:entry.size,modified:entry.modTime?Date.parse(entry.modTime):Date.now(),starred:entry.starred===true}))
    driveError=''
  }catch(error){
    items=[];driveError=error.message
  }finally{
    driveLoading=false;render()
  }
}
async function loadDashboard(){
  try{
    const response=await fetch('/api/status')
    const data=await response.json()
    driveAccounts=data.accounts||[]
    driveConnected=data.connected
    syncFolders=data.folders||[]
    const savedRemote=localStorage.getItem('nuvem-active-remote')
    driveRemote=(savedRemote&&data.remotes?.includes(savedRemote))?savedRemote:(data.remotes?.[0]||'')
    driveQuota=driveAccounts.find(account=>account.remote===driveRemote)?.storage||null
    render()
    if(driveConnected&&driveRemote)await loadDrive()
  }catch(error){
    driveError=error.message;render()
  }
}
async function refreshDashboardStatus(){
  try{
    const response=await fetch('/api/status')
    const data=await response.json()
    driveAccounts=data.accounts||[]
    driveConnected=data.connected
    syncFolders=data.folders||[]
    const savedRemote=localStorage.getItem('nuvem-active-remote')
    if(!driveRemote||!data.remotes?.includes(driveRemote)){
      driveRemote=(savedRemote&&data.remotes?.includes(savedRemote))?savedRemote:(data.remotes?.[0]||'')
    }
    driveQuota=driveAccounts.find(account=>account.remote===driveRemote)?.storage||null
    updateStorage()
    const overview=document.querySelector('#sync-overview')
    if(overview){
      overview.outerHTML=syncFoldersHtml()
      document.querySelector('#manageSync')?.addEventListener('click',()=>{document.querySelector('#syncModal').hidden=false;refreshSync()})
    }
  }catch{}
}
render()
loadDashboard()
setInterval(refreshDashboardStatus,30000)
