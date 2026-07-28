export function SpaceWallpaper({ accent }: { accent: string }) {
  // deterministic star field
  const stars = Array.from({ length: 90 }, (_, i) => {
    const x = (i * 37) % 100;
    const y = (i * 71) % 100;
    const s = ((i * 13) % 3) + 1;
    const d = ((i * 7) % 40) / 10;
    return { x, y, s, d, k: i };
  });
  const shootingStars = [0, 1, 2, 3];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none", background: "radial-gradient(ellipse at 20% 10%, #1a0a3e 0%, #0a0620 40%, #000 100%)" }}>
      {/* nebula glow */}
      <div style={{ position: "absolute", top: "-20%", right: "-10%", width: 500, height: 500, background: `radial-gradient(circle, ${accent}22 0%, transparent 60%)`, filter: "blur(40px)" }} />
      <div style={{ position: "absolute", bottom: "-10%", left: "-20%", width: 500, height: 500, background: "radial-gradient(circle, #7b5cff33 0%, transparent 60%)", filter: "blur(40px)" }} />

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
          position: "absolute", top: `${10 + i * 20}%`, left: "-10%",
          width: 120, height: 1, background: `linear-gradient(90deg, transparent, ${accent}, #fff)`,
          boxShadow: `0 0 8px ${accent}`,
          animation: `shoot 6s linear ${i * 2.2}s infinite`,
          transform: "rotate(20deg)",
        }} />
      ))}

      {/* scanline grid */}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${accent}05 1px, transparent 1px), linear-gradient(90deg, ${accent}05 1px, transparent 1px)`, backgroundSize: "40px 40px", opacity: 0.4 }} />
    </div>
  );
}
