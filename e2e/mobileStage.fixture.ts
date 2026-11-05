/** Synthetic geometry and state for layout regressions; no scientific/product data. */
export const mobileStageEntry = `
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,useSearchParams} from 'react-router';
import {CaseWorkbench,StoryFrame,Stage,SceneCallouts,useShellLang,useLangStore,useThemeStore} from './src/index';
const initial=new URLSearchParams(location.search);
useLangStore.getState().setLang(initial.get('lang')==='es'?'es':'en');
useThemeStore.getState().setTheme(initial.get('theme')==='dark'?'dark':'light');
function App(){
 const [params,setParams]=useSearchParams(),lang=useShellLang(),[row,setRow]=useState(0),[method,setMethod]=useState('a');
 const t=(en,es)=>lang==='es'?es:en;
 const write=(key,value)=>{const p=new URLSearchParams(location.search);p.set(key,value);setParams(p);};
 const caseId=params.get('case')??'c1',step=params.get('step')??'one';
 const controls=<><label htmlFor="fixture-row">{t('Original row selection','Selección de fila original')}<select id="fixture-row" value={row} onChange={e=>setRow(Number(e.target.value))}><option value="0">r0000</option><option value="1">r0001</option></select></label><label htmlFor="fixture-method">{t('Method with complete native controls','Método con controles nativos completos')}<select id="fixture-method" value={method} onChange={e=>setMethod(e.target.value)}><option value="a">A</option><option value="b">B</option></select></label><button id="fixture-last" onClick={()=>setRow(1)}>r0001</button>{params.has('longpanel')&&Array.from({length:28},(_,i)=><label key={i}>{t('Additional fixture setting','Ajuste adicional de la prueba')} {i}<input aria-label={'setting '+i} defaultValue={i}/></label>)}</>;
 const drawing=<Stage label={{en:'Synthetic layout drawing',es:'Dibujo sintético de diseño'}}>{({width,height})=>{
  const top=150,bottom=height-45,cellW=(width-48)/4,cellH=(bottom-top)/5;
  const anchors=[{x:24+cellW/2,y:top+cellH/2},{x:width/2,y:top+cellH*2.5},{x:width-24-cellW/2,y:top+cellH*4.5}];
  return <div style={{position:'relative',width:'100%',height:'100%'}}><svg data-mobile-drawing="" data-fixture-row={row} data-fixture-method={method} width={width} height={height} viewBox={'0 0 '+width+' '+height} style={{display:'block',width:'100%',height:'100%',fontSize:14,color:'var(--color-fg)'}} role="group" aria-label="Synthetic layout fixture only">
   <text x="24" y="140" fill="currentColor">{t('Synthetic layout fixture only','Prueba sintética de diseño')}</text>
   {Array.from({length:5},(_,i)=><g key={i} role="button" tabIndex={0} data-fixture-scene-row={i} aria-label={'row '+i} onClick={()=>setRow(i%2)} onKeyDown={e=>{if(e.key==='Enter')setRow(i%2)}}>{Array.from({length:4},(_,j)=><g key={j}><rect x={24+j*cellW} y={top+i*cellH} width={cellW-2} height={cellH-2} fill={i%2===row?'var(--color-surface-2)':'var(--color-surface)'} stroke="var(--color-border)"/><text x={24+(j+.5)*cellW} y={top+(i+.5)*cellH} fill="currentColor" textAnchor="middle">{i+1},{j+1}</text></g>)}</g>)}
   {anchors.map((a,i)=><circle key={i} data-fixture-subject={i} cx={a.x} cy={a.y} r="5" fill="var(--color-accent)"/>)}
  </svg><SceneCallouts placement="header" items={anchors.map((a,i)=>({id:String(i),eyebrow:{en:'Fixture '+i,es:'Prueba '+i},value:String(row+i),unit:{en:'1',es:'1'},state:'normal',source:{en:'synthetic fixture',es:'prueba sintética'},anchor:{x:a.x/width,y:a.y/height}}))}/></div>
 }}</Stage>;
 const scene=<div style={{display:'flex',flexDirection:'column',flex:'1 1 auto',minHeight:280,height:'100%'}}>{drawing}<p style={{margin:0,padding:8,fontSize:14}}>{t('Synthetic geometry; shared selected row','Geometría sintética; fila compartida')} {row} · {method}</p></div>;
 const rail=[{id:'selection',label:{en:'Selection',es:'Selección'},content:controls},{id:'details',label:{en:'Details',es:'Detalles'},content:<p>{t('A complete translated description of the selected original row.','Una descripción traducida completa de la fila original seleccionada.')}</p>}];
 const names={en:'Long synthetic case name with several words and an intentionally wide reference token ABCDEFGHIJKLMNOPQRSTUVWXYZ',es:'Caso sintético de nombre extenso con varias palabras y una referencia deliberadamente ancha ABCDEFGHIJKLMNOPQRSTUVWXYZ'};
 const storySections=[{id:'selection',label:{en:'Selection',es:'Selección'},content:controls},{id:'source',label:{en:'Source',es:'Fuente'},content:<p>Synthetic layout fixture, not scientific evidence.</p>}];
 const storySteps=['one','two','three'].map((id,i)=>{const p=new URLSearchParams(location.search);p.set('step',id);return{id,number:i+1,verb:{en:'Inspect '+(i+1),es:'Inspeccionar '+(i+1)},headline:{en:'Layout fixture '+(i+1)+' preserves the selected row',es:'La prueba '+(i+1)+' conserva la fila seleccionada'},summary:{en:'Synthetic layout data, not a scientific result.',es:'Datos sintéticos de diseño; sin resultado científico.'},href:'/?'+p,accent:i+1,stage:scene,panel:params.has('sections')?storySections:controls}});
 return <div className="app-shell fixed contain"><header className="site-header"><div className="header-inner"><span>Layout fixture</span></div></header><main className="page">{params.get('surface')==='story'?<StoryFrame steps={storySteps} activeId={step} onStepChange={id=>write('step',id)} onExit={()=>write('surface','app')} autoAdvanceMs={10000}/>:<CaseWorkbench caseId={caseId} cases={{cases:[{id:'c1',name:names[lang]},{id:'c2',name:t('Second case','Segundo caso')}],selectedId:caseId,onSelect:id=>write('case',id),layout:'select'}} controls={{row,method}} rail={rail} focus={{title:{en:names.en,es:names.es},hud:params.has('hud')?Array.from({length:8},(_,i)=>({label:{en:'Long synthetic HUD quantity '+i,es:'Magnitud sintética extensa '+i},value:'123456.789'})):undefined}} groups={[{id:'scene',label:{en:'Drawing',es:'Dibujo'},content:scene}]} context={{content:<>{Array.from({length:35},(_,i)=><p key={i}>Intentional long context owner {i}</p>)}</>}}/>}</main><footer className="site-footer"><div className="footer-inner">Synthetic layout fixture</div></footer></div>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>);
`;
