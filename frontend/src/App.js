import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import * as d3 from "d3";
import WelcomeModal from "./WelcomeModal";
import "./App.css";

const API = process.env.REACT_APP_BACKEND_URL || "";

const FIELD_PALETTE = {
  "Computing/AI":"#2563eb","Medical/Veterinary":"#16a34a","Chemistry & Metallurgy":"#d97706",
  "Organic Chemistry":"#7c3aed","Biochemistry/Microbiology":"#0891b2","Electric Power":"#ea580c",
  "Communications":"#db2777","Mechanical Engineering":"#64748b","Agriculture":"#65a30d",
  "Physics":"#9333ea","ICT Applications":"#0284c7","Measuring/Testing":"#b45309",
  "Basic Electric Elements":"#c2410c","Nano-Technology":"#7e22ce","Polymers":"#0f766e",
  "Petroleum/Fuels":"#78350f","Human Necessities":"#15803d","Performing Operations":"#0369a1",
  "Textiles & Paper":"#be185d","Unknown":"#d1d5db",
};

const CITY_COORDS = {
  "Mumbai":[72.877,19.076],"New Delhi":[77.209,28.613],"Bengaluru":[77.594,12.971],
  "Chennai":[80.270,13.082],"Hyderabad":[78.486,17.385],"Pune":[73.856,18.520],
  "Kolkata":[88.363,22.572],"Ahmedabad":[72.571,23.022],"Nagpur":[79.088,21.145],
  "Mangaluru":[74.856,12.914],"Coimbatore":[76.955,11.016],"Jaipur":[75.787,26.912],
  "Kochi":[76.267,9.931],"Chandigarh":[76.779,30.733],"Lucknow":[80.946,26.846],
  "Visakhapatnam":[83.299,17.686],"Indore":[75.857,22.719],"Bhubaneswar":[85.824,20.296],
  "Vadodara":[73.200,22.307],"Gurugram":[77.026,28.459],"Noida":[77.391,28.535],
  "Mysuru":[76.655,12.295],"Bhopal":[77.402,23.259],"Patna":[85.144,25.594],
};

function DENSITY_GREEN(intensity) {
  const shades = [
    "#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80", 
    "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d"
  ];
  const idx = Math.min(Math.floor(intensity * 10), 9);
  return shades[idx];
}

function getMegaBadge(score) {
  if (score >= 85) return { label: "ULTRA", color: "#dc2626" };
  if (score >= 75) return { label: "MEGA+", color: "#ea580c" };
  if (score >= 65) return { label: "MEGA", color: "#16a34a" };
  return null;
}

function IndiaMap({ patents, selectedCity, focusField, onCityClick }) {
  const [states, setStates] = useState([]);
  const [proj, setProj] = useState(null);

  const cityStats = useMemo(() => {
    const stats = {};
    patents.forEach(p => {
      const c = p.city; if (!c) return;
      if (!stats[c]) stats[c] = { total:0, mega:0, fields:{} };
      stats[c].total++;
      if (p.mega_score >= 65) stats[c].mega++;
      stats[c].fields[p.field] = (stats[c].fields[p.field]||0)+1;
    });
    Object.values(stats).forEach(s => {
      s.dominant = Object.entries(s.fields).sort((a,b)=>b[1]-a[1])[0]?.[0]||"Unknown";
    });
    return stats;
  }, [patents]);

  const maxCount = useMemo(() => Math.max(...Object.values(cityStats).map(s=>s.total), 1), [cityStats]);
  const rOf = n => 6 + (n/maxCount)*20;

  useEffect(() => {
    let live=true;
    (async()=>{
      try {
        // Use topojson library
        await new Promise((res,rej)=>{
          if(window.topojson)return res();
          const s=document.createElement("script");
          s.src="https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
          s.onload=res;s.onerror=rej;document.head.appendChild(s);
        });
        
        // Load better India map with states
        const res = await fetch("https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/e388c4cae20aa53cb5090210a42ebb9b765c0a36/india_states.geojson");
        const indiaGeo = await res.json();
        
        if(!indiaGeo||!live)return;
        const p = d3.geoMercator().fitSize([420, 520], indiaGeo);
        setProj(()=>p);
        
        const pathGen = d3.geoPath().projection(p);
        const statePaths = indiaGeo.features.map(f => ({
          path: pathGen(f),
          name: f.properties.st_nm
        }));
        setStates(statePaths);
      }catch(e){
        console.warn("Map load error", e);
      }
    })();
    return()=>{live=false;};
  },[]);

  return (
    <svg width={420} height={520} style={{display:"block"}}>
      <rect x={0} y={0} width={420} height={520} fill="#fafafa"/>
      {states.length > 0 ? states.map((s, i) => (
        <path key={i} d={s.path} fill="#e8f5e9" stroke="#66bb6a" strokeWidth={0.5} />
      )) : (
        <rect x={30} y={30} width={360} height={460} rx={6} fill="#e8f5e9" stroke="#66bb6a" strokeDasharray="8,4"/>
      )}
      {proj && Object.entries(CITY_COORDS).map(([city,[lng,lat]])=>{
        const stat=cityStats[city];
        if(!stat)return null;
        const[cx,cy]=proj([lng,lat]);
        const r=rOf(stat.total);
        const megaPct = stat.mega / stat.total;
        const col = megaPct > 0.2 ? "#16a34a" : megaPct > 0.1 ? "#4ade80" : "#86efac";
        const isSel=selectedCity===city;
        return(
          <g key={city} style={{cursor:"pointer"}} onClick={()=>onCityClick(city)}>
            {isSel&&<circle cx={cx} cy={cy} r={r+8} fill="none" stroke={col} strokeWidth={2} opacity={0.4}/>}
            <circle cx={cx} cy={cy} r={r+2} fill={col} opacity={0.2}/>
            <circle cx={cx} cy={cy} r={r} fill={col} opacity={isSel?1:0.75} stroke="#fff" strokeWidth={2}/>
            {stat.total>=3&&(
              <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fill="#fff"
                fontSize={r>14?10:8} fontFamily="JetBrains Mono,monospace" fontWeight="700">
                {stat.total}
              </text>
            )}
            <text x={cx+r+6} y={cy+2} dominantBaseline="middle"
              fill={isSel?"#111":"#666"} fontSize={10} fontFamily="DM Sans,sans-serif"
              fontWeight={isSel?"600":"400"}>
              {city}
            </text>
            {stat.mega>0&&(
              <text x={cx+r+6} y={cy+14} fontSize={8} fill="#16a34a" fontFamily="JetBrains Mono">
                {stat.mega} MEGA
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function UploadModal({ journalNo, onClose, onUploadStart }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.pdf'));
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(f => f.name.endsWith('.pdf'));
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('journal_no', journalNo);
    files.forEach(file => formData.append('files', file));

    try {
      const res = await fetch(`${API}/api/journals/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      onUploadStart(data.job_id);
      onClose();
    } catch (e) {
      alert('Upload failed: ' + e.message);
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="upload-modal" onClick={e => e.stopPropagation()}>
        <div className="upload-header">
          <h2>Upload PDFs for Journal {journalNo}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="upload-dropzone"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}>
          <div className="dropzone-icon">📄</div>
          <p>Drop PDF files here or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf"
            style={{display:'none'}}
            onChange={handleFileSelect}
          />
        </div>

        {files.length > 0 && (
          <div className="upload-files">
            <h3>{files.length} file(s) selected:</h3>
            <ul>
              {files.map((f, i) => (
                <li key={i}>
                  {f.name} ({(f.size / 1024 / 1024).toFixed(1)} MB)
                  <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>✕</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="upload-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleUpload} disabled={uploading || files.length === 0}>
            {uploading ? 'Uploading...' : `Upload ${files.length} PDF(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MegaPatentApp() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [journals, setJournals] = useState([]);
  const [patents, setPatents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState({});
  const [activeJournal, setActiveJournal] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [focusField, setFocusField] = useState("All");
  const [megaOnly, setMegaOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("mega_score");
  const [selectedPatent, setSelectedPatent] = useState(null);
  const [uploadModal, setUploadModal] = useState(null);

  const loadJournals = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/journals${refresh?"?refresh=1":""}`);
      const d = await r.json();
      const sorted = (d.journals||[]).sort((a,b)=>{
        if(a.journal_no==="UPCOMING")return -1;
        if(b.journal_no==="UPCOMING")return 1;
        return b.pub_date.split("/").reverse().join("").localeCompare(a.pub_date.split("/").reverse().join(""));
      });
      setJournals(sorted);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  const loadPatents = useCallback(async () => {
    try {
      const params = new URLSearchParams({limit:500,sort:sortBy});
      if(activeJournal) params.set("journal_no",activeJournal);
      if(focusField&&focusField!=="All") params.set("field",focusField);
      if(selectedCity) params.set("city",selectedCity);
      if(search) params.set("search",search);
      if(megaOnly) params.set("mega_only","1");
      const r = await fetch(`${API}/api/patents?${params}`);
      const d = await r.json();
      setPatents(d.patents||[]);
    } catch(e) { console.error(e); }
  }, [activeJournal,focusField,selectedCity,search,sortBy,megaOnly]);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/stats${activeJournal?`?journal_no=${activeJournal}`:""}`)
      const d = await r.json();
      setStats(d);
    } catch(e) { console.error(e); }
  }, [activeJournal]);

  useEffect(() => { loadJournals(); }, [loadJournals]);
  useEffect(() => { loadPatents(); }, [loadPatents]);
  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    const running = Object.values(jobs).filter(j=>j.status==="running");
    if (!running.length) return;
    const id = setInterval(async () => {
      for (const job of running) {
        try {
          const r = await fetch(`${API}/api/jobs/${job.job_id}`);
          const d = await r.json();
          setJobs(prev => ({...prev, [job.journal_no]: d}));
          if (d.status==="complete") { loadJournals(); loadPatents(); loadStats(); }
        } catch {}
      }
    }, 2000);
    return () => clearInterval(id);
  }, [jobs, loadJournals, loadPatents, loadStats]);

  const startDownload = async (journal_no) => {
    try {
      const r = await fetch(`${API}/api/journals/download`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({journal_no}),
      });
      const d = await r.json();
      setJobs(prev => ({...prev, [journal_no]: {...d, status:"running", progress:0}}));
    } catch(e) { alert("Download failed: "+e.message); }
  };

  const counts = useMemo(()=>{
    const c={};
    patents.forEach(p=>{c[p.field]=(c[p.field]||0)+1;});
    return c;
  },[patents]);

  const maxCount = Math.max(...Object.values(counts), 1);
  const sortedFields = Object.keys(FIELD_PALETTE).filter(f=>counts[f]>0).sort((a,b)=>(counts[b]||0)-(counts[a]||0));

  return (
    <>
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      {uploadModal && (
        <UploadModal
          journalNo={uploadModal}
          onClose={() => setUploadModal(null)}
          onUploadStart={(jobId) => setJobs(prev => ({...prev, [uploadModal]: {job_id:jobId, status:"running", progress:0}}))}
        />
      )}

      <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#fff"}}>
        <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:64,borderBottom:"2px solid #16a34a",flexShrink:0,background:"linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"}}>
          <div style={{display:"flex",alignItems:"baseline",gap:16}}>
            <span style={{fontFamily:"'Libre Baskerville',serif",fontSize:22,fontWeight:700,color:"#15803d"}}>🔍 MEGA Patent Discovery</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#16a34a",letterSpacing:"0.1em",textTransform:"uppercase"}}>
              {activeJournal?`Journal ${activeJournal}`:"All Journals"}
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {(selectedCity||focusField!=="All"||search)&&(
              <button className="btn" onClick={()=>{setSelectedCity(null);setFocusField("All");setSearch("");}}>
                ✕ Clear Filters
              </button>
            )}
            <label style={{display:"flex",alignItems:"center",gap:8,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#15803d",cursor:"pointer"}}>
              <input type="checkbox" checked={megaOnly} onChange={e=>setMegaOnly(e.target.checked)} />
              MEGA Only
            </label>
          </div>
        </header>

        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",borderBottom:"1px solid #e5e5e5",flexShrink:0}}>
          {[
            {n:stats?.overview?.total||patents.length,label:"Total Patents",sub:activeJournal||"all journals",color:"#111"},
            {n:stats?.overview?.mega_patents||patents.filter(p=>p.mega_score>=65).length,label:"MEGA Patents",sub:"score ≥ 65",color:"#16a34a",bg:"#f0fdf4"},
            {n:Math.round(stats?.overview?.avg_mega_score||0),label:"Avg Score",sub:"0-100 scale",color:"#15803d"},
            {n:stats?.overview?.cities||new Set(patents.map(p=>p.city).filter(Boolean)).size,label:"Cities",sub:"innovation hubs",color:"#111"},
            {n:Math.round(stats?.overview?.avg_claims||0),label:"Avg Claims",sub:"per patent",color:"#111"},
          ].map((s,i)=>(
            <div key={i} style={{padding:"16px 20px",borderRight:i<4?"1px solid #e5e5e5":"none",background:s.bg||"transparent"}}>
              <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:26,fontWeight:700,color:s.color,lineHeight:1}}>
                {loading?"…":s.n}
              </div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:s.color==="#16a34a"?"#15803d":"#999",letterSpacing:"0.08em",textTransform:"uppercase",marginTop:4}}>{s.label}</div>
              <div style={{fontSize:10,color:"#ccc",marginTop:2}}>{s.sub}</div>
            </div>
          ))}
        </div>

        <PanelGroup direction="horizontal" style={{flex:1}}>
          <Panel defaultSize={18} minSize={15} maxSize={25}>
            <div style={{height:"100%",display:"flex",flexDirection:"column",borderRight:"1px solid #e5e5e5"}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid #f0f0f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",color:"#999"}}>IPO Journals</span>
                <button className="btn" onClick={()=>loadJournals(true)} disabled={loading}>
                  {loading?"⟳":"↻"} Refresh
                </button>
              </div>
              <div style={{flex:1,overflowY:"auto"}}>
                {journals.map(j=>{
                  const job=jobs[j.journal_no];
                  const isActive=activeJournal===j.journal_no;
                  const isRunning=job&&job.status==="running";
                  return(
                    <div key={j.journal_no}
                      className={`journal-row${isActive?" sel":""}`}
                      onClick={()=>j.status==="processed"&&setActiveJournal(a=>a===j.journal_no?null:j.journal_no)}
                      style={{cursor:j.status==="processed"?"pointer":"default"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:j.status==="processed"?"#16a34a":j.status==="upcoming"?"#6366f1":"#d1d5db",flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:10,color:isActive?"#fff":"#333"}}>No. {j.journal_no}</div>
                        <div style={{fontSize:9,color:isActive?"#aaa":"#999",marginTop:1}}>{j.pub_date}</div>
                        {j.mega_patents_count>0&&<div style={{fontSize:8,color:isActive?"#4ade80":"#16a34a",marginTop:2}}>{j.mega_patents_count} MEGA</div>}
                      </div>
                      {isRunning?(
                        <div style={{textAlign:"right",minWidth:50}}>
                          <div style={{fontSize:9,color:"#d97706",marginBottom:2}}>{job.progress||0}%</div>
                          <div className="progress-bar" style={{width:50,height:3}}>
                            <div className="progress-fill" style={{width:`${job.progress||0}%`,background:"#16a34a"}}/>
                          </div>
                        </div>
                      ):j.status==="available"||j.status==="upcoming"?(
                        <div style={{display:"flex",gap:4}}>
                          <button className="btn-mini primary" onClick={e=>{e.stopPropagation();startDownload(j.journal_no);}} disabled={j.status==="upcoming"}>
                            ↓
                          </button>
                          <button className="btn-mini" onClick={e=>{e.stopPropagation();setUploadModal(j.journal_no);}} disabled={j.status==="upcoming"}>
                            📤
                          </button>
                        </div>
                      ):null}
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle style={{width:4,background:"#e5e5e5",cursor:"col-resize",transition:"background 0.2s"}} />

          <Panel defaultSize={35} minSize={25}>
            <div style={{height:"100%",display:"flex",flexDirection:"column"}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid #f0f0f0"}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",color:"#999"}}>Innovation Map</span>
              </div>
              <div style={{flex:1,overflowY:"auto",display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
                <IndiaMap patents={patents} selectedCity={selectedCity} focusField={focusField} onCityClick={c=>setSelectedCity(s=>s===c?null:c)} />
              </div>
              <div style={{borderTop:"1px solid #f0f0f0",padding:"12px 16px",maxHeight:"35%",overflowY:"auto"}}>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",color:"#999",marginBottom:10}}>Technology Density</div>
                {sortedFields.slice(0,12).map(field=>{
                  const n=counts[field]||0;
                  const intensity=n/maxCount;
                  const greenShade=DENSITY_GREEN(intensity);
                  const isOn=focusField===field;
                  return(
                    <div key={field} className="field-row" onClick={()=>setFocusField(isOn?"All":field)}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:greenShade,border:`1px solid ${isOn?"#16a34a":"#86efac"}`,flexShrink:0}}/>
                      <div style={{flex:1,fontSize:10,fontWeight:isOn?600:400,color:isOn?"#111":"#666"}}>{field}</div>
                      <div style={{width:50,background:"#f0f0f0",height:4,borderRadius:2}}>
                        <div style={{height:"100%",width:`${(n/maxCount)*100}%`,background:greenShade,borderRadius:2}}/>
                      </div>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#999",width:20,textAlign:"right"}}>{n}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle style={{width:4,background:"#e5e5e5",cursor:"col-resize"}} />

          <Panel defaultSize={47} minSize={35}>
            <div style={{height:"100%",display:"flex",flexDirection:"column"}}>
              <div style={{padding:"10px 20px",borderBottom:"1px solid #f0f0f0",display:"flex",gap:12,alignItems:"center"}}>
                <input className="search-box" placeholder="Search patents..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1}}/>
                <select onChange={e=>setSortBy(e.target.value)} value={sortBy} className="select-box">
                  <option value="mega_score">MEGA Score ↓</option>
                  <option value="num_claims">Claims ↓</option>
                  <option value="num_pages">Pages ↓</option>
                  <option value="filing_date">Date ↓</option>
                </select>
              </div>
              <div style={{padding:"8px 20px",borderBottom:"1px solid #f8f8f8",fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#999",letterSpacing:"0.07em"}}>
                {patents.length} RESULT{patents.length!==1?"S":""}
                {selectedCity?` · ${selectedCity}`:""}
                {focusField!=="All"?` · ${focusField}`:""}
                {megaOnly?" · MEGA ONLY":""}
              </div>
              <div style={{flex:1,overflowY:"auto"}}>
                {patents.length===0?(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:"#ccc"}}>
                    {loading?"Loading...":"No patents found"}
                  </div>
                ):patents.map((p,i)=>{
                  const badge=getMegaBadge(p.mega_score);
                  const isSel=selectedPatent?.id===p.id;
                  return(
                    <div key={p.id} className={`patent-card${isSel?" sel":""}`} onClick={()=>setSelectedPatent(s=>s?.id===p.id?null:p)} style={{animationDelay:`${i*0.01}s`}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:16}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                            <span className="field-pill" style={{background:FIELD_PALETTE[p.field]||"#999"}}>{p.field}</span>
                            {badge&&<span className="mega-badge" style={{background:badge.color}}>{badge.label}</span>}
                          </div>
                          <div style={{fontSize:13,fontWeight:500,lineHeight:1.5,marginBottom:8,color:isSel?"#fff":"#111"}}>{p.title}</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px",fontSize:10,color:isSel?"#aaa":"#999"}}>
                            {p.city&&<span>📍 {p.city}</span>}
                            {p.applicants?.[0]&&<span>👤 {p.applicants[0]}</span>}
                            {p.ipc_codes?.[0]&&<span>🏷️ {p.ipc_codes[0]}</span>}
                          </div>
                          <div style={{marginTop:6,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:isSel?"#666":"#ccc"}}>
                            {p.application_no} · {p.filing_date}
                          </div>
                        </div>
                        <div style={{textAlign:"center",minWidth:70}}>
                          <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:28,fontWeight:700,color:badge?badge.color:isSel?"#fff":"#111",lineHeight:1}}>{p.mega_score}</div>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:isSel?"#666":"#999",letterSpacing:"0.05em",textTransform:"uppercase",marginTop:2}}>SCORE</div>
                          <div style={{fontSize:10,color:isSel?"#888":"#ccc",marginTop:6}}>{Math.round(p.num_claims||0)}c · {p.num_pages}p</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <div className={`slide-panel${selectedPatent?" open":""}` }>
        {selectedPatent&&(()=>{
          const badge=getMegaBadge(selectedPatent.mega_score);
          return(
            <div style={{padding:"28px 36px",maxWidth:1000,margin:"0 auto"}}>
              <button onClick={()=>setSelectedPatent(null)} className="panel-close">✕</button>
              <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:32}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <span className="field-pill" style={{background:FIELD_PALETTE[selectedPatent.field]||"#999"}}>{selectedPatent.field}</span>
                    {badge&&<span className="mega-badge" style={{background:badge.color,fontSize:12}}>{badge.label}</span>}
                    <div style={{marginLeft:"auto",textAlign:"center"}}>
                      <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:32,fontWeight:700,color:badge?badge.color:"#4ade80",lineHeight:1}}>{selectedPatent.mega_score}</div>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#666",letterSpacing:"0.06em"}}>MEGA SCORE</div>
                    </div>
                  </div>
                  <h2 style={{fontFamily:"'Libre Baskerville',serif",fontSize:18,fontWeight:700,lineHeight:1.5,color:"#fff",marginBottom:16}}>{selectedPatent.title}</h2>
                  <p style={{fontSize:13,lineHeight:1.8,color:"#999",marginBottom:20}}>{selectedPatent.abstract||"No abstract available."}</p>
                  {selectedPatent.applicants?.length>0&&(
                    <div style={{marginBottom:16}}>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#666",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Applicants</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {selectedPatent.applicants.map(a=>(<span key={a} style={{fontSize:11,background:"#1a1a1a",padding:"4px 10px",borderRadius:3,color:"#aaa"}}>{a}</span>))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  {[
                    ["Application No.",selectedPatent.application_no],
                    ["Filing Date",selectedPatent.filing_date],
                    ["Published",selectedPatent.publication_date],
                    ["Claims",Math.round(selectedPatent.num_claims||0)],
                    ["Pages",selectedPatent.num_pages],
                    ["IPC Codes",selectedPatent.ipc_codes?.slice(0,3).join(", ")||"-"],
                    ["City",selectedPatent.city||"Unknown"],
                    ["State",selectedPatent.state||"Unknown"],
                    ["Journal",selectedPatent.journal_no],
                    ["Type",selectedPatent.pub_type],
                  ].map(([label,val])=>(
                    <div key={label}>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"#666",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>{label}</div>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#ddd",lineHeight:1.4}}>{val||"—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}
