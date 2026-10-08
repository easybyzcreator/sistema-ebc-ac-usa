import React, { useState, useEffect } from "react";
import { Lead, ContractConfig } from "../types";
import { getDefaultContractConfig, formatClause3 } from "../lib/contractDefaults";
import DatePickerBR from "./DatePickerBR";
import { 
  X, 
  Save, 
  FileText, 
  Building2, 
  User2, 
  DollarSign, 
  KeyRound, 
  FileEdit, 
  Eye, 
  Sparkles, 
  RefreshCw, 
  Check, 
  Calendar,
  Lock,
  ShieldAlert,
  Shield
} from "lucide-react";
import { formatCpfCnpj, formatDateBRInput, formatPhoneBR } from "../lib/masks";

interface ContractConfiguratorProps {
  lead: Lead;
  onSave: (config: ContractConfig) => Promise<void>;
  onClose: () => void;
  isReadOnly?: boolean;
}

export default function ContractConfigurator({ lead, onSave, onClose, isReadOnly = false }: ContractConfiguratorProps) {
  const [config, setConfig] = useState<ContractConfig>(() => {
    const base = lead.contractConfig || getDefaultContractConfig(lead);
    const defaults = getDefaultContractConfig(lead);
    
    let actInstr = base.activationInstructions || defaults.activationInstructions;
    if (actInstr.includes("7 dias úteis")) {
      actInstr = actInstr.replace("7 dias úteis", "10 dias úteis");
    }
    
    let c2 = base.clause2Body || defaults.clause2Body;
    if (c2.includes("7 (sete) dias úteis")) {
      c2 = c2.replace("7 (sete) dias úteis", "10 (dez) dias úteis");
    } else if (c2.includes("7 dias úteis")) {
      c2 = c2.replace("7 dias úteis", "10 (dez) dias úteis");
    }

    let c3 = base.clause3Body || defaults.clause3Body;
    if (c3 && !c3.includes("3.6.")) {
      c3 = `${c3}\n\n3.6. Da Suspensão dos Serviços por Inadimplemento: O atraso superior a 48 (quarenta e oito horas) no pagamento de qualquer parcela mensal, contado a partir da data de vencimento, autorizará a CONTRATADA a realizar a suspensão temporária dos serviços, incluindo a retirada do aplicativo/sistema do ar e o bloqueio de suporte, mediante aviso prévio por e-mail ou mensagem eletrônica.\n\n• Parágrafo único: O reestabelecimento do sistema e a liberação do acesso ocorrerão exclusivamente após a comprovação da quitação integral dos valores em aberto (incluindo multas e juros previstos no item 3.4) e a compensação bancária confirmada na conta da CONTRATADA.`;
    }

    return {
      ...defaults,
      ...base,
      activationInstructions: actInstr,
      clause2Body: c2,
      clause3Body: c3
    };
  });
  const [saving, setSaving] = useState(false);
  const [activePane, setActivePane] = useState<"edit" | "preview">("edit"); // Responsive pane for smaller screens
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Local state inputs for supporting commas and cents without spinners
  const [installmentInput, setInstallmentInput] = useState<string>(() => {
    const initialVal = lead.contractConfig?.installmentValue ?? lead.monthlyFee ?? "";
    if (initialVal === "") return "";
    return String(initialVal).replace(".", ",");
  });
  
  const [setupFeeInput, setSetupFeeInput] = useState<string>(() => {
    const initialVal = lead.contractConfig?.setupFee ?? lead.configurationFee ?? "";
    if (initialVal === "") return "";
    return String(initialVal).replace(".", ",");
  });

  // Keep client information updated if it changes in lead prop
  useEffect(() => {
    if (!lead.contractConfig) {
      const defaultConf = getDefaultContractConfig(lead);
      setConfig(defaultConf);
      setInstallmentInput(defaultConf.installmentValue === "" ? "" : String(defaultConf.installmentValue).replace(".", ","));
      setSetupFeeInput(defaultConf.setupFee === "" ? "" : String(defaultConf.setupFee).replace(".", ","));
    }
  }, [lead]);

  const handleChange = (field: keyof ContractConfig, value: any) => {
    setConfig(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-calculate annual total if installment changes
      if (field === "installmentValue") {
        const instVal = value !== "" ? Number(value) : 0;
        updated.totalAnnualValue = instVal * 12;
      }
      return updated;
    });
  };

  const handleInstallmentInputChange = (val: string) => {
    setInstallmentInput(val);
    const clean = val.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(clean);
    const numericVal = isNaN(parsed) ? "" : parsed;
    
    handleChange("installmentValue", numericVal);
  };

  const handleSetupFeeInputChange = (val: string) => {
    setSetupFeeInput(val);
    const clean = val.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(clean);
    const numericVal = isNaN(parsed) ? "" : parsed;
    
    handleChange("setupFee", numericVal);
  };

  const handleResetToDefaults = () => {
    if (isReadOnly) return;
    const defaultConf = getDefaultContractConfig(lead);
    setConfig(defaultConf);
    setInstallmentInput(defaultConf.installmentValue === "" ? "" : String(defaultConf.installmentValue).replace(".", ","));
    setSetupFeeInput(defaultConf.setupFee === "" ? "" : String(defaultConf.setupFee).replace(".", ","));
    setShowResetConfirm(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    try {
      setSaving(true);
      await onSave(config);
      setSaving(false);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  // Live formatted clause 3 rendering helper
  const formattedClause3Text = formatClause3(config.clause3Body, {
    frequency: config.frequency,
    installmentValue: config.installmentValue,
    setupFee: config.setupFee,
    totalAnnualValue: config.totalAnnualValue,
    setupInstallments: config.setupInstallments || 1,
    firstMonthlyDueDate: config.firstMonthlyDueDate,
    setupDueDate: config.setupDueDate,
    setupDueDateOption: config.setupDueDateOption
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 z-50 overflow-hidden animate-fadeIn">
      <div className="bg-white text-slate-800 w-full h-full sm:h-[95vh] sm:max-w-7xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header Title Bar */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#BD5944]/10 flex items-center justify-center text-[#BD5944]">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-[#342825] uppercase flex items-center gap-1.5">
                Configuração Completa do Contrato
              </h2>
              <p className="text-[10px] text-slate-500">Personalize termos, cláusulas e chaves de pagamento em tempo real para o cliente: <strong>{lead.name}</strong></p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isReadOnly ? (
              <button
                onClick={handleResetToDefaults}
                className="text-slate-600 hover:text-slate-950 text-[10px] font-bold py-1.5 px-3 bg-slate-100 rounded-lg hover:bg-slate-200 transition flex items-center gap-1 cursor-pointer border border-slate-200"
                title="Restaurar clausulas padrão"
              >
                <RefreshCw size={11} />
                Restaurar Padrão
              </button>
            ) : (
              <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-800 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Lock size={11} />
                Acesso EGN (Leitura)
              </span>
            )}
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 border border-slate-200 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Mobile View Navigation Toggle */}
        <div className="flex sm:hidden border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setActivePane("edit")}
            className={`flex-1 py-3 text-xs font-bold transition-all text-center border-b-2 ${
              activePane === "edit" ? "border-[#BD5944] text-[#BD5944] bg-white font-black" : "border-transparent text-slate-500"
            }`}
          >
            Editar Campos
          </button>
          <button
            onClick={() => setActivePane("preview")}
            className={`flex-1 py-3 text-xs font-bold transition-all text-center border-b-2 ${
              activePane === "preview" ? "border-[#BD5944] text-[#BD5944] bg-white font-black" : "border-transparent text-slate-500"
            }`}
          >
            Visualizar Contrato
          </button>
        </div>

        {/* Dual Panel Body Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT PANEL: INPUT FORM (Configurator) */}
          <form 
            onSubmit={handleFormSubmit}
            className={`w-full lg:w-1/2 flex flex-col bg-[#fcfdfa] overflow-hidden ${
              activePane === "edit" ? "flex" : "hidden lg:flex"
            }`}
          >
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-light">
              {isReadOnly && (
                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 flex items-start gap-3 text-amber-900 shadow-xs">
                  <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={18} />
                  <div className="text-xs">
                    <p className="font-extrabold uppercase tracking-wide">Modo Visualização EGN (Apenas Leitura)</p>
                    <p className="text-[11px] text-amber-800/90 mt-0.5">
                      Você pode consultar todas as cláusulas e configurações do contrato, mas as alterações e regravações estão bloqueadas para este perfil.
                    </p>
                  </div>
                </div>
              )}

              <fieldset disabled={isReadOnly} className="space-y-8 contents">
              {/* SECTION 1: IDENTIFICATION OF CONTRATADA */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-[#BD5944] uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Building2 size={14} />
                  01. Identificação da Contratada
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Nome Completo (Responsável)</label>
                    <input
                      type="text"
                      required
                      value={config.contratadaName}
                      onChange={(e) => handleChange("contratadaName", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Marca / Fantasia</label>
                    <input
                      type="text"
                      required
                      value={config.contratadaBrand}
                      onChange={(e) => handleChange("contratadaBrand", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Sede / Endereço</label>
                    <input
                      type="text"
                      required
                      value={config.contratadaAddress}
                      onChange={(e) => handleChange("contratadaAddress", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: CONTRATANTE DETAILS */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-[#BD5944] uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                  <User2 size={14} />
                  02. Dados do Contratante
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Nome do Cliente</label>
                    <input
                      type="text"
                      required
                      value={config.clientName}
                      onChange={(e) => handleChange("clientName", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Nome da Empresa</label>
                    <input
                      type="text"
                      value={config.clientCompany}
                      onChange={(e) => handleChange("clientCompany", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">E-mail</label>
                    <input
                      type="email"
                      value={config.clientEmail}
                      onChange={(e) => handleChange("clientEmail", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">CPF</label>
                    <input
                      type="text"
                      value={config.clientDoc}
                      onChange={(e) => handleChange("clientDoc", formatCpfCnpj(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">WhatsApp</label>
                    <input
                      type="text"
                      value={config.clientPhone}
                      onChange={(e) => handleChange("clientPhone", formatPhoneBR(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Data de Nascimento</label>
                    <input
                      type="text"
                      value={config.clientBirthDate}
                      onChange={(e) => handleChange("clientBirthDate", formatDateBRInput(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Endereço nos EUA (com Zip Code)</label>
                    <input
                      type="text"
                      value={config.clientAddress}
                      onChange={(e) => handleChange("clientAddress", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: PLAN AND VALUES */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-[#BD5944] uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                  <DollarSign size={14} />
                  03. Plano e Valores (em Dólar - USD $)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Título do Serviço / Plataforma</label>
                    <input
                      type="text"
                      required
                      value={config.serviceTitle}
                      onChange={(e) => handleChange("serviceTitle", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 font-bold transition"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Periodicidade de Cobrança</label>
                    <div className="bg-[#BD5944]/10 px-4 py-2.5 rounded-xl border border-[#BD5944]/20 text-xs font-bold text-[#342825] flex items-center gap-2">
                      <Check size={14} />
                      Plano Mensal (Única Opção Ativa)
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">V. Parcela / Mensalidade ($)</label>
                    <input
                      type="text"
                      value={installmentInput}
                      onChange={(e) => handleInstallmentInputChange(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                      placeholder="Ex: 450,00"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-[#BD5944]" />
                        Data de Pagamento da 1ª Mensalidade
                      </span>
                      <span className="text-[9px] font-semibold text-slate-500 normal-case">
                        (Defina o vencimento da Mensalidade)
                      </span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleChange("monthlyDueDateOption", "signing_date");
                          handleChange("firstMonthlyDueDate", "");
                        }}
                        className={`text-left p-2.5 rounded-lg text-xs font-bold border transition flex items-center gap-2 cursor-pointer ${
                          config.monthlyDueDateOption !== "custom_date" && !config.firstMonthlyDueDate
                            ? "bg-[#BD5944]/10 border-[#BD5944] text-[#342825]"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100/60"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          config.monthlyDueDateOption !== "custom_date" && !config.firstMonthlyDueDate
                            ? "border-[#BD5944] bg-[#BD5944]"
                            : "border-slate-300 bg-white"
                        }`}>
                          {config.monthlyDueDateOption !== "custom_date" && !config.firstMonthlyDueDate && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <span>Mesmo dia da assinatura do contrato</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleChange("monthlyDueDateOption", "custom_date");
                          if (!config.firstMonthlyDueDate) {
                            const d = new Date();
                            d.setDate(d.getDate() + 15);
                            handleChange("firstMonthlyDueDate", d.toISOString().split("T")[0]);
                          }
                        }}
                        className={`text-left p-2.5 rounded-lg text-xs font-bold border transition flex items-center gap-2 cursor-pointer ${
                          config.monthlyDueDateOption === "custom_date" || !!config.firstMonthlyDueDate
                            ? "bg-[#BD5944]/10 border-[#BD5944] text-[#342825]"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100/60"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          config.monthlyDueDateOption === "custom_date" || !!config.firstMonthlyDueDate
                            ? "border-[#BD5944] bg-[#BD5944]"
                            : "border-slate-300 bg-white"
                        }`}>
                          {(config.monthlyDueDateOption === "custom_date" || !!config.firstMonthlyDueDate) && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <span>Escolher data específica (Calendário)</span>
                      </button>
                    </div>

                    {(config.monthlyDueDateOption === "custom_date" || !!config.firstMonthlyDueDate) && (
                      <div className="pt-2">
                        <label className="text-[10px] font-bold text-slate-600 block mb-1 uppercase tracking-wider">
                          Selecione a data de vencimento da 1ª mensalidade (DD/MM/AAAA):
                        </label>
                        <DatePickerBR
                          value={config.firstMonthlyDueDate || ""}
                          onChange={(v) => {
                            handleChange("firstMonthlyDueDate", v);
                            handleChange("monthlyDueDateOption", "custom_date");
                          }}
                          placeholder="DD/MM/AAAA"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          As próximas mensalidades vencerão sempre no mesmo dia dos meses seguintes.
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Setup / Taxa de Configuração ($)</label>
                    <input
                      type="text"
                      value={setupFeeInput}
                      onChange={(e) => handleSetupFeeInputChange(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                      placeholder="Ex: 1500,00"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Parcelamento do Setup (Até 5x)</label>
                    <select
                      value={config.setupInstallments || 1}
                      onChange={(e) => handleChange("setupInstallments", parseInt(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 font-bold transition cursor-pointer"
                    >
                      <option value={1}>
                        1x à vista {config.setupFee !== "" ? `($\u00A0${Number(config.setupFee).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ""}
                      </option>
                      <option value={2}>
                        2x sem juros {config.setupFee !== "" ? `(2x de $\u00A0${(Number(config.setupFee) / 2).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ""}
                      </option>
                      <option value={3}>
                        3x sem juros {config.setupFee !== "" ? `(3x de $\u00A0${(Number(config.setupFee) / 3).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ""}
                      </option>
                      <option value={4}>
                        4x sem juros {config.setupFee !== "" ? `(4x de $\u00A0${(Number(config.setupFee) / 4).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ""}
                      </option>
                      <option value={5}>
                        5x sem juros {config.setupFee !== "" ? `(5x de $\u00A0${(Number(config.setupFee) / 5).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ""}
                      </option>
                    </select>
                  </div>

                  {/* DATA DE PAGAMENTO DA TAXA DE SETUP / CONFIGURAÇÃO */}
                  <div className="space-y-2 sm:col-span-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-[#BD5944]" />
                        Data de Pagamento da Taxa de Setup / Configuração
                      </span>
                      <span className="text-[9px] font-semibold text-slate-500 normal-case">
                        (Defina o vencimento do Setup)
                      </span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleChange("setupDueDateOption", "signing_date");
                          handleChange("setupDueDate", "");
                        }}
                        className={`text-left p-2.5 rounded-lg text-xs font-bold border transition flex items-center gap-2 cursor-pointer ${
                          config.setupDueDateOption !== "custom_date" && !config.setupDueDate
                            ? "bg-[#BD5944]/10 border-[#BD5944] text-[#342825]"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100/60"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          config.setupDueDateOption !== "custom_date" && !config.setupDueDate
                            ? "border-[#BD5944] bg-[#BD5944]"
                            : "border-slate-300 bg-white"
                        }`}>
                          {config.setupDueDateOption !== "custom_date" && !config.setupDueDate && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <span>Mesmo dia da assinatura do contrato</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleChange("setupDueDateOption", "custom_date");
                          if (!config.setupDueDate) {
                            const d = new Date();
                            handleChange("setupDueDate", d.toISOString().split("T")[0]);
                          }
                        }}
                        className={`text-left p-2.5 rounded-lg text-xs font-bold border transition flex items-center gap-2 cursor-pointer ${
                          config.setupDueDateOption === "custom_date" || !!config.setupDueDate
                            ? "bg-[#BD5944]/10 border-[#BD5944] text-[#342825]"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100/60"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          config.setupDueDateOption === "custom_date" || !!config.setupDueDate
                            ? "border-[#BD5944] bg-[#BD5944]"
                            : "border-slate-300 bg-white"
                        }`}>
                          {(config.setupDueDateOption === "custom_date" || !!config.setupDueDate) && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <span>Escolher data específica (Calendário)</span>
                      </button>
                    </div>

                    {(config.setupDueDateOption === "custom_date" || !!config.setupDueDate) && (
                      <div className="pt-2">
                        <label className="text-[10px] font-bold text-slate-600 block mb-1 uppercase tracking-wider">
                          Selecione a data de vencimento do Setup (DD/MM/AAAA):
                        </label>
                        <DatePickerBR
                          value={config.setupDueDate || ""}
                          onChange={(v) => {
                            handleChange("setupDueDate", v);
                            handleChange("setupDueDateOption", "custom_date");
                          }}
                          placeholder="DD/MM/AAAA"
                        />
                        {Number(config.setupInstallments || 1) > 1 && (
                          <p className="text-[10px] text-slate-500 mt-1">
                            Esta data será o vencimento da 1ª parcela do Setup. As demais ({Number(config.setupInstallments || 1)}x) vencerão a cada 30 dias subsequentes.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 4: PAYMENT KEYS */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-[#BD5944] uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                  <KeyRound size={14} />
                  04. Chaves de Pagamento
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Chave PIX Pré-Cadastrada</label>
                    <input
                      type="text"
                      value={config.pixKey}
                      onChange={(e) => handleChange("pixKey", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 font-mono font-bold transition"
                      placeholder="Deixar em branco se não houver"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Zelle Key (Opcional)</label>
                    <input
                      type="text"
                      value={config.zelleKey}
                      onChange={(e) => handleChange("zelleKey", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                      placeholder="Deixar em branco se não houver"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Venmo Username (Opcional)</label>
                    <input
                      type="text"
                      value={config.venmoKey}
                      onChange={(e) => handleChange("venmoKey", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                      placeholder="Deixar em branco se não houver"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Link de Pagamento Especial (Stripe/Paypal - Opcional)</label>
                    <input
                      type="url"
                      value={config.paymentLink}
                      onChange={(e) => handleChange("paymentLink", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                      placeholder="Deixar em branco se não houver"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: CUSTOM CLAUSES & INSTRUCTIONS */}
              <div className="space-y-6">
                <h3 className="text-xs font-black text-[#BD5944] uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                  <FileEdit size={14} />
                  05. Instruções e Cláusulas do Contrato
                </h3>

                {/* Box de instruções de ativação com as cores da marca */}
                <div className="space-y-1.5 p-4 bg-[#BD5944]/10 rounded-xl border border-[#BD5944]/20">
                  <span className="text-[10px] font-bold text-[#342825] uppercase tracking-wider block mb-1">Instruções de Ativação do Setup (Box da Marca)</span>
                  <textarea
                    rows={4}
                    value={config.activationInstructions}
                    onChange={(e) => handleChange("activationInstructions", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 font-sans leading-relaxed transition"
                  />
                </div>

                {/* CLAUSE 1 */}
                <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="text"
                    value={config.clause1Title}
                    onChange={(e) => handleChange("clause1Title", e.target.value)}
                    className="w-full bg-transparent border-none text-[#BD5944] text-xs font-bold uppercase tracking-wider p-0 focus:outline-none"
                  />
                  <textarea
                    rows={3}
                    value={config.clause1Body}
                    onChange={(e) => handleChange("clause1Body", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                  />
                </div>

                {/* CLAUSE 2 */}
                <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="text"
                    value={config.clause2Title}
                    onChange={(e) => handleChange("clause2Title", e.target.value)}
                    className="w-full bg-transparent border-none text-[#BD5944] text-xs font-bold uppercase tracking-wider p-0 focus:outline-none"
                  />
                  <textarea
                    rows={4}
                    value={config.clause2Body}
                    onChange={(e) => handleChange("clause2Body", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                  />
                </div>

                {/* CLAUSE 3 */}
                <div className="space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <input
                      type="text"
                      value={config.clause3Title}
                      onChange={(e) => handleChange("clause3Title", e.target.value)}
                      className="bg-transparent border-none text-[#BD5944] text-xs font-bold uppercase tracking-wider p-0 focus:outline-none flex-1"
                    />
                    <span className="text-[9px] bg-[#BD5944]/15 text-[#342825] font-bold px-2 py-0.5 rounded-full border border-[#BD5944]/20">Fórmula Ativa</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-2 leading-tight">
                    Dica: Use as tags <code className="text-[#342825] font-mono font-bold">{"{FREQUENCY}"}</code>, <code className="text-[#342825] font-mono font-bold">{"{TOTAL_VALUE}"}</code>, <code className="text-[#342825] font-mono font-bold">{"{INSTALLMENT_TEXT}"}</code> e <code className="text-[#342825] font-mono font-bold">{"{SETUP_VALUE}"}</code> para que as fórmulas de valores e setup sejam preenchidas de forma automática.
                  </p>
                  <textarea
                    rows={6}
                    value={config.clause3Body}
                    onChange={(e) => handleChange("clause3Body", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 font-mono transition"
                  />
                </div>

                {/* CLAUSE 4 */}
                <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="text"
                    value={config.clause4Title}
                    onChange={(e) => handleChange("clause4Title", e.target.value)}
                    className="w-full bg-transparent border-none text-[#BD5944] text-xs font-bold uppercase tracking-wider p-0 focus:outline-none"
                  />
                  <textarea
                    rows={3}
                    value={config.clause4Body}
                    onChange={(e) => handleChange("clause4Body", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                  />
                </div>

                {/* CLAUSE 5 */}
                <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="text"
                    value={config.clause5Title}
                    onChange={(e) => handleChange("clause5Title", e.target.value)}
                    className="w-full bg-transparent border-none text-[#BD5944] text-xs font-bold uppercase tracking-wider p-0 focus:outline-none"
                  />
                  <textarea
                    rows={3}
                    value={config.clause5Body}
                    onChange={(e) => handleChange("clause5Body", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                  />
                </div>

                {/* CLAUSE 6 */}
                <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="text"
                    value={config.clause6Title}
                    onChange={(e) => handleChange("clause6Title", e.target.value)}
                    className="w-full bg-transparent border-none text-[#BD5944] text-xs font-bold uppercase tracking-wider p-0 focus:outline-none"
                  />
                  <textarea
                    rows={6}
                    value={config.clause6Body}
                    onChange={(e) => handleChange("clause6Body", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 leading-relaxed transition"
                  />
                </div>

                {/* CLAUSE 7 */}
                <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="text"
                    value={config.clause7Title}
                    onChange={(e) => handleChange("clause7Title", e.target.value)}
                    className="w-full bg-transparent border-none text-[#BD5944] text-xs font-bold uppercase tracking-wider p-0 focus:outline-none"
                  />
                  <textarea
                    rows={4}
                    value={config.clause7Body}
                    onChange={(e) => handleChange("clause7Body", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                  />
                </div>

                {/* CLAUSE 8 */}
                <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="text"
                    value={config.clause8Title}
                    onChange={(e) => handleChange("clause8Title", e.target.value)}
                    className="w-full bg-transparent border-none text-[#BD5944] text-xs font-bold uppercase tracking-wider p-0 focus:outline-none"
                  />
                  <textarea
                    rows={4}
                    value={config.clause8Body}
                    onChange={(e) => handleChange("clause8Body", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                  />
                </div>

                {/* CLAUSE 9 */}
                <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="text"
                    value={config.clause9Title}
                    onChange={(e) => handleChange("clause9Title", e.target.value)}
                    className="w-full bg-transparent border-none text-[#BD5944] text-xs font-bold uppercase tracking-wider p-0 focus:outline-none"
                  />
                  <textarea
                    rows={4}
                    value={config.clause9Body}
                    onChange={(e) => handleChange("clause9Body", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-[#BD5944] focus:ring-1 focus:ring-[#BD5944]/30 transition"
                  />
                </div>
              </div>
              </fieldset>
            </div>

            {/* Bottom Form Action Buttons */}
            <div className="bg-white px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              {isReadOnly ? (
                <div className="w-full bg-slate-100 border border-slate-300 text-slate-500 font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 text-xs tracking-wider uppercase select-none shadow-inner">
                  <Lock size={15} className="text-slate-400" />
                  Modo Apenas Leitura (EGN) - Edição e Gravação Bloqueadas
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-[#BD5944] hover:bg-[#342825] text-white font-extrabold py-3.5 px-6 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md text-xs tracking-wider uppercase"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Gravando Configuração...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Salvar e Gerar Link Único
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* RIGHT PANEL: LIVE DOCUMENT PREVIEW */}
          <div 
            className={`w-full lg:w-1/2 bg-slate-100 border-l border-slate-200 h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] overflow-y-auto flex flex-col scrollbar-light ${
              activePane === "preview" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* THIS IS THE DIRECTLY OVERFLOWING DIV WITH ROBUST LIGHT SCROLLBAR */}
            <div className="flex-1 w-full p-4 sm:p-8 flex flex-col items-center">
              <div className="w-full max-w-2xl text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                <Eye size={14} className="text-[#BD5944]" />
                Visão em tempo real do cliente
              </div>

              {/* A4 Paper Mockup Container */}
              <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl p-6 sm:p-10 border border-slate-200/80 text-[#342825] font-sans leading-relaxed text-xs relative overflow-hidden mb-8">
                
                {/* Discrete EGN background Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none z-0">
                  <img 
                    src="https://i.ibb.co/2z275rh/logoapp.png" 
                    alt="EGN Watermark" 
                    className="w-96 h-96 object-contain rotate-[-15deg]"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="space-y-4 relative z-10">
                  {/* Centered EBC Logo - Highlighted with reduced spacing */}
                  <div className="flex flex-col items-center justify-center pt-1 pb-2 border-b border-slate-100">
                    <img 
                      src="https://i.ibb.co/PG6c7BgZ/logo-easybyzcreator.png" 
                      alt="EBC Logo" 
                      className="h-10 object-contain mb-1"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <h1 className="text-sm font-black uppercase tracking-wider text-center text-[#342825] pt-2 max-w-lg mx-auto">
                    Contrato de Prestação de Serviços - {config.serviceTitle}
                  </h1>

                  {/* Qualificação Contratada */}
                  <div className="text-[11px] space-y-1 leading-relaxed">
                    <p>
                      <strong>CONTRATADA:</strong> {config.contratadaName}, operando sob a marca <strong>{config.contratadaBrand}</strong>, com sede em {config.contratadaAddress}.
                    </p>
                  </div>

                  {/* Contractor Details Table Frame */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                    <div className="bg-slate-100/85 px-3 py-1.5 border-b border-slate-200 text-[9px] font-bold uppercase text-slate-500 tracking-wider">
                      Contratante
                    </div>
                    <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] text-slate-600">
                      <p className="truncate"><strong>Nome/Razão Social:</strong> <span className="text-slate-900 font-medium">{config.clientName || "__________________"}</span></p>
                      <p className="truncate"><strong>Nome Fantasia:</strong> <span className="text-slate-900 font-medium">{config.clientCompany || "__________________"}</span></p>
                      <p className="truncate"><strong>E-mail:</strong> <span className="text-slate-900 font-medium">{config.clientEmail || "__________________"}</span></p>
                      <p className="truncate"><strong>CPF:</strong> <span className="text-slate-900 font-medium">{config.clientDoc || "__________________"}</span></p>
                      <p className="truncate"><strong>Data de Nascimento:</strong> <span className="text-slate-900 font-medium">{config.clientBirthDate || "__________________"}</span></p>
                      <p className="truncate"><strong>WhatsApp:</strong> <span className="text-slate-900 font-medium">{config.clientPhone || "__________________"}</span></p>
                      <p className="col-span-2 truncate"><strong>Endereço:</strong> <span className="text-slate-900 font-medium">{config.clientAddress || "______________________________________"}</span></p>
                    </div>
                  </div>

                  {/* Box de instruções de ativação com as cores da marca */}
                  {config.activationInstructions && (
                    <div className="bg-[#BD5944]/10 text-[#342825] p-4 rounded-xl border border-[#BD5944]/20 text-[10px] space-y-1.5 shadow-sm">
                      <p className="font-bold flex items-center gap-1 text-[#342825]">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#BD5944]"></span>
                        Instruções de Ativação do Setup
                      </p>
                      <p className="whitespace-pre-line leading-relaxed text-slate-600 font-sans">{config.activationInstructions}</p>
                    </div>
                  )}

                  {/* Custom Clauses Dynamic Rendering */}
                  <div className="space-y-4 text-[10.5px] text-slate-600 leading-relaxed font-sans text-justify">
                    
                    {/* Clause 1 */}
                    {config.clause1Body && (
                      <div className="space-y-1">
                        <h4 className="font-bold text-[#342825] uppercase">{config.clause1Title}</h4>
                        <p>{config.clause1Body}</p>
                      </div>
                    )}

                    {/* Clause 2 */}
                    {config.clause2Body && (
                      <div className="space-y-1">
                        <h4 className="font-bold text-[#342825] uppercase">{config.clause2Title}</h4>
                        <p>{config.clause2Body}</p>
                      </div>
                    )}

                    {/* Clause 3 */}
                    {config.clause3Body && (
                      <div className="space-y-1">
                        <h4 className="font-bold text-[#342825] uppercase">{config.clause3Title}</h4>
                        <p className="whitespace-pre-line">{formattedClause3Text}</p>
                      </div>
                    )}

                    {/* Clause 4 */}
                    {config.clause4Body && (
                      <div className="space-y-1">
                        <h4 className="font-bold text-[#342825] uppercase">{config.clause4Title}</h4>
                        <p>{config.clause4Body}</p>
                      </div>
                    )}

                    {/* Clause 5 */}
                    {config.clause5Body && (
                      <div className="space-y-1">
                        <h4 className="font-bold text-[#342825] uppercase">{config.clause5Title}</h4>
                        <p>{config.clause5Body}</p>
                        
                        {/* Sub-details displaying Zelle/Venmo/Pix inside clause 5 preview if set */}
                        {(config.zelleKey || config.venmoKey || config.pixKey || config.paymentLink) && (
                          <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[9.5px] font-mono grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-500">
                            {config.zelleKey && <p><strong>ZELLE:</strong> {config.zelleKey}</p>}
                            {config.venmoKey && <p><strong>VENMO:</strong> {config.venmoKey}</p>}
                            {config.pixKey && <p><strong>PIX:</strong> {config.pixKey}</p>}
                            {config.paymentLink && <p className="sm:col-span-2 truncate"><strong>LINK:</strong> {config.paymentLink}</p>}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Clause 6 */}
                    {config.clause6Body && (
                      <div className="space-y-1">
                        <h4 className="font-bold text-[#342825] uppercase">{config.clause6Title}</h4>
                        <p className="whitespace-pre-line">{config.clause6Body}</p>
                      </div>
                    )}

                    {/* Clause 7 */}
                    {config.clause7Body && (
                      <div className="space-y-1">
                        <h4 className="font-bold text-[#342825] uppercase">{config.clause7Title}</h4>
                        <p className="whitespace-pre-line">{config.clause7Body}</p>
                      </div>
                    )}

                    {/* Clause 8 */}
                    {config.clause8Body && (
                      <div className="space-y-1">
                        <h4 className="font-bold text-[#342825] uppercase">{config.clause8Title}</h4>
                        <p className="whitespace-pre-line">{config.clause8Body}</p>
                      </div>
                    )}

                    {/* Clause 9 */}
                    {config.clause9Body && (
                      <div className="space-y-1">
                        <h4 className="font-bold text-[#342825] uppercase">{config.clause9Title}</h4>
                        <p>{config.clause9Body}</p>
                      </div>
                    )}

                  </div>

                  {/* Final Signatures Placeholder */}
                  <div className="pt-10 border-t border-slate-100 flex justify-between gap-10 text-[9px] text-slate-400">
                    <div className="flex-1 text-center">
                      <div className="border-b border-slate-200 h-8 mb-1"></div>
                      <p className="font-bold text-slate-500 uppercase">{config.contratadaBrand}</p>
                      <p>Contratada</p>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="border-b border-slate-200 h-8 mb-1"></div>
                      <p className="font-bold text-slate-500 uppercase">{config.clientName || "O CONTRATANTE"}</p>
                      <p>Contratante</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
