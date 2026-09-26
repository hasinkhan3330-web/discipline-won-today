import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Play, Pause, Music2, Volume2 } from "lucide-react";
import { completeFocusMusic } from "@/utils/focus-music.functions";
import beta14 from "@/assets/audio/beta14.mp3.asset.json";
import pure40 from "@/assets/audio/pure40.mp3.asset.json";
import battleWave from "@/assets/audio/battlewave.mp3.asset.json";

const TRACKS = [
  { id: "beta14", name: "14Hz Beta", sub: "Deep concentration", src: beta14.url, intensity: "steady" as const },
  { id: "pure40", name: "40Hz Binaural", sub: "Memory and clarity", src: pure40.url, intensity: "calm" as const },
  { id: "battle", name: "Battle Wave", sub: "High-intensity execution", src: battleWave.url, intensity: "intense" as const },
];
const DURATIONS = [{m:25,reward:0},{m:45,reward:0},{m:60,reward:0},{m:90,reward:0}] as const;
const two = (n:number) => String(n).padStart(2,"0");
const fmt = (seconds:number) => `${two(Math.floor(seconds/3600))}:${two(Math.floor((seconds%3600)/60))}:${two(seconds%60)}`;

export function FocusMusicPanel({ onClose, onReward }: { onClose: () => void; onReward?: (coins: number, minutes: number) => void }) {
  const complete = useServerFn(completeFocusMusic);
  const [trackId,setTrackId] = useState(TRACKS[0]?.id ?? "beta14");
  const [minutes,setMinutes] = useState<25|45|60|90>(25);
  const [running,setRunning] = useState(false);
  const [left,setLeft] = useState(25*60);
  const [volume,setVolume] = useState(.7);
  const [rewarding,setRewarding] = useState(false);
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const tokenRef = useRef<string|null>(null);
  const track = TRACKS.find(item => item.id===trackId) ?? TRACKS[0];
  const reward = DURATIONS.find(item => item.m===minutes)?.reward ?? 5;

  useEffect(() => { if (!running) setLeft(minutes*60); },[minutes,running]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume=volume; },[volume,trackId]);
  useEffect(() => () => audioRef.current?.pause(),[]);

  const finish = useCallback(async () => {
    const token=tokenRef.current;
    if (!token || rewarding || !track) return;
    setRewarding(true);
    try {
      const result=await complete({data:{sessionToken:token,minutes,intensity:track.intensity}});
      onReward?.(result.awarded,result.minutes);
      toast.success("Focus session logged");
    } catch (cause) { toast.error("Could not save that focus session",{description:cause instanceof Error?cause.message:"Try again."}); }
    finally { setRewarding(false); }
  },[complete,minutes,onReward,rewarding,track]);

  useEffect(() => {
    if (!running) return;
    const id=window.setInterval(() => setLeft(seconds => {
      if (seconds>1) return seconds-1;
      window.clearInterval(id); audioRef.current?.pause(); setRunning(false); queueMicrotask(() => void finish()); return 0;
    }),1000);
    return () => window.clearInterval(id);
  },[running,finish]);

  const toggle=async()=>{
    const audio=audioRef.current; if(!audio||rewarding) return;
    if(running){audio.pause();setRunning(false);return;}
    if(left<=0){setLeft(minutes*60);tokenRef.current=null;}
    if(!tokenRef.current) tokenRef.current=crypto.randomUUID();
    try{await audio.play();setRunning(true);}catch{toast.error("Audio could not start");}
  };
  const pickTrack=(id:string)=>{audioRef.current?.pause();setRunning(false);setTrackId(id);};

  return <div className="focus-music-overlay" onClick={onClose}><section className="focus-music-panel" onClick={event=>event.stopPropagation()} aria-label="Focus music session">
    <header><span><Music2 size={19}/></span><div><h2>Focus Music</h2><p>Sound engineered for disciplined work</p></div><button onClick={onClose} aria-label="Close focus music"><X size={19}/></button></header>
    <div className="focus-wave" aria-hidden="true">{Array.from({length:24},(_,index)=><i key={index} style={{animationDelay:`${index*35}ms`}} className={running?"is-running":""}/>)}</div>
    <div className="focus-clock"><strong>{fmt(left)}</strong><span>{running?"Session active":left===0?"Session complete":"Ready to focus"} · focus only · no coins</span></div>
    <label className="focus-label">Session length</label><div className="focus-durations">{DURATIONS.map(item=><button key={item.m} disabled={running} className={minutes===item.m?"is-active":""} onClick={()=>setMinutes(item.m)}><strong>{item.m}</strong><span>MIN</span><small>focus</small></button>)}</div>
    <label className="focus-label">Soundscape</label><div className="focus-tracks">{TRACKS.map(item=><button key={item.id} className={item.id===trackId?"is-active":""} onClick={()=>pickTrack(item.id)}><Volume2 size={16}/><span><strong>{item.name}</strong><small>{item.sub}</small></span><i/></button>)}</div>
    <div className="focus-volume"><Volume2 size={15}/><input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={event=>setVolume(Number(event.target.value))}/></div>
    <button className="focus-main-control" onClick={toggle} disabled={rewarding}>{running?<Pause size={18}/>:<Play size={18}/>} {rewarding?"Saving…":running?"Pause session":left===0?"Start another session":"Start focus session"}</button>
    <audio ref={audioRef} src={track?.src} loop preload="metadata"/>
  </section></div>;
}