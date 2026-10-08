import React, { useState } from "react";
import { doc, updateDoc, deleteDoc, collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Lead, HistoryItem, Payment } from "../types";
import { X, Calendar, Plus, Trash2, ArrowRightLeft, Landmark, MessageSquare, Mail, Phone, Building, ShieldAlert, Link as LinkIcon, Copy, ExternalLink, Check, Clock, CheckCircle2, MapPin } from "lucide-react";
import { calcEgnCommissionSetup, calcEgnCommissionSingle, formatPhoneUS, formatZipCodeUS, formatMoneyUSD } from "../lib/masks";

interface LeadModalProps {
  lead: Lead;
  onClose: () => void;
  isReadOnly: boolean;
  initialTab?: "history" | "edit" | "convert";
}

export default function LeadModal({ lead, onClose, isReadOnly, initialTab }: LeadModalProps) {
  const [activeTab, setActiveTab] = useState<"history" | "edit" | "convert">(initialTab || (lead.id ? "history" : "edit"));
  
  // Note creation state
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Lead Editing states
  const [name, setName] = useState(lead.name || "");
  const [email, setEmail] = useState(lead.email || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [company, setCompany] = useState(lead.company || "");
  const [instagram, setInstagram] = useState(lead.instagram || "");
  const [site, setSite] = useState(lead.site || "");
  const [googleStudioAppAccount, setGoogleStudioAppAccount] = useState(lead.googleStudioAppAccount || "");
  const [firebaseAppAccount, setFirebaseAppAccount] = useState(lead.firebaseAppAccount || "");

  // US Address states
  const [streetAddress, setStreetAddress] = useState(lead.streetAddress || lead.address || "");
  const [city, setCity] = useState(lead.city || "");
  const [state, setState] = useState(lead.state || "");
  const [zipCode, setZipCode] = useState(lead.zipCode || "");
  
  // Direct Payment Links & Status
  const [setupPaymentLink, setSetupPaymentLink] = useState(lead.setupPaymentLink || "");
  const [setupPaymentStatus, setSetupPaymentStatus] = useState<"pending" | "paid" | "partial">(lead.setupPaymentStatus || (lead.configurationFeePaid ? "paid" : "pending"));
  const [monthlyPaymentLink, setMonthlyPaymentLink] = useState(lead.monthlyPaymentLink || "");
  const [monthlyPaymentStatus, setMonthlyPaymentStatus] = useState<"pending" | "paid">(lead.monthlyPaymentStatus || "pending");
  const [copiedLinkType, setCopiedLinkType] = useState<string | null>(null);

  const [monthlyFeeDueDay, setMonthlyFeeDueDay] = useState<number>(lead.monthlyFeeDueDay || 10);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const copyToClipboard = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLinkType(type);
    setTimeout(() => setCopiedLinkType(null), 2000);
  };

  const handlePhoneChange = (val: string) => {
    setPhone(formatPhoneUS(val));
  };

  const handleZipCodeChange = (val: string) => {
    setZipCode(formatZipCodeUS(val));
  };

  // Helper to format currency input in USD
  const formatCurrencyInput = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    const num = parseInt(digits, 10) / 100;
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Helper to parse currency strings to numbers
  const parseCurrency = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/,/g, "").replace(/\$/g, "").trim();
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Conversion states preloaded with lead values if present
  const [configFeeInput, setConfigFeeInput] = useState<string>(
    lead.configurationFee !== undefined && lead.configurationFee !== null && lead.configurationFee > 0
      ? lead.configurationFee.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ""
  );
  const [monthlyFeeInput, setMonthlyFeeInput] = useState<string>(
    lead.monthlyFee !== undefined && lead.monthlyFee !== null && lead.monthlyFee > 0
      ? lead.monthlyFee.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ""
  );
  const [setupInstallments, setSetupInstallments] = useState<number>(lead.setupInstallments || 1);
  const [converting, setConverting] = useState(false);

  // Add a history item note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!noteText.trim()) return;

    try {
      setAddingNote(true);
      
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: noteText,
        type: "note"
      };

      const updatedHistory = [...(lead.history || []), newItem];
      
      const leadRef = doc(db, "leads", lead.id);
      await updateDoc(leadRef, {
        history: updatedHistory,
        updatedAt: new Date().toISOString()
      });

      lead.history = updatedHistory; // local sync
      setNoteText("");
      setAddingNote(false);
    } catch (err) {
      console.error("Error adding note:", err);
      alert("Erro ao salvar nota.");
      setAddingNote(false);
    }
  };

  // Edit general & financial info
  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!name.trim()) return;

    const parsedConfigFee = parseCurrency(configFeeInput);
    const parsedMonthlyFee = parseCurrency(monthlyFeeInput);

    const fullAddress = [
      streetAddress.trim(),
      city.trim(),
      state.trim() ? (state.trim().length <= 2 ? state.trim().toUpperCase() : state.trim()) : "",
      zipCode.trim()
    ].filter(Boolean).join(", ");

    try {
      setSaving(true);
      
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: `Dados do contato atualizados: Nome=${name}, Email=${email}, Tel=${phone}, Empresa=${company}, Setup=$ ${parsedConfigFee.toFixed(2)} (${setupInstallments}x), Mensalidade=$ ${parsedMonthlyFee.toFixed(2)}`,
        type: "note"
      };

      if (!lead.id) {
        await addDoc(collection(db, "leads"), {
          name,
          email,
          phone,
          company,
          instagram,
          site,
          address: fullAddress,
          streetAddress,
          city,
          state,
          zipCode,
          googleStudioAppAccount: googleStudioAppAccount.trim(),
          firebaseAppAccount: firebaseAppAccount.trim(),
          status: lead.status || "new",
          configurationFee: parsedConfigFee,
          monthlyFee: parsedMonthlyFee,
          monthlyFeeDueDay: Number(monthlyFeeDueDay),
          setupInstallments: setupInstallments,
          setupPaymentLink: setupPaymentLink.trim(),
          setupPaymentStatus: setupPaymentStatus,
          configurationFeePaid: setupPaymentStatus === "paid",
          monthlyPaymentLink: monthlyPaymentLink.trim(),
          monthlyPaymentStatus: monthlyPaymentStatus,
          history: [newItem],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        alert("Contato cadastrado com sucesso!");
        onClose();
        return;
      }

      const leadRef = doc(db, "leads", lead.id);
      await updateDoc(leadRef, {
        name,
        email,
        phone,
        company,
        instagram,
        site,
        address: fullAddress,
        streetAddress,
        city,
        state,
        zipCode,
        googleStudioAppAccount: googleStudioAppAccount.trim(),
        firebaseAppAccount: firebaseAppAccount.trim(),
        configurationFee: parsedConfigFee,
        monthlyFee: parsedMonthlyFee,
        monthlyFeeDueDay: Number(monthlyFeeDueDay),
        setupInstallments: setupInstallments,
        setupPaymentLink: setupPaymentLink.trim(),
        setupPaymentStatus: setupPaymentStatus,
        configurationFeePaid: setupPaymentStatus === "paid",
        monthlyPaymentLink: monthlyPaymentLink.trim(),
        monthlyPaymentStatus: monthlyPaymentStatus,
        history: [...(lead.history || []), newItem],
        updatedAt: new Date().toISOString()
      });

      // Local mutations
      lead.name = name;
      lead.email = email;
      lead.phone = phone;
      lead.company = company;
      lead.instagram = instagram;
      lead.site = site;
      lead.address = fullAddress;
      lead.streetAddress = streetAddress;
      lead.city = city;
      lead.state = state;
      lead.zipCode = zipCode;
      lead.googleStudioAppAccount = googleStudioAppAccount.trim();
      lead.firebaseAppAccount = firebaseAppAccount.trim();
      lead.configurationFee = parsedConfigFee;
      lead.monthlyFee = parsedMonthlyFee;
      lead.monthlyFeeDueDay = Number(monthlyFeeDueDay);
      lead.setupInstallments = setupInstallments;
      lead.setupPaymentLink = setupPaymentLink.trim();
      lead.setupPaymentStatus = setupPaymentStatus;
      lead.configurationFeePaid = setupPaymentStatus === "paid";
      lead.monthlyPaymentLink = monthlyPaymentLink.trim();
      lead.monthlyPaymentStatus = monthlyPaymentStatus;
      lead.history.push(newItem);

      alert("Informações atualizadas com sucesso!");
      onClose();
    } catch (err) {
      console.error("Error updating lead:", err);
      alert("Erro ao salvar informações.");
    } finally {
      setSaving(false);
    }
  };

  // Delete lead
  const handleDeleteLead = async () => {
    if (isReadOnly) return;
    try {
      setSaving(true);
      await deleteDoc(doc(db, "leads", lead.id));
      onClose();
    } catch (err) {
      console.error("Error deleting lead:", err);
      alert("Erro ao excluir lead.");
      setSaving(false);
    }
  };

  // Convert to Client
  const handleConvertToClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    
    const parsedConfigFee = parseCurrency(configFeeInput);
    const parsedMonthlyFee = parseCurrency(monthlyFeeInput);

    try {
      setConverting(true);

      const installmentCount = setupInstallments || 1;
      const installmentAmount = installmentCount > 0 ? parsedConfigFee / installmentCount : parsedConfigFee;

      const setupPayments: Payment[] = [];
      for (let i = 1; i <= installmentCount; i++) {
        const dateObj = new Date();
        dateObj.setMonth(dateObj.getMonth() + i - 1);
        const calcDueDate = dateObj.toISOString().split("T")[0];

        setupPayments.push({
          id: `setup_inst_${i}_` + Math.random().toString(36).substr(2, 9),
          type: "configuration",
          dueDate: calcDueDate,
          amount: parseFloat(installmentAmount.toFixed(2)),
          installmentNumber: i,
          totalInstallments: installmentCount,
          status: "pending"
        });
      }

      const firstMonthlyPayment: Payment = {
        id: "mth_" + Math.random().toString(36).substr(2, 9),
        type: "monthly",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        amount: parsedMonthlyFee,
        status: "pending"
      };

      const newItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: `Contato ativado como CLIENTE ATIVO (PAGANDO) no sistema. Taxa setup: $ ${parsedConfigFee.toFixed(2)} (${installmentCount}x), Mensalidade: $ ${parsedMonthlyFee.toFixed(2)}.`,
        type: "status_change"
      };

      const leadRef = doc(db, "leads", lead.id);
      await updateDoc(leadRef, {
        status: "client",
        configurationFee: parsedConfigFee,
        configurationFeePaid: false,
        monthlyFee: parsedMonthlyFee,
        setupInstallments: installmentCount,
        payments: [...setupPayments, firstMonthlyPayment],
        history: [...(lead.history || []), newItem],
        updatedAt: new Date().toISOString()
      });

      alert("Contato ativado como CLIENTE com sucesso!");
      onClose();
    } catch (err) {
      console.error("Error converting lead:", err);
      alert("Erro ao realizar conversão de status.");
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#342825]/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden border border-[#342825]/10">
        
        {/* Modal Header */}
        <div className="bg-[#342825] text-white px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-between border-b border-[#BD5944]/30">
          <div className="min-w-0">
            <span className={`text-[10px] sm:text-xs font-black py-1 px-3 rounded-full inline-block mb-1 uppercase tracking-wider ${
              lead.status === "client" ? "bg-[#BD5944] text-white shadow-xs" : "bg-white/20 text-[#F7F2EC]"
            }`}>
              {lead.status === "client" ? "Cliente Ativo (Pagando)" : "Cliente Inativo / Lead"}
            </span>
            <h3 className="font-black text-lg sm:text-xl tracking-tight truncate">{lead.name || "Novo Contato"}</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl hover:bg-white/10 transition text-white/80 hover:text-white flex-shrink-0 cursor-pointer"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#342825]/10 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-500 bg-[#F7F2EC]/50">
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-3.5 text-center border-b-2 transition cursor-pointer ${
              activeTab === "history" 
                ? "border-[#BD5944] text-[#BD5944] bg-white font-black" 
                : "border-transparent hover:text-[#342825]"
            }`}
          >
            Histórico / Linha do Tempo
          </button>
          
          {!isReadOnly && (
            <>
              <button
                onClick={() => setActiveTab("edit")}
                className={`flex-1 py-3.5 text-center border-b-2 transition cursor-pointer ${
                  activeTab === "edit" 
                    ? "border-[#BD5944] text-[#BD5944] bg-white font-black" 
                    : "border-transparent hover:text-[#342825]"
                }`}
              >
                Editar Informações
              </button>

              {lead.status === "lead" && (
                <button
                  onClick={() => setActiveTab("convert")}
                  className={`flex-1 py-3.5 text-center border-b-2 transition text-[#BD5944] font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === "convert" 
                      ? "border-[#BD5944] bg-[#BD5944]/10" 
                      : "border-transparent hover:bg-[#BD5944]/5"
                  }`}
                >
                  <ArrowRightLeft size={14} />
                  Ativar como Ativo (Pagando)
                </button>
              )}
            </>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          {isReadOnly && activeTab !== "history" && (
            <div className="bg-[#BD5944]/10 text-[#BD5944] text-sm p-4 rounded-xl flex items-center gap-2 border border-[#BD5944]/20 font-bold">
              <ShieldAlert size={16} />
              Apenas leitura. Você está conectado com o perfil de visualização da Andreia Cakes USA.
            </div>
          )}

          {/* TAB 1: History of operations */}
          {activeTab === "history" && (
            <div className="space-y-6">
              {/* Quick lead stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-[#F7F2EC]/60 p-4 sm:p-5 rounded-2xl border border-[#342825]/10 text-sm text-[#342825]">
                <p className="flex items-center gap-2.5 truncate">
                  <Phone size={16} className="text-[#BD5944] flex-shrink-0" />
                  {lead.phone ? (
                    <a
                      href={`https://wa.me/${lead.phone.replace(/\D/g, "").startsWith("1") ? lead.phone.replace(/\D/g, "") : "1" + lead.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[#BD5944] hover:text-[#342825] font-bold truncate text-sm"
                    >
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">Sem telefone</span>
                  )}
                </p>

                <p className="flex items-center gap-2.5 truncate">
                  <Mail size={16} className="text-[#BD5944] flex-shrink-0" />
                  <span className="truncate text-slate-700 font-medium">{lead.email || "Sem e-mail"}</span>
                </p>

                <p className="flex items-center gap-2.5 truncate">
                  <Building size={16} className="text-[#BD5944] flex-shrink-0" />
                  <span className="font-bold text-[#342825] truncate text-sm">{lead.company || "Sem empresa"}</span>
                </p>

                {lead.address && (
                  <p className="flex items-center gap-2.5 sm:col-span-3 text-xs text-slate-600 truncate">
                    <MapPin size={15} className="text-[#BD5944] flex-shrink-0" />
                    <span>{lead.address}</span>
                  </p>
                )}
              </div>

              {/* Informações Financeiras Resumo */}
              <div className="bg-slate-50 border border-[#342825]/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between font-black text-[#342825]">
                  <span className="text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Landmark size={16} className="text-[#BD5944]" /> Condições Financeiras Cadastradas (USD)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Taxa de Setup</span>
                    <p className="font-black text-lg sm:text-xl text-[#342825]">
                      $ {(lead.configurationFee || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className="text-xs text-slate-500 font-medium">
                      {lead.setupInstallments ? `${lead.setupInstallments}x parcelamento` : "À Vista"} • 
                      Comissão 10%: <span className="text-[#BD5944] font-black">$ {((lead.configurationFee || 0) * 0.1).toFixed(2)}</span>
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Mensalidade</span>
                    <p className="font-black text-lg sm:text-xl text-[#342825]">
                      $ {(lead.monthlyFee || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /mês
                    </p>
                    <span className="text-xs text-slate-500 font-medium">
                      Comissão 10%: <span className="text-[#BD5944] font-black">$ {((lead.monthlyFee || 0) * 0.1).toFixed(2)} /mês</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Add Note Form */}
              {!isReadOnly && (
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Adicionar nota rápida ao histórico..."
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#BD5944]/40 focus:border-[#BD5944] transition text-[#342825]"
                  />
                  <button
                    type="submit"
                    disabled={addingNote || !noteText.trim()}
                    className="bg-[#BD5944] hover:bg-[#342825] text-white rounded-xl px-5 py-3 text-sm font-black transition flex items-center justify-center gap-1.5 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer shadow-xs"
                  >
                    <Plus size={16} />
                    <span>Adicionar</span>
                  </button>
                </form>
              )}

              {/* History Timeline */}
              <div className="space-y-4">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                  Linha do Tempo de Atividades
                </span>
                <div className="space-y-3">
                  {(lead.history || []).slice().reverse().map((item) => (
                    <div key={item.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs sm:text-sm space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-[11px]">
                        <span className="font-bold uppercase text-[#BD5944]">{item.type}</span>
                        <span>{new Date(item.date).toLocaleString("pt-BR")}</span>
                      </div>
                      <p className="text-[#342825] font-medium leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                  {(!lead.history || lead.history.length === 0) && (
                    <p className="text-xs text-slate-400 italic text-center py-4">Nenhum evento registrado ainda.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Edit Information */}
          {activeTab === "edit" && !isReadOnly && (
            <form onSubmit={handleUpdateInfo} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Nome do Lead / Cliente *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Nome da Empresa / Estabelecimento</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Telefone (Formato EUA)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                    placeholder="(555) 000-0000"
                    maxLength={18}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">E-mail para contato</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                  />
                </div>

                {/* ENDEREÇO AMERICANO COM ZIP CODE */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                    Endereço nos EUA (Street Address, Suite/Apt)
                  </label>
                  <input
                    type="text"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="Ex: 123 Ocean Drive, Suite 400"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Cidade (City)</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex: Miami"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Estado (State)</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      placeholder="Ex: FL"
                      maxLength={15}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40 uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Zip Code</label>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => handleZipCodeChange(e.target.value)}
                      placeholder="Ex: 33101"
                      maxLength={10}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Instagram</label>
                  <input
                    type="text"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="Ex: @nome_usuario"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Site</label>
                  <input
                    type="text"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    placeholder="Ex: www.restaurant.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Conta Google Studio App</label>
                  <input
                    type="text"
                    value={googleStudioAppAccount}
                    onChange={(e) => setGoogleStudioAppAccount(e.target.value)}
                    placeholder="Ex: conta@gmail.com ou ID do app"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Conta Firebase App</label>
                  <input
                    type="text"
                    value={firebaseAppAccount}
                    onChange={(e) => setFirebaseAppAccount(e.target.value)}
                    placeholder="Ex: firebase-projeto-id ou conta@gmail.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                  />
                </div>
              </div>

              {/* CONDIÇÕES FINANCEIRAS EM DÓLAR */}
              <div className="pt-4 border-t border-[#342825]/10 space-y-4">
                <span className="block text-xs font-black text-[#342825] uppercase tracking-wider">Condições Financeiras do Cliente (Dólar - USD)</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Taxa de Setup ($)</label>
                    <input
                      type="text"
                      value={configFeeInput}
                      onChange={(e) => setConfigFeeInput(formatCurrencyInput(e.target.value))}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                    />
                    {(() => {
                      const comm = calcEgnCommissionSetup(parseCurrency(configFeeInput), setupInstallments);
                      return (
                        <span className="text-[11px] text-slate-500 block font-bold">
                          Comissão 10% Líquida:{" "}
                          <span className="text-[#BD5944]">
                            {comm.installments > 1 
                              ? `${comm.installments}x $ ${comm.commissionPerInstallment.toFixed(2)}`
                              : `$ ${comm.totalCommission.toFixed(2)}`}
                          </span>
                          <span className="text-[9px] text-slate-400 block font-normal">(após taxa bancária: $0,49 + 3,49% por parcela)</span>
                        </span>
                      );
                    })()}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Parcelas Setup</label>
                    <select
                      value={setupInstallments}
                      onChange={(e) => setSetupInstallments(parseInt(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#BD5944]/40 text-[#342825] cursor-pointer"
                    >
                      <option value={1}>À Vista (1x)</option>
                      <option value={2}>2x Sem Juros</option>
                      <option value={3}>3x Sem Juros</option>
                      <option value={4}>4x Sem Juros</option>
                      <option value={5}>5x Sem Juros</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Mensalidade ($)</label>
                    <input
                      type="text"
                      value={monthlyFeeInput}
                      onChange={(e) => setMonthlyFeeInput(formatCurrencyInput(e.target.value))}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                    />
                    {(() => {
                      const comm = calcEgnCommissionSingle(parseCurrency(monthlyFeeInput));
                      return (
                        <span className="text-[11px] text-slate-500 block font-bold">
                          Comissão 10% Líquida: <span className="text-[#BD5944]">$ {comm.toFixed(2)}/mês</span>
                          <span className="text-[9px] text-slate-400 block font-normal">(após taxa bancária: $0,49 + 3,49%)</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* SESSÃO DE LINKS DE PAGAMENTO DIRETO */}
                <div className="pt-4 border-t border-[#342825]/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="block text-xs font-black text-[#342825] uppercase tracking-wider flex items-center gap-1.5">
                      <LinkIcon size={14} className="text-[#BD5944]" /> Links de Pagamento Direto
                    </span>
                  </div>

                  {/* 1. LINK DE TAXA DE SETUP */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="block text-xs font-black text-[#342825] uppercase">
                        1. Link da Taxa de Setup / Configuração
                      </label>
                      
                      {setupPaymentStatus === "paid" ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-[#342825] text-white border border-[#BD5944]">
                          <CheckCircle2 size={13} className="text-[#BD5944]" /> Setup: Pago
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-[#BD5944]/15 text-[#BD5944] border border-[#BD5944]/30">
                          <Clock size={13} /> Setup: Pendente
                        </span>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="url"
                        value={setupPaymentLink}
                        onChange={(e) => setSetupPaymentLink(e.target.value)}
                        placeholder="Cole aqui o link de pagamento do setup..."
                        className="w-full pl-3.5 pr-20 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#BD5944]/40 text-[#342825]"
                      />
                      {setupPaymentLink && (
                        <div className="absolute right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(setupPaymentLink, "setup")}
                            className="p-1.5 text-slate-500 hover:text-[#342825] hover:bg-slate-100 rounded-lg transition"
                            title="Copiar Link"
                          >
                            {copiedLinkType === "setup" ? <Check size={15} className="text-[#BD5944]" /> : <Copy size={15} />}
                          </button>
                          <a
                            href={setupPaymentLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:text-[#BD5944] hover:bg-slate-100 rounded-lg transition"
                            title="Abrir Link"
                          >
                            <ExternalLink size={15} />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs bg-white p-3 rounded-xl border border-slate-200/80">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-black uppercase">Valor da Taxa</span>
                        <span className="font-black text-sm text-[#342825]">
                          $ {configFeeInput || "0.00"} {setupInstallments > 1 ? `(em até ${setupInstallments}x de $ ${(parseCurrency(configFeeInput) / setupInstallments).toFixed(2)})` : "(À Vista)"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-black uppercase">Vencimento do Setup</span>
                        <span className="font-black text-sm text-[#342825]">
                          No ato da adesão / 1º vencimento
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. LINK DA MENSALIDADE RECORRENTE */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="block text-xs font-black text-[#342825] uppercase">
                        2. Link da Mensalidade Recorrente / Assinatura
                      </label>
                      
                      {monthlyPaymentStatus === "paid" ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-[#342825] text-white border border-[#BD5944]">
                          <CheckCircle2 size={13} className="text-[#BD5944]" /> Mensalidade: Paga
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-[#BD5944]/15 text-[#BD5944] border border-[#BD5944]/30">
                          <Clock size={13} /> Mensalidade: Pendente
                        </span>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="url"
                        value={monthlyPaymentLink}
                        onChange={(e) => setMonthlyPaymentLink(e.target.value)}
                        placeholder="Cole aqui o link de cobrança da assinatura..."
                        className="w-full pl-3.5 pr-20 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#BD5944]/40 text-[#342825]"
                      />
                      {monthlyPaymentLink && (
                        <div className="absolute right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(monthlyPaymentLink, "monthly")}
                            className="p-1.5 text-slate-500 hover:text-[#342825] hover:bg-slate-100 rounded-lg transition"
                            title="Copiar Link"
                          >
                            {copiedLinkType === "monthly" ? <Check size={15} className="text-[#BD5944]" /> : <Copy size={15} />}
                          </button>
                          <a
                            href={monthlyPaymentLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:text-[#BD5944] hover:bg-slate-100 rounded-lg transition"
                            title="Abrir Link"
                          >
                            <ExternalLink size={15} />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs bg-white p-3 rounded-xl border border-slate-200/80">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-black uppercase">Valor da Mensalidade</span>
                        <span className="font-black text-sm text-[#342825]">
                          $ {monthlyFeeInput || "0.00"} / mês
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-black uppercase">Dia de Vencimento</span>
                        <span className="font-black text-sm text-[#342825]">
                          {lead.contractData?.signedAt
                            ? `Todo dia ${new Date(lead.contractData.signedAt).getDate()} de cada mês (Dia da assinatura)`
                            : "Mesmo dia em que o contrato for assinado"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-5 flex justify-between gap-3 border-t border-[#342825]/10">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving}
                  className="px-4 py-2.5 hover:bg-rose-50 text-rose-600 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 border border-transparent hover:border-rose-100 cursor-pointer"
                >
                  <Trash2 size={16} />
                  Excluir Lead
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#BD5944] hover:bg-[#342825] text-white rounded-xl px-6 py-2.5 text-xs sm:text-sm font-black transition shadow-sm cursor-pointer"
                >
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Conversion to Client */}
          {activeTab === "convert" && !isReadOnly && (
            <form onSubmit={handleConvertToClient} className="space-y-6">
              <div className="bg-[#F7F2EC] text-[#342825] rounded-2xl p-5 text-xs sm:text-sm leading-relaxed border border-[#342825]/10 space-y-1.5">
                <p className="font-black flex items-center gap-2 text-sm sm:text-base text-[#BD5944]">
                  <Landmark size={18} /> Lançamento de Configuração & Mensalidade (USD)
                </p>
                <p>Ao ativar este contato como Cliente Ativo (Pagando), o sistema criará as cobranças correspondentes. 10% de todo valor pago será repassado para Andreia Cakes USA como comissão comercial.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Taxa de Configuração / Setup ($)</label>
                <input
                  type="text"
                  required
                  value={configFeeInput}
                  onChange={(e) => setConfigFeeInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                  placeholder="Ex: 1500.00"
                />
                <span className="text-xs text-slate-500 block font-bold">
                  Comissão Andreia Cakes USA estimada (10%): <span className="text-[#BD5944]">$ {((parseFloat(configFeeInput.replace(/,/g, "")) || 0) * 0.1).toFixed(2)}</span>
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Parcelamento da Taxa de Setup (Até 5x)</label>
                <select
                  value={setupInstallments}
                  onChange={(e) => setSetupInstallments(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#BD5944]/40 text-[#342825] cursor-pointer"
                >
                  <option value={1}>À Vista (1x)</option>
                  <option value={2}>2x Sem Juros</option>
                  <option value={3}>3x Sem Juros</option>
                  <option value={4}>4x Sem Juros</option>
                  <option value={5}>5x Sem Juros</option>
                </select>
                {setupInstallments > 1 && configFeeInput && (
                  <span className="text-xs text-[#BD5944] block font-bold italic">
                    Serão gerados {setupInstallments} lançamentos mensais de $ {((parseFloat(configFeeInput.replace(/,/g, "")) || 0) / setupInstallments).toFixed(2)} cada.
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Mensalidade do Cliente ($)</label>
                <input
                  type="text"
                  required
                  value={monthlyFeeInput}
                  onChange={(e) => setMonthlyFeeInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#342825] focus:ring-2 focus:ring-[#BD5944]/40"
                  placeholder="Ex: 450.00"
                />
                <span className="text-xs text-slate-500 block font-bold">
                  Comissão Andreia Cakes USA estimada mensal (10%): <span className="text-[#BD5944]">$ {((parseFloat(monthlyFeeInput.replace(/,/g, "")) || 0) * 0.1).toFixed(2)}</span>
                </span>
              </div>

              <div className="pt-4 border-t border-[#342825]/10 flex justify-end">
                <button
                  type="submit"
                  disabled={converting}
                  className="w-full bg-[#BD5944] hover:bg-[#342825] text-white font-black py-3.5 px-6 rounded-2xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {converting ? "Ativando Cliente..." : "Confirmar e Ativar Cliente (Pagando)"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* MODAL IN-APP: CONFIRMAÇÃO DE EXCLUSÃO DE LEAD */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 bg-[#342825]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3.5 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={24} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 uppercase">Excluir Lead?</h3>
                <p className="text-xs text-slate-500 font-semibold">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100">
              Tem certeza de que deseja excluir permanentemente o lead <strong>"{lead.name}"</strong>? Todos os dados cadastrais e histórico serão removidos.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDeleteLead}
                className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {saving ? "Excluindo..." : "Sim, Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
