import { useNavigate } from 'react-router-dom';
import './landing.css';

export default function Hero() {
  const navigate=useNavigate();
  return <section style={{background:'#f9f8f6',color:'#111',padding:'80px 5% 40px',fontFamily:"'Mograp',sans-serif",borderBottom:'1px solid #e5e5e0'}}>
    <div style={{maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'#f1f0ec',padding:'6px 14px',borderRadius:20,fontSize:'.85rem',marginBottom:25,color:'#333'}}><span style={{width:6,height:6,background:'#111',borderRadius:'50%'}}/>Website building, made simple</div>
      <h1 style={{fontSize:'clamp(2.5rem,5.5vw,4.5rem)',fontWeight:400,lineHeight:1.1,letterSpacing:'-.03em',margin:'0 0 25px',textTransform:'lowercase'}}>Build your website<br/><span style={{color:'#666'}}>before you publish.</span></h1>
      <p style={{maxWidth:650,fontSize:'1.05rem',lineHeight:1.7,color:'#555',margin:'0 0 26px'}}>Create a professional business website, customize its design, and manage your products and orders in one place.</p>
      <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center',marginBottom:55}}>
        <button type="button" onClick={()=>navigate('/signup')} style={{background:'#111',color:'#fff',border:0,padding:'18px 23px',fontSize:'.9rem',fontWeight:500,letterSpacing:'.3px',cursor:'pointer',fontFamily:"'Mograp',sans-serif"}}>Start building →</button>
        <button type="button" onClick={()=>navigate('/design-preview')} style={{background:'none',border:0,textDecoration:'underline',cursor:'pointer',font:'inherit',color:'#555'}}>Explore sample designs</button>
      </div>
    </div>
    <div style={{maxWidth:1100,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'.78rem',color:'#666',borderTop:'1px solid #e5e5e0',paddingTop:25,flexWrap:'wrap',gap:15}}><span>No coding required</span><span>•</span><span>Products and orders</span><span>•</span><span>One-time $246 lifetime access</span></div>
  </section>;
}
