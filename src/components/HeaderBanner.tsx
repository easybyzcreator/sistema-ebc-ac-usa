import React from "react";

export default function HeaderBanner() {
  return (
    <div className="bg-gradient-to-br from-[#342825] via-[#453430] to-[#5a423d] rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-[#BD5944]/30 mb-8">
      {/* Andreia Cakes USA Watermark on the Right */}
      <div className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none select-none">
        <img 
          src="https://i.ibb.co/G33D7hsJ/Gemini-Generated-Image-pv7de2pv7de2pv7d.jpg" 
          alt="Andreia Cakes USA Watermark" 
          className="w-72 h-72 sm:w-80 sm:h-80 object-cover rounded-full"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="relative z-10 max-w-2xl">
        <span className="bg-[#BD5944] text-white text-[11px] uppercase tracking-wider font-bold py-1 px-3 rounded-full shadow-xs">
          Painel Geral da Parceria
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold mt-3 tracking-tight">
          EBC & Andreia Cakes USA
        </h2>
        <p className="text-slate-200/90 text-sm mt-2 leading-relaxed">
          Gestão integrada de clientes e contatos da Andreia Cakes USA com ativação técnica, assinaturas digitais de contratos e comissionamentos da Easy Byz Creator (EBC).
        </p>
        <div className="flex flex-wrap gap-4 mt-6">
          <div className="bg-white/10 px-4 py-2 rounded-xl text-xs flex items-center gap-2 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Sincronização em tempo real ativa
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl text-xs flex items-center gap-2 border border-white/10">
            <span className="text-[#BD5944] font-black text-sm bg-white px-1.5 py-0.5 rounded-md">10%</span>
            Comissão fixa configurada
          </div>
        </div>
      </div>
    </div>
  );
}

