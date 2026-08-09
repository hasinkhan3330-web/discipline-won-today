export function SpaceWallpaper({ accent, level = 0, photo }: { accent: string; level?: number; photo?: string }) {
  // deterministic star field
  const starCount = 90 + level * 30;
  const stars = Array.from({ length: starCount }, (_, i) => {
    const x = (i * 37) % 100;
    const y = (i * 71) % 100;
    const s = ((i * 13) % 3) + 1;
    const d = ((i * 7) % 40) / 10;
    return { x, y, s, d, k: i };
  });
  const shootingStars = Array.from({ length: 4 + level * 2 }, (_, i) => i);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none", background: "radial-gradient(ellipse at 20% 10%, #1a0a3e 0%, #0a0620 40%, #000 100%)" }}>
      {/* photo wallpaper layer */}
      {photo && (
        <>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center bottom",
            opacity: 0.85, transform: "scale(1.04)", animation: "wall-drift 26s ease-in-out infinite alternate",
          }} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.75) 100%)` }} />
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 62%, ${accent}1f 0%, transparent 55%)` }} />
        </>
      )}

      {/* nebula glow */}
      {!photo && <div style={{ position: "absolute", top: "-20%", right: "-10%", width: 500, height: 500, background: `radial-gradient(circle, ${accent}22 0%, transparent 60%)`, filter: "blur(40px)" }} />
      <div style={{ position: "absolute", bottom: "-10%", left: "-20%", width: 500, height: 500, background: "radial-gradient(circle, #7b5cff33 0%, transparent 60%)", filter: "blur(40px)" }} />

      {/* level 1+ : aurora curtain */}
      {level >= 1 && (
        <div style={{
          position: "absolute", top: "-10%", left: "-25%", width: "150%", height: "60%",
          background: `linear-gradient(115deg, transparent 20%, ${accent}33 45%, #8a5bff33 60%, transparent 80%)`,
          filter: "blur(50px)", animation: "aurora-drift 18s ease-in-out infinite",
        }} />
      )}

      {/* level 2+ : neural orbital rings */}
      {level >= 2 && [0, 1].map(i => (
        <div key={`ring${i}`} style={{
          position: "absolute", left: "50%", top: "55%",
          width: 420 + i * 200, height: 420 + i * 200, marginLeft: -(210 + i * 100), marginTop: -(210 + i * 100),
          borderRadius: "50%", border: `1px solid ${accent}${i ? "18" : "28"}`,
          animation: `ring-orbit ${26 + i * 14}s linear infinite${i ? " reverse" : ""}`,
        }}>
          <div style={{ position: "absolute", top: -3, left: "50%", width: 6, height: 6, borderRadius: "50%", background: accent, boxShadow: `0 0 14px ${accent}` }} />
        </div>
      ))}

      {/* earth — equirectangular NASA Blue Marble wrapped on a rotating sphere */}
      <div style={{ position: "absolute", top: 50, right: 20, width: 120, height: 120 }}>
        <div style={{ position: "absolute", inset: -18, borderRadius: "50%", background: "radial-gradient(circle, rgba(120,190,255,0.55) 0%, rgba(40,110,220,0.25) 50%, transparent 75%)", filter: "blur(8px)" }} />
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", boxShadow: "0 0 55px rgba(90,170,255,0.7), 0 0 120px rgba(40,100,220,0.4)" }}>
          <div
            style={{
              position: "absolute", inset: 0,
              backgroundImage: "url('https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Land_ocean_ice_2048.jpg/1024px-Land_ocean_ice_2048.jpg')",
              backgroundSize: "200% 100%",
              backgroundRepeat: "repeat-x",
              animation: "earth-spin 24s linear infinite",
            }}
          />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25) 0%, transparent 45%), radial-gradient(circle at 70% 70%, rgba(0,0,0,0.35) 0%, transparent 60%)", pointerEvents: "none" }} />
        </div>
      </div>

      {/* stars */}
      {stars.map(st => (
        <div key={st.k} style={{
          position: "absolute", left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s,
          background: "#fff", borderRadius: "50%", boxShadow: `0 0 ${st.s * 3}px #fff`,
          animation: `twinkle 3s ease-in-out ${st.d}s infinite`,
        }} />
      ))}

      {/* shooting stars */}
      {shootingStars.map(i => (
        <div key={i} style={{
          position: "absolute", top: `${8 + i * 12}%`, left: "-10%",
          width: 120, height: 1, background: `linear-gradient(90deg, transparent, ${accent}, #fff)`,
          boxShadow: `0 0 8px ${accent}`,
          animation: `shoot 6s linear ${i * 1.4}s infinite`,
          transform: "rotate(20deg)",
        }} />
      ))}

      {/* level 3+ : plasma energy arcs */}
      {level >= 3 && [0, 1, 2].map(i => (
        <div key={`arc${i}`} style={{
          position: "absolute", left: `${-10 + i * 30}%`, top: `${20 + i * 18}%`,
          width: "70%", height: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          filter: "blur(1px)", opacity: 0.55,
          animation: `plasma-wave ${7 + i * 2}s ease-in-out ${i * 1.3}s infinite`,
        }} />
      ))}

      {/* level 4+ : quantum helix */}
      {level >= 4 && (
        <div style={{ position: "absolute", left: "6%", top: "12%", height: "70%", width: 60 }}>
          {Array.from({ length: 18 }, (_, i) => (
            <div key={`hx${i}`} style={{
              position: "absolute", top: `${i * 5.4}%`, left: 0, width: 8, height: 8, borderRadius: "50%",
              background: i % 2 ? accent : "#fff", boxShadow: `0 0 12px ${accent}`,
              animation: `helix-spin 4s linear ${i * 0.12}s infinite`, opacity: 0.7,
            }} />
          ))}
        </div>
      )}

      {/* level 5+ : nova flare */}
      {level >= 5 && (
        <div style={{
          position: "absolute", left: "50%", top: "20%", width: 260, height: 260, marginLeft: -130,
          borderRadius: "50%", background: `radial-gradient(circle, ${accent}55 0%, transparent 65%)`,
          filter: "blur(20px)", animation: "nova-pulse 5s ease-in-out infinite",
        }} />
      )}

      {/* level 6+ : titan hex shield */}
      {level >= 6 && (
        <div style={{
          position: "absolute", inset: 0,
          background: `repeating-linear-gradient(60deg, ${accent}0f 0 1px, transparent 1px 26px), repeating-linear-gradient(-60deg, ${accent}0f 0 1px, transparent 1px 26px)`,
          animation: "nova-pulse 9s ease-in-out infinite",
        }} />
      )}

      {/* level 7 : rocket launch */}
      {level >= 7 && [0, 1].map(i => (
        <div key={`rk${i}`} style={{
          position: "absolute", bottom: "-15%", left: `${18 + i * 48}%`,
          animation: `rocket-fly ${9 + i * 3}s linear ${i * 4}s infinite`,
        }}>
          <div style={{ fontSize: 26, transform: "rotate(-12deg)", filter: `drop-shadow(0 0 12px ${accent})` }}>🚀</div>
          <div style={{ position: "absolute", top: 24, left: 6, width: 4, height: 90, background: `linear-gradient(180deg, ${accent}, transparent)`, filter: "blur(3px)", opacity: 0.8 }} />
        </div>
      ))}


      {/* scanline grid */}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${accent}05 1px, transparent 1px), linear-gradient(90deg, ${accent}05 1px, transparent 1px)`, backgroundSize: "40px 40px", opacity: 0.4 }} />
    </div>
  );
}
