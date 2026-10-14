import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { ShieldCheck, LockKeyhole } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { trpc } from "./lib/trpc";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

function LoginScreen() {
  const [username,setUsername]=useState(""); const [password,setPassword]=useState("");
  const utils=trpc.useUtils();
  const login=trpc.auth.login.useMutation({onSuccess:()=>utils.auth.me.invalidate()});
  return <main className="login-shell"><section className="login-card"><div className="login-brand"><span className="brand-mark"><ShieldCheck size={24}/></span><span>guardia<strong>flow</strong></span></div><p className="eyebrow teal">ACCESO SEGURO</p><h1>Control de personal</h1><p className="login-copy">Ingresa con tu usuario de supervisor para ver los sitios y guardias asignados.</p><form onSubmit={e=>{e.preventDefault();login.mutate({username,password})}}><label>Usuario<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Ej. supervisor"/></label><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña"/></label>{login.error&&<p className="login-error">{login.error.message}</p>}<button className="primary login-button" disabled={login.isPending||username.length<2||password.length<8}><LockKeyhole size={17}/>{login.isPending?"Verificando…":"Ingresar al sistema"}</button></form><small className="login-note">El administrador puede crear supervisores desde Empresas y supervisores.</small></section></main>;
}

function AuthGate(){const me=trpc.auth.me.useQuery(); if(me.isLoading)return <main className="login-shell"><div className="login-loading">Verificando sesión…</div></main>; return me.data?.authenticated?<Router/>:<LoginScreen/>;}

function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><AuthGate /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
export default App;
