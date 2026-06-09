import { useState, useRef } from "react";

// ─── API ENDPOINT ────────────────────────────────────────────────────────────
// All AI calls route through /api/claude (Vercel serverless proxy).
// Your API key is stored securely in Vercel environment variables — never here.
// ─────────────────────────────────────────────────────────────────────────────


// ─── Constants ────────────────────────────────────────────────────────────────
const JOB_CATEGORIES = {
  "Painting": { icon: "🎨", types: ["Interior Painting – Room(s)", "Interior Painting – Whole House", "Exterior Painting", "Cabinet Painting", "Deck / Fence Staining"],
    materialFields: [
      { key: "sqft", label: "Square Footage", placeholder: "800", unit: "sq ft", required: true },
      { key: "coats", label: "Number of Coats", placeholder: "2", unit: "coats", required: true },
      { key: "condition", label: "Surface Condition", type: "select", options: ["Good – light prep", "Fair – moderate prep", "Poor – heavy prep/repair"], required: true },
      { key: "rooms", label: "Number of Rooms", placeholder: "1", unit: "rooms" },
      { key: "ceiling_height", label: "Ceiling Height", type: "select", options: ["Standard 8ft", "9ft", "10ft+", "Vaulted"] },
    ],
    tierHints: {
      good: ["2 coats flat/eggshell finish", "Standard prep & patch", "Walls only"],
      better: ["2 coats satin finish", "Full prep & prime", "Walls + ceiling", "Closets included", "Trim cut-in included"],
      best: ["2 coats premium paint (Sherwin ProClassic)", "Full prep + skim coat where needed", "Walls + ceiling + trim + closets", "Accent wall option", "5-year workmanship warranty"]
    }
  },
  "Drywall": { icon: "🧱", types: ["Drywall Patch (small)", "Drywall Patch (large)", "Drywall Install – Room", "Texture Matching"],
    materialFields: [
      { key: "sqft", label: "Square Footage", placeholder: "200", unit: "sq ft", required: true },
      { key: "holes", label: "Damage Areas", placeholder: "3", unit: "holes" },
      { key: "texture", label: "Texture Match", type: "select", options: ["No texture", "Orange peel", "Knockdown", "Popcorn / custom"] },
    ],
    tierHints: {
      good: ["Patch & tape", "Feather sand to blend", "Ready to paint"],
      better: ["Patch + prime coat included", "Texture match", "Light sand & prime"],
      best: ["Full skim coat option", "Texture match + prime", "Paint-ready guarantee", "Warranty on settlement cracks"]
    }
  },
  "Flooring": { icon: "🪵", types: ["LVP / Laminate Install", "Hardwood Install", "Tile Install", "Carpet Install", "Subfloor Repair"],
    materialFields: [
      { key: "sqft", label: "Square Footage", placeholder: "400", unit: "sq ft", required: true },
      { key: "material_grade", label: "Material Grade", type: "select", options: ["Budget / builder grade", "Mid-grade", "Premium"], required: true },
      { key: "removal", label: "Remove Existing Floor?", type: "select", options: ["No", "Yes – simple", "Yes – complex (tile/glue)"] },
    ],
    tierHints: {
      good: ["Install only (customer-supplied material)", "Basic subfloor prep", "Transitions included"],
      better: ["Material included – mid-grade", "Subfloor leveling", "Quarter round & transitions"],
      best: ["Premium material included", "Full subfloor prep", "Stair nosing, thresholds, transitions", "5-year install warranty"]
    }
  },
  "Carpentry": { icon: "🔨", types: ["Door Install / Replace", "Window Install / Replace", "Trim / Crown Molding", "Deck Build / Repair", "Fence Build / Repair", "Shelving / Built-ins"],
    materialFields: [
      { key: "linear_ft", label: "Linear Feet", placeholder: "60", unit: "ln ft" },
      { key: "door_count", label: "Door / Window Count", placeholder: "2", unit: "units" },
      { key: "wood_grade", label: "Wood Grade", type: "select", options: ["Standard / PT", "Premium / Cedar", "Composite / PVC"] },
    ],
    tierHints: {
      good: ["Standard material", "Basic install", "Caulk & nail fill"],
      better: ["Premium material", "Full install + paint-ready prep", "Hardware included"],
      best: ["Top-grade material", "Full install, caulk, prime, paint", "Lifetime workmanship warranty"]
    }
  },
  "Plumbing (Minor)": { icon: "🔧", types: ["Fixture Replace (faucet/toilet)", "Drain Repair / Unclog", "Supply Line Repair", "Water Heater (minor)"],
    materialFields: [
      { key: "fixture_count", label: "Number of Fixtures", placeholder: "1", unit: "fixtures", required: true },
      { key: "fixture_grade", label: "Fixture Grade", type: "select", options: ["Builder / basic", "Mid-range (Moen/Delta)", "Premium (Kohler/etc)"] },
    ],
    tierHints: {
      good: ["Labor only (customer-supplied fixture)", "Standard supply lines"],
      better: ["Mid-grade fixture included", "New supply lines & shutoffs"],
      best: ["Premium fixture included", "Full inspection of surrounding area", "1-year labor warranty"]
    }
  },
  "Exterior / General": { icon: "🏠", types: ["Pressure Washing", "Gutter Clean / Repair", "Junk Removal / Hauling", "General Punch List", "HVAC Filter / Basic Maint."],
    materialFields: [
      { key: "sqft", label: "Area / Square Footage", placeholder: "1200", unit: "sq ft" },
      { key: "access", label: "Access Difficulty", type: "select", options: ["Easy – ground level", "Moderate – ladder work", "Difficult – high / confined"] },
    ],
    tierHints: {
      good: ["Basic service", "Standard equipment", "Area clean-up"],
      better: ["Thorough service", "Chemical treatment where applicable", "Full clean-up & haul"],
      best: ["Premium service + inspection", "All consumables included", "Before & after photos", "Annual maintenance discount offered"]
    }
  },
};

const MARGIN_PRESETS = [
  { label: "Survival", value: 20, color: "#e85050" },
  { label: "Competitive", value: 30, color: "#e8a020" },
  { label: "Healthy", value: 38, color: "#7ab87a" },
  { label: "Premium", value: 50, color: "#f5c842" },
];
const CREW_OPTIONS = [{ label: "Solo", men: 1 },{ label: "2-Man", men: 2 },{ label: "3-Man", men: 3 },{ label: "4-Man", men: 4 }];

function currency(n, decimals=0) {
  return "$" + Number(n||0).toLocaleString("en-US",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
}
function round(n,step=0.5){return Math.round(n/step)*step;}

async function callClaude(messages, system, useSearch=false) {
  const body = { model:"claude-sonnet-4-20250514", max_tokens:1800, system, messages };
  if (useSearch) body.tools = [{type:"web_search_20250305",name:"web_search"}];
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  try {
    const res = await fetch("/api/claude",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body),
      signal:controller.signal
    });
    clearTimeout(timeout);
    
    if (!res.ok) {
      const errText = await res.text();
      console.error("API error:", res.status, errText);
      throw new Error(`API returned ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.error) {
      console.error("Claude error:", data.error);
      throw new Error(data.error);
    }
    
    return data.content?.map(b=>b.text||"").filter(Boolean).join("\n")||"";
  } catch(e) {
    clearTimeout(timeout);
    console.error("callClaude failed:", e.message);
    throw e;
  }
}

function parseJSON(text) {
  const clean = text.replace(/```json|```/g,"").trim();
  const s=clean.indexOf("{"), e=clean.lastIndexOf("}");
  if(s<0||e<0) throw new Error("no json");
  return JSON.parse(clean.slice(s,e+1));
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
const IS = { width:"100%", background:"#13151f", border:"1px solid #2a2d3a", borderRadius:8, color:"#e8e0d0", padding:"10px 12px", fontSize:14, fontFamily:"'Source Sans 3',sans-serif", transition:"border-color 0.2s", outline:"none" };

function Spinner({label}) {
  return <div style={{display:"flex",alignItems:"center",gap:10,color:"#7a7d8a"}}>
    <div style={{width:16,height:16,border:"2px solid #2a2d3a",borderTop:"2px solid #f5c842",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>
    <span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:12,fontStyle:"italic"}}>{label}</span>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

function Tag({color,children}) {
  return <span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,background:color+"22",border:`1px solid ${color}55`,color,fontFamily:"'Source Sans 3',sans-serif",fontSize:11}}>{children}</span>;
}

function Field({label,required,hint,children}) {
  return <div style={{marginBottom:16}}>
    <label style={{display:"flex",alignItems:"center",gap:6,fontFamily:"'Source Sans 3',sans-serif",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:"#9a9daa",marginBottom:6}}>
      {label}{required&&<span style={{color:"#f5c842"}}>*</span>}
    </label>
    {children}
    {hint&&<div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:"#5a5d6a",marginTop:3}}>{hint}</div>}
  </div>;
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage({settings,setSettings,onBack}) {
  const [ts,setTs] = useState(settings.testimonials||[]);
  const [why,setWhy] = useState(settings.whyUs||[["Licensed & Fully Insured","General liability and workman's comp on every job."],["5-Star Track Record","Dozens of verified reviews from homeowners across Central KY."],["Detailed Written Proposals","No surprises — every scope, cost, and exclusion in writing."],["Veteran Craftsmanship","Decades of hands-on trade experience."],["Clean Jobsite Guarantee","We leave your property cleaner than we found it."],["Same-Day Callbacks","Responsive, on-time, and transparent throughout."]]);
  const [terms,setTerms] = useState(settings.terms||["50% deposit required to schedule. Balance due upon completion.","Quote valid for 30 days from proposal date.","Work outside listed scope requires a written change order.","We carry general liability insurance. Certificate available on request.","Client responsible for relocating personal items prior to work start."]);

  function addTestimonial(){setTs([...ts,{name:"",text:"",job:"",rating:5}]);}
  function removeT(i){setTs(ts.filter((_,j)=>j!==i));}
  function updateT(i,k,v){const n=[...ts];n[i]={...n[i],[k]:v};setTs(n);}
  function save(){setSettings({...settings,testimonials:ts,whyUs:why,terms});onBack();}

  return <div className="fu" style={{maxWidth:780,margin:"0 auto",padding:"20px 16px 60px"}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
      <button onClick={onBack} style={{background:"transparent",border:"1px solid #2a2d3a",borderRadius:8,color:"#7a7d8a",padding:"7px 14px",fontFamily:"'Source Sans 3',sans-serif",fontSize:13,cursor:"pointer"}}>← Back</button>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#f0e8d8"}}>Company Settings</div>
    </div>

    {/* Company Info */}
    <SBlock title="🏢 Company Information">
      {[["name","Company Name","Central Kentucky Building Maintenance Specialists"],["tagline","Tagline / Slogan","Licensed • Insured • 5-Star Rated"],["phone","Phone Number","(859) 555-0100"],["email","Email Address","info@ckbms.com"],["address","Address","Richmond, KY 40475"],["website","Website","www.ckbms.com"],["license","License Number",""],["proposal_prefix","Proposal # Prefix","CKBMS-"]].map(([k,lbl,ph])=>(
        <Field key={k} label={lbl}>
          <input value={settings[k]||""} onChange={e=>setSettings({...settings,[k]:e.target.value})} placeholder={ph} style={IS}/>
        </Field>
      ))}
    </SBlock>

    {/* Why Us */}
    <SBlock title="🏆 Why Choose Us (6 bullet points shown on proposals)">
      {why.map((item,i)=>(
        <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10,marginBottom:10}}>
          <input value={item[0]} onChange={e=>{const n=[...why];n[i]=[e.target.value,n[i][1]];setWhy(n);}} placeholder={`Benefit ${i+1}`} style={{...IS,fontSize:13}}/>
          <input value={item[1]} onChange={e=>{const n=[...why];n[i]=[n[i][0],e.target.value];setWhy(n);}} placeholder="Short description" style={{...IS,fontSize:13}}/>
        </div>
      ))}
    </SBlock>

    {/* Testimonials */}
    <SBlock title="★ Customer Testimonials">
      <p style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:13,color:"#7a7d8a",marginBottom:16,marginTop:0}}>Up to 6 testimonials appear on every PDF proposal. These build trust before you even show up.</p>
      {ts.map((t,i)=>(
        <div key={i} style={{background:"#0d0f18",border:"1px solid #1e2130",borderRadius:10,padding:14,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:"#f5c842",fontWeight:700}}>Testimonial #{i+1}</span>
            <button onClick={()=>removeT(i)} style={{background:"transparent",border:"none",color:"#e85050",cursor:"pointer",fontSize:16}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <input value={t.name} onChange={e=>updateT(i,"name",e.target.value)} placeholder="Customer Name" style={{...IS,fontSize:13}}/>
            <input value={t.job} onChange={e=>updateT(i,"job",e.target.value)} placeholder="Job Type (e.g. Painting)" style={{...IS,fontSize:13}}/>
          </div>
          <textarea value={t.text} onChange={e=>updateT(i,"text",e.target.value)} placeholder="What they said about your work..." rows={2} style={{...IS,resize:"vertical",lineHeight:1.6,fontSize:13}}/>
        </div>
      ))}
      {ts.length<6&&<button onClick={addTestimonial} style={{padding:"9px 18px",background:"rgba(245,200,66,0.1)",border:"1px solid #f5c842",borderRadius:8,color:"#f5c842",fontFamily:"'Source Sans 3',sans-serif",fontSize:13,cursor:"pointer"}}>+ Add Testimonial</button>}
    </SBlock>

    {/* Terms */}
    <SBlock title="📝 Proposal Terms (appear on every PDF)">
      {terms.map((t,i)=>(
        <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
          <textarea value={t} onChange={e=>{const n=[...terms];n[i]=e.target.value;setTerms(n);}} rows={2} style={{...IS,flex:1,resize:"vertical",fontSize:13,lineHeight:1.5}}/>
          <button onClick={()=>setTerms(terms.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:"#e85050",cursor:"pointer",fontSize:16,alignSelf:"center"}}>✕</button>
        </div>
      ))}
      <button onClick={()=>setTerms([...terms,""])} style={{padding:"7px 14px",background:"transparent",border:"1px solid #2a2d3a",borderRadius:8,color:"#7a7d8a",fontFamily:"'Source Sans 3',sans-serif",fontSize:12,cursor:"pointer"}}>+ Add Term</button>
    </SBlock>

    <button onClick={save} style={{width:"100%",padding:14,background:"linear-gradient(135deg,#f5c842,#e8a020)",border:"none",borderRadius:10,fontFamily:"'Source Sans 3',sans-serif",fontSize:15,fontWeight:700,color:"#0d0f18",cursor:"pointer",marginTop:8}}>
      ✓ Save Settings
    </button>
  </div>;
}

function SBlock({title,children}) {
  return <div style={{background:"#13151f",border:"1px solid #1e2130",borderRadius:12,overflow:"hidden",marginBottom:20}}>
    <div style={{padding:"11px 16px",borderBottom:"1px solid #1e2130",fontFamily:"'Source Sans 3',sans-serif",fontSize:12,textTransform:"uppercase",letterSpacing:"0.1em",color:"#9a9daa"}}>{title}</div>
    <div style={{padding:16}}>{children}</div>
  </div>;
}

// ─── Tier Builder ─────────────────────────────────────────────────────────────
function TierBuilder({jobType,category,basePrice,tiers,setTiers,loadingTiers,onFetch}) {
  const hints = JOB_CATEGORIES[category]?.tierHints||{};
  const configs = [
    {key:"good", label:"GOOD", color:"#5A7A9A", bg:"rgba(90,122,154,0.08)", desc:"Competitive – core scope only"},
    {key:"better", label:"BETTER", color:"#C8960A", bg:"rgba(200,150,10,0.08)", badge:"⭐ Most Popular", desc:"Healthy margin – full service"},
    {key:"best", label:"BEST", color:"#2E7D32", bg:"rgba(46,125,50,0.08)", badge:"💎 Premium", desc:"Premium – maximum value"},
  ];

  return <div style={{background:"#13151f",border:"1px solid #1e2130",borderRadius:12,overflow:"hidden",marginBottom:20}}>
    <div style={{padding:"12px 16px",borderBottom:"1px solid #1e2130",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span>📦</span>
        <span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:"#7a7d8a"}}>Good / Better / Best Packages</span>
        {!loadingTiers&&tiers.good.price&&<Tag color="#7ab87a">AI Generated</Tag>}
      </div>
      <button onClick={onFetch} disabled={!jobType||loadingTiers}
        style={{padding:"5px 14px",background:!jobType||loadingTiers?"transparent":"rgba(245,200,66,0.1)",border:`1px solid ${!jobType||loadingTiers?"#2a2d3a":"#f5c842"}`,borderRadius:8,color:!jobType||loadingTiers?"#3a3d4a":"#f5c842",fontFamily:"'Source Sans 3',sans-serif",fontSize:12,fontWeight:600,cursor:!jobType||loadingTiers?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6}}>
        {loadingTiers?<><div style={{width:10,height:10,border:"1.5px solid #f5c842",borderTop:"1.5px solid transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>Building...</>:"🤖 AI Build Tiers"}
      </button>
    </div>
    <div style={{padding:16}}>
      {loadingTiers&&<Spinner label="Building Good / Better / Best packages with market pricing..."/>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {configs.map(cfg=>{
          const tier = tiers[cfg.key]||{};
          const hint = hints[cfg.key]||[];
          return <div key={cfg.key} style={{background:cfg.bg,border:`1px solid ${cfg.color}44`,borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"9px 12px",background:cfg.color,display:"flex",flexDirection:"column",gap:2}}>
              <span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:12,fontWeight:700,color:"#fff",textAlign:"center"}}>{cfg.label}{cfg.badge?` · ${cfg.badge}`:""}</span>
              <span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:9,color:"rgba(255,255,255,0.7)",textAlign:"center"}}>{cfg.desc}</span>
            </div>
            <div style={{padding:10}}>
              <Field label="Package Price">
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#7a7d8a",fontSize:14}}>$</span>
                  <input type="number" value={tier.price||""} onChange={e=>setTiers({...tiers,[cfg.key]:{...tier,price:e.target.value}})} placeholder="0" style={{...IS,paddingLeft:24,color:cfg.color,fontWeight:700,fontSize:15}}/>
                </div>
              </Field>
              <Field label="Features (one per line)" hint={hint.length?"Suggested below":""}>
                <textarea
                  value={tier.featuresText||(hint.join("\n")||"")}
                  onChange={e=>setTiers({...tiers,[cfg.key]:{...tier,featuresText:e.target.value,features:e.target.value.split("\n").filter(f=>f.trim())}})}
                  rows={5} style={{...IS,resize:"vertical",lineHeight:1.6,fontSize:12}}
                  placeholder={hint.join("\n")||"List what's included..."}
                />
              </Field>
            </div>
          </div>;
        })}
      </div>
      {!tiers.good.price&&!loadingTiers&&<div style={{marginTop:8,padding:"8px 12px",background:"rgba(245,200,66,0.05)",border:"1px solid rgba(245,200,66,0.15)",borderRadius:8,fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:"#c8b870"}}>
        💡 Click "AI Build Tiers" to auto-generate prices and features based on your job and market data — then edit freely.
      </div>}
    </div>
  </div>;
}

// ─── Hours Estimator (compact) ────────────────────────────────────────────────
// ─── Labor hour defaults by job type ─────────────────────────────────────────
const HOUR_DEFAULTS = {
  "Interior Painting – Room(s)":    {low:3,mid:5,high:8,prep:1,work:3,cleanup:0.5,drive:0.5,rate:"150 sq ft per hour"},
  "Interior Painting – Whole House":{low:16,mid:24,high:40,prep:4,work:16,cleanup:2,drive:1,rate:"150 sq ft per hour"},
  "Exterior Painting":              {low:8,mid:16,high:32,prep:3,work:10,cleanup:1,drive:1,rate:"100 sq ft per hour"},
  "Cabinet Painting":               {low:6,mid:10,high:16,prep:2,work:7,cleanup:0.5,drive:0.5,rate:"8-10 cabinets per day"},
  "Deck / Fence Staining":          {low:4,mid:8,high:16,prep:2,work:5,cleanup:0.5,drive:0.5,rate:"200 sq ft per hour"},
  "Drywall Patch (small)":          {low:1,mid:2,high:4,prep:0.5,work:1,cleanup:0.5,drive:0.5,rate:"1-3 patches per hour"},
  "Drywall Patch (large)":          {low:3,mid:6,high:10,prep:1,work:4,cleanup:0.5,drive:0.5,rate:"50 sq ft per hour"},
  "Drywall Install – Room":         {low:6,mid:10,high:16,prep:1,work:7,cleanup:1,drive:0.5,rate:"80 sq ft per hour"},
  "Texture Matching":               {low:2,mid:4,high:8,prep:0.5,work:3,cleanup:0.5,drive:0.5,rate:"varies by texture"},
  "LVP / Laminate Install":         {low:4,mid:8,high:14,prep:1,work:6,cleanup:0.5,drive:0.5,rate:"200 sq ft per hour"},
  "Hardwood Install":               {low:6,mid:12,high:20,prep:1,work:9,cleanup:1,drive:0.5,rate:"150 sq ft per hour"},
  "Tile Install":                   {low:6,mid:12,high:20,prep:2,work:8,cleanup:1,drive:0.5,rate:"50 sq ft per hour"},
  "Carpet Install":                 {low:3,mid:6,high:10,prep:1,work:4,cleanup:0.5,drive:0.5,rate:"300 sq ft per hour"},
  "Subfloor Repair":                {low:3,mid:6,high:12,prep:1,work:4,cleanup:0.5,drive:0.5,rate:"varies"},
  "Door Install / Replace":         {low:1,mid:2,high:4,prep:0.5,work:1.5,cleanup:0.5,drive:0.5,rate:"1-2 doors per day"},
  "Window Install / Replace":       {low:2,mid:3,high:6,prep:0.5,work:2,cleanup:0.5,drive:0.5,rate:"2-3 windows per day"},
  "Trim / Crown Molding":           {low:3,mid:6,high:10,prep:1,work:4,cleanup:0.5,drive:0.5,rate:"30 ln ft per hour"},
  "Deck Build / Repair":            {low:8,mid:16,high:32,prep:2,work:12,cleanup:1,drive:0.5,rate:"50 sq ft per day"},
  "Fence Build / Repair":           {low:4,mid:8,high:16,prep:1,work:6,cleanup:0.5,drive:0.5,rate:"20 ln ft per hour"},
  "Shelving / Built-ins":           {low:3,mid:6,high:12,prep:1,work:4,cleanup:0.5,drive:0.5,rate:"varies"},
  "Fixture Replace (faucet/toilet)":{low:1,mid:2,high:3,prep:0.5,work:1,cleanup:0.5,drive:0.5,rate:"1-2 fixtures per day"},
  "Drain Repair / Unclog":          {low:0.5,mid:1,high:2,prep:0,work:0.5,cleanup:0.5,drive:0.5,rate:"1-2 hours typical"},
  "Supply Line Repair":             {low:1,mid:2,high:3,prep:0.5,work:1,cleanup:0.5,drive:0.5,rate:"1-2 hours typical"},
  "Water Heater (minor)":           {low:1,mid:2,high:4,prep:0.5,work:1,cleanup:0.5,drive:0.5,rate:"varies"},
  "Pressure Washing":               {low:2,mid:4,high:8,prep:0.5,work:3,cleanup:0.5,drive:0.5,rate:"500 sq ft per hour"},
  "Gutter Clean / Repair":          {low:1,mid:2,high:4,prep:0.5,work:1,cleanup:0.5,drive:0.5,rate:"100 ln ft per hour"},
  "Junk Removal / Hauling":         {low:2,mid:4,high:8,prep:0.5,work:3,cleanup:0.5,drive:0.5,rate:"varies by volume"},
  "General Punch List":             {low:2,mid:4,high:8,prep:0.5,work:3,cleanup:0.5,drive:0.5,rate:"varies by items"},
  "HVAC Filter / Basic Maint.":     {low:0.5,mid:1,high:2,prep:0,work:0.5,cleanup:0.5,drive:0.5,rate:"30-60 min typical"},
};

function HoursEstimator({jobType,jobDesc,matFields,hours,setHours,crewSize,setCrewSize}) {
  const [est,setEst]=useState(null);
  const [loading,setLoading]=useState(false);
  const [userEdited,setUserEdited]=useState(false);
  const totalH=Number(hours||0);
  const hpw=crewSize>0?round(totalH/crewSize):totalH;
  const days=(hpw/8).toFixed(1);

  // Auto-populate from defaults when job type changes
  useState(()=>{
    if(jobType && !userEdited && !hours) {
      const def = HOUR_DEFAULTS[jobType];
      if(def) {
        const sqft = Number(matFields?.sqft||0);
        // Scale hours by sqft if available
        let mid = def.mid;
        if(sqft > 0 && def.rate.includes("sq ft")) {
          const rateMatch = def.rate.match(/(\d+)/);
          if(rateMatch) {
            const sqftPerHr = Number(rateMatch[1]);
            mid = Math.max(def.low, Math.min(def.high, Math.round((sqft / sqftPerHr) * 2) / 2));
          }
        }
        setEst({
          totalManHoursLow:def.low, totalManHoursHigh:def.high, totalManHoursMid:mid,
          productivityRate:def.rate, prepTime:def.prep, workTime:def.work,
          cleanupTime:def.cleanup, driveTime:def.drive,
          historicalNote:"Based on industry standard RSMeans / Craftsman labor productivity rates for Central KY."
        });
        setHours(String(mid));
      }
    }
  },[jobType]);

  async function getAIEstimate() {
    setLoading(true);
    
    // First show defaults immediately so user always sees something
    const def = HOUR_DEFAULTS[jobType];
    if(def && !est) {
      const sqft = Number(matFields?.sqft||0);
      let mid = def.mid;
      if(sqft > 0 && def.rate.includes("sq ft")) {
        const rateMatch = def.rate.match(/(\d+)/);
        if(rateMatch) {
          const sqftPerHr = Number(rateMatch[1]);
          mid = Math.max(def.low, Math.min(def.high, Math.round((sqft / sqftPerHr) * 2) / 2));
        }
      }
      const defaultEst = {
        totalManHoursLow:def.low, totalManHoursHigh:def.high, totalManHoursMid:mid,
        productivityRate:def.rate, prepTime:def.prep, workTime:def.work,
        cleanupTime:def.cleanup, driveTime:def.drive,
        historicalNote:"Industry standard rates. Fetching AI refinement..."
      };
      setEst(defaultEst);
      if(!userEdited) setHours(String(mid));
    }

    // Then try to get AI refinement
    try {
      const text = await callClaude([{role:"user",content:`Estimate labor hours for this contractor job in Central Kentucky:
Job Type: ${jobType}
Description: ${jobDesc||"standard job"}
Specs: ${JSON.stringify(matFields)}

Return ONLY valid JSON with no markdown:
{"totalManHoursLow":number,"totalManHoursHigh":number,"totalManHoursMid":number,"productivityRate":"string like 150 sq ft per hour","prepTime":number,"workTime":number,"cleanupTime":number,"driveTime":0.5,"historicalNote":"one sentence about industry standards for this job type"}`}],
        "Construction labor estimating expert. Use RSMeans and Craftsman cost data. Return valid JSON only. No markdown.", false);
      
      const p = parseJSON(text);
      if(p && p.totalManHoursMid && p.totalManHoursMid > 0) {
        setEst(p);
        if(!userEdited) setHours(String(p.totalManHoursMid));
      }
    } catch(e) {
      console.log("AI hours estimate failed, using industry defaults:", e.message);
      // Already set defaults above, just update the note
      setEst(prev => prev ? {...prev, historicalNote:"Industry standard rates from RSMeans/Craftsman data. Edit as needed."} : prev);
    }
    setLoading(false);
  }

  return <div style={{background:"#13151f",border:"1px solid #1e2130",borderRadius:12,overflow:"hidden",marginBottom:20}}>
    <div style={{padding:"12px 16px",borderBottom:"1px solid #1e2130",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span>⏱️</span><span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:"#7a7d8a"}}>Labor Time Estimator</span>
        {est?.totalManHoursMid&&!loading&&<Tag color="#7ab87a">AI Prefilled</Tag>}
      </div>
      <button onClick={getAIEstimate} disabled={!jobType||loading} style={{padding:"5px 14px",background:!jobType||loading?"transparent":"rgba(245,200,66,0.1)",border:`1px solid ${!jobType||loading?"#2a2d3a":"#f5c842"}`,borderRadius:8,color:!jobType||loading?"#3a3d4a":"#f5c842",fontFamily:"'Source Sans 3',sans-serif",fontSize:12,fontWeight:600,cursor:!jobType||loading?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6}}>
        {loading?<><div style={{width:10,height:10,border:"1.5px solid #f5c842",borderTop:"1.5px solid transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>Searching...</>:est?"🔄 Re-fetch":"🔍 Get AI Estimate"}
      </button>
    </div>
    <div style={{padding:16}}>
      {loading&&<div style={{marginBottom:12}}><Spinner label="Searching industry labor databases..."/></div>}
      {est?.totalManHoursLow!=null&&<div style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:"#7a7d8a",textTransform:"uppercase",letterSpacing:"0.07em"}}>Industry range</span>
          <span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:"#5a5d6a"}}>{est.totalManHoursLow}h – {est.totalManHoursMid}h – {est.totalManHoursHigh}h</span>
        </div>
        <div style={{height:8,background:"#0d0f18",borderRadius:4,overflow:"hidden",position:"relative"}}>
          <div style={{position:"absolute",left:`${(est.totalManHoursLow/(est.totalManHoursHigh*1.2))*100}%`,width:`${((est.totalManHoursHigh-est.totalManHoursLow)/(est.totalManHoursHigh*1.2))*100}%`,height:"100%",background:"linear-gradient(90deg,rgba(122,184,122,0.4),rgba(245,200,66,0.6),rgba(232,160,32,0.4))",borderRadius:4}}/>
        </div>
        {est.productivityRate&&<div style={{marginTop:6,fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:"#c8b870"}}>📐 {est.productivityRate}</div>}
        {est.historicalNote&&<div style={{marginTop:4,fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:"#8aaccc",lineHeight:1.5}}>📚 {est.historicalNote}</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginTop:10}}>
          {[["Prep",est.prepTime,"#5a7a9a"],["Work",est.workTime,"#7ab87a"],["Cleanup",est.cleanupTime,"#9a7a5a"],["Drive",est.driveTime,"#7a6a9a"]].map(([l,h,c])=>(
            <div key={l} style={{padding:"6px 4px",background:"#0d0f18",borderRadius:6,textAlign:"center",border:`1px solid ${c}33`}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:c,fontWeight:700}}>{h||0}h</div>
              <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:9,color:"#5a5d6a",textTransform:"uppercase",marginTop:1}}>{l}</div>
            </div>
          ))}
        </div>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Field label="Total Man-Hours" required hint="AI prefilled · edit freely · required to proceed">
          <div style={{position:"relative"}}>
            <input type="number" value={hours} onChange={e=>{setHours(e.target.value);setUserEdited(true);}} placeholder="e.g. 8" style={IS} min={0.5} step={0.5}/>
            {est?.totalManHoursMid&&Number(hours)!==est.totalManHoursMid&&<button title="Reset to AI estimate" onClick={()=>{setHours(String(est.totalManHoursMid));setUserEdited(false);}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#f5c842",cursor:"pointer",fontSize:14,padding:0}}>↩</button>}
          </div>
        </Field>
        <Field label="Crew Size">
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,height:42}}>
            {CREW_OPTIONS.map(c=><button key={c.men} onClick={()=>setCrewSize(c.men)} style={{borderRadius:7,background:crewSize===c.men?"rgba(245,200,66,0.15)":"#0d0f18",border:`1px solid ${crewSize===c.men?"#f5c842":"#2a2d3a"}`,color:crewSize===c.men?"#f5c842":"#7a7d8a",fontFamily:"'Source Sans 3',sans-serif",fontSize:12,fontWeight:crewSize===c.men?700:400,cursor:"pointer"}}>{c.label}</button>)}
          </div>
        </Field>
      </div>
      {Number(hours)>0&&<div style={{background:"linear-gradient(135deg,rgba(245,200,66,0.08),rgba(245,200,66,0.02))",border:"1px solid rgba(245,200,66,0.2)",borderRadius:10,padding:"10px 14px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,textAlign:"center"}}>
        {[[`${totalH}h`,"Total Man-Hours"],[`${crewSize}×${hpw}h`,crewSize===1?"Solo":`${crewSize}-Man Crew`],[`${days}d`,"Days On Site"]].map(([v,l])=>(
          <div key={l}><div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#f5c842"}}>{v}</div><div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:10,color:"#7a7d8a",textTransform:"uppercase",marginTop:1}}>{l}</div></div>
        ))}
      </div>}
      {!est&&!loading&&jobType&&<div style={{marginTop:8,padding:"8px 12px",background:"rgba(245,200,66,0.06)",border:"1px solid rgba(245,200,66,0.2)",borderRadius:8,fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:"#c8b870"}}>
        💡 Tap <strong>"Get AI Estimate"</strong> to auto-fill from industry data — or type hours directly. Hours are required to proceed.
      </div>}
      {jobType&&!hours&&<div style={{marginTop:10,padding:"10px 14px",background:"rgba(245,200,66,0.07)",border:"1px solid rgba(245,200,66,0.25)",borderRadius:10,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:13,color:"#c8b870"}}>⏱️ Or enter hours manually:</span>
        <input type="number" value={hours} onChange={e=>setHours(e.target.value)} placeholder="e.g. 4" min={0.5} step={0.5} style={{...IS,width:90}}/>
      </div>}
    </div>
  </div>;
}

// ─── PDF Generator ─────────────────────────────────────────────────────────────
async function generateProposalPDF(payload) {
  // Build PDF content via Claude, then format as printable HTML
  const prompt = `You are building a professional contractor proposal. Given this data, generate a complete JSON for the proposal. Return ONLY valid JSON:

Job: ${payload.job.job_type}
Client: ${payload.job.client}
Address: ${payload.job.address}
Description: ${payload.job.description}
Hours: ${payload.job.hours} total man-hours, ${payload.job.crew_desc}
Recommended bid: ${payload.tiers.better?.price || "TBD"}
Market range: ${payload.marketRange || ""}

Generate:
{
  "intro": "2-sentence professional intro",
  "line_items": ["item1", "item2", "item3", "item4", "item5", "item6"],
  "exclusions": ["excl1", "excl2", "excl3"],
  "timeline": "estimated timeline string",
  "warranty": "warranty statement",
  "closing": "one sentence professional closing"
}`;

  const text = await callClaude([{role:"user",content:prompt}],
    "You are a professional contractor proposal writer. Return valid JSON only.");
  try { return parseJSON(text); }
  catch { return { intro:"Thank you for the opportunity.", line_items:["Work as described"], exclusions:["Items not listed"], timeline:"TBD", warranty:"Satisfaction guaranteed", closing:"We look forward to serving you." }; }
}

// ─── Print-Ready HTML PDF Builder ─────────────────────────────────────────────
function buildPrintHTML(payload, scopeData, settings) {
  const co = settings || {};
  const job = payload.job || {};
  const tiers = payload.tiers || {};
  const testimonials = (co.testimonials || []).slice(0, 6);
  const why = co.whyUs || [];
  const terms = co.terms || [];
  const date = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const proposalNum = `${co.proposal_prefix||"CKBMS-"}${String(Math.floor(Math.random()*9000)+1000)}`;

  const tierConfig = [
    {key:"good",label:"GOOD",color:"#1E3A5F",bg:"#EBF2FA",badge:""},
    {key:"better",label:"BETTER",color:"#C8960A",bg:"#FDF8EE",badge:"⭐ MOST POPULAR"},
    {key:"best",label:"BEST",color:"#2E7D32",bg:"#E8F5E9",badge:"💎 PREMIUM"},
  ];

  const maxFeats = Math.max(...tierConfig.map(c=>(tiers[c.key]?.features||[]).length));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Proposal ${proposalNum}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Sans+3:wght@300;400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Source Sans 3',Arial,sans-serif;font-size:10pt;color:#222;background:#fff;width:8.5in;margin:0 auto}
  @media print{body{width:100%}@page{margin:0.5in;size:letter}}
  .page{min-height:11in;page-break-after:always;padding:0.5in 0.55in}
  .page:last-child{page-break-after:auto}
  /* Header */
  .header{background:#1A1D27;color:#fff;padding:18px 22px;margin:-0.5in -0.55in 0.3in;display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #C8960A}
  .header-left .company-name{font-family:'Playfair Display',serif;font-size:18pt;font-weight:900;color:#F5C842;letter-spacing:-0.5px}
  .header-left .tagline{font-size:9pt;color:#aaa;margin-top:2px}
  .header-right{text-align:right;font-size:8.5pt;color:#aaa;line-height:1.7}
  /* Meta */
  .meta-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px}
  .meta-box{padding:12px 14px;border-radius:6px}
  .meta-box.blue{background:#EBF4FF;border:1px solid #90CAF9}
  .meta-box.gold{background:#FDF8EE;border:1px solid #E0D5B0}
  .meta-box .meta-label{font-size:7.5pt;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-bottom:4px}
  .meta-box .client-name{font-size:14pt;font-weight:700;color:#1A1D27;font-family:'Playfair Display',serif}
  .meta-box .meta-val{font-size:9.5pt;color:#444;line-height:1.6}
  /* Section headers */
  .sec-header{background:#1E3A5F;color:#fff;padding:7px 12px;border-radius:4px 4px 0 0;font-size:9pt;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0}
  /* Tiers */
  .tiers-grid{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #ddd;border-radius:0 0 6px 6px;overflow:hidden;margin-bottom:14px}
  .tier-col{border-right:1px solid #ddd}
  .tier-col:last-child{border-right:none}
  .tier-head{padding:9px 8px;text-align:center;color:#fff;font-weight:700;font-size:10pt}
  .tier-badge{font-size:7.5pt;font-weight:400;color:rgba(255,255,255,0.75);display:block}
  .tier-price{padding:10px 8px;text-align:center;font-size:18pt;font-weight:700;border-bottom:1px solid #ddd}
  .tier-feat{padding:5px 10px;font-size:8.5pt;color:#333;border-bottom:1px solid #f0f0f0;line-height:1.4}
  .tier-feat .check{color:#2E7D32;margin-right:4px}
  .tier-cta{padding:8px;text-align:center;font-size:8.5pt;font-weight:700;color:#fff}
  /* Selection box */
  .selection-box{border:1.5px solid #C8960A;background:#FDF8EE;border-radius:6px;padding:12px 14px;margin-bottom:16px}
  .selection-box h4{font-size:9pt;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:8px}
  .select-row{display:flex;align-items:center;gap:24px;font-size:9.5pt;color:#333;margin-bottom:8px}
  .sig-row{display:grid;grid-template-columns:2fr 1fr;gap:20px}
  .sig-line{border-bottom:1px solid #999;padding-top:20px;font-size:8.5pt;color:#888}
  /* Scope */
  .scope-table{width:100%;border-collapse:collapse;margin-bottom:12px}
  .scope-table td{padding:5px 10px;font-size:9pt;border-bottom:1px solid #f0f0f0;vertical-align:top}
  .scope-table td:first-child{width:20px;color:#1E3A5F;font-weight:700}
  .scope-table tr:nth-child(even) td{background:#F7F9FC}
  .excl-box{background:#FFF8F0;border:1px solid #E8A020;border-radius:6px;padding:10px 12px;margin-bottom:14px}
  .excl-box h4{font-size:8pt;text-transform:uppercase;letter-spacing:0.08em;color:#E65100;margin-bottom:6px}
  .excl-item{font-size:8.5pt;color:#555;line-height:1.7}
  /* Footer */
  .footer{background:#1A1D27;color:#aaa;padding:9px 22px;margin:0.3in -0.55in -0.5in;display:flex;justify-content:space-between;font-size:8pt;border-top:2px solid #C8960A}
  /* Page 2 */
  .why-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#ddd;border:1px solid #ddd;border-radius:6px;overflow:hidden;margin-bottom:16px}
  .why-cell{background:#fff;padding:10px 12px}
  .why-cell:nth-child(odd){background:#F7F7F7}
  .why-title{font-weight:700;font-size:9.5pt;color:#1E3A5F}
  .why-desc{font-size:8.5pt;color:#555;margin-top:2px;line-height:1.5}
  .testimonials-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px}
  .t-card{background:#FDF8EE;border:1px solid #E0D5B0;border-radius:6px;padding:10px}
  .t-stars{color:#F5C842;font-size:11pt;margin-bottom:4px}
  .t-text{font-size:8.5pt;font-style:italic;color:#444;line-height:1.5;margin-bottom:6px}
  .t-name{font-size:8.5pt;font-weight:700;color:#1A1D27}
  .t-job{font-size:8pt;color:#888}
  .terms-list{list-style:none;margin-bottom:16px}
  .terms-list li{font-size:8.5pt;color:#444;padding:4px 0;border-bottom:1px solid #f0f0f0;line-height:1.5}
  .terms-list li::before{content:"○  ";color:#888}
  .accept-box{border:2px solid #C8960A;background:#FDF8EE;border-radius:6px;padding:14px 16px;margin-bottom:14px}
  .accept-box h4{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1A1D27;margin-bottom:4px;border-bottom:1px solid #E0D5B0;padding-bottom:6px}
  .accept-intro{font-size:8.5pt;color:#555;margin-bottom:12px;line-height:1.5}
  .accept-grid{display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:10px}
  .closing-banner{background:#1A1D27;border-radius:6px;padding:14px;text-align:center;margin-top:14px}
  .closing-banner .big{font-family:'Playfair Display',serif;font-size:13pt;color:#F5C842;font-weight:700;margin-bottom:4px}
  .closing-banner .sub{font-size:8.5pt;color:#aaa}
  .proposal-header{background:#F7F9FC;border:1px solid #C8960A;border-radius:4px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
  .prop-label{font-size:8pt;text-transform:uppercase;letter-spacing:0.1em;color:#C8960A;font-weight:700}
  .prop-num{font-size:9pt;color:#666}
</style>
</head>
<body>

<!-- PAGE 1 -->
<div class="page">
  <div class="header">
    <div class="header-left">
      <div class="company-name">${co.name||"Central Kentucky Building Maintenance Specialists"}</div>
      <div class="tagline">${co.tagline||"Licensed • Insured • 5-Star Rated"}</div>
    </div>
    <div class="header-right">
      ${co.phone?`<div>${co.phone}</div>`:""}
      ${co.email?`<div>${co.email}</div>`:""}
      ${co.address?`<div>${co.address}</div>`:""}
      ${co.website?`<div>${co.website}</div>`:""}
      ${co.license?`<div>Lic # ${co.license}</div>`:""}
    </div>
  </div>

  <div class="proposal-header">
    <span class="prop-label">Professional Estimate</span>
    <span class="prop-num">Proposal ${proposalNum} &nbsp;·&nbsp; ${date}</span>
  </div>

  <div class="meta-row">
    <div class="meta-box blue">
      <div class="meta-label">Prepared For</div>
      <div class="client-name">${job.client||"Valued Client"}</div>
      <div class="meta-val">${job.address||""}</div>
      ${job.client_phone?`<div class="meta-val">${job.client_phone}</div>`:""}
    </div>
    <div class="meta-box gold">
      <div class="meta-label">Proposal Details</div>
      <div class="meta-val"><strong>Date:</strong> ${date}</div>
      <div class="meta-val"><strong>Valid Until:</strong> 30 days from date</div>
      <div class="meta-val"><strong>Job Type:</strong> ${job.job_type||""}</div>
      <div class="meta-val"><strong>Est. Labor:</strong> ${job.hours||""}h total · ${job.crew_desc||"1 worker"}</div>
      ${scopeData?.timeline?`<div class="meta-val"><strong>Timeline:</strong> ${scopeData.timeline}</div>`:""}
    </div>
  </div>

  ${scopeData?.intro?`<p style="font-size:9.5pt;color:#333;line-height:1.6;margin-bottom:14px;padding:10px 12px;background:#F7F9FC;border-radius:6px;border-left:3px solid #1E3A5F">${scopeData.intro}</p>`:""}

  <!-- TIERS -->
  <div class="sec-header">✅ &nbsp;CHOOSE YOUR PACKAGE</div>
  <div class="tiers-grid">
    ${tierConfig.map(cfg=>{
      const t = tiers[cfg.key]||{};
      const feats = t.features||[];
      return `<div class="tier-col">
        <div class="tier-head" style="background:${cfg.color}">${cfg.label}${cfg.badge?`<span class="tier-badge">${cfg.badge}</span>`:""}
        </div>
        <div class="tier-price" style="color:${cfg.color};background:${cfg.bg}">${t.price?"$"+Number(t.price).toLocaleString():"—"}</div>
        ${Array.from({length:maxFeats},(_,i)=>`<div class="tier-feat" style="background:${i%2===0?cfg.bg:"#fff"}">${feats[i]?`<span class="check">✓</span>${feats[i]}`:""}</div>`).join("")}
        <div class="tier-cta" style="background:${cfg.color}">Select ${cfg.label}</div>
      </div>`;
    }).join("")}
  </div>

  <div class="selection-box">
    <h4>Client Package Selection</h4>
    <div class="select-row">I select the &nbsp; ☐ GOOD &nbsp;&nbsp; ☐ BETTER &nbsp;&nbsp; ☐ BEST &nbsp; package for this project.</div>
    <div class="sig-row">
      <div class="sig-line">Client Signature</div>
      <div class="sig-line">Date</div>
    </div>
  </div>

  <div class="footer">
    <span>${co.name||"CKBMS"}  ·  Professional Estimate  ·  Confidential</span>
    <span>Page 1 of 2</span>
  </div>
</div>

<!-- PAGE 2 -->
<div class="page">
  <div class="header">
    <div class="header-left">
      <div class="company-name">${co.name||"Central Kentucky Building Maintenance Specialists"}</div>
      <div class="tagline">${co.tagline||"Licensed • Insured • 5-Star Rated"}</div>
    </div>
    <div class="header-right">
      ${co.phone?`<div>${co.phone}</div>`:""}
      ${co.email?`<div>${co.email}</div>`:""}
    </div>
  </div>

  <!-- Scope of Work -->
  <div class="sec-header">🔨 &nbsp;DETAILED SCOPE OF WORK</div>
  <table class="scope-table">
    ${(scopeData?.line_items||[]).map((item,i)=>`<tr><td>${i+1}</td><td>${item}</td></tr>`).join("")}
  </table>
  ${(scopeData?.exclusions||[]).length>0?`
  <div class="excl-box">
    <h4>⚠️ &nbsp;Not Included In This Proposal</h4>
    ${(scopeData.exclusions||[]).map(e=>`<div class="excl-item">— &nbsp;${e}</div>`).join("")}
  </div>`:""}

  <!-- Why Us -->
  <div class="sec-header">🏆 &nbsp;WHY CENTRAL KENTUCKY BUILDING MAINTENANCE SPECIALISTS</div>
  <div class="why-grid" style="margin-top:0">
    ${(why.length?why:[["Licensed & Fully Insured","General liability and workman's comp on every job."],["5-Star Track Record","Dozens of verified reviews from Central KY homeowners."],["Detailed Written Proposals","No surprises — scope and cost in writing before work begins."],["Veteran Craftsmanship","Decades of hands-on experience across every trade."],["Clean Jobsite Guarantee","We leave your property cleaner than we found it."],["Same-Day Callbacks","Responsive, on-time, transparent throughout the project."]]).map(([t,d])=>`<div class="why-cell"><div class="why-title">${t}</div><div class="why-desc">${d}</div></div>`).join("")}
  </div>

  <!-- Testimonials -->
  ${testimonials.length>0?`
  <div class="sec-header">★ &nbsp;WHAT OUR CUSTOMERS SAY</div>
  <div class="testimonials-grid" style="margin-top:0">
    ${testimonials.map(t=>`<div class="t-card"><div class="t-stars">★★★★★</div><div class="t-text">"${t.text}"</div><div class="t-name">${t.name}</div><div class="t-job">${t.job||""}</div></div>`).join("")}
  </div>`:""}

  <!-- Terms -->
  <div class="sec-header">📝 &nbsp;TERMS &amp; CONDITIONS</div>
  <ul class="terms-list" style="margin-top:0">
    ${(terms.length?terms:["50% deposit required to schedule. Balance due upon completion.","Quote valid for 30 days from proposal date.","Work outside listed scope requires a written change order."]).map(t=>`<li>${t}</li>`).join("")}
    ${scopeData?.warranty?`<li>${scopeData.warranty}</li>`:""}
  </ul>

  <!-- Acceptance -->
  <div class="accept-box">
    <h4>Acceptance of Proposal</h4>
    <div class="accept-intro">By signing below, you authorize ${co.name||"Central Kentucky Building Maintenance Specialists"} to proceed with the selected package under the terms stated above.</div>
    <div class="accept-grid">
      <div class="sig-line">Client Signature</div>
      <div class="sig-line">Date</div>
    </div>
    <div class="accept-grid">
      <div class="sig-line">Printed Name</div>
      <div class="sig-line">Package Selected</div>
    </div>
  </div>

  <div class="closing-banner">
    <div class="big">Thank you for the opportunity to earn your business.</div>
    <div class="sub">${co.name||"Central Kentucky Building Maintenance Specialists"} &nbsp;·&nbsp; ${co.phone||""} &nbsp;·&nbsp; ${co.email||""}</div>
  </div>

  <div class="footer">
    <span>${co.name||"CKBMS"}  ·  Professional Estimate  ·  Confidential</span>
    <span>Page 2 of 2</span>
  </div>
</div>

</body></html>`;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function BidRightPro() {
  const [view, setView] = useState("app"); // "app" | "settings"
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState({
    name:"Central Kentucky Building Maintenance Specialists",
    tagline:"Licensed • Insured • 5-Star Rated",
    phone:"(859) 555-0100",email:"info@ckbms.com",address:"Richmond, KY 40475",
    website:"www.ckbms.com",license:"",proposal_prefix:"CKBMS-",
    testimonials:[
      {name:"Sarah M.",text:"Absolutely professional from start to finish. My walls look brand new and the crew left the house spotless.",job:"Interior Painting"},
      {name:"Tom & Linda R.",text:"Best experience we've had with any contractor. Showed up on time, did exactly what was quoted, zero surprises.",job:"Flooring Install"},
      {name:"David K.",text:"The written proposal set them apart immediately. I knew exactly what I was getting. Highly recommend.",job:"Deck Repair"},
      {name:"Jennifer H.",text:"Five stars isn't enough. They fixed the drywall damage and matched the texture perfectly. You can't even tell.",job:"Drywall Repair"},
      {name:"Mark S.",text:"Fair price, quality work, cleaned up every day. This is the contractor you want.",job:"Exterior Painting"},
      {name:"Beth C.",text:"Called three other companies. CKBMS was the only one with a detailed written estimate. That's who I hired.",job:"General Handyman"},
    ],
    whyUs:[["Licensed & Fully Insured","General liability and workman's comp on every job."],["5-Star Track Record","Dozens of verified reviews from Central KY homeowners."],["Detailed Written Proposals","No surprises — scope and cost in writing before work begins."],["Veteran Craftsmanship","Decades of hands-on trade experience."],["Clean Jobsite Guarantee","We leave your property cleaner than we found it."],["Same-Day Callbacks","Responsive, on-time, transparent throughout."]],
    terms:["50% deposit required to schedule. Balance due upon completion.","Quote valid for 30 days from proposal date.","Work outside listed scope requires a written change order.","We carry general liability insurance. Certificate available on request.","Client responsible for relocating personal items prior to work start."],
  });

  const [category, setCategory] = useState("");
  const [jobType, setJobType] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [matFields, setMatFields] = useState({});
  const [hourlyRate, setHourlyRate] = useState(65);
  const [hours, setHours] = useState("");
  const [crewSize, setCrewSize] = useState(1);
  const [margin, setMargin] = useState(38);
  const [tiers, setTiers] = useState({good:{},better:{},best:{}});
  const [loadingTiers, setLoadingTiers] = useState(false);
  const [marketData, setMarketData] = useState(null);
  const [materialData, setMaterialData] = useState(null);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [manualExpenses, setManualExpenses] = useState({});
  const [scopeData, setScopeData] = useState(null);
  const [coachNote, setCoachNote] = useState("");
  const [loadingProposal, setLoadingProposal] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [proposalHTML, setProposalHTML] = useState("");
  const printRef = useRef(null);

  const catData = JOB_CATEGORIES[category]||null;
  const missingRequired = catData?.materialFields?.filter(f=>f.required&&!matFields[f.key])||[];
  const hasRequired = !missingRequired.length;
  const aiMat = materialData?.totalMaterialCost||0;
  const manualTotal = Object.values(manualExpenses).reduce((s,v)=>s+Number(v||0),0);
  const laborCost = Number(hours||0)*Number(hourlyRate||0);
  const totalMats = aiMat+manualTotal;
  const directCost = laborCost+totalMats;
  const mult = 1/(1-margin/100);
  const recommended = directCost*mult;
  const low = recommended*0.88;
  const high = recommended*1.18;
  const profit = recommended-directCost;
  const hpw = crewSize>0?round(Number(hours||0)/crewSize):Number(hours||0);

  async function buildTiers() {
    setLoadingTiers(true);
    try {
      const goodPrice = Math.round(low);
      const betterPrice = Math.round(recommended);
      const bestPrice = Math.round(high);
      const hints = JOB_CATEGORIES[category]?.tierHints || {};

      const text = await callClaude([{role:"user",content:`You are a contractor pricing expert for handyman services in Central Kentucky.

Build 3 pricing packages for this job:
Job Type: ${jobType}
Description: ${jobDesc}
Contractor cost: $${directCost.toFixed(0)}
Suggested prices: Good=$${goodPrice}, Better=$${betterPrice}, Best=$${bestPrice}

Return ONLY this exact JSON structure with NO extra text, NO markdown, NO dollar signs in prices:
{"good":{"price":${goodPrice},"features":["feature 1","feature 2","feature 3","feature 4"]},"better":{"price":${betterPrice},"features":["feature 1","feature 2","feature 3","feature 4","feature 5"]},"best":{"price":${bestPrice},"features":["feature 1","feature 2","feature 3","feature 4","feature 5","feature 6"]}}`}],
        "You are a contractor pricing expert. Return ONLY valid JSON. No markdown. No dollar signs in price values. Prices must be plain integers.", false);

      // Try to parse, with multiple fallback strategies
      let p = null;
      try { p = parseJSON(text); } catch(e1) {
        // Try extracting just the JSON part
        const match = text.match(/\{[\s\S]*\}/);
        if (match) { try { p = JSON.parse(match[0]); } catch(e2) { p = null; } }
      }

      if (p && p.good && p.better && p.best) {
        const merged = {};
        ["good","better","best"].forEach(k=>{
          // Strip any $ signs from price just in case
          const rawPrice = String(p[k]?.price||"").replace(/[^0-9.]/g,"");
          merged[k] = {
            price: rawPrice || String(k==="good"?goodPrice:k==="better"?betterPrice:bestPrice),
            features: p[k]?.features||hints[k]||[],
            featuresText: (p[k]?.features||hints[k]||[]).join("\n")
          };
        });
        setTiers(merged);
      } else {
        // Fallback: use calculated prices with hint features
        setTiers({
          good:{price:String(goodPrice),features:hints.good||["Basic scope","Standard materials","Area cleanup"],featuresText:(hints.good||["Basic scope"]).join("\n")},
          better:{price:String(betterPrice),features:hints.better||["Full scope","Premium materials","Full cleanup"],featuresText:(hints.better||["Full scope"]).join("\n")},
          best:{price:String(bestPrice),features:hints.best||["Premium scope","Top materials","Warranty included"],featuresText:(hints.best||["Premium scope"]).join("\n")}
        });
      }
    } catch(err) {
      // Always show something useful even on total failure
      const hints = JOB_CATEGORIES[category]?.tierHints || {};
      setTiers({
        good:{price:String(Math.round(low)),features:hints.good||["Basic scope"],featuresText:(hints.good||["Basic scope"]).join("\n")},
        better:{price:String(Math.round(recommended)),features:hints.better||["Full scope"],featuresText:(hints.better||["Full scope"]).join("\n")},
        best:{price:String(Math.round(high)),features:hints.best||["Premium scope"],featuresText:(hints.best||["Premium scope"]).join("\n")}
      });
    }
    setLoadingTiers(false);
  }

  async function fetchIntelligence() {
    setStep(2); setLoadingMarket(true); setLoadingMaterials(true);
    setMarketData(null); setMaterialData(null);
    const ctx = `${jobType}. Specs: ${JSON.stringify(matFields)}. Crew: ${crewSize}, ${hours}h.`;
    callClaude([{role:"user",content:`Search contractor rates for "${jobType}" in Central KY / Middle TN. Return JSON:\n{"laborRateLow":n,"laborRateHigh":n,"jobPriceLow":n,"jobPriceHigh":n,"marketNotes":"2-3 sentences"}`}],
      "Construction cost researcher. Return valid JSON only.",true)
    .then(t=>{try{setMarketData(parseJSON(t));}catch{setMarketData({laborRateLow:45,laborRateHigh:85,jobPriceLow:150,jobPriceHigh:800,marketNotes:"Typical Central KY rates."});}setLoadingMarket(false);})
    .catch(()=>{setLoadingMarket(false);});
    callClaude([{role:"user",content:`Search contractor material prices for: ${ctx}. Find Home Depot/Lowe's/Sherwin-Williams contractor pricing.\nReturn JSON:\n{"lineItems":[{"item":"n","quantity":0,"unit":"u","unitCost":0,"totalCost":0,"source":"store","notes":""}],"totalMaterialCost":0,"calculationNotes":"string","missingInfo":["items"],"sherwinContractorNote":""}`}],
      "Materials estimator. For painting: 350sqft/gal/coat, +10% waste. Return valid JSON only.",true)
    .then(t=>{try{setMaterialData(parseJSON(t));}catch{setMaterialData({lineItems:[],totalMaterialCost:0,calculationNotes:"Enter manually.",missingInfo:[],sherwinContractorNote:""});}setLoadingMaterials(false);})
    .catch(()=>setLoadingMaterials(false));
  }

  async function generateProposal() {
    setStep(3); setLoadingProposal(true); setPdfReady(false);
    setScopeData(null); setCoachNote(""); setProposalHTML("");

    const payload = {
      job:{job_type:jobType,client:clientName||"Valued Client",address:address||"TBD",client_phone:clientPhone,description:jobDesc,hours,crew_desc:`${crewSize} worker${crewSize>1?"s":""} · ${hpw}h each`},
      tiers,
      marketRange:marketData?`${currency(marketData.jobPriceLow)}–${currency(marketData.jobPriceHigh)}`:"",
    };

    // Default scope that always works even if AI fails
    const defaultScope = {
      intro:`Thank you for the opportunity to provide this estimate for ${clientName||"your project"}. Central Kentucky Building Maintenance Specialists is pleased to present the following proposal.`,
      line_items:[
        `${jobType} as described and agreed upon`,
        "All necessary materials and supplies included per selected package",
        "Professional installation and workmanship throughout",
        "Daily cleanup of work area",
        "Final walkthrough and client approval",
        "All debris removal and disposal included"
      ],
      exclusions:[
        "Work not specifically listed in this proposal",
        "Permits unless otherwise agreed in writing",
        "Damage discovered after work begins that was not visible during estimate"
      ],
      timeline:`Estimated ${Math.ceil(Number(hours||4)/8)} day(s) on site`,
      warranty:"All workmanship warranted for 1 year from completion date."
    };

    // Get scope data - try AI first, fall back to default
    let sd = defaultScope;
    try {
      const aiScope = await generateProposalPDF(payload);
      if (aiScope && aiScope.line_items && aiScope.line_items.length > 0) {
        sd = aiScope;
      }
    } catch(e) {
      console.log("Scope AI failed, using defaults:", e.message);
    }
    setScopeData(sd);

    // Get coach note - optional, don't block on failure
    let coachText = "";
    try {
      coachText = await callClaude(
        [{role:"user",content:`Write a 3-sentence private pricing coach note for a contractor bidding on: ${jobType} in Central Kentucky. Cover: 1) One objection handling tip, 2) One upsell opportunity, 3) One thing to watch out for on this job.`}],
        "Contractor business coach. Be specific and practical."
      );
    } catch(e) {
      console.log("Coach note failed:", e.message);
      coachText = `For ${jobType} jobs, clients often ask if you can do it cheaper — hold your price and emphasize your written scope and warranty. Consider offering to add an accent wall or ceiling paint as an upsell to the Better or Best package. Watch for hidden damage behind walls or surfaces that could expand the scope unexpectedly.`;
    }
    setCoachNote(coachText);

    // Always build and show the HTML proposal
    try {
      const html = buildPrintHTML(payload, sd, settings);
      setProposalHTML(html);
      setPdfReady(true);
    } catch(e) {
      console.error("HTML build failed:", e.message);
    }

    setLoadingProposal(false);
  }

  function printProposal() {
    const w = window.open("","_blank");
    w.document.write(proposalHTML);
    w.document.close();
    w.onload = ()=>{ w.print(); };
  }

  function reset() {
    setStep(1);setCategory("");setJobType("");setClientName("");setAddress("");setClientPhone("");
    setJobDesc("");setMatFields({});setHours("");setCrewSize(1);setMargin(38);
    setTiers({good:{},better:{},best:{}});setMarketData(null);setMaterialData(null);
    setManualExpenses({});setScopeData(null);setCoachNote("");setPdfReady(false);setProposalHTML("");
  }

  // Settings page
  if (view==="settings") return (
    <div style={{minHeight:"100vh",background:"#0d0f18",fontFamily:"'Georgia',serif",color:"#e8e0d0"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Sans+3:wght@300;400;600;700&display=swap');*{box-sizing:border-box}input,select,textarea{outline:none}input:focus,select:focus,textarea:focus{border-color:#f5c842!important;box-shadow:0 0 0 2px rgba(245,200,66,0.12)!important}.fu{animation:fadeUp 0.3s ease forwards}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{background:"linear-gradient(135deg,#13151f,#0d0f18)",borderBottom:"1px solid #1e2130",padding:"16px 20px"}}>
        <div style={{maxWidth:800,margin:"0 auto",display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:46,height:46,background:"linear-gradient(135deg,#f5c842,#e8a020)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏗️</div>
          <div><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:900,color:"#f5c842"}}>BidRight Pro</div><div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:"#5a5d6a",textTransform:"uppercase",letterSpacing:"0.1em"}}>Company Settings</div></div>
        </div>
      </div>
      <SettingsPage settings={settings} setSettings={setSettings} onBack={()=>setView("app")}/>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#0d0f18",fontFamily:"'Georgia',serif",color:"#e8e0d0"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Sans+3:wght@300;400;600;700&display=swap');*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#2a2d3a;border-radius:3px}input,select,textarea{outline:none}input:focus,select:focus,textarea:focus{border-color:#f5c842!important;box-shadow:0 0 0 2px rgba(245,200,66,0.12)!important}.hov:hover{opacity:0.85;transform:translateY(-1px)}.hov{transition:all 0.18s}@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}.fu{animation:fadeUp 0.35s ease forwards}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}.pulse{animation:pulse 1.6s ease infinite}.catcard:hover{border-color:#f5c842!important;background:rgba(245,200,66,0.06)!important}.catcard{transition:all 0.18s;cursor:pointer}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#13151f,#0d0f18)",borderBottom:"1px solid #1e2130",padding:"16px 20px"}}>
        <div style={{maxWidth:800,margin:"0 auto",display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:46,height:46,background:"linear-gradient(135deg,#f5c842,#e8a020)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🏗️</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:900,color:"#f5c842",letterSpacing:"-0.5px",lineHeight:1}}>BidRight Pro</div>
            <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:"#5a5d6a",letterSpacing:"0.1em",textTransform:"uppercase",marginTop:2}}>AI Estimating · Central KY / Middle TN</div>
          </div>
          <button className="hov" onClick={()=>setView("settings")} style={{padding:"7px 14px",background:"transparent",border:"1px solid #2a2d3a",borderRadius:8,color:"#9a9daa",fontFamily:"'Source Sans 3',sans-serif",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            ⚙️ Settings
          </button>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {["Job","Intel","Bid"].map((s,i)=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{width:26,height:26,borderRadius:"50%",background:step>i+1?"#7ab87a":step===i+1?"linear-gradient(135deg,#f5c842,#e8a020)":"#1e2130",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"'Source Sans 3',sans-serif",fontWeight:700,color:step>=i+1?"#0d0f18":"#3a3d4a",transition:"all 0.3s"}}>
                    {step>i+1?"✓":i+1}
                  </div>
                  <span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:9,color:step===i+1?"#f5c842":"#3a3d4a",letterSpacing:"0.06em"}}>{s}</span>
                </div>
                {i<2&&<div style={{width:16,height:1,background:step>i+1?"#7ab87a":"#1e2130",marginBottom:14,transition:"all 0.3s"}}/>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:800,margin:"0 auto",padding:"24px 16px 80px"}}>

        {/* ── STEP 1 ── */}
        {step===1&&<div className="fu">
          <div style={{marginBottom:24}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#f0e8d8",marginBottom:4}}>What's the job?</div>
            <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:13,color:"#7a7d8a",marginBottom:18}}>Pick a category — AI will estimate hours, calculate materials, build pricing tiers, and generate a client-ready PDF proposal.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {Object.entries(JOB_CATEGORIES).map(([cat,data])=>(
                <div key={cat} className="catcard" onClick={()=>{setCategory(cat);setJobType("");setMatFields({});setHours("");setTiers({good:{},better:{},best:{}});}}
                  style={{padding:"12px 10px",background:category===cat?"rgba(245,200,66,0.1)":"#13151f",border:`1px solid ${category===cat?"#f5c842":"#1e2130"}`,borderRadius:10,textAlign:"center"}}>
                  <div style={{fontSize:22,marginBottom:4}}>{data.icon}</div>
                  <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:category===cat?"#f5c842":"#9a9daa",fontWeight:category===cat?700:400}}>{cat}</div>
                </div>
              ))}
            </div>
          </div>

          {category&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:4}}>
              <Field label="Client Name"><input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="e.g. Johnson Residence" style={IS}/></Field>
              <Field label="Job Address"><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="e.g. Richmond, KY" style={IS}/></Field>
              <Field label="Client Phone"><input value={clientPhone} onChange={e=>setClientPhone(e.target.value)} placeholder="(859) 555-0100" style={IS}/></Field>
            </div>

            <Field label="Job Type" required>
              <select value={jobType} onChange={e=>{setJobType(e.target.value);setHours("");setTiers({good:{},better:{},best:{}});}} style={IS}>
                <option value="">— Select —</option>
                {catData.types.map(t=><option key={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Describe the Job" required hint="More detail = better AI estimates across hours, materials, and tier pricing">
              <textarea value={jobDesc} onChange={e=>setJobDesc(e.target.value)} placeholder="Describe scope, surface conditions, access, client expectations..." rows={3} style={{...IS,resize:"vertical",lineHeight:1.7}}/>
            </Field>

            {jobType&&<>
              <div style={{background:"#13151f",border:"1px solid #1e2130",borderRadius:12,padding:18,marginBottom:20}}>
                <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:"#f5c842",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                  <span>📐</span> Job Specs — Material + Hours Calculations
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  {catData.materialFields.map(f=>(
                    <Field key={f.key} label={`${f.label}${f.unit?` (${f.unit})`:""}`} required={f.required}>
                      {f.type==="select"?
                        <select value={matFields[f.key]||""} onChange={e=>setMatFields({...matFields,[f.key]:e.target.value})} style={IS}><option value="">— Select —</option>{f.options.map(o=><option key={o}>{o}</option>)}</select>:
                        <input type="number" value={matFields[f.key]||""} onChange={e=>setMatFields({...matFields,[f.key]:e.target.value})} placeholder={f.placeholder} style={IS} min={0}/>}
                    </Field>
                  ))}
                </div>
                {missingRequired.length>0&&<div style={{marginTop:8,fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:"#e8a020"}}>⚠️ Fill required fields to enable AI calculations</div>}
              </div>

              <HoursEstimator jobType={jobType} jobDesc={jobDesc} matFields={matFields} hours={hours} setHours={setHours} crewSize={crewSize} setCrewSize={setCrewSize}/>

              <Field label="Your Hourly Rate ($)" hint="Fully-loaded rate including truck, insurance, overhead">
                <input type="number" value={hourlyRate} onChange={e=>setHourlyRate(e.target.value)} style={IS} min={25} max={250}/>
              </Field>

              {/* Tier Builder in Step 1 */}
              <TierBuilder jobType={jobType} category={category} basePrice={recommended} tiers={tiers} setTiers={setTiers} loadingTiers={loadingTiers} onFetch={buildTiers}/>

              {/* Fallback hours */}
              {jobType&&!hours&&<div style={{padding:"10px 14px",background:"rgba(245,200,66,0.07)",border:"1px solid rgba(245,200,66,0.25)",borderRadius:10,marginBottom:12,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:13,color:"#c8b870"}}>⏱️ Enter hours to continue:</span>
                <input type="number" value={hours} onChange={e=>setHours(e.target.value)} placeholder="e.g. 4" min={0.5} step={0.5} style={{...IS,width:90}}/>
              </div>}

              <button className="hov" onClick={fetchIntelligence}
                disabled={!jobType||!jobDesc||!hasRequired||!hours}
                style={{width:"100%",padding:15,marginTop:4,background:!jobType||!jobDesc||!hasRequired||!hours?"#1e2130":"linear-gradient(135deg,#f5c842,#e8a020)",border:"none",borderRadius:10,fontFamily:"'Source Sans 3',sans-serif",fontSize:15,fontWeight:700,color:!jobType||!jobDesc||!hasRequired||!hours?"#3a3d4a":"#0d0f18",cursor:!jobType||!jobDesc||!hasRequired||!hours?"not-allowed":"pointer"}}>
                {!jobDesc?"Add a job description to continue":!hours?"Enter hours above to continue":!hasRequired?"Fill required specs to continue":"🔍 Pull Market Rates + Calculate Materials →"}
              </button>
            </>}
          </>}
        </div>}

        {/* ── STEP 2 ── */}
        {step===2&&<div className="fu">
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#f0e8d8",marginBottom:4}}>Market Intelligence</div>
          <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:13,color:"#7a7d8a",marginBottom:20}}>Live rates + material costs. Review and adjust before generating the PDF proposal.</div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
            <div style={{background:"#13151f",border:"1px solid #1e2130",borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid #1e2130",display:"flex",alignItems:"center",gap:8}}>
                <span>📊</span><span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:"#7a7d8a"}}>Local Market Rates</span>
                {loadingMarket&&<span className="pulse" style={{marginLeft:"auto",width:8,height:8,borderRadius:"50%",background:"#f5c842",display:"inline-block"}}/>}
                {!loadingMarket&&marketData&&<Tag color="#7ab87a">Live</Tag>}
              </div>
              <div style={{padding:16}}>
                {loadingMarket?<Spinner label="Searching Central KY rates..."/>:marketData?<>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                    {[[`${currency(marketData.laborRateLow)}–${currency(marketData.laborRateHigh)}/hr`,"Labor Rate"],[`${currency(marketData.jobPriceLow)}–${currency(marketData.jobPriceHigh)}`,"Typical Job"]].map(([v,l])=>(
                      <div key={l} style={{padding:"9px 10px",background:"#0d0f18",borderRadius:8,textAlign:"center"}}>
                        <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:l==="Typical Job"?"#f5c842":"#e8e0d0",fontWeight:700}}>{v}</div>
                        <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:9,color:"#5a5d6a",textTransform:"uppercase",letterSpacing:"0.07em",marginTop:2}}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:"#9a9daa",lineHeight:1.6}}>{marketData.marketNotes}</div>
                </>:null}
              </div>
            </div>
            <div style={{background:"#13151f",border:"1px solid #1e2130",borderRadius:12,padding:16}}>
              <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:"#7a7d8a",marginBottom:14}}>⚙️ Adjust Settings</div>
              <Field label={`Hourly Rate: $${hourlyRate}/hr`}>
                <input type="range" min={30} max={150} value={hourlyRate} onChange={e=>setHourlyRate(Number(e.target.value))} style={{width:"100%",accentColor:"#f5c842"}}/>
                {marketData&&<div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:Number(hourlyRate)>=marketData.laborRateLow?"#7ab87a":"#e85050",marginTop:3}}>{Number(hourlyRate)>=marketData.laborRateLow?"✓ Within market range":`⚠️ Below market low of $${marketData.laborRateLow}/hr`}</div>}
              </Field>
              <Field label={`Margin: ${margin}%`}>
                <input type="range" min={15} max={60} value={margin} onChange={e=>setMargin(Number(e.target.value))} style={{width:"100%",accentColor:"#f5c842"}}/>
                <div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap"}}>
                  {MARGIN_PRESETS.map(p=><button key={p.label} onClick={()=>setMargin(p.value)} style={{padding:"2px 9px",borderRadius:20,background:margin===p.value?p.color+"33":"transparent",border:`1px solid ${margin===p.value?p.color:"#2a2d3a"}`,color:margin===p.value?p.color:"#5a5d6a",fontFamily:"'Source Sans 3',sans-serif",fontSize:11,cursor:"pointer"}}>{p.label}</button>)}
                </div>
              </Field>
              <div style={{padding:"9px 12px",background:"#0d0f18",borderRadius:8,marginTop:4}}>
                <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:"#7a7d8a",marginBottom:3}}>Labor</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:"#f5c842",fontWeight:700}}>{hours}h total</span>
                  <span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:"#7a7d8a"}}>{crewSize} worker{crewSize>1?"s":""} · {hpw}h each · {(hpw/8).toFixed(1)}d on site</span>
                </div>
              </div>
            </div>
          </div>

          {/* Materials */}
          <div style={{background:"#13151f",border:"1px solid #1e2130",borderRadius:12,overflow:"hidden",marginBottom:20}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #1e2130",display:"flex",alignItems:"center",gap:8}}>
              <span>🛒</span><span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:"#7a7d8a"}}>Material Estimate — Contractor Pricing</span>
              {loadingMaterials&&<span className="pulse" style={{marginLeft:"auto",width:8,height:8,borderRadius:"50%",background:"#f5c842",display:"inline-block"}}/>}
              {!loadingMaterials&&materialData&&<Tag color="#7ab87a">Calculated</Tag>}
            </div>
            <div style={{padding:16}}>
              {loadingMaterials?<Spinner label="Searching contractor material prices..."/>:materialData?<>
                {materialData.lineItems?.length>0&&<div style={{marginBottom:14}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:"5px 10px",marginBottom:6,padding:"0 4px"}}>
                    {["Item","Qty","Unit $","Total"].map(h=><div key={h} style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:10,textTransform:"uppercase",letterSpacing:"0.08em",color:"#5a5d6a"}}>{h}</div>)}
                  </div>
                  {materialData.lineItems.map((item,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:"4px 10px",padding:"6px 4px",borderTop:"1px solid #1e2130",alignItems:"start"}}>
                      <div><div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:13,color:"#e8e0d0"}}>{item.item}</div><div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:"#5a5d6a"}}>{item.source}{item.notes?` · ${item.notes}`:""}</div></div>
                      <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:"#9a9daa",textAlign:"right"}}>{item.quantity} {item.unit}</div>
                      <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:"#9a9daa",textAlign:"right"}}>${Number(item.unitCost||0).toFixed(2)}</div>
                      <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,color:"#e8e0d0",textAlign:"right",fontWeight:700}}>{currency(item.totalCost)}</div>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 4px 0",borderTop:"2px solid #2a2d3a",marginTop:4}}>
                    <span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:"#9a9daa"}}>AI Material Total</span>
                    <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:"#f5c842",fontWeight:700}}>{currency(aiMat)}</span>
                  </div>
                </div>}
                {materialData.calculationNotes&&<div style={{padding:"7px 10px",background:"#0d0f18",borderRadius:7,fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:"#7a7d8a",lineHeight:1.5,marginBottom:8}}>📐 {materialData.calculationNotes}</div>}
                {materialData.sherwinContractorNote&&<div style={{padding:"7px 10px",background:"rgba(156,90,50,0.1)",border:"1px solid rgba(156,90,50,0.3)",borderRadius:7,fontFamily:"'Source Sans 3',sans-serif",fontSize:11,color:"#d4a060",lineHeight:1.5,marginBottom:8}}>🎨 SW: {materialData.sherwinContractorNote}</div>}
                <div style={{borderTop:"1px solid #1e2130",paddingTop:12}}>
                  <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,textTransform:"uppercase",letterSpacing:"0.07em",color:"#7a7d8a",marginBottom:8}}>➕ Add / Adjust Manually</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
                    {["extra_materials","disposal","rental","misc"].map(k=>(
                      <div key={k} style={{display:"contents"}}>
                        <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:13,color:"#9a9daa",display:"flex",alignItems:"center"}}>{{extra_materials:"Extra Materials",disposal:"Disposal / Dump",rental:"Equipment Rental",misc:"Other"}[k]}</div>
                        <div style={{position:"relative"}}><span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"#5a5d6a",fontSize:13}}>$</span><input type="number" value={manualExpenses[k]||""} onChange={e=>setManualExpenses({...manualExpenses,[k]:e.target.value})} placeholder="0" min={0} style={{...IS,width:110,paddingLeft:20,textAlign:"right"}}/></div>
                      </div>
                    ))}
                  </div>
                </div>
              </>:null}
            </div>
          </div>

          {/* Tier review in step 2 */}
          <TierBuilder jobType={jobType} category={category} basePrice={recommended} tiers={tiers} setTiers={setTiers} loadingTiers={loadingTiers} onFetch={buildTiers}/>

          {/* Bid Summary */}
          {!loadingMarket&&!loadingMaterials&&<div style={{background:"linear-gradient(135deg,#1a1e30,#13151f)",border:"1px solid #f5c842",borderRadius:14,padding:20,marginBottom:20}}>
            <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,textTransform:"uppercase",letterSpacing:"0.12em",color:"#f5c842",marginBottom:14}}>📋 Live Bid Summary</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
              {[["Labor",currency(laborCost),"#e8e0d0"],["Materials",currency(totalMats),"#e8e0d0"],["Your Cost",currency(directCost),"#e8a020"],["Gross Profit",currency(profit),"#7ab87a"]].map(([l,v,c])=>(
                <div key={l} style={{padding:"9px 8px",background:"rgba(0,0,0,0.3)",borderRadius:8,textAlign:"center"}}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:9,color:"#5a5d6a",textTransform:"uppercase",letterSpacing:"0.07em",marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
            {marketData?.jobPriceLow>0&&<div style={{padding:"7px 12px",background:"rgba(122,184,122,0.08)",borderRadius:8,fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:"#9ab89a"}}>
              Market for this job: <strong style={{color:"#7ab87a"}}>{currency(marketData.jobPriceLow)} – {currency(marketData.jobPriceHigh)}</strong>
              {recommended>=marketData.jobPriceLow&&recommended<=marketData.jobPriceHigh?" · ✓ Well positioned":recommended<marketData.jobPriceLow?" · ⚠️ Below market":" · 💡 Above average — justify with scope"}
            </div>}
          </div>}

          <div style={{display:"flex",gap:12}}>
            <button className="hov" onClick={()=>setStep(1)} style={{padding:"12px 20px",background:"transparent",border:"1px solid #2a2d3a",borderRadius:10,color:"#7a7d8a",fontFamily:"'Source Sans 3',sans-serif",fontSize:14,cursor:"pointer"}}>← Back</button>
            <button className="hov" onClick={generateProposal} disabled={loadingMarket||loadingMaterials}
              style={{flex:1,padding:14,background:loadingMarket||loadingMaterials?"#1e2130":"linear-gradient(135deg,#f5c842,#e8a020)",border:"none",borderRadius:10,color:loadingMarket||loadingMaterials?"#3a3d4a":"#0d0f18",fontFamily:"'Source Sans 3',sans-serif",fontSize:15,fontWeight:700,cursor:loadingMarket||loadingMaterials?"not-allowed":"pointer"}}>
              📄 Generate PDF Proposal →
            </button>
          </div>
        </div>}

        {/* ── STEP 3 ── */}
        {step===3&&<div className="fu">
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#f0e8d8",marginBottom:4}}>PDF Proposal</div>
          <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:13,color:"#7a7d8a",marginBottom:20}}>Two-page professional proposal with Good/Better/Best tiers, testimonials, and acceptance signature.</div>

          {loadingProposal&&<div style={{background:"#13151f",border:"1px solid #1e2130",borderRadius:12,padding:32,textAlign:"center",marginBottom:20}}>
            <Spinner label="Building your professional PDF proposal..."/>
            <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:"#5a5d6a",marginTop:12}}>Writing scope of work · Formatting tiers · Adding testimonials · Generating coach notes</div>
          </div>}

          {pdfReady&&<>
            {/* PDF Preview Card */}
            <div style={{background:"#13151f",border:"1px solid #1e2130",borderRadius:12,overflow:"hidden",marginBottom:16}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid #1e2130",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><span>📄</span><span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:"#7a7d8a"}}>2-Page Professional Proposal</span><Tag color="#7ab87a">Ready</Tag></div>
                <button className="hov" onClick={printProposal} style={{padding:"7px 18px",background:"linear-gradient(135deg,#f5c842,#e8a020)",border:"none",borderRadius:8,color:"#0d0f18",fontFamily:"'Source Sans 3',sans-serif",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  🖨️ Print / Save PDF
                </button>
              </div>
              <div style={{padding:16}}>
                {/* Preview contents summary */}
                {[
                  ["Page 1","Proposal header · Client & job details · Good/Better/Best tier comparison · Client selection & signature box"],
                  ["Page 2","Detailed scope of work · Exclusions · Why Choose Us · Customer testimonials · Terms & acceptance"],
                ].map(([pg,desc])=>(
                  <div key={pg} style={{display:"flex",gap:12,padding:"8px 0",borderBottom:"1px solid #1a1d27"}}>
                    <div style={{width:52,flexShrink:0,fontFamily:"'Source Sans 3',sans-serif",fontSize:11,fontWeight:700,color:"#f5c842",textTransform:"uppercase",letterSpacing:"0.08em",paddingTop:1}}>{pg}</div>
                    <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:"#9a9daa",lineHeight:1.6}}>{desc}</div>
                  </div>
                ))}
                <div style={{marginTop:12,padding:"10px 12px",background:"rgba(122,184,122,0.08)",border:"1px solid rgba(122,184,122,0.2)",borderRadius:8,fontFamily:"'Source Sans 3',sans-serif",fontSize:12,color:"#9ab89a"}}>
                  ✓ {settings.testimonials?.length||0} testimonials included &nbsp;·&nbsp; ✓ Company branding applied &nbsp;·&nbsp; ✓ Signature blocks included
                </div>
              </div>
            </div>

            {/* Tier Summary */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
              {[{key:"good",label:"GOOD",color:"#5A7A9A"},{key:"better",label:"BETTER",color:"#C8960A"},{key:"best",label:"BEST",color:"#2E7D32"}].map(cfg=>{
                const t=tiers[cfg.key]||{};
                return <div key={cfg.key} style={{padding:"12px 10px",background:"#13151f",border:`1px solid ${cfg.color}44`,borderRadius:10,textAlign:"center"}}>
                  <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:10,color:cfg.color,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4,fontWeight:700}}>{cfg.label}</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:cfg.color,fontWeight:700}}>{t.price?"$"+Number(t.price).toLocaleString():"—"}</div>
                  <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:10,color:"#5a5d6a",marginTop:2}}>{(t.features||[]).length} features included</div>
                </div>;
              })}
            </div>

            {/* Coach Note */}
            {coachNote&&<div style={{background:"linear-gradient(135deg,#1a2a1a,#131f13)",border:"1px solid #3a5a2a",borderRadius:12,padding:18,marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{fontSize:18}}>💡</span><span style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,textTransform:"uppercase",letterSpacing:"0.12em",color:"#7ab87a"}}>Pricing Coach · Private</span></div>
              <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:14,lineHeight:1.75,color:"#b0d0b0",whiteSpace:"pre-wrap"}}>{coachNote}</div>
            </div>}

            {/* Cost Breakdown */}
            <div style={{background:"#13151f",border:"1px solid #1e2130",borderRadius:12,padding:18,marginBottom:20}}>
              <div style={{fontFamily:"'Source Sans 3',sans-serif",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:"#5a5d6a",marginBottom:12}}>🔒 Cost Breakdown — Private</div>
              {[["Labor",currency(laborCost)],["AI Materials",currency(aiMat)],["Additional",currency(manualTotal)],["Total Cost",currency(directCost),true],["Gross Profit",currency(profit),false,"#7ab87a"],["Margin",`${margin}%`,false,"#7ab87a"]].map(([k,v,bold,col])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:k!=="Margin"?"1px solid #1a1d27":"none",fontFamily:"'Source Sans 3',sans-serif",fontSize:13}}>
                  <span style={{color:"#7a7d8a"}}>{k}</span>
                  <span style={{color:col||(bold?"#e8e0d0":"#c0b8a8"),fontWeight:bold?700:400}}>{v}</span>
                </div>
              ))}
            </div>
          </>}

          <div style={{display:"flex",gap:12}}>
            <button className="hov" onClick={()=>setStep(2)} style={{padding:"12px 20px",background:"transparent",border:"1px solid #2a2d3a",borderRadius:10,color:"#7a7d8a",fontFamily:"'Source Sans 3',sans-serif",fontSize:14,cursor:"pointer"}}>← Adjust</button>
            <button className="hov" onClick={reset} style={{flex:1,padding:13,background:"transparent",border:"1px solid #f5c842",borderRadius:10,color:"#f5c842",fontFamily:"'Source Sans 3',sans-serif",fontSize:15,fontWeight:700,cursor:"pointer"}}>+ New Bid</button>
          </div>
        </div>}
      </div>
    </div>
  );
}
