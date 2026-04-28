import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as d3 from "d3";
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

const W=370, H=470;

function h2r(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgba(${r},${g},${b},${a})`;}
function statusColor(s){return s==="processed"?"#16a34a":s==="upcoming"?"#6366f1":s==="running"?"#d97706":s==="failed"?"#dc2626":"#d1d5db";}
function statusLabel(s){return s==="processed"?"✓ Processed":s==="upcoming"?"⏳ Upcoming":s==="running"?"⟳ Downloading":s==="failed"?"✗ Failed":s==="queued"?"… Queued":"○ Available";}

function useFetch(url, deps=[]) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetch_ = useCallback(async () => {
    if (!url) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [url]);
  useEffect(() => { fetch_(); }, deps);
  return { data, loading, error, refetch: fetch_ };
}

function IndiaMap({ patents, selectedCity, focusField, onCityClick, onCityHover }) {
  const [indiaPath, setIndiaPath] = useState("");
  const [proj, setProj] = useState(null);

  const cityStats = useMemo(() => {
    const stats = {};
    patents.forEach(p => {
      const c = p.city; if (!c) return;
      if (!stats[c]) stats[c] = { total:0, fields:{} };
      stats[c].total++;
      stats[c].fields[p.field] = (stats[c].fields[p.field]||0)+1;
    });
    Object.values(stats).forEach(s => {
      s.dominant = Object.entries(s.fields).sort((a,b)=>b[1]-a[1])[0]?.[0]||"Unknown";
    });
    return stats;
  }, [patents]);

  const maxCount = useMemo(() => Math.max(...Object.values(cityStats).map(s=>s.total), 1), [cityStats]);
  const rOf = n => 5 + (n/maxCount)*18;

  useEffect(() => {
    let live=true;
    (async()=>{
      try {
        await new Promise((res,rej)=>{
          if(window.topojson)return res();
          const s=document.createElement("script");
          s.src="https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
          s.onload=res;s.onerror=rej;document.head.appendChild(s);
        });
        const res=await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json");
        const world=await res.json();
        const india=window.topojson.feature(world,world.objects.countries).features.find(f=>f.id==="356");
        if(!india||!live)return;
        const p=d3.geoMercator().fitSize([W,H],india);
        setProj(()=>p);
        setIndiaPath(d3.geoPath().projection(p)(india));
      }catch(e){console.warn(e);}
    })();
    return()=>{live=false;};
  },[]);

  return (
    <svg width={W} height={H} style={{display:"block",overflow:"visible"}}>
      <rect x={0} y={0} width={W} height={H} fill="#fafafa"/>
      {indiaPath
        ?<path d={indiaPath} fill="#f0f0f0" stroke="#d4d4d4" strokeWidth={0.8}/>
        :<rect x={30} y={10} width={310} height={450} rx={6} fill="#f0f0f0" stroke="#ddd" strokeDasharray="6,4"/>
      }
      {proj && Object.entries(CITY_COORDS).map(([city,[lng,lat]])=>{
        const stat=cityStats[city];
        if(!stat)return null;
        const[cx,cy]=proj([lng,lat]);
        const r=rOf(stat.total);
        const col=FIELD_PALETTE[stat.dominant]||"#999";
        const hasFocus=!focusField||focusField==="All"||stat.fields[focusField]>0;
        const isSel=selectedCity===city;
        return(
          <g key={city} style={{cursor:"pointer",transition:"opacity 0.3s"}} opacity={hasFocus?1:0.1}
            onClick={()=>onCityClick(city)}
            onMouseEnter={()=>onCityHover(city,cx,cy,stat)}
            onMouseLeave={()=>onCityHover(null)}>
            {isSel&&<circle cx={cx} cy={cy} r={r+9} fill="none" stroke={col} strokeWidth={1.2} opacity={0.25}/>}
            <circle cx={cx} cy={cy} r={r+2} fill={col} opacity={0.13}/>
            <circle cx={cx} cy={cy} r={isSel?r+1:r-1} fill={col} opacity={isSel?1:0.82} stroke="#fff" strokeWidth={isSel?2:1.5}/>
            {stat.total>=2&&(
              <text x={cx} y={cy+0.5} textAnchor="middle" dominantBaseline="middle" fill="#fff"
                fontSize={r>12?9:7} fontFamily="JetBrains Mono,monospace" fontWeight="600" pointerEvents="none">
                {stat.total}
              </text>
            )}
            <text x={cx+r+5} y={cy+1} dominantBaseline="middle"
              fill={isSel?"#111":"#777"} fontSize={9} fontFamily="DM Sans,sans-serif"
              fontWeight={isSel?"600":"400"} pointerEvents="none">
              {city}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function FieldHeatmap({ patents, focusField, onFieldClick }) {
  const counts = useMemo(()=>{const c={};patents.forEach(p=>{c[p.field]=(c[p.field]||0)+1;});return c;},[patents]);
  const total=patents.length||1;
  const sorted=Object.keys(FIELD_PALETTE).filter(f=>counts[f]>0).sort((a,b)=>(counts[b]||0)-(counts[a]||0));
  return(
    <div style={{padding:"12px 16px 14px"}}>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",color:"#c8c8c8",marginBottom:10}}>
        Field Heatmap <span style={{color:"#ddd",fontSize:8,marginLeft:4}}>click to spotlight</span>
      </div>
      {sorted.map(field=>{
        const n=counts[field]||0,pct=n/total,col=FIELD_PALETTE[field],isOn=focusField===field,dim=focusField&&focusField!=="All"&&!isOn;
        return(
          <div key={field} className="field-row" style={{opacity:dim?0.2:1}} onClick={()=>onFieldClick(isOn?"All":field)}>
            <div style={{width:7,height:7,borderRadius:"50%",background:col,flexShrink:0}}/>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10.5,flex:1,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:isOn?"#111":"#555",fontWeight:isOn?600:400}}>{field}</div>
            <div style={{width:68,background:"#f0f0f0",height:4,borderRadius:2,flexShrink:0}}>
              <div className="hm-bar" style={{width:`${pct*100}%`,background:col,opacity:isOn?1:0.55}}/>
            </div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#ccc",width:18,textAlign:"right",flexShrink:0}}>{n}</div>
          </div>
        );
      })}
    </div>
  );
}

function JournalPanel({ activeJournal, onSelect }) {
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState({});
  const [scraping, setScraping] = useState(false);

  const loadJournals = useCallback(async (refresh=false) => {
    setScraping(refresh); setLoading(true);
    try {
      const r = await fetch(`${API}/api/journals${refresh?"?refresh=1":""}`);
      const d = await r.json();
      setJournals(d.journals||[]);
    } catch(e) { console.error(e); }
    setScraping(false); setLoading(false);
  }, []);

  useEffect(() => { loadJournals(); }, [loadJournals]);

  useEffect(() => {
    const running = Object.values(jobs).filter(j=>j.status==="running"||j.status==="started");
    if (!running.length) return;
    const id = setInterval(async () => {
      const updated = {...jobs};
      for (const job of running) {
        try {
          const r = await fetch(`${API}/api/jobs/${job.job_id}`);
          const d = await r.json();
          updated[job.journal_no] = d;
          if (d.status==="complete") { loadJournals(); }
        } catch {}
      }
      setJobs(updated);
    }, 2000);
    return () => clearInterval(id);
  }, [jobs, loadJournals]);

  const startDownload = useCallback(async (journal_no) => {
    try {
      const r = await fetch(`${API}/api/journals/download`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({journal_no}),
      });
      const d = await r.json();
      setJobs(prev => ({...prev, [journal_no]: {...d, status:"running", progress:0, message:"Starting…"}}));
    } catch(e) { alert("Download failed: "+e.message); }
  }, []);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"12px 16px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",color:"#bbb"}}>
          IPO Journals
        </span>
        <button className="btn" onClick={()=>loadJournals(true)} disabled={scraping||loading}>
          {scraping?<span className="spinner">⟳</span>:"↻"} Refresh
        </button>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {loading&&!journals.length&&(
          <div style={{padding:20,textAlign:"center",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#ddd"}}>
            <span className="spinner">⟳</span> Loading journals…
          </div>
        )}
        {journals.map(j=>{
          const job=jobs[j.journal_no];
          const isActive=activeJournal===j.journal_no;
          const isRunning=job&&(job.status==="running"||job.status==="started");
          const canDownload=j.status!=="upcoming"&&j.status!=="processed"&&!isRunning;

          return(
            <div key={j.journal_no}
              className={`journal-row${isActive?" sel":""}`}
              onClick={()=>j.status==="processed"&&onSelect(j.journal_no)}
              style={{opacity:j.status==="upcoming"?0.5:1}}
            >
              <div style={{width:6,height:6,borderRadius:"50%",background:isActive?"#fff":statusColor(job?.status||j.status),flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:10,color:isActive?"#fff":"#333"}}>No. {j.journal_no}</div>
                <div style={{fontSize:9,color:isActive?"#888":"#bbb",marginTop:1}}>{j.pub_date}</div>
              </div>
              {j.patents_count>0&&(
                <div style={{fontSize:9,color:isActive?"#aaa":"#ccc"}}>{j.patents_count}p</div>
              )}
              {isRunning?(
                <div style={{textAlign:"right",minWidth:60}}>
                  <div style={{fontSize:9,color:"#d97706",marginBottom:3}}>{job.progress||0}%</div>
                  <div className="progress-bar" style={{width:60}}>
                    <div className="progress-fill" style={{width:`${job.progress||0}%`}}/>
                  </div>
                </div>
              ):canDownload?(
                <button className="btn primary" style={{padding:"3px 8px",fontSize:8}}
                  onClick={e=>{e.stopPropagation();startDownload(j.journal_no);}}>
                  ↓ Get
                </button>
              ):null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PatentWatch() {
  const [activeJournal, setActiveJournal] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [focusField, setFocusField] = useState("All");
  const [selectedPatent, setSelectedPatent] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("num_claims");
  const [tooltip, setTooltip] = useState(null);
  const [tab, setTab] = useState("list");
  const [backendOk, setBackendOk] = useState(null);
  const [patents, setPatents] = useState([]);
  const [pLoading, setPLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(()=>{
    fetch(`${API}/api/health`).then(r=>r.ok?setBackendOk(true):setBackendOk(false)).catch(()=>setBackendOk(false));
  },[]);

  useEffect(()=>{
    if(backendOk===false) return;
    let cancelled=false;
    const load=async()=>{
      setPLoading(true);
      try {
        const params=new URLSearchParams({limit:500,sort:sortBy});
        if(activeJournal) params.set("journal_no",activeJournal);
        if(focusField&&focusField!=="All") params.set("field",focusField);
        if(selectedCity) params.set("city",selectedCity);
        if(search) params.set("search",search);
        const r=await fetch(`${API}/api/patents?${params}`);
        const d=await r.json();
        if(!cancelled) setPatents(d.patents||[]);
      } catch(e) { if(!cancelled) console.error(e); }
      if(!cancelled) setPLoading(false);
    };
    const debounce=setTimeout(load,search?300:0);
    return()=>{cancelled=true;clearTimeout(debounce);};
  },[activeJournal,focusField,selectedCity,search,sortBy,backendOk]);

  useEffect(()=>{
    if(backendOk===false)return;
    fetch(`${API}/api/stats${activeJournal?`?journal_no=${activeJournal}`:""}`)
      .then(r=>r.json()).then(setStats).catch(()=>{});
  },[activeJournal,backendOk]);

  const sorted = useMemo(()=>{
    const p=[...patents];
    if(sortBy==="num_claims") p.sort((a,b)=>b.num_claims-a.num_claims);
    else if(sortBy==="num_pages") p.sort((a,b)=>b.num_pages-a.num_pages);
    else if(sortBy==="filing_date") p.sort((a,b)=>(b.filing_date||"").localeCompare(a.filing_date||""));
    return p;
  },[patents,sortBy]);

  const cityPatents = useMemo(()=>selectedCity?sorted.filter(p=>p.city===selectedCity):sorted,[sorted,selectedCity]);

  const handleCityClick=useCallback((city)=>{setSelectedCity(c=>c===city?null:city);setSelectedPatent(null);},[]);
  const handleCityHover=useCallback((city,cx,cy,stat)=>{if(!city){setTooltip(null);return;}setTooltip({city,cx,cy,stat});},[]);
  const clearAll=useCallback(()=>{setSelectedCity(null);setFocusField("All");setSearch("");setSelectedPatent(null);},[]);

  const hasFilter=selectedCity||(focusField&&focusField!=="All")||search.trim();
  const displayPatents=cityPatents;
  const overviewStats=stats?.overview;

  return(
    <>
      <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#fff",overflow:"hidden"}}>

        <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:54,borderBottom:"1px solid #efefef",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"baseline",gap:14}}>
            <span style={{fontFamily:"'Libre Baskerville',serif",fontSize:18,fontWeight:700,letterSpacing:"-0.02em"}}>Bharat Patent Watch</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#ccc",letterSpacing:"0.09em",textTransform:"uppercase"}}>
              IPO India · {activeJournal?`Journal ${activeJournal}`:"All Journals"}
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {hasFilter&&(
              <button className="btn" onClick={clearAll}>✕ clear filters</button>
            )}
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#d8d8d8"}}>{new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</span>
          </div>
        </header>

        {backendOk===true&&(
          <div style={{background:"#f0fdf4",borderBottom:"1px solid #bbf7d0",padding:"5px 24px",fontFamily:"'JetBrains Mono',monospace",fontSize:9.5,color:"#14532d"}}>
            ● Backend connected — live data
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",borderBottom:"1px solid #efefef",flexShrink:0}}>
          {[
            {n:overviewStats?.total??displayPatents.length,label:"Patents",sub:activeJournal||"all journals"},
            {n:overviewStats?.cities??new Set(displayPatents.map(p=>p.city).filter(Boolean)).size,label:"Cities",sub:"publishing"},
            {n:overviewStats?.avg_claims??(displayPatents.length?(displayPatents.reduce((s,p)=>s+(p.num_claims||0),0)/displayPatents.length).toFixed(1):"—"),label:"Avg Claims",sub:"per patent"},
            {n:overviewStats?.max_claims??Math.max(...displayPatents.map(p=>p.num_claims||0),0),label:"Most Claims",sub:"single patent"},
            {n:overviewStats?.avg_pages??(displayPatents.length?(displayPatents.reduce((s,p)=>s+(p.num_pages||0),0)/displayPatents.length).toFixed(1):"—"),label:"Avg Pages",sub:"per patent"},
          ].map((s,i)=>(
            <div key={i} style={{padding:"13px 20px",borderRight:i<4?"1px solid #efefef":"none"}}>
              <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:21,fontWeight:700,letterSpacing:"-0.03em",lineHeight:1}}>
                {pLoading?"…":s.n}
              </div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,color:"#c8c8c8",letterSpacing:"0.09em",textTransform:"uppercase",marginTop:3}}>{s.label}</div>
              <div style={{fontSize:10,color:"#ddd",marginTop:2}}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{display:"flex",flex:1,overflow:"hidden"}}>

          <div style={{width:210,flexShrink:0,borderRight:"1px solid #efefef",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <JournalPanel activeJournal={activeJournal} onSelect={(jn)=>{setActiveJournal(a=>a===jn?null:jn);clearAll();}}/>
          </div>

          <div style={{width:420,flexShrink:0,borderRight:"1px solid #efefef",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"12px 10px",position:"relative",overflow:"hidden"}}>
              <IndiaMap
                patents={displayPatents}
                selectedCity={selectedCity}
                focusField={focusField}
                onCityClick={handleCityClick}
                onCityHover={handleCityHover}
              />
              {tooltip&&(
                <div style={{position:"absolute",left:tooltip.cx+26,top:tooltip.cy-14,background:"#111",color:"#fff",padding:"8px 12px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,pointerEvents:"none",zIndex:10,borderRadius:2,minWidth:150}}>
                  <div style={{fontWeight:600,marginBottom:4}}>{tooltip.city}</div>
                  <div style={{color:"#777",fontSize:9,marginBottom:6}}>{tooltip.stat?.total||0} patents</div>
                  {tooltip.stat&&Object.entries(tooltip.stat.fields).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([f,n])=>(
                    <div key={f} style={{display:"flex",alignItems:"center",gap:6,color:"#aaa",fontSize:9,marginTop:3}}>
                      <span style={{color:FIELD_PALETTE[f]||"#888"}}>●</span>
                      <span style={{flex:1}}>{f.split("/")[0]}</span>
                      <span style={{color:"#666"}}>{n}</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedCity&&(
                <div style={{position:"absolute",top:8,right:8}}>
                  <button className="btn" onClick={()=>{setSelectedCity(null);setSelectedPatent(null);}}>✕ {selectedCity}</button>
                </div>
              )}
            </div>
            <div style={{padding:"6px 14px",borderTop:"1px solid #f8f8f8",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
              {[2,5,8].map(n=>(
                <div key={n} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:n*2.8,height:n*2.8,borderRadius:"50%",background:"#555",opacity:0.45,flexShrink:0}}/>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#ccc"}}>{n}</span>
                </div>
              ))}
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#ddd"}}>patents · click to filter</span>
            </div>
            <div style={{borderTop:"1px solid #efefef",overflowY:"auto",flexShrink:0}}>
              <FieldHeatmap patents={displayPatents} focusField={focusField} onFieldClick={setFocusField}/>
            </div>
          </div>

          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
            <div style={{display:"flex",borderBottom:"1px solid #efefef",flexShrink:0}}>
              <div className={`tab${tab==="list"?" active":""}`} onClick={()=>setTab("list")}>Patents</div>
              <div className={`tab${tab==="insights"?" active":""}`} onClick={()=>setTab("insights")}>Insights</div>
            </div>

            {tab==="list"&&(
              <>
                <div style={{padding:"10px 20px",borderBottom:"1px solid #efefef",display:"flex",gap:12,alignItems:"center",flexShrink:0}}>
                  <div style={{flex:1,minWidth:0}}>
                    <input className="search-box" placeholder="Search title, abstract, applicant…" value={search} onChange={e=>setSearch(e.target.value)}/>
                  </div>
                  <select onChange={e=>setSortBy(e.target.value)} value={sortBy} style={{appearance:"none",border:"1px solid #ebebeb",background:"#fff",padding:"6px 28px 6px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",outline:"none",color:"#777",borderRadius:2,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23bbb'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",flexShrink:0}}>
                    <option value="num_claims">Claims ↓</option>
                    <option value="num_pages">Pages ↓</option>
                    <option value="filing_date">Date ↓</option>
                  </select>
                </div>
                <div style={{padding:"6px 20px",borderBottom:"1px solid #f8f8f8",fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,color:"#d0d0d0",letterSpacing:"0.07em",flexShrink:0,display:"flex",alignItems:"center",gap:8}}>
                  {pLoading&&<span className="spinner" style={{fontSize:10}}>⟳</span>}
                  {displayPatents.length} RESULT{displayPatents.length!==1?"S":""}
                  {selectedCity?` · ${selectedCity}`:""}
                  {focusField&&focusField!=="All"?` · ${focusField}`:""}
                </div>
                <div style={{flex:1,overflowY:"auto"}}>
                  {displayPatents.length===0?(
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:200,gap:8}}>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#e8e8e8",letterSpacing:"0.06em"}}>
                        {pLoading?"LOADING…":"NO RESULTS"}
                      </div>
                    </div>
                  ):displayPatents.map((p,i)=>{
                    const col=FIELD_PALETTE[p.field]||"#999";
                    const isSel=selectedPatent?.id===p.id;
                    const apps=p.applicants||[];
                    const ipcs=p.ipc_codes||[];
                    return(
                      <div key={p.id||p.application_no} className={`card${isSel?" sel":""}`} style={{animationDelay:`${i*0.016}s`}}
                        onClick={()=>setSelectedPatent(s=>s?.id===p.id?null:p)}>
                        <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:isSel?"rgba(255,255,255,0.2)":col,opacity:0.65}}/>
                        <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{marginBottom:5}}>
                              <span className="field-pill" style={{color:isSel?col:"#fff",background:isSel?h2r(col,0.22):col}}>
                                <span style={{width:5,height:5,borderRadius:"50%",background:isSel?col:"rgba(255,255,255,0.5)",display:"inline-block",flexShrink:0}}/>
                                {p.field}
                              </span>
                            </div>
                            <div style={{fontSize:13,fontWeight:500,lineHeight:1.45,marginBottom:8,color:isSel?"#fff":"#111"}}>{p.title}</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:"3px 14px"}}>
                              {p.city&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9.5,color:isSel?"#aaa":"#888"}}>📍 {p.city}</span>}
                              {apps[0]&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9.5,color:isSel?"#666":"#c0c0c0"}}>{apps[0]}{apps.length>1?` +${apps.length-1}`:""}</span>}
                              {ipcs[0]&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9.5,color:isSel?"#555":"#d0d0d0"}}>{ipcs[0]}</span>}
                            </div>
                            <div style={{marginTop:8,fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,color:isSel?"#555":"#d8d8d8",letterSpacing:"0.04em"}}>
                              {p.application_no} · filed {p.filing_date} · {p.pub_type}
                            </div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:21,fontWeight:700,letterSpacing:"-0.02em",lineHeight:1,color:isSel?"#fff":"#111"}}>{p.num_claims}</div>
                            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:isSel?"#666":"#d0d0d0",letterSpacing:"0.07em",textTransform:"uppercase",marginTop:2}}>claims</div>
                            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:isSel?"#555":"#d8d8d8",marginTop:6}}>{p.num_pages}p</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {tab==="insights"&&stats&&(
              <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
                <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:16,fontWeight:700,marginBottom:20,letterSpacing:"-0.01em"}}>
                  {activeJournal?`Journal ${activeJournal} Insights`:"All-Journals Insights"}
                </div>

                <div style={{marginBottom:24}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.09em",textTransform:"uppercase",color:"#bbb",marginBottom:12}}>Top Publishing Cities</div>
                  {(stats.by_city||[]).slice(0,10).map(({city,state,count})=>{
                    const pct=(count/(stats.overview?.total||1))*100;
                    return(
                      <div key={city} style={{marginBottom:8,cursor:"pointer"}} onClick={()=>{setSelectedCity(city);setTab("list");}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:12,color:"#333"}}>{city}</span>
                          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#bbb"}}>{count}</span>
                        </div>
                        <div style={{height:4,background:"#f0f0f0",borderRadius:2}}>
                          <div style={{height:"100%",width:`${pct}%`,background:"#111",borderRadius:2,transition:"width 0.5s"}}/>
                        </div>
                        {state&&<div style={{fontSize:10,color:"#ccc",marginTop:2}}>{state}</div>}
                      </div>
                    );
                  })}
                </div>

                <div style={{marginBottom:24}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.09em",textTransform:"uppercase",color:"#bbb",marginBottom:12}}>Technology Distribution</div>
                  {(stats.by_field||[]).map(({field,count})=>{
                    const col=FIELD_PALETTE[field]||"#999";
                    const pct=(count/(stats.overview?.total||1))*100;
                    return(
                      <div key={field} style={{marginBottom:8,cursor:"pointer"}} onClick={()=>{setFocusField(field);setTab("list");}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:col,flexShrink:0}}/>
                          <span style={{fontSize:11.5,color:"#333",flex:1}}>{field}</span>
                          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#bbb"}}>{count}</span>
                        </div>
                        <div style={{height:4,background:"#f0f0f0",borderRadius:2,marginLeft:14}}>
                          <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:2,opacity:0.7,transition:"width 0.5s"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`slide-panel${selectedPatent?" open":""}` }>
        {selectedPatent&&(()=>{
          const col=FIELD_PALETTE[selectedPatent.field]||"#999";
          const apps=selectedPatent.applicants||[];
          const invs=selectedPatent.inventors||[];
          const ipcs=selectedPatent.ipc_codes||[];
          return(
            <div style={{padding:"24px 32px"}}>
              <button onClick={()=>setSelectedPatent(null)} style={{position:"absolute",top:18,right:22,background:"none",border:"1px solid #2a2a2a",color:"#888",width:26,height:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,borderRadius:1}}>✕</button>
              <div style={{display:"grid",gridTemplateColumns:"1fr 240px",gap:28,alignItems:"start"}}>
                <div>
                  <span className="field-pill" style={{color:col,background:h2r(col,0.15),marginBottom:10,display:"inline-flex"}}>
                    <span style={{width:5,height:5,borderRadius:"50%",background:col,display:"inline-block"}}/>
                    {selectedPatent.field}
                  </span>
                  <h2 style={{fontFamily:"'Libre Baskerville',serif",fontSize:15,fontWeight:700,lineHeight:1.5,color:"#fff",marginBottom:12,maxWidth:560}}>{selectedPatent.title}</h2>
                  <p style={{fontSize:12.5,lineHeight:1.8,color:"#777",maxWidth:560,marginBottom:14}}>{selectedPatent.abstract}</p>
                  {invs.length>0&&(
                    <div>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,color:"#444",letterSpacing:"0.09em",textTransform:"uppercase",marginBottom:5}}>Inventors</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {invs.map(inv=>(<span key={inv} style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#999",background:"#1c1c1c",padding:"3px 9px",borderRadius:2}}>{inv}</span>))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {[
                    ["Application No.", selectedPatent.application_no],
                    ["Filing Date", selectedPatent.filing_date],
                    ["Published", selectedPatent.publication_date],
                    ["Type", selectedPatent.pub_type],
                    ["Claims / Pages", `${selectedPatent.num_claims} · ${selectedPatent.num_pages}p`],
                    ["IPC Codes", ipcs.slice(0,3).join(" · ")||"—"],
                    ["City / State", [selectedPatent.city,selectedPatent.state].filter(Boolean).join(", ")||"—"],
                    ["Applicants", apps.join("; ")||"—"],
                    ["Priority Country", selectedPatent.priority_country&&selectedPatent.priority_country!=="NA"?selectedPatent.priority_country:"India"],
                    ["Journal", selectedPatent.journal_no],
                  ].map(([label,val])=>(
                    <div key={label}>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"#444",letterSpacing:"0.09em",textTransform:"uppercase",marginBottom:2}}>{label}</div>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#ccc",lineHeight:1.4}}>{val||"—"}</div>
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
