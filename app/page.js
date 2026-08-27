'use client';
import { useEffect, useMemo, useState } from 'react';
import Ferrofluid from './components/Ferrofluid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

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
  const [chatExpanded, setChatExpanded] = useState(false);

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
    if(!activeId) return;
    setProfiles(prev=>{
      const idx = prev.findIndex(p=>p.id===activeId);
      if(idx<0) return prev;
      if(JSON.stringify(prev[idx])===JSON.stringify(profile)) return prev;
      const copy=[...prev];
      copy[idx]={...profile};
      return copy;
    });
  },[profile,activeId]);

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
      <div style={{position:'fixed', inset:0, zIndex:-1, pointerEvents:'none'}}>
        <Ferrofluid colors={['#ffffff','#e0e7ff','#ffffff']} speed={0.5} scale={1.6} opacity={0.8} flowDirection="down" />
      </div>
      <div id="custom-cursor" className="custom-cursor"></div>
      <div className="wrap">
        <div className="card">
          <div className="chat-layout">
            <aside className="chat-sidebar">
              <div style={{padding:'16px 16px 8px',borderBottom:'1px solid var(--border)',margin:'0 -16px 12px'}}>
                <h1 style={{margin:0,fontSize:'18px',fontWeight:800}}>NVIDIA Key Lab</h1>
                <p style={{color:'var(--muted)',fontSize:'12px',margin:'4px 0 0'}}>Local-only profiles</p>
              </div>
              <div className="profile-list-sidebar">
                {profiles.map(p=>(
                  <button key={p.id} className={`profile-item ${p.id===activeId?'active':''}`} onClick={()=>setActiveId(p.id)}>{p.name}</button>
                ))}
                <button className="profile-item new" onClick={newProfile}>+ New Profile</button>
              </div>
              <div style={{marginTop:'24px',padding:'12px',border:'1px solid var(--border)',borderRadius:'12px',background:'#fff'}}>
                <h4 style={{margin:'0 0 8px',fontSize:'13px',fontWeight:700}}>API Info</h4>
                <div className="field small"><label>Profile Name</label><input autoComplete="off" value={profile.name} onChange={e=>update('name',e.target.value)} /></div>
                <div className="field small"><label>Base URL</label><input autoComplete="off" value={profile.baseUrl} onChange={e=>update('baseUrl',e.target.value)} /></div>
                <div className="field small"><label>API Key</label><input autoComplete="new-password" type="password" value={profile.apiKey} onChange={e=>update('apiKey',e.target.value)} placeholder="nvapi-..." /></div>
                <div className="field small"><label>Model</label><input autoComplete="off" value={profile.model} onChange={e=>update('model',e.target.value)} /></div>
                <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
                  <button className="btn primary small" onClick={saveProfile}>Save</button>
                  <button className="btn small" onClick={()=>setModal({type:'confirm', message:'Delete current profile "'+profile.name+'" ?', onConfirm:()=>{deleteProfile(activeId); setModal(null);}})}>Delete</button>
                </div>
              </div>
            </aside>
            <main className="chat-main">
              <div className="chat-header">
                <div style={{fontWeight:700}}>{profile.name}</div>
                <div style={{color:'var(--muted)',fontSize:'12px'}}>Model: {profile.model || '—'}</div>
              </div>
              <div className="chat-messages">
              {profile.messages.map((m,i)=>(
                <div key={i} style={{marginBottom:'18px',display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
                  <div style={{maxWidth:'720px',padding:'14px 16px',borderRadius:'12px',background:m.role==='user'?'#e8f0fe':'#ffffff',border:'1px solid var(--border)',fontSize:'14px',textAlign:'left',wordBreak:'break-word',boxShadow:'0 1px 0 rgba(0,0,0,.02)'}}>
                    {m.role==='assistant' ? (
                      <div className="chat-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
              {isSending && (
                <div style={{marginBottom:'18px',display:'flex',justifyContent:'flex-start'}}>
                  <div style={{maxWidth:'720px',padding:'14px 16px',borderRadius:'12px',background:'#ffffff',border:'1px solid var(--border)',fontSize:'14px',boxShadow:'0 1px 0 rgba(0,0,0,.02)'}}>
                    <span className="dots"><span></span><span></span><span></span></span>
                  </div>
                </div>
              )}
            </div>
            <div className="chat-input-wrap">
              <div style={{display:'flex',gap:'8px',maxWidth:'900px',margin:'0 auto'}}>
                <input autoComplete="off" disabled={isSending} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter' && !e.shiftKey && !isSending){e.preventDefault();sendMessage();}}} placeholder={isSending?'Sending...':'Type a message...'} style={{flex:1,border:'1px solid var(--border)',background:'#fff',color:'var(--fg)',padding:'10px 14px',borderRadius:'8px',fontSize:'14px',opacity:isSending?0.6:1}}/>
                <button className="btn primary" onClick={sendMessage} disabled={isSending}>{isSending?'Sending...':'Send'}</button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.5)',display:'grid',placeItems:'center',zIndex:9999}}>
          <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:'12px',padding:'20px',width:'min(90vw,420px)',color:'var(--fg)',boxShadow:'0 10px 30px rgba(15,23,42,0.2)'}}>
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
