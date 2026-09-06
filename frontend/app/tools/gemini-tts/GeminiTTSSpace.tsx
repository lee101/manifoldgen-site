'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AudioLines, Download, LoaderCircle, Mic2, Sparkles, Users } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import TranscriptEditor, { type TranscriptEditorHandle } from './TranscriptEditor';
import styles from '../audio-spaces.module.css';

const VOICES = ['Achernar','Achird','Algenib','Algieba','Alnilam','Aoede','Autonoe','Callirrhoe','Charon','Despina','Enceladus','Erinome','Fenrir','Gacrux','Iapetus','Kore','Laomedeia','Leda','Orus','Puck','Pulcherrima','Rasalgethi','Sadachbia','Sadaltager','Schedar','Sulafat','Umbriel','Vindemiatrix','Zephyr','Zubenelgenubi'];
const STYLES = ['Natural','Deadpan','Empathetic','Dramatic','Whispering','Excited','Calm','Authoritative','Playful','Suspicious'];
const PACES = ['Natural','Slow','Measured','Fast','Staccato','Urgent'];
const ACCENTS = ['American (Gen)','British (RP)','Neutral','Australian','Indian English','Irish','Scottish'];
const TAGS = ['[angry]','[shouting]','[whispers]','[caution]','[determination]','[pensive]','[suspicion]','[urgency]','[excited]','[calm]','[playful]','[sad]'];
const SAMPLE = `Speaker 1: [shouting] Halt, traveler! The northern pass is sealed by order of the council.\nSpeaker 2: [determination] I carry a message for the elder. Step aside, or I will force my way through.\nSpeaker 1: [caution] No one passes. [pensive] The elder is... he's no longer receiving visitors.\nSpeaker 2: [suspicion] What do you mean? We don't have time for games.\nSpeaker 1: It's too late. [whispers] The shadow reached him first. [urgency] You need to leave. Now.`;
const BARS = [19,34,57,28,71,45,84,36,65,92,48,76,30,58,87,42,69,24,53,79,38,63,28,47,73,34,57,22,44,68,31,51];

type Mode = 'single'|'multi';
type APIResult = { result?: { audio_base64?: string; audio_url?: string; format?: string; characters?: number }; credits_used?: number; usd_equivalent?: number; error?: string };

function Field({ label, children }: { label:string; children:React.ReactNode }) { return <label className={styles.field}>{label}{children}</label>; }
function Select({ value, values, onChange }: { value:string; values:string[]; onChange:(value:string)=>void }) { return <select value={value} onChange={(event)=>onChange(event.target.value)}>{values.map((item)=><option key={item}>{item}</option>)}</select>; }

export default function GeminiTTSSpace() {
  const [user,setUser]=useState<StoredUser|null>(null); const [mode,setMode]=useState<Mode>('multi');
  const [transcript,setTranscript]=useState(SAMPLE); const [scene,setScene]=useState('A dark, crumbling dungeon with dripping water echoing in the distance.');
  const [context,setContext]=useState('Fantasy RPG style. Measured pacing that snaps into urgency at the end. Tense and cautious.');
  const [profile1,setProfile1]=useState('A stern and weary gatekeeper'); const [profile2,setProfile2]=useState('A determined and courageous traveler seeking answers');
  const [voice1,setVoice1]=useState('Fenrir'); const [voice2,setVoice2]=useState('Puck');
  const [style1,setStyle1]=useState('Deadpan'); const [style2,setStyle2]=useState('Empathetic');
  const [pace1,setPace1]=useState('Natural'); const [pace2,setPace2]=useState('Staccato');
  const [accent1,setAccent1]=useState('British (RP)'); const [accent2,setAccent2]=useState('American (Gen)');
  const [audio,setAudio]=useState(''); const [format,setFormat]=useState('wav'); const [characters,setCharacters]=useState(0);
  const [status,setStatus]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const transcriptRef=useRef<TranscriptEditorHandle>(null);
  useEffect(()=>{ const cached=loadStoredUser(); setUser(cached); if(cached?.api_key) void refreshUser(cached.api_key).then((fresh)=>{if(fresh){setUser(fresh);saveUser(fresh);}}); },[]);

  const prompt=useMemo(()=>mode==='single'
    ? `Read the transcript based on the audio profile and director's note.\n\n# Audio Profile\n${profile1}\n\n# Director's note\nStyle: ${style1}. Pace: ${pace1}. Accent: ${accent1}.\n\n## Scene\n${scene}\n\n## Context\n${context}\n\n## Transcript\n${transcript}`
    : `Read the transcript based on the audio profile and director's note.\n\n# Audio Profile\nFor Speaker 1: ${profile1}\nFor Speaker 2: ${profile2}\n\n# Director's note\nFor Speaker 1: Style: ${style1}. Pace: ${pace1}. Accent: ${accent1}.\nFor Speaker 2: Style: ${style2}. Pace: ${pace2}. Accent: ${accent2}.\n\n## Scene\n${scene}\n\n## Context\n${context}\n\n## Transcript\n${transcript}`,
  [accent1,accent2,context,mode,pace1,pace2,profile1,profile2,scene,style1,style2,transcript]);

  function tag(value:string){ transcriptRef.current?.insert(value); }
  async function generate(){
    if(!user?.api_key){setError('Sign in to generate speech');return;} if(!transcript.trim()){setError('Add a transcript first');return;}
    if(mode==='multi'&&(!/Speaker 1:/i.test(transcript)||!/Speaker 2:/i.test(transcript))){setError('Use both Speaker 1: and Speaker 2: labels');return;}
    setBusy(true);setError('');setAudio('');setStatus('Directing the performance…');
    try{
      const response=await fetch('/api/service',{method:'POST',headers:{Authorization:`Bearer ${user.api_key}`,'Content-Type':'application/json'},body:JSON.stringify({service:'gemini-tts',input:prompt,voice:voice1,language:'en-US',temperature:1,...(mode==='multi'?{speaker_voices:[{speaker:'Speaker 1',voice:voice1},{speaker:'Speaker 2',voice:voice2}]}:{})})});
      const payload=await response.json() as APIResult; if(!response.ok) throw new Error(payload.error||'Speech generation failed'); const result=payload.result||{}; if(!result.audio_base64&&!result.audio_url) throw new Error('No audio returned');
      const nextFormat=result.format||'wav'; setFormat(nextFormat);setCharacters(result.characters||prompt.length);setAudio(result.audio_url||`data:audio/${nextFormat};base64,${result.audio_base64}`);setStatus('Performance ready');
      void refreshUser(user.api_key).then((fresh)=>{if(fresh){setUser(fresh);saveUser(fresh);}});
    }catch(reason){setError(reason instanceof Error?reason.message:'Speech generation failed');setStatus('');}finally{setBusy(false);}
  }
  const usd=user?.credits_usd??(user?(user.credits*(user.credit_price_usd||.01)):0); const estimate=(Math.ceil(prompt.length/4)*1.2+prompt.length*4*24)/1_000_000;
  return <main className={styles.page}><header className={styles.header}><Link href="/tools"><ArrowLeft size={15}/> Creative spaces</Link><Link href="/account" className={styles.balance}>{user?`$${usd.toFixed(2)} USD`:'Sign in'}</Link></header>
    <section className={styles.hero}><div className={styles.eyebrow}><Mic2 size={13}/> GEMINI 3.1 FLASH TTS · OPENPATHS</div><h1>Direct every voice.</h1><p>Stage expressive narration and two-person scenes with 30 voices, per-speaker profiles, pace, accent, context, and inline emotion cues.</p></section>
    <section className={styles.workspace}>
      <div className={styles.panel}><div className={styles.panelHead}><div><span>01 / CAST</span><h2>Speaker direction</h2></div><Users size={17}/></div><div className={styles.segment}>{(['single','multi'] as Mode[]).map((item)=><button key={item} className={mode===item?styles.active:''} onClick={()=>setMode(item)}>{item==='single'?'Single speaker':'Two speakers'}</button>)}</div>
        <div className={styles.speaker}><div className={styles.speakerTitle}><i>1</i> {mode==='single'?'Narrator':'Speaker 1'}</div><Field label="Audio profile"><input value={profile1} onChange={(e)=>setProfile1(e.target.value)}/></Field><div className={styles.row}><Field label="Style"><Select value={style1} values={STYLES} onChange={setStyle1}/></Field><Field label="Pace"><Select value={pace1} values={PACES} onChange={setPace1}/></Field></div><Field label="Accent"><Select value={accent1} values={ACCENTS} onChange={setAccent1}/></Field><Field label="Voice"><Select value={voice1} values={VOICES} onChange={setVoice1}/></Field></div>
        {mode==='multi'&&<div className={styles.speaker}><div className={styles.speakerTitle}><i>2</i> Speaker 2</div><Field label="Audio profile"><input value={profile2} onChange={(e)=>setProfile2(e.target.value)}/></Field><div className={styles.row}><Field label="Style"><Select value={style2} values={STYLES} onChange={setStyle2}/></Field><Field label="Pace"><Select value={pace2} values={PACES} onChange={setPace2}/></Field></div><Field label="Accent"><Select value={accent2} values={ACCENTS} onChange={setAccent2}/></Field><Field label="Voice"><Select value={voice2} values={VOICES} onChange={setVoice2}/></Field></div>}
      </div>
      <div className={styles.panel}><div className={styles.panelHead}><div><span>02 / SCRIPT</span><h2>Scene and transcript</h2></div><Sparkles size={17}/></div><Field label="Scene"><input value={scene} onChange={(e)=>setScene(e.target.value)}/></Field><Field label="Director context"><textarea rows={3} value={context} onChange={(e)=>setContext(e.target.value)}/></Field><TranscriptEditor ref={transcriptRef} value={transcript} onChange={setTranscript} voices={VOICES} cues={TAGS} multiSpeaker={mode==='multi'}/><div className={styles.chips}>{TAGS.map((item)=><button key={item} onClick={()=>tag(item)}>{item}</button>)}</div></div>
      <div className={styles.panel}><div className={styles.panelHead}><div><span>03 / RENDER</span><h2>Voice output</h2></div><AudioLines size={17}/></div><button data-testid="gemini-run" className={styles.run} disabled={busy} onClick={()=>void generate()}>{busy?<LoaderCircle className={styles.spin} size={17}/>:<Sparkles size={16}/>} {busy?status:'Generate speech'}</button><div className={styles.price}><span>Estimate · ${estimate.toFixed(4)}</span><span>{mode==='multi'?'2 speakers':'1 speaker'}</span></div>{error&&<div className={styles.error}>{error}</div>}<div className={styles.output}><div className={styles.outputHead}><span>OUTPUT</span><span className={audio?styles.ready:''}>{audio?'READY':busy?'RENDERING':'WAITING'}</span></div><div className={`${styles.wave} ${audio||busy?styles.live:''}`}>{BARS.map((height,index)=><i key={index} style={{height:`${height}%`}}/>)}</div>{audio?<><audio data-testid="gemini-audio" controls src={audio}/><a className={styles.download} href={audio} download={`manifoldgen-gemini-tts.${format}`}><Download size={14}/> Download {format.toUpperCase()}</a></>:<p className={styles.empty}>{status||'Your performance will appear here'}</p>}</div><div className={styles.facts}><div><b>30</b><span>VOICES</span></div><div><b>24 kHz</b><span>WAV</span></div><div><b>{characters||'—'}</b><span>CHARS</span></div></div></div>
    </section></main>;
}
