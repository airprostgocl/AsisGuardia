import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation, useSearch } from "wouter";
import { ShieldCheck, LockKeyhole } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { trpc } from "./lib/trpc";
import { ForceChangePasswordScreen, ForgotPasswordScreen, ResetPasswordScreen } from "./pages/PasswordScreens";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

function LoginScreen() {
  const [username,setUsername]=useState(""); const [password,setPassword]=useState(""); const [forgot,setForgot]=useState(false);
  const utils=trpc.useUtils();
  const login=trpc.auth.login.useMutation({onSuccess:()=>utils.auth.me.invalidate()});
  if (forgot) return <ForgotPasswordScreen onBack={()=>setForgot(false)}/>;
  return <main className="login-shell"><section className="login-card"><div className="login-brand"><span className="brand-mark"><ShieldCheck size={24}/></span><span>guardia<strong>flow</strong></span></div><p className="eyebrow teal">ACCESO SEGURO</p><h1>Control de personal</h1><p className="login-copy">Ingresa con tu usuario de supervisor para ver los sitios y guardias asignados.</p><form onSubmit={e=>{e.preventDefault();login.mutate({username,password})}}><label>Usuario<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Ej. supervisor"/></label><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña"/></label>{login.error&&<p className="login-error">{login.error.message}</p>}<button className="primary login-button" disabled={login.isPending||username.length<2||password.length<8}><LockKeyhole size={17}/>{login.isPending?"Verificando…":"Ingresar al sistema"}</button></form><button type="button" className="link-button" onClick={()=>setForgot(true)}>¿Olvidaste tu contraseña?</button><small className="login-note">Si no tienes cuenta, pídela al administrador de GuardiaFlow.</small></section></main>;
}

function AuthGate(){
  const [location,navigate]=useLocation(); const search=useSearch();
  const me=trpc.auth.me.useQuery(undefined,{enabled:location!=="/restablecer"});
  // El enlace del correo de recuperación funciona con o sin sesión iniciada.
  if(location==="/restablecer")return <ResetPasswordScreen token={new URLSearchParams(search).get("token")||""} onDone={()=>navigate("/",{replace:true})}/>;
  if(me.isLoading)return <main className="login-shell"><div className="login-loading">Verificando sesión…</div></main>;
  if(!me.data?.authenticated)return <LoginScreen/>;
  if(me.data.supervisor?.mustChangePassword)return <ForceChangePasswordScreen name={me.data.supervisor.name}/>;
  return <Router/>;
}

function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><AuthGate /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
export default App;
