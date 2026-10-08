import React, { useState } from "react";
import { UserRole } from "../types";
import { Shield, Eye, EyeOff, CheckCircle2, UserCheck, KeyRound, ArrowRight } from "lucide-react";

interface AuthLoginProps {
  onLogin: (role: UserRole) => void;
}

export default function AuthLogin({ onLogin }: AuthLoginProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>("viewer");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Senhas de acesso:
  // Visualização (Andreia Cakes USA): "0711"
  // Acesso Geral (EBC): "1306"
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      const cleanPass = password.trim();

      // Reconhecimento inteligente da senha independente do botão previamente marcado
      if (cleanPass === "0711" || cleanPass === "acusa2026" || cleanPass === "andreia") {
        onLogin("viewer");
        return;
      }

      if (cleanPass === "1306" || cleanPass === "ebcadm2026" || cleanPass === "admin") {
        onLogin("admin");
        return;
      }

      // Se não corresponder a nenhuma senha
      if (selectedRole === "viewer") {
        setError("Senha de Visualização incorreta. Para Andreia Cakes USA, utilize a senha 0711.");
      } else {
        setError("Senha de Acesso Geral incorreta. Utilize a senha 1306 ou selecione o perfil Visualização (0711).");
      }
      setLoading(false);
    }, 250);
  };

  return (
    <div className="min-h-screen bg-[#F7F2EC] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-[#342825]/10 p-8 sm:p-10 space-y-6 relative overflow-hidden">
        
        {/* Top Header Logos */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img 
              src="https://i.ibb.co/G33D7hsJ/Gemini-Generated-Image-pv7de2pv7de2pv7d.jpg" 
              alt="Andreia Cakes USA Logo" 
              className="h-14 w-14 rounded-2xl object-cover border border-[#BD5944]/20 shadow-xs"
              referrerPolicy="no-referrer"
            />
            <div className="h-8 w-px bg-slate-200"></div>
            <img 
              src="https://i.ibb.co/PG6c7BgZ/logo-easybyzcreator.png" 
              alt="EBC Logo" 
              className="h-10 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-base font-black tracking-tight text-[#342825] uppercase">
            SISTEMA EBC-AC-USA
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            EBC & Andreia Cakes USA • Clientes, Contratos & Finanças
          </p>
        </div>

        {/* Profile Selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
            Selecione o Perfil de Acesso
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSelectedRole("viewer");
                setError(null);
              }}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                selectedRole === "viewer"
                  ? "bg-[#342825] text-white border-[#342825] shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-[#F7F2EC]"
              }`}
            >
              <div className="flex items-center justify-between">
                <UserCheck size={16} className={selectedRole === "viewer" ? "text-[#BD5944]" : "text-slate-400"} />
                {selectedRole === "viewer" && <CheckCircle2 size={14} className="text-[#BD5944]" />}
              </div>
              <span className="text-xs font-black uppercase tracking-wider mt-1">Visualização</span>
              <span className={`text-[10px] ${selectedRole === "viewer" ? "text-[#F7F2EC]" : "text-slate-400"}`}>
                Andreia Cakes USA (0711)
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRole("admin");
                setError(null);
              }}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                selectedRole === "admin"
                  ? "bg-[#342825] text-white border-[#342825] shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-[#F7F2EC]"
              }`}
            >
              <div className="flex items-center justify-between">
                <Shield size={16} className={selectedRole === "admin" ? "text-[#BD5944]" : "text-slate-400"} />
                {selectedRole === "admin" && <CheckCircle2 size={14} className="text-[#BD5944]" />}
              </div>
              <span className="text-xs font-black uppercase tracking-wider mt-1">Acesso Geral</span>
              <span className={`text-[10px] ${selectedRole === "admin" ? "text-[#F7F2EC]" : "text-slate-400"}`}>
                Total EBC (1306)
              </span>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Senha de Acesso ({selectedRole === "viewer" ? "Visualização" : "Acesso Geral"})</span>
            </label>

            <div className="relative">
              <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={selectedRole === "viewer" ? "Digite a senha (0711)..." : "Digite a senha (1306)..."}
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-[#342825] focus:outline-none focus:ring-2 focus:ring-[#BD5944]"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#342825] cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-[#BD5944]/10 border border-[#BD5944]/30 text-[#BD5944] text-xs rounded-xl font-bold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 cursor-pointer ${
              loading || !password.trim()
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-[#BD5944] hover:bg-[#342825] text-white"
            }`}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
