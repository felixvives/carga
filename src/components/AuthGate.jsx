import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

const bg = "#16171A";
const surface = "#202226";
const border = "#34373D";
const textPrimary = "#F2F0EC";
const textMuted = "#8B8F97";
const iron = "#C8442D";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendMagicLink = async (e) => {
    e.preventDefault();
    setError(null);
    // emailRedirectTo usa la URL actual (localhost en dev, tu dominio de GitHub
    // Pages en producción) en vez de depender solo del "Site URL" fijo de Supabase.
    // Igual necesitás tener esa URL agregada en Authentication > URL Configuration
    // > Redirect URLs, o Supabase la va a rechazar.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  if (session === undefined) {
    return (
      <div style={{ background: bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: textMuted, fontFamily: "monospace", fontSize: 13 }}>cargando...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ background: bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        <form
          onSubmit={sendMagicLink}
          style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: 28, width: 300 }}
        >
          <h1 style={{ color: textPrimary, fontFamily: "monospace", fontSize: 22, marginBottom: 4 }}>CARGA</h1>
          <p style={{ color: textMuted, fontSize: 13, marginBottom: 16 }}>Entrá con tu correo, te mandamos un link de acceso.</p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: bg, border: `1px solid ${border}`, color: textPrimary, marginBottom: 12, boxSizing: "border-box" }}
          />
          <button
            type="submit"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: iron, color: "#fff", border: "none", fontWeight: 600 }}
          >
            Enviar link
          </button>
          {sent && <p style={{ color: "#4F8F5B", fontSize: 12, marginTop: 10 }}>Revisá tu correo y hacé click en el link.</p>}
          {error && <p style={{ color: iron, fontSize: 12, marginTop: 10 }}>{error}</p>}
        </form>
      </div>
    );
  }

  return children;
}
