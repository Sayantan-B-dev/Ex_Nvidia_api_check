'use client';
import { useEffect, useMemo, useState } from 'react';
import ScatterBg from './components/ScatterBg';

const STORAGE_KEY = 'nvidia_profiles_next';
const defaults = {
  name: 'Untitled',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  apiKey: '',
  model: '',
  messages: [],
  params: { temperature: 1, top_p: 0.95, max_tokens: 8192, stream: false }
};

function uid(){ return Math.random().toString(36).slice(2,10); }

export default function Page(){
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [profile, setProfile] = useState(defaults);
  const [response, setResponse] = useState('— No request sent yet —');
  const [meta, setMeta] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [modal, setModal] = useState(null);

  useEffect(()=>{
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw?JSON.parse(raw):[];
      const list = data.length?data:[{...defaults,id:uid()}];
      setProfiles(list);
      setActiveId(list[0].id);
      setProfile(list[0]);
    }catch{}
  },[]);

  useEffect(()=>{
    if(!activeId) return;
    const p = profiles.find(x=>x.id===activeId);
    if(p) setProfile(p);
  },[activeId, profiles]);

  useEffect(()=>{
    if(!profiles.length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  },[profiles]);

  const saveProfile = ()=>{
    setProfiles(prev=>{
      const idx = prev.findIndex(p=>p.id===activeId);
      if(idx>=0){
        const copy=[...prev];
        copy[idx]={...profile};
        return copy;
      }
      return [...prev, {...profile, id:uid()}];
    });
  };

  const newProfile = ()=>{
    const p={...defaults, id:uid(), name:'New '+new Date().toLocaleTimeString()};
    setProfiles(prev=>[p,...prev]);
    setActiveId(p.id);
    setProfile(p);
  };

  const deleteProfile = (id)=>{
    setProfiles(prev=>{
      const filtered = prev.filter(p=>p.id!==id);
      if(filtered.length===0){
        const fresh={...defaults,id:uid()};
        setActiveId(fresh.id);
        setProfile(fresh);
        return [fresh];
      }
      if(activeId===id){
        const next = filtered[0];
        setActiveId(next.id);
        setProfile(next);
      }
      return filtered;
    });
  };

  const update = (k,v)=> setProfile(p=>({...p,[k]:v}));
  const updateParam = (k,v)=> setProfile(p=>({...p,params:{...p.params,[k]:v}}));

  const sendMessage = async ()=>{
    if(!chatInput.trim() || isSending) return;
    if(!profile.apiKey){ setModal({type:'alert', message:'API Key required'}); return; }
    if(!profile.model){ setModal({type:'alert', message:'Model required'}); return; }
    const userMsg = { role:'user', content: chatInput.trim() };
    const newMessages = [...profile.messages.filter(m=>m.content.trim()), userMsg];
    setProfile(p=>({...p, messages:newMessages}));
    setChatInput('');
    setIsSending(true);
    const body = {
      model: profile.model,
      messages: newMessages,
      temperature: profile.params.temperature,
      top_p: profile.params.top_p,
      max_tokens: profile.params.max_tokens,
      stream: profile.params.stream
    };
    const start = performance.now();
    setResponse('Sending...');
    setMeta('');
    try{
      const res = await fetch('/api/proxy',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ baseUrl: profile.baseUrl, apiKey: profile.apiKey, ...body })
      });
      const headersTime = Math.round(performance.now()-start);
      if(!res.ok){
        const txt = await res.text();
        setResponse(`HTTP ${res.status}\n\n${txt}`);
        setMeta(`Headers: ${headersTime} ms`);
        return;
      }
      if(profile.params.stream){
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf='';
        let content='';
        let first=null;
        setResponse('');
        while(true){
          const {done,value}=await reader.read();
          if(done) break;
          buf+=dec.decode(value,{stream:true});
          const evs = buf.split('\n\n');
          buf = evs.pop()||'';
          for(const e of evs){
            const line = e.split('\n').find(l=>l.startsWith('data: '));
            if(!line) continue;
            const data = line.slice(6);
            if(data==='[DONE]') continue;
            try{
              const chunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta;
              if(first===null && delta?.content) first=Math.round(performance.now()-start);
              if(delta?.content){ content+=delta.content; setResponse(content); }
            }catch{}
          }
        }
        setProfile(p=>({...p, messages:[...p.messages, {role:'assistant', content}]}));
        setMeta(`Headers: ${headersTime} ms • First token: ${first??'N/A'} ms • Total: ${Math.round(performance.now()-start)} ms`);
      }else{
        const json = await res.json();
        const total = Math.round(performance.now()-start);
        const content = json.choices?.[0]?.message?.content || JSON.stringify(json,null,2);
        setProfile(p=>({...p, messages:[...p.messages, {role:'assistant', content}]}));
        setResponse(content);
        setMeta(`Headers: ${headersTime} ms • Total: ${total} ms`);
      }
    }catch(e){
      setResponse('Error: '+e.message);
    }finally{
      setIsSending(false);
    }
  };

  return (
    <div>
      <ScatterBg count={14} />
      <div id="custom-cursor" className="custom-cursor"></div>
      <div className="wrap">
        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap',marginBottom:'8px'}}>
            <h1 style={{margin:0}}>NVIDIA Key Lab</h1>
            <a href="https://github.com/Sayantan-B-dev/Ex_Nvidia_api_check" target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:'6px',border:'2px solid var(--border)',padding:'4px 8px',borderRadius:'6px',textDecoration:'none',color:'var(--fg)',fontSize:'clamp(9px,0.7vw+4px,10px)',fontWeight:700}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5z"/></svg>
              View code
            </a>
          </div>
          <p style={{color:'var(--muted)',fontSize:'clamp(10px,0.8vw+5px,11px)',margin:'0 0 12px'}}>No backend. No database. All API keys and profiles are stored locally in your browser localStorage only. Requests go directly from your browser to Nvidia. Nothing is recorded on any server. You can verify this yourself on GitHub.</p>
          <div className="profile-list">
            {profiles.map(p=>(
              <button key={p.id} className={`pill ${p.id===activeId?'active':''}`} onClick={()=>setActiveId(p.id)}>{p.name}</button>
            ))}
            <button className="pill" onClick={newProfile}>+ New</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
            <div style={{border:'2px solid var(--border)',borderRadius:'8px',padding:'12px',background:'rgba(30,30,38,0.4)'}}>
              <h3 style={{margin:'0 0 12px',fontWeight:800}}>API Info</h3>
              <div className="field"><label>Profile Name</label><input value={profile.name} onChange={e=>update('name',e.target.value)} /></div>
              <div className="field"><label>Base URL</label><input value={profile.baseUrl} onChange={e=>update('baseUrl',e.target.value)} /></div>
              <div className="field"><label>API Key</label><input type="password" value={profile.apiKey} onChange={e=>update('apiKey',e.target.value)} placeholder="nvapi-..." /></div>
              <div className="field"><label>Model</label><input value={profile.model} onChange={e=>update('model',e.target.value)} /></div>
              <div style={{marginTop:'12px',display:'flex',gap:'8px'}}>
                <button className="btn primary" onClick={saveProfile}>Save Profile</button>
                <button className="btn" onClick={()=>setModal({type:'confirm', message:'Delete current profile "'+profile.name+'" ?', onConfirm:()=>{deleteProfile(activeId); setModal(null);}})}>Delete Profile</button>
              </div>
            </div>
            <div style={{border:'2px solid var(--border)',borderRadius:'8px',padding:'12px',background:'rgba(30,30,38,0.4)'}}>
              <h3 style={{margin:'0 0 12px',fontWeight:800}}>Parameters</h3>
              <div className="field"><label>temperature</label><input type="number" step="0.01" value={profile.params.temperature} onChange={e=>updateParam('temperature',parseFloat(e.target.value))}/></div>
              <div className="field"><label>top_p</label><input type="number" step="0.01" value={profile.params.top_p} onChange={e=>updateParam('top_p',parseFloat(e.target.value))}/></div>
              <div className="field"><label>max_tokens</label><input type="number" value={profile.params.max_tokens} onChange={e=>updateParam('max_tokens',parseInt(e.target.value))}/></div>
              <label style={{display:'flex',alignItems:'center',gap:8,marginTop:12}}><input type="checkbox" checked={profile.params.stream} onChange={e=>updateParam('stream',e.target.checked)} /> stream</label>
            </div>
          </div>
          <div style={{border:'2px solid var(--border)',borderRadius:'8px',padding:'12px',background:'rgba(30,30,38,0.4)'}}>
            <h3 style={{margin:'0 0 12px',fontWeight:800}}>Chat</h3>
            <div style={{border:'2px solid var(--border)',borderRadius:'12px',padding:'10px',background:'rgba(20,20,28,0.5)',maxHeight:'320px',overflow:'auto',marginBottom:'10px'}}>
              {profile.messages.map((m,i)=>(
                <div key={i} style={{marginBottom:'8px',textAlign:m.role==='user'?'right':'left'}}>
                  <div style={{display:'inline-block',maxWidth:'80%',padding:'8px 12px',borderRadius:'12px',background:m.role==='user'?'rgba(60,100,180,0.35)':'rgba(80,140,90,0.35)',border:'1px solid var(--border)',fontSize:'clamp(11px,0.8vw+3px,13px)'}}>{m.content}</div>
                </div>
              ))}
              {isSending && (
                <div style={{marginBottom:'8px',textAlign:'left'}}>
                  <div style={{display:'inline-block',maxWidth:'80%',padding:'8px 12px',borderRadius:'12px',background:'rgba(80,140,90,0.35)',border:'1px solid var(--border)',fontSize:'clamp(11px,0.8vw+3px,13px)'}}>
                    <span className="dots"><span></span><span></span><span></span></span>
                  </div>
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:'8px',marginTop:'10px'}}>
              <input disabled={isSending} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter' && !e.shiftKey && !isSending){e.preventDefault();sendMessage();}}} placeholder={isSending?'Sending...':'Type a message...'} style={{flex:1,border:'2px solid var(--border)',background:'rgba(30,30,38,0.6)',color:'var(--fg)',padding:'8px 12px',borderRadius:'12px',fontSize:'clamp(11px,0.8vw+3px,13px)',opacity:isSending?0.6:1}}/>
              <button className="btn primary" onClick={sendMessage} disabled={isSending}>{isSending?'Sending...':'Send'}</button>
            </div>
          </div>
        </div>
      </div>
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'grid',placeItems:'center',zIndex:9999}}>
          <div style={{background:'rgba(18,18,24,0.9)',border:'2px solid var(--border)',borderRadius:'8px',padding:'16px',width:'min(90vw,420px)',color:'var(--fg)'}}>
            <h3 style={{margin:'0 0 8px',fontWeight:800}}>{modal.type==='confirm'?'Confirm':'Alert'}</h3>
            <p style={{margin:'0 0 16px'}}>{modal.message}</p>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              {modal.type==='confirm' && <button className="btn" onClick={()=>setModal(null)}>Cancel</button>}
              <button className="btn primary" onClick={()=>{ if(modal.onConfirm) modal.onConfirm(); setModal(null); }}>{modal.type==='confirm'?'Delete':'OK'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
