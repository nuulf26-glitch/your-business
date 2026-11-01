import { useNavigate } from 'react-router-dom';

const samples=[
  {type:'Skincare',name:'Atelier Botanique',photo:'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80'},
  {type:'Coffee',name:'Sunday Roast',photo:'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=80'},
  {type:'Fashion',name:'Forme Studio',photo:'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80'},
];
export default function DesignSamples(){
  const navigate=useNavigate();
  return <section id="examples" style={{background:'#f1f0ec',padding:'84px 5%',color:'#171614',borderBottom:'1px solid #e5e5e0'}}>
    <div style={{maxWidth:1200,margin:'0 auto'}}>
      <p style={{fontSize:11,letterSpacing:'.18em',color:'#88715a'}}>EXAMPLE DESIGNS · RENDERED BY CYB</p>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'end',gap:25,flexWrap:'wrap',marginBottom:30}}><div><h2 style={{font:'400 clamp(34px,5vw,58px)/1.08 Georgia,serif',letterSpacing:'-.04em',maxWidth:650,margin:'14px 0'}}>A few ways your idea could look.</h2><p style={{color:'#69635b',fontSize:14,lineHeight:1.7,maxWidth:600}}>These are sample brand concepts, not customer testimonials. They show the kinds of polished layouts CYB can render and customize.</p></div><button onClick={()=>navigate('/design-preview')} style={{padding:'14px 19px',border:'1px solid #24211d',background:'transparent',cursor:'pointer'}}>Explore sample designs ↗</button></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:18}}>{samples.map(item=><article key={item.name} style={{background:'#fff',border:'1px solid #e1ddd5'}}><img src={item.photo} alt={`${item.type} sample design`} loading="lazy" style={{display:'block',width:'100%',height:240,objectFit:'cover'}}/><div style={{padding:'18px 20px'}}><small style={{fontSize:9,letterSpacing:'.14em',color:'#89725b'}}>{item.type.toUpperCase()} · SAMPLE CONCEPT</small><h3 style={{font:'400 23px Georgia,serif',margin:'10px 0 0'}}>{item.name}</h3></div></article>)}</div>
    </div>
  </section>;
}
