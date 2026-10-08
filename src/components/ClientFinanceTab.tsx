import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Lead, Payment, HistoryItem } from "../types";
import DatePickerBR from "./DatePickerBR";
import DashboardKPIs from "./DashboardKPIs";
import { calcEgnCommissionSingle, calcBankFee, calcNetReceivedAmount } from "../lib/masks";
import { 
  Landmark, 
  Check, 
  Calendar, 
  BadgePercent, 
  Copy, 
  ExternalLink, 
  Upload, 
  FileText, 
  Paperclip, 
  Eye, 
  Download, 
  X, 
  FileCheck, 
  History, 
  Clock, 
  FileUp, 
  CheckCircle2, 
  Search, 
  Users, 
  ArrowLeft, 
  ChevronRight, 
  RefreshCw,
  AlertCircle,
  Plus,
  CreditCard,
  DollarSign,
  CheckCheck,
  Activity,
  ShieldCheck,
  Info,
  Lock,
  ShieldAlert,
  Trash2
} from "lucide-react";

interface ClientFinanceTabProps {
  leads: Lead[];
  isReadOnly: boolean;
}

interface RepasseItem {
  clientLeadId: string;
  clientName: string;
  company: string;
  payment: Payment;
  commissionAmount: number;
}

function cleanFirestoreData<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map(item => cleanFirestoreData(item)) as unknown as T;
  }
  if (data !== null && typeof data === "object") {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

function BrDateInput({
  value,
  onChange,
  required,
  className
}: {
  value: string;
  onChange: (isoValue: string) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    <DatePickerBR
      value={value}
      onChange={onChange}
      required={required}
      className={className || "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#342825] focus:outline-none focus:ring-2 focus:ring-[#BD5944]"}
    />
  );
}

export default function ClientFinanceTab({ leads, isReadOnly }: ClientFinanceTabProps) {
  // In the unified dashboard, all active entities (isActive !== false) are trackable clients
  const clients = leads.filter(l => l.isActive !== false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  const selectedClient = selectedClientId 
    ? (leads.find(l => l.id === selectedClientId) || null) 
    : null;

  // Repasse state
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().substring(0, 7));
  const [repasseFilterTab, setRepasseFilterTab] = useState<"pendentes" | "historico">("pendentes");
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "confirmados" | "parcial" | "pendentes" | "atrasados">("todos");
  
  // Batch Repasse modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const getSuggested25thDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-25`;
  };

  const [repasseDate, setRepasseDate] = useState<string>(getSuggested25thDate());
  const [repasseNotes, setRepasseNotes] = useState<string>("");
  const [repasseProofFile, setRepasseProofFile] = useState<string | null>(null);
  const [repasseProofFileName, setRepasseProofFileName] = useState<string | null>(null);
  const [savingRepasse, setSavingRepasse] = useState(false);

  // Proof Viewer Modal
  const [proofViewerModal, setProofViewerModal] = useState<{
    url: string;
    name: string;
    date?: string;
    clientName?: string;
    amount?: number;
  } | null>(null);

  const [syncingStatus, setSyncingStatus] = useState(false);

  // Copied link state feedback
  const [copiedLinkType, setCopiedLinkType] = useState<string | null>(null);

  // New manual payment state inside selected client modal
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(false);
  const [newPaymentType, setNewPaymentType] = useState<"configuration" | "monthly">("monthly");
  const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
  const [newPaymentDueDate, setNewPaymentDueDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const handleCopyLink = (url: string, type: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLinkType(type);
    setTimeout(() => setCopiedLinkType(null), 2500);
  };

  const handleAddManualPayment = async () => {
    if (isReadOnly || !selectedClient) return;
    if (!newPaymentAmount || newPaymentAmount <= 0) {
      alert("Por favor, informe um valor válido para a cobrança.");
      return;
    }
    try {
      const currentPayments: Payment[] = [...(selectedClient.payments || [])];
      const newPayment: Payment = {
        id: `${newPaymentType}_${Date.now()}`,
        type: newPaymentType,
        amount: newPaymentAmount,
        dueDate: newPaymentDueDate || new Date().toISOString().split("T")[0],
        status: "pending"
      };
      currentPayments.push(newPayment);

      const clientRef = doc(db, "leads", selectedClient.id);
      await updateDoc(clientRef, {
        payments: currentPayments,
        updatedAt: new Date().toISOString()
      });

      setShowAddPaymentForm(false);
      setNewPaymentAmount(0);
    } catch (err: any) {
      alert("Erro ao adicionar cobrança: " + err.message);
    }
  };

  const formatDateBr = (dateStr?: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return "0.00";
    return (Math.round(val * 100) / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Status and payments are loaded and persisted directly via Firebase Firestore
  // Toggle item payment status
  const handleTogglePaymentItemStatus = async (paymentId: string, currentStatus: "paid" | "pending") => {
    if (isReadOnly || !selectedClient) return;
    try {
      const nextStatus = currentStatus === "paid" ? "pending" : "paid";
      const todayStr = new Date().toISOString().split("T")[0];

      const setupFee = Number(selectedClient.configurationFee || 0);
      const totalSetupInst = Number(selectedClient.setupInstallments || selectedClient.contractConfig?.setupInstallments || (setupFee > 0 ? 3 : 1));
      const expectedInstAmount = totalSetupInst > 0 ? Math.round((setupFee / totalSetupInst) * 100) / 100 : setupFee;

      let currentPayments: Payment[] = (selectedClient.payments && selectedClient.payments.length > 0)
        ? [...selectedClient.payments]
        : [];

      if (currentPayments.length === 0) {
        if (setupFee > 0) {
          for (let i = 1; i <= totalSetupInst; i++) {
            currentPayments.push({
              id: `setup_inst_${i}_${selectedClient.id}`,
              type: "configuration",
              dueDate: todayStr,
              amount: expectedInstAmount,
              status: selectedClient.setupPaymentStatus === "paid" ? "paid" : "pending",
              installmentNumber: i,
              totalInstallments: totalSetupInst
            });
          }
        }
        if (selectedClient.monthlyFee) {
          currentPayments.push({
            id: `monthly_${selectedClient.id}`,
            type: "monthly",
            dueDate: todayStr,
            amount: selectedClient.monthlyFee,
            status: selectedClient.monthlyPaymentStatus === "paid" ? "paid" : "pending"
          });
        }
      }

      let matched = false;
      let updatedPayments = currentPayments.map(p => {
        if (p.id === paymentId || (p as any).asaasPaymentId === paymentId) {
          matched = true;
          const { paidDate, commissionPaidToEgn, egnRepassePaidDate, ...rest } = p;
          return {
            ...rest,
            status: nextStatus as "paid" | "pending",
            ...(nextStatus === "paid" ? { paidDate: p.paidDate || todayStr } : {})
          };
        }
        return p;
      });

      // Se não encontrou pelo paymentId e for uma mensalidade genérica (ex: monthly_...), procura a primeira mensalidade
      if (!matched && (paymentId.startsWith("monthly") || paymentId.includes("mth"))) {
        const mIdx = updatedPayments.findIndex(p => p.type === "monthly");
        if (mIdx !== -1) {
          matched = true;
          const cur = updatedPayments[mIdx];
          const { paidDate, commissionPaidToEgn, egnRepassePaidDate, ...rest } = cur;
          updatedPayments[mIdx] = {
            ...rest,
            status: nextStatus as "paid" | "pending",
            ...(nextStatus === "paid" ? { paidDate: cur.paidDate || todayStr } : {})
          };
        }
      }

      if (!matched) {
        updatedPayments.push({
          id: paymentId,
          type: "monthly",
          dueDate: todayStr,
          amount: selectedClient.monthlyFee || 0,
          status: nextStatus as "paid" | "pending",
          ...(nextStatus === "paid" ? { paidDate: todayStr } : {})
        });
      }

      const allSetupAfter = updatedPayments.filter(p => p.type === "configuration");
      const paidSetupCount = allSetupAfter.filter(p => p.status === "paid").length;
      
      let newSetupStatus: "paid" | "partial" | "pending" = "pending";
      let newConfigFeePaid = false;
      if (allSetupAfter.length > 0) {
        if (paidSetupCount === allSetupAfter.length) {
          newSetupStatus = "paid";
          newConfigFeePaid = true;
        } else if (paidSetupCount > 0) {
          newSetupStatus = "partial";
          newConfigFeePaid = false;
        } else {
          newSetupStatus = "pending";
          newConfigFeePaid = false;
        }
      } else {
        newSetupStatus = selectedClient.setupPaymentStatus || "pending";
        newConfigFeePaid = selectedClient.configurationFeePaid || false;
      }

      const isMonthlyPaid = updatedPayments.filter(p => p.type === "monthly").some(p => p.status === "paid");
      const newMonthlyStatus = isMonthlyPaid ? "paid" : "pending";

      let newFinStatus: "CONFIRMADO" | "PAGO PARCIAL" | "PENDENTE" | "ATRASADO" = "PENDENTE";
      if (allSetupAfter.length > 0) {
        if (newSetupStatus === "paid" && newMonthlyStatus === "paid") newFinStatus = "CONFIRMADO";
        else if (paidSetupCount > 0 || newMonthlyStatus === "paid") newFinStatus = "PAGO PARCIAL";
      } else {
        newFinStatus = newMonthlyStatus === "paid" ? "CONFIRMADO" : "PENDENTE";
      }

      const clientRef = doc(db, "leads", selectedClient.id);
      await updateDoc(clientRef, cleanFirestoreData({
        payments: updatedPayments,
        setupPaymentStatus: newSetupStatus,
        configurationFeePaid: newConfigFeePaid,
        monthlyPaymentStatus: newMonthlyStatus,
        financialStatus: newFinStatus,
        updatedAt: new Date().toISOString()
      }));
    } catch (err: any) {
      console.error("Erro ao alterar status:", err);
    }
  };

  // Dar baixa ou desfazer em UMA parcela individual de setup
  const handleToggleInstallment = async (installmentNumber: number, targetStatus?: "paid" | "pending", paymentId?: string) => {
    if (isReadOnly || !selectedClient) return;
    try {
      const cfgFee = Number(selectedClient.configurationFee || 0);
      const totalInst = Number(selectedClient.setupInstallments || (selectedClient.contractConfig?.setupInstallments) || (cfgFee > 0 ? 3 : 1));
      const expectedInstAmount = totalInst > 0 ? Math.round((cfgFee / totalInst) * 100) / 100 : cfgFee;

      let currentPayments = [...(selectedClient.payments || [])];

      // Inicializa ou garante que as parcelas de setup existem com numeração
      const existingSetup = currentPayments.filter(p => p.type === "configuration");
      if (existingSetup.length < totalInst) {
        const generatedSetup: Payment[] = [];
        for (let i = 1; i <= totalInst; i++) {
          const found = existingSetup.find(p => p.installmentNumber === i) || existingSetup[i - 1];
          if (found) {
            const { paidDate, ...rest } = found;
            generatedSetup.push({
              ...rest,
              installmentNumber: i,
              totalInstallments: totalInst,
              ...(found.status === "paid" && found.paidDate ? { paidDate: found.paidDate } : {})
            });
          } else {
            const today = new Date();
            const dueDateObj = new Date(today.getFullYear(), today.getMonth() + (i - 1), today.getDate());
            generatedSetup.push({
              id: `setup_inst_${i}_${selectedClient.id}`,
              type: "configuration",
              dueDate: dueDateObj.toISOString().split("T")[0],
              amount: expectedInstAmount,
              status: "pending",
              installmentNumber: i,
              totalInstallments: totalInst
            });
          }
        }
        currentPayments = [
          ...generatedSetup,
          ...currentPayments.filter(p => p.type !== "configuration")
        ];
      }

      const todayStr = new Date().toISOString().split("T")[0];
      
      // Procura pelo ID se fornecido, ou pelo número da parcela
      let instIdx = -1;
      if (paymentId) {
        instIdx = currentPayments.findIndex(p => p.id === paymentId || (p as any).asaasPaymentId === paymentId);
      }
      if (instIdx === -1) {
        instIdx = currentPayments.findIndex(p => p.type === "configuration" && (Number(p.installmentNumber) === Number(installmentNumber)));
      }
      if (instIdx === -1) {
        // Fallback: procura pela i-ésima parcela de configuração
        let configCount = 0;
        for (let idx = 0; idx < currentPayments.length; idx++) {
          if (currentPayments[idx].type === "configuration") {
            configCount++;
            if (configCount === installmentNumber) {
              instIdx = idx;
              break;
            }
          }
        }
      }

      if (instIdx !== -1) {
        const cur = currentPayments[instIdx];
        const nextStatus = targetStatus || (cur.status === "paid" ? "pending" : "paid");
        const { paidDate, commissionPaidToEgn, egnRepassePaidDate, ...rest } = cur;
        currentPayments[instIdx] = {
          ...rest,
          installmentNumber,
          totalInstallments: totalInst,
          status: nextStatus,
          ...(nextStatus === "paid" ? { paidDate: cur.paidDate || todayStr } : {})
        };
      }

      const allSetupAfter = currentPayments.filter(p => p.type === "configuration");
      const paidSetupCount = allSetupAfter.filter(p => p.status === "paid").length;

      let nextSetupStatus: "paid" | "partial" | "pending" = "pending";
      let nextConfigFeePaid = false;
      if (paidSetupCount === allSetupAfter.length && allSetupAfter.length > 0) {
        nextSetupStatus = "paid";
        nextConfigFeePaid = true;
      } else if (paidSetupCount > 0) {
        nextSetupStatus = "partial";
        nextConfigFeePaid = false;
      } else {
        nextSetupStatus = "pending";
        nextConfigFeePaid = false;
      }

      const isMonthlyPaid = selectedClient.monthlyPaymentStatus === "paid" || currentPayments.some(p => p.type === "monthly" && p.status === "paid");
      let newFinStatus: "CONFIRMADO" | "PAGO PARCIAL" | "PENDENTE" | "ATRASADO" = "PENDENTE";
      if (nextSetupStatus === "paid" && isMonthlyPaid) {
        newFinStatus = "CONFIRMADO";
      } else if (paidSetupCount > 0 || isMonthlyPaid) {
        newFinStatus = "PAGO PARCIAL";
      }

      const historyText = targetStatus === "pending"
        ? `Pagamento da Parcela ${installmentNumber} de ${totalInst} da Taxa de Setup desfeito (status alterado para Pendente).`
        : `Parcela ${installmentNumber} de ${totalInst} da Taxa de Setup ($ ${formatMoney(expectedInstAmount)}) marcada como PAGA manualmente em ${formatDateBr(todayStr)}.`;

      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: historyText,
        type: "payment"
      };

      const clientRef = doc(db, "leads", selectedClient.id);
      await updateDoc(clientRef, cleanFirestoreData({
        setupPaymentStatus: nextSetupStatus,
        configurationFeePaid: nextConfigFeePaid,
        financialStatus: newFinStatus,
        payments: currentPayments,
        history: [...(selectedClient.history || []), newHistoryItem],
        updatedAt: new Date().toISOString()
      }));
    } catch (err: any) {
      console.error("Erro ao alterar parcela:", err);
    }
  };

  // Excluir fatura ou parcela individual do cliente
  const handleDeletePaymentItem = async (paymentId: string) => {
    if (isReadOnly || !selectedClient) return;
    if (!window.confirm("Deseja realmente remover este registro de fatura/parcela deste cliente?")) return;
    try {
      const currentPayments = (selectedClient.payments || []).filter(p => p.id !== paymentId && (p as any).asaasPaymentId !== paymentId);

      const hasSetupPayment = currentPayments.some(p => p.type === "configuration");
      const isSetupPaid = currentPayments.filter(p => p.type === "configuration").every(p => p.status === "paid");
      const isMonthlyPaid = currentPayments.filter(p => p.type === "monthly").some(p => p.status === "paid");

      const newSetupStatus = hasSetupPayment ? (isSetupPaid ? "paid" : "pending") : selectedClient.setupPaymentStatus;
      const newMonthlyStatus = isMonthlyPaid ? "paid" : "pending";

      let newFinStatus: "CONFIRMADO" | "PAGO PARCIAL" | "PENDENTE" | "ATRASADO" = "PENDENTE";
      if (hasSetupPayment) {
        if (newSetupStatus === "paid" && newMonthlyStatus === "paid") newFinStatus = "CONFIRMADO";
        else if (newSetupStatus === "paid" || newMonthlyStatus === "paid") newFinStatus = "PAGO PARCIAL";
      } else {
        newFinStatus = newMonthlyStatus === "paid" ? "CONFIRMADO" : "PENDENTE";
      }

      const clientRef = doc(db, "leads", selectedClient.id);
      await updateDoc(clientRef, cleanFirestoreData({
        payments: currentPayments,
        setupPaymentStatus: newSetupStatus,
        configurationFeePaid: newSetupStatus === "paid",
        monthlyPaymentStatus: newMonthlyStatus,
        financialStatus: newFinStatus,
        updatedAt: new Date().toISOString()
      }));
    } catch (err: any) {
      console.error("Erro ao remover registro:", err);
    }
  };

  const handleToggleSetupStatus = async () => {
    if (isReadOnly || !selectedClient) return;
    try {
      const current = selectedClient.setupPaymentStatus === "paid" || selectedClient.configurationFeePaid;
      const nextPaid = !current;
      const nextStatus = nextPaid ? "paid" : "pending";
      const todayStr = new Date().toISOString().split("T")[0];

      let currentPayments = [...(selectedClient.payments || [])];
      let hasSetup = false;
      currentPayments = currentPayments.map(p => {
        if (p.type === "configuration") {
          hasSetup = true;
          const { paidDate, commissionPaidToEgn, egnRepassePaidDate, ...rest } = p;
          return {
            ...rest,
            status: nextStatus as "paid" | "pending",
            ...(nextPaid ? { paidDate: p.paidDate || todayStr } : {})
          };
        }
        return p;
      });

      if (!hasSetup && selectedClient.configurationFee) {
        currentPayments.unshift({
          id: `setup_${Date.now()}`,
          type: "configuration",
          dueDate: todayStr,
          amount: selectedClient.configurationFee,
          status: nextStatus as "paid" | "pending",
          ...(nextPaid ? { paidDate: todayStr } : {})
        });
      }

      const isMonthlyPaid = selectedClient.monthlyPaymentStatus === "paid" || currentPayments.some(p => p.type === "monthly" && p.status === "paid");
      let newFinStatus: "CONFIRMADO" | "PAGO PARCIAL" | "PENDENTE" | "ATRASADO" = "PENDENTE";
      if (nextPaid && isMonthlyPaid) newFinStatus = "CONFIRMADO";
      else if (nextPaid || isMonthlyPaid) newFinStatus = "PAGO PARCIAL";

      const clientRef = doc(db, "leads", selectedClient.id);
      await updateDoc(clientRef, cleanFirestoreData({
        setupPaymentStatus: nextStatus,
        configurationFeePaid: nextPaid,
        financialStatus: newFinStatus,
        payments: currentPayments,
        updatedAt: new Date().toISOString()
      }));
    } catch (err: any) {
      console.error("Erro ao atualizar status do Setup:", err);
    }
  };

  const handleToggleMonthlyStatus = async () => {
    if (isReadOnly || !selectedClient) return;
    try {
      const current = selectedClient.monthlyPaymentStatus === "paid";
      const nextPaid = !current;
      const nextStatus = nextPaid ? "paid" : "pending";
      const todayStr = new Date().toISOString().split("T")[0];

      let currentPayments = [...(selectedClient.payments || [])];
      let hasMonthly = false;
      currentPayments = currentPayments.map(p => {
        if (p.type === "monthly") {
          hasMonthly = true;
          const { paidDate, commissionPaidToEgn, egnRepassePaidDate, ...rest } = p;
          return {
            ...rest,
            status: nextStatus as "paid" | "pending",
            ...(nextPaid ? { paidDate: p.paidDate || todayStr } : {})
          };
        }
        return p;
      });

      if (!hasMonthly) {
        currentPayments.push({
          id: `monthly_${Date.now()}`,
          type: "monthly",
          dueDate: todayStr,
          amount: selectedClient.monthlyFee || 0,
          status: nextStatus as "paid" | "pending",
          ...(nextPaid ? { paidDate: todayStr } : {})
        });
      }

      const isSetupPaid = selectedClient.setupPaymentStatus === "paid" || selectedClient.configurationFeePaid;
      const hasSetup = Boolean(selectedClient.configurationFee && selectedClient.configurationFee > 0);

      let newFinStatus: "CONFIRMADO" | "PAGO PARCIAL" | "PENDENTE" | "ATRASADO" = "PENDENTE";
      if (hasSetup) {
        if (isSetupPaid && nextPaid) newFinStatus = "CONFIRMADO";
        else if (isSetupPaid || nextPaid) newFinStatus = "PAGO PARCIAL";
      } else {
        newFinStatus = nextPaid ? "CONFIRMADO" : "PENDENTE";
      }

      const clientRef = doc(db, "leads", selectedClient.id);
      await updateDoc(clientRef, cleanFirestoreData({
        monthlyPaymentStatus: nextStatus,
        financialStatus: newFinStatus,
        payments: currentPayments,
        updatedAt: new Date().toISOString()
      }));
    } catch (err: any) {
      console.error("Erro ao atualizar status da Mensalidade:", err);
    }
  };

  const handleManualSyncStatus = async () => {
    if (!selectedClient) return;
    try {
      setSyncingStatus(true);
      const res = await fetch("/api/asaas/sync-client-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedClient.id,
          customerId: (selectedClient as any).asaasCustomerId,
          subscriptionId: (selectedClient as any).asaasSubscriptionId,
          email: selectedClient.email,
          setupPaymentLink: selectedClient.setupPaymentLink,
          monthlyPaymentLink: selectedClient.monthlyPaymentLink
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.found || (data.details && data.details.length > 0)) {
          const detailMsg = data.details?.length > 0 ? `\n\nDetalhes:\n• ${data.details.join("\n• ")}` : "";
          alert(`✅ Sincronização concluída com sucesso!${detailMsg}\n\nStatus Atual:\n• Setup: ${data.setupPaymentStatus === "paid" ? "PAGO" : "PENDENTE"}\n• Assinatura/Mensalidade: ${data.monthlyPaymentStatus === "paid" ? "PAGA" : "PENDENTE"}`);
        } else {
          alert(`ℹ️ Consulta ao Asaas realizada.\n\nStatus retornado:\n• Setup: ${data.setupPaymentStatus === "paid" ? "PAGO" : "PENDENTE"}\n• Mensalidade: ${data.monthlyPaymentStatus === "paid" ? "PAGA" : "PENDENTE"}\n\nCaso o pagamento tenha sido feito recentemente, você também pode usar os botões "Marcar como Pago" diretamente nos cards.`);
        }
      } else {
        alert("Erro na sincronização: " + (data.error || "Não foi possível sincronizar com o Asaas."));
      }
    } catch (e: any) {
      alert("Erro ao consultar status no Asaas: " + e.message);
    } finally {
      setSyncingStatus(false);
    }
  };

  const handleProofFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert("O arquivo selecionado excede o limite de 4MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setRepasseProofFile(reader.result as string);
      setRepasseProofFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBatchMonthlyRepasse = async () => {
    if (isReadOnly) return;
    if (!repasseDate) {
      alert("Por favor, selecione a data do repasse.");
      return;
    }

    let itemsToProcess = [...allPendingRepasses];
    if (itemsToProcess.length === 0) {
      alert("Não há repasses pendentes de pagamentos efetivamente recebidos para dar baixa.");
      return;
    }

    try {
      setSavingRepasse(true);
      const itemsByClient: { [clientId: string]: RepasseItem[] } = {};
      itemsToProcess.forEach(item => {
        if (!itemsByClient[item.clientLeadId]) itemsByClient[item.clientLeadId] = [];
        itemsByClient[item.clientLeadId].push(item);
      });

      let totalBatchAmountRepassed = 0;

      for (const clientId of Object.keys(itemsByClient)) {
        const targetLead = leads.find(l => l.id === clientId);
        if (!targetLead) continue;

        const clientItems = itemsByClient[clientId];
        const paymentIdsToSettle = new Set(clientItems.map(i => i.payment.id));

        let updatedPayments = (targetLead.payments || []).map(p => {
          if (paymentIdsToSettle.has(p.id)) {
            return {
              ...p,
              status: "paid" as const,
              paidDate: p.paidDate || repasseDate,
              commissionPaidToEgn: true,
              egnRepassePaidDate: repasseDate,
              egnRepasseProofUrl: repasseProofFile || undefined,
              egnRepasseProofName: repasseProofFileName || undefined,
              egnRepasseNotes: repasseNotes.trim() ? `[Repasse Dia 25] ${repasseNotes.trim()}` : "[Repasse Dia 25]",
            };
          }
          return p;
        });

        clientItems.forEach(item => {
          if (!targetLead.payments?.some(p => p.id === item.payment.id)) {
            updatedPayments.push({
              id: item.payment.id,
              type: item.payment.type || "monthly",
              dueDate: item.payment.dueDate || repasseDate,
              amount: item.payment.amount || 1548.58,
              status: "paid",
              paidDate: repasseDate,
              commissionPaidToEgn: true,
              egnRepassePaidDate: repasseDate,
              egnRepasseProofUrl: repasseProofFile || undefined,
              egnRepasseProofName: repasseProofFileName || undefined,
              egnRepasseNotes: repasseNotes.trim() ? `[Repasse Dia 25] ${repasseNotes.trim()}` : "[Repasse Dia 25]",
            });
          }
        });

        const clientBatchTotal = clientItems.reduce((acc, curr) => acc + curr.commissionAmount, 0);
        totalBatchAmountRepassed += clientBatchTotal;

        const newHistoryItem: HistoryItem = {
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString(),
          text: `Repasse Andreia Cakes USA de $ ${formatMoney(clientBatchTotal)} quitado em ${formatDateBr(repasseDate)}.`,
          type: "payment"
        };

        const clientRef = doc(db, "leads", targetLead.id);
        await updateDoc(clientRef, {
          payments: updatedPayments,
          history: [...(targetLead.history || []), newHistoryItem],
          updatedAt: new Date().toISOString()
        });
      }

      setShowBatchModal(false);
      setRepasseProofFile(null);
      setRepasseProofFileName(null);
      setRepasseNotes("");
      setSavingRepasse(false);
      alert(`Fechamento concluído! Repasse de $ ${formatMoney(totalBatchAmountRepassed)} registrado com sucesso.`);
    } catch (err) {
      console.error(err);
      alert("Erro ao processar o repasse.");
      setSavingRepasse(false);
    }
  };

  const handleRevertRepasse = async (clientLeadId: string, paymentId: string) => {
    if (isReadOnly) return;
    if (!window.confirm("Deseja desfazer a baixa deste repasse de 10%?")) return;
    try {
      const targetLead = leads.find(l => l.id === clientLeadId);
      if (!targetLead) return;

      const updatedPayments = targetLead.payments?.map(p => {
        if (p.id === paymentId) {
          const { commissionPaidToEgn, egnRepassePaidDate, egnRepasseProofUrl, egnRepasseProofName, egnRepasseNotes, ...rest } = p;
          return { ...rest, commissionPaidToEgn: false };
        }
        return p;
      }) || [];

      const clientRef = doc(db, "leads", targetLead.id);
      await updateDoc(clientRef, {
        payments: updatedPayments,
        updatedAt: new Date().toISOString()
      });
      alert("Repasse revertido para pendente.");
    } catch (err) {
      alert("Erro ao desfazer repasse.");
    }
  };

  // Tallies
  let totalSetupReceived = 0;
  let totalSetupPending = 0;
  let totalMonthlyReceived = 0;
  let totalMonthlyPending = 0;
  let totalReceived = 0;
  let totalPending = 0;
  let totalEgnCommissionPaid = 0;
  let totalEgnCommissionPending = 0;

  const allPendingRepasses: RepasseItem[] = [];
  const allPaidRepasses: RepasseItem[] = [];

  clients.forEach(c => {
    const clientPayments: Payment[] = [];
    const cfgFee = Number(c.configurationFee || 0);
    const monFee = Number(c.monthlyFee || 0);
    const instCount = Number(c.setupInstallments || (cfgFee > 0 ? 3 : 1));
    const instVal = instCount > 0 ? Math.round((cfgFee / instCount) * 100) / 100 : cfgFee;

    if (c.payments && c.payments.length > 0) {
      // Filtrar apenas pagamentos válidos e legítimos deste cliente ativo
      const validPayments = c.payments.filter(p => {
        const pDate = p.paidDate || p.dueDate || "";
        const isOld = pDate.startsWith("2023") || pDate.startsWith("2022") || pDate.startsWith("2021");
        if (isOld) return false;

        const pVal = Number(p.amount || 0);
        const matches = (cfgFee > 0 && Math.abs(pVal - instVal) < 0.15) ||
                        (cfgFee > 0 && Math.abs(pVal - cfgFee) < 0.15) ||
                        (monFee > 0 && Math.abs(pVal - monFee) < 0.15) ||
                        (cfgFee === 0 && monFee === 0);
        return matches;
      });

      clientPayments.push(...validPayments);
    } else {
      const isSetupPaid = c.setupPaymentStatus === "paid" || c.configurationFeePaid === true;
      const isMonthlyPaid = c.monthlyPaymentStatus === "paid";
      if (c.configurationFee && c.configurationFee > 0) {
        clientPayments.push({
          id: "setup_" + c.id,
          type: "configuration" as const,
          dueDate: c.createdAt ? c.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
          amount: c.configurationFee,
          status: isSetupPaid ? "paid" : "pending",
          paidDate: isSetupPaid ? (c.updatedAt ? c.updatedAt.split("T")[0] : undefined) : undefined
        });
      }
      if (c.monthlyFee && c.monthlyFee > 0) {
        clientPayments.push({
          id: "monthly_" + c.id,
          type: "monthly" as const,
          dueDate: new Date().toISOString().split("T")[0],
          amount: c.monthlyFee,
          status: isMonthlyPaid ? "paid" : "pending",
          paidDate: isMonthlyPaid ? (c.updatedAt ? c.updatedAt.split("T")[0] : undefined) : undefined
        });
      }
    }

    clientPayments.forEach(p => {
      const isPaid = p.status === "paid";
      if (isPaid) {
        totalReceived += p.amount;
        if (p.type === "configuration") {
          totalSetupReceived += p.amount;
        } else {
          totalMonthlyReceived += p.amount;
        }
        const comm = calcEgnCommissionSingle(p.amount);
        const item: RepasseItem = {
          clientLeadId: c.id,
          clientName: c.name,
          company: c.company || "Empresa Individual",
          payment: p,
          commissionAmount: comm
        };

        if (p.commissionPaidToEgn === true) {
          totalEgnCommissionPaid += comm;
          allPaidRepasses.push(item);
        } else {
          totalEgnCommissionPending += comm;
          allPendingRepasses.push(item);
        }
      } else {
        totalPending += p.amount;
        if (p.type === "configuration") {
          totalSetupPending += p.amount;
        } else {
          totalMonthlyPending += p.amount;
        }
      }
    });
  });

  const normalizeClientPayments = (client: Lead) => {
    const setupFee = Number(client.configurationFee || 0);
    const monthlyFee = Number(client.monthlyFee || 0);
    const totalSetupInst = Number(client.setupInstallments || client.contractConfig?.setupInstallments || (setupFee > 0 ? 3 : 1));
    const expectedSetupInstAmount = totalSetupInst > 0 ? Math.round((setupFee / totalSetupInst) * 100) / 100 : setupFee;

    const rawList: Payment[] = (client.payments || []).filter(p => {
      const pDate = p.paidDate || p.dueDate || "";
      const isOld = pDate.startsWith("2023") || pDate.startsWith("2022") || pDate.startsWith("2021");
      if (isOld) return false;
      const pAmount = Number(p.amount || (p as any).value || 0);
      const matches = (setupFee > 0 && Math.abs(expectedSetupInstAmount - pAmount) < 0.15) ||
                      (setupFee > 0 && Math.abs(setupFee - pAmount) < 0.15) ||
                      (monthlyFee > 0 && Math.abs(monthlyFee - pAmount) < 0.15) ||
                      (setupFee === 0 && monthlyFee === 0);
      return matches;
    });
    const setupList: Payment[] = [];
    const monthlyList: Payment[] = [];

    const extractCode = (link?: string) => {
      if (!link) return "";
      const match = link.match(/\/(?:c|i)\/([a-zA-Z0-9_-]+)/);
      return match ? match[1].toLowerCase() : link.replace(/https?:\/\/[^\/]+\/(c|i)\//g, "").trim().toLowerCase();
    };

    const setupCode = extractCode(client.setupPaymentLink);
    const monthlyCode = extractCode(client.monthlyPaymentLink);

    rawList.forEach((p) => {
      const pAmount = Number(p.amount || (p as any).value || 0);
      const pId = String(p.id || (p as any).asaasPaymentId || "").toLowerCase();
      const invoiceUrl = String((p as any).invoiceUrl || "").toLowerCase();
      const desc = String((p as any).description || "").toLowerCase();
      const subId = (p as any).subscription || (p as any).asaasSubscriptionId;
      const isInst = Boolean((p as any).installment || p.installmentNumber);

      let isSetup = false;

      // 1. PRIORIDADE: Se tem vínculo explícito de assinatura ou código de link mensal
      if (subId || (monthlyCode && (pId.includes(monthlyCode) || invoiceUrl.includes(monthlyCode)))) {
        isSetup = false;
      }
      // 2. Se tem vínculo com o link de setup ou carnê de parcelamento
      else if (isInst || (setupCode && (pId.includes(setupCode) || invoiceUrl.includes(setupCode)))) {
        isSetup = true;
      }
      // 3. Descrição
      else if (desc.includes("setup") || desc.includes("config") || desc.includes("implan") || desc.includes("taxa") || /parcela\s*(\d+)/i.test(desc)) {
        isSetup = true;
      } else if (desc.includes("mensal") || desc.includes("assinatura") || desc.includes("recorren")) {
        isSetup = false;
      }
      // 4. Comparação com a Taxa de Setup
      else if (setupFee > 0 && !subId && setupList.length < totalSetupInst && (Math.abs(expectedSetupInstAmount - pAmount) < 0.05 || Math.abs(setupFee - pAmount) < 0.05)) {
        isSetup = true;
      } else if (monthlyFee > 0 && Math.abs(monthlyFee - pAmount) < 0.05) {
        isSetup = false;
      } else if (p.type === "configuration") {
        isSetup = true;
      } else if (p.type === "monthly") {
        isSetup = false;
      } else {
        isSetup = setupFee > 0 && setupList.length < totalSetupInst;
      }

      if (isSetup) {
        setupList.push({
          ...p,
          type: "configuration",
          installmentNumber: p.installmentNumber || (setupList.length + 1),
          totalInstallments: p.totalInstallments || totalSetupInst
        });
      } else {
        // Identificação precisa da competência (Mês de Referência)
        let resolvedMonthRef = "";
        const descMatch = (desc || "").match(/(\d{2}\/\d{4})/);
        if (descMatch) {
          resolvedMonthRef = descMatch[1];
        } else if (p.monthReference) {
          resolvedMonthRef = p.monthReference;
        } else if (p.dueDate && p.dueDate.includes("-")) {
          const parts = p.dueDate.split("-");
          resolvedMonthRef = `${parts[1]}/${parts[0]}`;
        } else if (p.status === "paid" && p.paidDate && p.paidDate.includes("-")) {
          const parts = p.paidDate.split("-");
          resolvedMonthRef = `${parts[1]}/${parts[0]}`;
        }

        monthlyList.push({
          ...p,
          type: "monthly",
          monthReference: resolvedMonthRef
        });
      }
    });

    // Deduplicar e filtrar rigorosamente faturas mensais por Mês de Referência / ID
    const uniqueMonthlyByRef = new Map<string, Payment>();
    const now = new Date();
    const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

    // Verificar se existe alguma mensalidade paga
    const hasPaidMonthly = monthlyList.some(m => m.status === "paid");

    monthlyList.forEach((m) => {
      // Se a fatura está PENDENTE e pertence a um mês futuro (> mês atual) enquanto o cliente já está em dia, não polui
      if (m.status !== "paid") {
        if (m.monthReference && m.monthReference > currentMonthYear && hasPaidMonthly) {
          return; // Não incluir faturas de meses futuros ainda não geradas/cobradas
        }
        if (m.dueDate) {
          const dueTime = new Date(m.dueDate).getTime();
          const diffDays = (dueTime - now.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > 30 && hasPaidMonthly) {
            return;
          }
        }
      }

      const key = m.monthReference || (m.dueDate && m.dueDate.includes("-") ? `${m.dueDate.split("-")[1]}/${m.dueDate.split("-")[0]}` : (m as any).asaasPaymentId || m.id || "atual");
      const existing = uniqueMonthlyByRef.get(key);
      if (!existing) {
        uniqueMonthlyByRef.set(key, m);
      } else {
        // Se a nova fatura está PAGA e a existente não, substitui pela PAGA
        if (m.status === "paid" && existing.status !== "paid") {
          uniqueMonthlyByRef.set(key, m);
        } else if (!(existing as any).invoiceUrl && (m as any).invoiceUrl) {
          uniqueMonthlyByRef.set(key, m);
        }
      }
    });

    const deduplicatedMonthlyList = Array.from(uniqueMonthlyByRef.values());

    // Limpar IDs falsos do Asaas em parcelas de setup que ainda não foram pagas ou geradas
    const cleanedSetupList = setupList.map((s, idx) => {
      if (s.status !== "paid" && !(s as any).installment) {
        // Parcela pendente aguardando quitação futura: não possui ID de fatura gerada no Asaas
        return {
          ...s,
          asaasPaymentId: undefined,
          installmentNumber: s.installmentNumber || (idx + 1)
        };
      }
      return s;
    });

    // Se o cliente ainda não tem parcelas de setup estruturadas no array mas possui taxa de setup contratada:
    let finalSetupList = [...cleanedSetupList];
    if (finalSetupList.length === 0 && setupFee > 0) {
      const isGlobalSetupPaid = client.setupPaymentStatus === "paid" || client.configurationFeePaid === true;
      const isGlobalSetupPartial = client.setupPaymentStatus === "partial";
      const baseDueDateStr = client.setupDueDate || client.contractConfig?.setupDueDate;

      for (let i = 1; i <= totalSetupInst; i++) {
        const isPaid = isGlobalSetupPaid || (isGlobalSetupPartial && i === 1);
        let dueDateObj: Date;
        if (baseDueDateStr) {
          const parts = baseDueDateStr.split("-");
          const bYear = parseInt(parts[0], 10);
          const bMonth = parseInt(parts[1], 10) - 1;
          const bDay = parseInt(parts[2], 10);
          dueDateObj = new Date(bYear, bMonth + (i - 1), bDay);
        } else {
          const today = new Date();
          dueDateObj = new Date(today.getFullYear(), today.getMonth() + (i - 1), today.getDate());
        }

        finalSetupList.push({
          id: `setup_inst_${i}_${client.id}`,
          type: "configuration",
          dueDate: dueDateObj.toISOString().split("T")[0],
          amount: expectedSetupInstAmount,
          status: isPaid ? "paid" : "pending",
          installmentNumber: i,
          totalInstallments: totalSetupInst,
          paidDate: isPaid ? (client.updatedAt ? client.updatedAt.split("T")[0] : new Date().toISOString().split("T")[0]) : undefined
        });
      }
    }

    // Ordenar mensalidades por data decrescente (mais recente primeiro)
    deduplicatedMonthlyList.sort((a, b) => {
      const tA = new Date(a.dueDate || a.paidDate || 0).getTime();
      const tB = new Date(b.dueDate || b.paidDate || 0).getTime();
      return tB - tA;
    });

    let finalMonthlyList = [...deduplicatedMonthlyList];
    if (finalMonthlyList.length === 0 && monthlyFee > 0) {
      const isMonthlyPaid = client.monthlyPaymentStatus === "paid";
      finalMonthlyList.push({
        id: `monthly_${client.id}`,
        type: "monthly",
        dueDate: now.toISOString().split("T")[0],
        amount: monthlyFee,
        status: isMonthlyPaid ? "paid" : "pending",
        monthReference: currentMonthYear,
        paidDate: isMonthlyPaid ? (client.updatedAt ? client.updatedAt.split("T")[0] : now.toISOString().split("T")[0]) : undefined
      });
    }

    return { setupList: finalSetupList, monthlyList: finalMonthlyList, totalSetupInst, expectedSetupInstAmount };
  };

  const getClientFinanceOverview = (client: Lead) => {
    const setupFee = Number(client.configurationFee || 0);
    const monthlyFee = Number(client.monthlyFee || 0);
    const isMonthlyPaidGlobal = client.monthlyPaymentStatus === "paid";
    const isGlobalSetupPaid = client.setupPaymentStatus === "paid" || client.configurationFeePaid === true;
    const isGlobalSetupPartial = client.setupPaymentStatus === "partial";

    // Extrair parcelas de setup e pagamentos mensais normalizados
    const { setupList: setupPayments, monthlyList: monthlyPayments, totalSetupInst, expectedSetupInstAmount } = normalizeClientPayments(client);

    // Total de parcelas de setup configuradas
    const setupTotalInstallments = totalSetupInst;

    // Calcular parcelas pagas de setup
    const setupPaidPayments = setupPayments.filter(p => p.status === "paid");
    let setupPaidCount = setupPaidPayments.length;
    let setupPaidAmount = setupPaidPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    // Se ainda não há pagamentos estruturados no array mas o flag global foi setado
    if (setupPaidCount === 0 && setupFee > 0) {
      if (isGlobalSetupPaid) {
        setupPaidCount = setupTotalInstallments || 1;
        setupPaidAmount = setupFee;
      } else if (isGlobalSetupPartial) {
        setupPaidCount = 1;
        setupPaidAmount = expectedSetupInstAmount;
      }
    }

    const effectiveSetupTotalCount = setupTotalInstallments > 0 ? setupTotalInstallments : (setupPayments.length || 1);
    
    // Porcentagem da barra de progresso (loading bar)
    let setupProgressPercent = 0;
    if (setupFee > 0) {
      setupProgressPercent = Math.min(100, Math.round((setupPaidAmount / setupFee) * 100));
    } else if (effectiveSetupTotalCount > 0) {
      setupProgressPercent = Math.min(100, Math.round((setupPaidCount / effectiveSetupTotalCount) * 100));
    }

    let setupStatusBadge: "paid" | "partial" | "pending" = "pending";
    if (setupProgressPercent >= 100 || isGlobalSetupPaid || (setupFee > 0 && setupPaidAmount >= setupFee - 0.05)) {
      setupStatusBadge = "paid";
      setupProgressPercent = 100;
    } else if (setupPaidCount > 0 || isGlobalSetupPartial || setupPaidAmount > 0) {
      setupStatusBadge = "partial";
    }

    // Identificação do Mês Ativo de Referência (ex: "09/2026" ou "08/2026")
    const now = new Date();
    const defaultMonthRef = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    
    // A mensalidade ativa é a mais recente cadastrada ou a pendente mais urgente
    const pendingMonthly = monthlyPayments.find(p => p.status === "pending");
    const latestMonthly = monthlyPayments[0];
    const activeMonthlyPayment = pendingMonthly || latestMonthly;

    const currentMonthRef = activeMonthlyPayment?.monthReference || 
      (activeMonthlyPayment?.dueDate ? `${activeMonthlyPayment.dueDate.split("-")[1]}/${activeMonthlyPayment.dueDate.split("-")[0]}` : defaultMonthRef);
    
    const isCurrentMonthPaid = activeMonthlyPayment ? (activeMonthlyPayment.status === "paid") : isMonthlyPaidGlobal;
    const activeMonthlyDueDate = activeMonthlyPayment?.dueDate;
    const activeMonthlyPaidDate = activeMonthlyPayment?.paidDate;
    const activeMonthlyInvoiceUrl = (activeMonthlyPayment as any)?.invoiceUrl;

    const totalPayments = (setupPayments.length || effectiveSetupTotalCount) + (monthlyPayments.length || 1);
    const paidCount = setupPaidCount + (isCurrentMonthPaid ? 1 : 0);
    const totalAmount = setupFee + (monthlyFee || 0);
    const paidAmount = setupPaidAmount + (isCurrentMonthPaid ? monthlyFee : 0);

    const isSetupFullyPaid = (setupFee > 0 ? setupStatusBadge === "paid" : true);

    let statusBadge = "PENDENTE";
    let badgeColor = "bg-amber-50 text-amber-800 border-amber-300";
    let progressColor = "bg-slate-200";

    if (client.financialStatus === "ATRASADO") {
      statusBadge = "ATRASADO";
      badgeColor = "bg-rose-50 text-rose-800 border-rose-300";
      progressColor = "bg-rose-500";
    } else if (isSetupFullyPaid && isCurrentMonthPaid) {
      statusBadge = "CONFIRMADO";
      badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-300";
      progressColor = "bg-emerald-500";
    } else if (setupStatusBadge === "partial" || setupStatusBadge === "paid" || isCurrentMonthPaid || monthlyPayments.some(p => p.status === "paid")) {
      statusBadge = "PAGO PARCIAL";
      badgeColor = "bg-amber-50 text-amber-900 border-amber-300";
      progressColor = "bg-amber-500";
    }

    return {
      setupFee,
      monthlyFee,
      expectedSetupInstAmount,
      setupTotalInstallments: effectiveSetupTotalCount,
      setupPaidInstallments: setupPaidCount,
      setupPaidAmount,
      setupProgressPercent,
      setupStatusBadge,
      isMonthlyPaid: isCurrentMonthPaid,
      currentMonthRef,
      activeMonthlyDueDate,
      activeMonthlyPaidDate,
      activeMonthlyInvoiceUrl,
      monthlyPayments,
      monthlyPaymentsCount: monthlyPayments.length,
      monthlyPaidCount: monthlyPayments.filter(p => p.status === "paid").length,
      totalPayments,
      paidCount,
      totalAmount,
      paidAmount,
      statusBadge,
      badgeColor,
      progressColor
    };
  };

  const allClientOverviews = clients.map(c => ({ client: c, overview: getClientFinanceOverview(c) }));
  const countTodos = clients.length;
  const countConfirmados = allClientOverviews.filter(o => o.overview.statusBadge === "CONFIRMADO").length;
  const countParcial = allClientOverviews.filter(o => o.overview.statusBadge === "PAGO PARCIAL").length;
  const countPendentes = allClientOverviews.filter(o => o.overview.statusBadge === "PENDENTE").length;
  const countAtrasados = allClientOverviews.filter(o => o.overview.statusBadge === "ATRASADO").length;

  const filteredClientOverviews = allClientOverviews.filter(({ client: c, overview }) => {
    if (statusFilter === "confirmados" && overview.statusBadge !== "CONFIRMADO") return false;
    if (statusFilter === "parcial" && overview.statusBadge !== "PAGO PARCIAL") return false;
    if (statusFilter === "pendentes" && overview.statusBadge !== "PENDENTE") return false;
    if (statusFilter === "atrasados" && overview.statusBadge !== "ATRASADO") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, "");

      const matchName = (c.name || "").toLowerCase().includes(q);
      const matchCompany = (c.company || "").toLowerCase().includes(q);
      const matchEmail = (c.email || "").toLowerCase().includes(q) ||
                         (c.contractConfig?.clientEmail || "").toLowerCase().includes(q) ||
                         (c.contractData?.email || "").toLowerCase().includes(q);
      const matchStatus = overview.statusBadge.toLowerCase().includes(q);

      // Phone matching
      const p1 = (c.phone || "").toLowerCase();
      const p2 = (c.whatsapp || "").toLowerCase();
      const p3 = (c.contractData?.phone || "").toLowerCase();
      const p4 = (c.contractConfig?.clientPhone || "").toLowerCase();
      const pd1 = p1.replace(/\D/g, "");
      const pd2 = p2.replace(/\D/g, "");
      const pd3 = p3.replace(/\D/g, "");
      const pd4 = p4.replace(/\D/g, "");
      const matchPhone = p1.includes(q) || p2.includes(q) || p3.includes(q) || p4.includes(q) ||
        (qDigits.length >= 3 && (pd1.includes(qDigits) || pd2.includes(qDigits) || pd3.includes(qDigits) || pd4.includes(qDigits)));

      // Doc matching
      const d1 = (c.contractData?.document || "").toLowerCase();
      const d2 = (c.contractConfig?.clientDoc || "").toLowerCase();
      const d3 = (c.document || "").toLowerCase();
      const d4 = (c.cpf || "").toLowerCase();
      const d5 = (c.cnpj || "").toLowerCase();
      const dd1 = d1.replace(/\D/g, "");
      const dd2 = d2.replace(/\D/g, "");
      const dd3 = d3.replace(/\D/g, "");
      const dd4 = d4.replace(/\D/g, "");
      const dd5 = d5.replace(/\D/g, "");
      const matchDoc = d1.includes(q) || d2.includes(q) || d3.includes(q) || d4.includes(q) || d5.includes(q) ||
        (qDigits.length >= 3 && (dd1.includes(qDigits) || dd2.includes(qDigits) || dd3.includes(qDigits) || dd4.includes(qDigits) || dd5.includes(qDigits)));

      return matchName || matchCompany || matchEmail || matchStatus || matchPhone || matchDoc;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* KPIs and Visual Distribution Dashboard */}
      <DashboardKPIs leads={leads} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
        <div>
          <h2 className="font-extrabold text-sm uppercase tracking-wider text-[#342825] flex items-center gap-2">
            <Landmark size={16} className="text-[#BD5944]" />
            Gestão Financeira & Clientes
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Controle de mensalidades, faturamentos, repasses de 10% e fluxo de caixa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowMonthlyReport(!showMonthlyReport)}
            className={`flex items-center gap-1.5 text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer ${
              showMonthlyReport ? "bg-[#342825] text-white" : "bg-amber-50 hover:bg-amber-100 text-[#342825] border border-amber-200/80"
            }`}
          >
            <BadgePercent size={14} />
            Relatório e Repasses (10%)
            {allPendingRepasses.length > 0 && (
              <span className="bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ml-1">
                {allPendingRepasses.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Monthly Report Panel */}
      {showMonthlyReport && (
        <div className="bg-white border border-amber-200/80 rounded-2xl p-6 space-y-5 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center font-bold">
                <BadgePercent size={22} />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-[#342825] uppercase tracking-wider">
                  Relatório & Controle de Repasses Andreia Cakes USA (10%)
                </h4>
                <p className="text-xs text-slate-500">Ciclo mensal encerrado dia 24 | Repasse efetuado dia 25</p>
              </div>
            </div>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setShowBatchModal(true);
                  setRepasseDate(getSuggested25thDate());
                }}
                className="bg-rose-700 hover:bg-rose-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Upload size={14} />
                Quitar Repasse Mensal (Dia 25 - Zerar Saldo)
              </button>
            )}
          </div>

          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setRepasseFilterTab("pendentes")}
              className={`py-2.5 px-4 font-bold text-xs border-b-2 transition flex items-center gap-2 cursor-pointer ${
                repasseFilterTab === "pendentes" ? "border-rose-600 text-rose-700" : "border-transparent text-slate-500"
              }`}
            >
              <Clock size={14} /> Repasses Pendentes ({allPendingRepasses.length})
            </button>
            <button
              onClick={() => setRepasseFilterTab("historico")}
              className={`py-2.5 px-4 font-bold text-xs border-b-2 transition flex items-center gap-2 cursor-pointer ${
                repasseFilterTab === "historico" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500"
              }`}
            >
              <History size={14} /> Histórico de Repasses ({allPaidRepasses.length})
            </button>
          </div>

          {repasseFilterTab === "pendentes" ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              {allPendingRepasses.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <p className="font-bold text-slate-600">Nenhum repasse pendente.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Comissões de 10% são geradas sobre o valor líquido recebido de cada cobrança (descontadas as taxas bancárias de $0,49 fixo + 3,49%).</p>
                </div>
              ) : (
                allPendingRepasses.map((item, idx) => (
                  <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#342825]">{item.clientName} ({item.company})</p>
                      <p className="text-[11px] text-slate-500">
                        {item.payment.type === "configuration" ? "Setup" : "Mensalidade"} • Recebido Bruto: <strong className="text-slate-700">$ {formatMoney(item.payment.amount)}</strong>
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Taxa Bancária (0,49 + 3,49%): -$ {formatMoney(calcBankFee(item.payment.amount))} • Base Líquida: $ {formatMoney(calcNetReceivedAmount(item.payment.amount))}
                      </p>
                    </div>
                    <div className="text-right sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Comissão Andreia (10% Líquido)</span>
                      <span className="text-base font-black text-rose-700">$ {formatMoney(item.commissionAmount)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              {allPaidRepasses.length === 0 ? (
                <p className="p-8 text-slate-400 text-center italic">Nenhum histórico de repasse quitado encontrado.</p>
              ) : (
                allPaidRepasses.map((item, idx) => (
                  <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#342825]">{item.clientName} ({item.company})</p>
                      <p className="text-[11px] text-slate-500">
                        {item.payment.type === "configuration" ? "Setup" : "Mensalidade"} • Recebido Bruto: $ {formatMoney(item.payment.amount)} • Tx Bancária: -$ {formatMoney(calcBankFee(item.payment.amount))}
                      </p>
                      <p className="text-[11px] text-emerald-700 font-bold mt-0.5">Pago em: {formatDateBr(item.payment.egnRepassePaidDate)}</p>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Comissão 10% Líquido</span>
                        <span className="text-base font-black text-emerald-700">$ {formatMoney(item.commissionAmount)}</span>
                      </div>
                      {item.payment.egnRepasseProofUrl && (
                        <button
                          type="button"
                          onClick={() => setProofViewerModal({
                            url: item.payment.egnRepasseProofUrl!,
                            name: item.payment.egnRepasseProofName || "comprovante",
                            date: item.payment.egnRepassePaidDate,
                            clientName: item.clientName,
                            amount: item.commissionAmount
                          })}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg text-xs"
                        >
                          Ver Comprovante
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* KPI Financial Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 border border-slate-200/80 rounded-xl p-5">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recebido (Geral)</span>
          <p className="text-xl font-extrabold text-[#342825] mt-1">$ {formatMoney(totalReceived)}</p>
          <div className="mt-2 flex flex-col gap-0.5 text-[10px] font-bold">
            <span className="text-emerald-700">Setup: $ {formatMoney(totalSetupReceived)}</span>
            <span className="text-blue-700">Mensal: $ {formatMoney(totalMonthlyReceived)}</span>
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">A Receber (Previsão)</span>
          <p className="text-xl font-extrabold text-[#BD5944] mt-1">$ {formatMoney(totalPending)}</p>
          <div className="mt-2 flex flex-col gap-0.5 text-[10px] font-bold">
            <span className="text-amber-700">Setup Pend.: $ {formatMoney(totalSetupPending)}</span>
            <span className="text-slate-500">Mensal Pend.: $ {formatMoney(totalMonthlyPending)}</span>
          </div>
        </div>
        <div 
          onClick={() => { setShowMonthlyReport(true); setRepasseFilterTab("historico"); }}
          className="bg-white border border-emerald-200/80 rounded-xl p-3.5 shadow-sm hover:shadow-md cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Repassado Andreia Cakes USA (10%)</span>
          <p className="text-xl font-extrabold text-emerald-700 mt-1">$ {formatMoney(totalEgnCommissionPaid)}</p>
          <span className="text-[10px] font-semibold text-emerald-600 block mt-2">Clique para ver histórico</span>
        </div>
        <div 
          onClick={() => { setShowMonthlyReport(true); setRepasseFilterTab("pendentes"); }}
          className="bg-white border border-rose-200/80 rounded-xl p-3.5 shadow-sm hover:shadow-md cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Pendente Repasse Andreia Cakes</span>
          <p className="text-xl font-extrabold text-rose-700 mt-1">$ {formatMoney(totalEgnCommissionPending)}</p>
          <span className="text-[9px] font-semibold text-rose-600 block mt-2">10% líquido (após tx bancária: $0,49 + 3,49%)</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setStatusFilter("todos")}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider ${
              statusFilter === "todos" ? "bg-[#342825] text-white" : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            <Users size={16} />
            <span>Todos Clientes</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">{countTodos}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("confirmados")}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider ${
              statusFilter === "confirmados" ? "bg-emerald-700 text-white" : "bg-white text-emerald-800 border border-emerald-200"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>Clientes Pagos</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">{countConfirmados}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("parcial")}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider ${
              statusFilter === "parcial" ? "bg-amber-700 text-white" : "bg-white text-amber-900 border border-amber-200"
            }`}
          >
            <Clock size={16} />
            <span>Pago Parcial</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 font-bold">{countParcial}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("pendentes")}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider ${
              statusFilter === "pendentes" ? "bg-slate-700 text-white" : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            <AlertCircle size={16} />
            <span>Pendentes</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">{countPendentes}</span>
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, empresa, CPF/CNPJ, telefone ou e-mail..."
            className="w-full pl-11 pr-10 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-xs font-bold text-[#342825] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#BD5944]"
          />
        </div>
      </div>

      {/* Main Clients Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
          <div className="col-span-12 sm:col-span-4">Cliente / Empresa</div>
          <div className="col-span-12 sm:col-span-3 hidden sm:block text-left">Status da Parcela (Setup)</div>
          <div className="col-span-12 sm:col-span-3 hidden sm:block text-left">Status da Assinatura (Mensal)</div>
          <div className="col-span-12 sm:col-span-2 hidden sm:block text-right">Ações</div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredClientOverviews.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <p className="text-sm font-bold text-slate-600">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            filteredClientOverviews.map(({ client: c, overview }) => {
              return (
                <div 
                  key={c.id} 
                  onClick={() => setSelectedClientId(c.id)}
                  className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <div className="col-span-12 sm:col-span-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-sm text-[#342825] group-hover:text-[#BD5944] transition-colors uppercase">{c.name}</h4>
                      {overview.statusBadge === "CONFIRMADO" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold">100% PAGO</span>
                      )}
                      {overview.statusBadge === "PAGO PARCIAL" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-extrabold">PAGO PARCIAL</span>
                      )}
                      {overview.statusBadge === "ATRASADO" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold">ATRASADO</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-bold uppercase">{c.company || "EMPRESA INDIVIDUAL"}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{c.email || c.phone || ""}</p>
                  </div>

                  {/* 1. Status da Parcela / Setup com Barra de Progresso (Estilo Loading) */}
                  <div className="col-span-12 sm:col-span-3 text-left">
                    <div className="p-3 bg-white border border-slate-200/90 rounded-xl space-y-2 shadow-xs group-hover:border-slate-300 transition-colors">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase border ${
                          overview.setupStatusBadge === "paid"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : overview.setupStatusBadge === "partial"
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {overview.setupStatusBadge === "paid" ? "✓ PAGO" : overview.setupStatusBadge === "partial" ? "PAGO PARCIAL" : "PENDENTE"}
                        </span>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">
                          {overview.setupPaidInstallments} de {overview.setupTotalInstallments} parcelas
                        </span>
                      </div>

                      {/* Barra de Progresso / Loading Bar */}
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${
                            overview.setupStatusBadge === "paid"
                              ? "bg-emerald-500"
                              : overview.setupStatusBadge === "partial"
                              ? "bg-amber-500"
                              : "bg-transparent"
                          }`}
                          style={{ width: `${Math.max(overview.setupProgressPercent, overview.setupPaidInstallments > 0 ? 20 : 0)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-extrabold pt-0.5">
                        <span className="text-[#342825]">
                          $ {formatMoney(overview.setupPaidAmount)}
                        </span>
                        <span className="text-slate-400">
                          Total: $ {formatMoney(overview.setupFee)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Status da Assinatura / Mensal */}
                  <div className="col-span-12 sm:col-span-3 text-left">
                    <div className="p-3 bg-white border border-slate-200/90 rounded-xl space-y-2 shadow-xs group-hover:border-slate-300 transition-colors">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase border ${
                          overview.isMonthlyPaid
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-amber-100 text-amber-900 border-amber-300"
                        }`}>
                          {overview.isMonthlyPaid ? "✓ PAGA" : "PENDENTE"}
                        </span>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">
                          Ref: {overview.currentMonthRef}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-extrabold pt-2">
                        <span className="text-[#342825]">
                          {overview.monthlyFee ? `$ ${formatMoney(overview.monthlyFee)}/mês` : "$ 0,00"}
                        </span>
                        <span className={`text-[9px] font-bold ${overview.isMonthlyPaid ? "text-emerald-700" : "text-amber-700"}`}>
                          {overview.isMonthlyPaid ? "Assinatura Ativa" : (overview.activeMonthlyDueDate ? `Venc: ${formatDateBr(overview.activeMonthlyDueDate)}` : "Aguardando Pgto")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 sm:col-span-2 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClientId(c.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-[#342825] text-[#342825] hover:text-white rounded-xl text-xs font-black uppercase transition-all shadow-xs cursor-pointer ml-auto"
                    >
                      <span>VER DETALHES</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL DETALHES FINANCEIROS DO CLIENTE (POPUP EM TELA CHEIA) */}
      {selectedClient && (() => {
        const modalOverview = getClientFinanceOverview(selectedClient);
        const { setupList: normalizedSetupList, monthlyList: normalizedMonthlyList } = normalizeClientPayments(selectedClient);
        
        const setupInstallmentList = (() => {
          const totalInst = modalOverview.setupTotalInstallments || 3;
          const list = [];
          for (let i = 1; i <= totalInst; i++) {
            const found = normalizedSetupList.find(p => p.installmentNumber === i) || normalizedSetupList[i - 1];
            const isPaid = found ? found.status === "paid" : (modalOverview.setupPaidInstallments >= i);
            const val = found?.amount || modalOverview.expectedSetupInstAmount || (modalOverview.setupFee > 0 ? (modalOverview.setupFee / totalInst) : 0);
            list.push({
              number: i,
              total: totalInst,
              status: isPaid ? "paid" : "pending",
              amount: val,
              dueDate: found?.dueDate,
              paidDate: found?.paidDate,
              paymentId: found?.id,
              asaasPaymentId: (found as any)?.asaasPaymentId,
              invoiceUrl: (found as any)?.invoiceUrl
            });
          }
          return list;
        })();

        // Unificar histórico de interações, auditoria e linha do tempo de pagamentos
        const allDisplayPayments = [...normalizedSetupList, ...normalizedMonthlyList];

        const unifiedTimeline = (() => {
          const events: Array<{
            id: string;
            date: string;
            displayDate: string;
            title: string;
            description?: string;
            type: "payment" | "webhook" | "status" | "note";
            badge: string;
            badgeColor: string;
          }> = [];

          // 1. Pagamentos Registrados
          allDisplayPayments.forEach((p, idx) => {
            const pDate = p.paidDate || p.dueDate || selectedClient.createdAt || "";
            const isSetup = p.type === "configuration";
            const pLabel = isSetup 
              ? `Taxa de Setup • Parcela ${p.installmentNumber || idx + 1} de ${p.totalInstallments || modalOverview.setupTotalInstallments}`
              : `Mensalidade Recorrente ${p.monthReference ? `(Ref: ${p.monthReference})` : ""}`;

            events.push({
              id: `pay_evt_${p.id || idx}`,
              date: pDate,
              displayDate: formatDateBr(pDate),
              title: `${pLabel} - $ ${formatMoney(p.amount)}`,
              description: p.status === "paid" 
                ? `Pagamento confirmado e compensado. ${(p as any).asaasPaymentId ? `(ID Asaas: ${(p as any).asaasPaymentId})` : ""}`
                : `Cobrança pendente com vencimento para ${formatDateBr(p.dueDate)}.`,
              type: "payment",
              badge: p.status === "paid" ? "PAGO / QUITADO" : "PENDENTE",
              badgeColor: p.status === "paid" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"
            });
          });

          // 2. Histórico de Interações (Lead History)
          (selectedClient.history || []).forEach((h, hIdx) => {
            const txt = h.text || "";
            if (txt.includes("2023") || txt.includes("69.9") || txt.includes("69.90") || txt.includes("69.99")) return;
            if (txt.includes("[Sincronização Asaas]")) return; // evita poluição visual de sincronizações repetitivas

            const hDate = h.date || "";
            events.push({
              id: `hist_${h.id || hIdx}`,
              date: hDate,
              displayDate: hDate ? new Date(hDate).toLocaleString("pt-BR") : "-",
              title: h.text || "Anotação registrada",
              type: h.type === "payment" ? "payment" : h.type === "status_change" ? "status" : "note",
              badge: h.type === "payment" ? "PAGAMENTO" : h.type === "status_change" ? "STATUS" : "HISTÓRICO",
              badgeColor: h.type === "payment" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-700 border-slate-300"
            });
          });

          // 3. Logs de Webhook e Notificações Asaas
          (selectedClient.logs || []).forEach((l, lIdx) => {
            const act = l.action || "";
            if (act.includes("2023") || act.includes("69.9") || act.includes("69.90") || act.includes("69.99")) return;
            if (act.includes("[Sincronização Asaas]") || act.includes("[Consulta Asaas]")) return;

            events.push({
              id: `log_${lIdx}`,
              date: l.date || "",
              displayDate: l.date || "-",
              title: l.action || "Notificação Asaas",
              description: `Origem: ${l.user || "Sistema / Webhook Asaas"}`,
              type: "webhook",
              badge: "WEBHOOK / ASAAS",
              badgeColor: "bg-blue-100 text-blue-800 border-blue-300"
            });
          });

          // Ordenar por data mais recente
          return events.sort((a, b) => {
            const tA = a.date ? new Date(a.date).getTime() : 0;
            const tB = b.date ? new Date(b.date).getTime() : 0;
            return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
          });
        })();

        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
              
              {/* Header do Modal */}
              <div className="bg-[#342825] text-white p-5 sm:p-6 flex justify-between items-start border-b border-[#BD5944]/30">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#BD5944] text-white flex items-center justify-center font-black text-xl shadow-inner shrink-0">
                    {selectedClient.name ? selectedClient.name.charAt(0).toUpperCase() : "C"}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-lg sm:text-xl uppercase tracking-wide">{selectedClient.name}</h3>
                      
                      {/* Badge Parcela / Setup */}
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                        modalOverview.setupStatusBadge === "paid"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                          : modalOverview.setupStatusBadge === "partial"
                          ? "bg-amber-500/20 text-amber-300 border-amber-400/40"
                          : "bg-slate-700/40 text-slate-300 border-slate-600"
                      }`}>
                        Parcelas Setup: {modalOverview.setupPaidInstallments} de {modalOverview.setupTotalInstallments} ({modalOverview.setupStatusBadge === "paid" ? "PAGO" : modalOverview.setupStatusBadge === "partial" ? "PAGO PARCIAL" : "PENDENTE"})
                      </span>

                      {/* Badge Assinatura / Mensal */}
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                        modalOverview.isMonthlyPaid
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                          : "bg-amber-500/20 text-amber-300 border-amber-400/40"
                      }`}>
                        Assinatura: {modalOverview.isMonthlyPaid ? `PAGA (${modalOverview.currentMonthRef})` : `PENDENTE (${modalOverview.currentMonthRef})`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium mt-1">
                      {selectedClient.company || "Empresa Individual"} • CPF/CNPJ: {selectedClient.contractData?.document || selectedClient.document || selectedClient.cpf || selectedClient.cnpj || "Não informado"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setSelectedClientId(null); setShowAddPaymentForm(false); }}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Corpo do Modal (Scrollável) */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
                {isReadOnly && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
                    <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    <div className="text-xs">
                      <p className="font-extrabold uppercase tracking-wide">Acesso Andreia Cakes USA (Modo Visualização)</p>
                      <p className="text-[11px] text-amber-800/90 mt-0.5">
                        Todas as cobranças, parcelas e status financeiros estão visíveis para conferência. Ações de baixa manual e edição de faturas são exclusivas do Acesso Geral (EBC).
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Informações de Contato */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">E-mail</span>
                    <span className="font-bold text-slate-800 break-all">{selectedClient.email || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Telefone / WhatsApp</span>
                    <span className="font-bold text-slate-800">{selectedClient.phone || selectedClient.whatsapp || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status do Contrato</span>
                    <span className="font-bold text-slate-800 text-[11px]">
                      {selectedClient.contractStatus === "signed" || selectedClient.contractData?.signedAt ? (
                        <span className="text-emerald-700 font-bold">Assinado Digitalmente</span>
                      ) : (
                        <span className="text-amber-700 font-medium">Pendente de Assinatura</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Blocos de Cobrança: Setup e Mensalidade */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* 1. Taxa de Setup / Configuração */}
                  <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-amber-50 text-amber-800 rounded-xl">
                            <CreditCard size={18} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-[#342825] uppercase">Taxa de Setup (Parcelamento)</h4>
                            <p className="text-[11px] text-slate-400 font-bold">Implementação em até {modalOverview.setupTotalInstallments}x</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase border ${
                          modalOverview.setupStatusBadge === "paid"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : modalOverview.setupStatusBadge === "partial"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          {modalOverview.setupStatusBadge === "paid" ? "✓ 100% PAGO" : modalOverview.setupStatusBadge === "partial" ? "PAGO PARCIAL" : "PENDENTE"}
                        </span>
                      </div>

                      {/* Progresso Loading Bar */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2">
                        <div className="flex items-center justify-between text-xs font-black">
                          <span className="text-[#342825]">Progresso das Parcelas</span>
                          <span className="text-[#BD5944] uppercase tracking-wider">{modalOverview.setupPaidInstallments} de {modalOverview.setupTotalInstallments} parcelas pagas</span>
                        </div>
                        
                        {/* Loading Bar */}
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 rounded-full ${
                              modalOverview.setupStatusBadge === "paid" ? "bg-emerald-500" : modalOverview.setupStatusBadge === "partial" ? "bg-amber-500" : "bg-slate-300"
                            }`}
                            style={{ width: `${Math.max(modalOverview.setupProgressPercent, modalOverview.setupPaidInstallments > 0 ? 33 : 0)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-extrabold pt-1">
                          <span className="text-emerald-700">Pago: $ {formatMoney(modalOverview.setupPaidAmount)}</span>
                          <span className="text-slate-500">Total: $ {formatMoney(modalOverview.setupFee)}</span>
                        </div>
                      </div>

                      {/* Lista discriminada das Parcelas */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Linha do Tempo das Parcelas de Setup:</span>
                        <div className="space-y-1.5">
                          {setupInstallmentList.map((inst) => (
                            <div key={inst.number} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] ${
                                  inst.status === "paid" ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-200 text-slate-600"
                                }`}>
                                  {inst.status === "paid" ? "✓" : inst.number}
                                </span>
                                <div>
                                  <span className="font-extrabold text-[#342825]">Parcela {inst.number} de {inst.total}</span>
                                  {inst.status === "paid" ? (
                                    <span className="text-[10px] text-emerald-700 font-bold block">
                                      Quitada {inst.paidDate ? `em ${formatDateBr(inst.paidDate)}` : ""} {inst.asaasPaymentId ? `• Asaas: ${inst.asaasPaymentId}` : ""}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-bold block">
                                      {inst.dueDate ? `Vencimento: ${formatDateBr(inst.dueDate)}` : "Aguardando pagamento"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-700">$ {formatMoney(inst.amount)}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${
                                  inst.status === "paid" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                                }`}>
                                  {inst.status === "paid" ? "PAGA" : "PENDENTE"}
                                </span>

                                {!isReadOnly && (
                                  inst.status === "paid" ? (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleInstallment(inst.number, "pending", inst.paymentId)}
                                      className="px-2 py-1 bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer"
                                      title="Desfazer quitação desta parcela"
                                    >
                                      Desfazer
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleInstallment(inst.number, "paid", inst.paymentId)}
                                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer shadow-xs"
                                      title="Dar baixa e marcar esta parcela como Paga"
                                    >
                                      Dar Baixa
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Link do Setup */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Link de Pagamento do Setup:</span>
                        {selectedClient.setupPaymentLink ? (
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                            <input
                              type="text"
                              readOnly
                              value={selectedClient.setupPaymentLink}
                              className="bg-transparent text-xs text-blue-600 font-bold flex-1 outline-none truncate"
                            />
                            <button
                              type="button"
                              onClick={() => handleCopyLink(selectedClient.setupPaymentLink || "", "setup")}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                              title="Copiar Link"
                            >
                              {copiedLinkType === "setup" ? <Check size={15} className="text-emerald-600 font-bold" /> : <Copy size={15} />}
                            </button>
                            <a
                              href={selectedClient.setupPaymentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Abrir Checkout"
                            >
                              <ExternalLink size={15} />
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            Nenhum link configurado para a taxa de setup.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botão de Alternância Manual */}
                    {!isReadOnly && (
                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={handleToggleSetupStatus}
                          className={`w-full py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all border ${
                            modalOverview.setupStatusBadge === "paid"
                              ? "bg-slate-100 text-slate-600 border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                              : "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800"
                          }`}
                        >
                          {modalOverview.setupStatusBadge === "paid"
                            ? "Reverter Setup para Pendente"
                            : "Marcar Todas Parcelas como Pagas"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 2. Mensalidade / Assinatura Recorrente */}
                  <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
                            <Activity size={18} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-[#342825] uppercase">Assinatura / Mensalidade</h4>
                            <p className="text-[11px] text-slate-400 font-bold">Cobrança recorrente mensal ativa</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase border ${
                          modalOverview.isMonthlyPaid
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}>
                          {modalOverview.isMonthlyPaid ? "✓ PAGA" : "PENDENTE"}
                        </span>
                      </div>

                      {/* Status do Mês Atual */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">Mês de Referência Ativo:</span>
                          <span className="text-sm font-black text-[#342825] px-2 py-0.5 bg-white rounded-lg border border-slate-200">
                            {modalOverview.currentMonthRef}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-1">
                          <span className="text-xs font-bold text-slate-500">Valor Mensalidade:</span>
                          <span className="text-xl font-black text-[#342825]">
                            $ {formatMoney(selectedClient.monthlyFee || 0)}/mês
                          </span>
                        </div>
                      </div>

                      {/* Linha do Tempo das Mensalidades (Faturas Recorrentes do Asaas) */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Linha do Tempo das Mensalidades:</span>
                        <div className="space-y-2">
                          {(normalizedMonthlyList.length > 0 ? normalizedMonthlyList : [
                            {
                              id: `monthly_${selectedClient.id}`,
                              type: "monthly" as const,
                              dueDate: new Date().toISOString().split("T")[0],
                              amount: selectedClient.monthlyFee || 0,
                              status: selectedClient.monthlyPaymentStatus === "paid" ? ("paid" as const) : ("pending" as const),
                              monthReference: modalOverview.currentMonthRef
                            }
                          ]).map((m, idx) => {
                            const isPaid = m.status === "paid";
                            return (
                              <div key={m.id || idx} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200 text-xs transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 ${
                                    isPaid ? "bg-emerald-600 text-white shadow-xs" : "bg-amber-500 text-white shadow-xs"
                                  }`}>
                                    {isPaid ? "✓" : "⏳"}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-extrabold text-[#342825]">
                                        Mensalidade {m.monthReference ? `(Ref: ${m.monthReference})` : `(Ref: ${modalOverview.currentMonthRef})`}
                                      </span>
                                    </div>
                                    {isPaid ? (
                                      <span className="text-[10px] text-emerald-700 font-bold block">
                                        Quitada em {formatDateBr(m.paidDate || m.dueDate)} {(m as any).asaasPaymentId ? `• Asaas: ${(m as any).asaasPaymentId}` : ""}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-amber-700 font-bold block">
                                        Pendente • Vencimento: {formatDateBr(m.dueDate)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-black text-slate-700">$ {formatMoney(m.amount)}</span>
                                  <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase border ${
                                    isPaid ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"
                                  }`}>
                                    {isPaid ? "PAGA" : "PENDENTE"}
                                  </span>

                                  {!isReadOnly && (
                                    isPaid ? (
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePaymentItemStatus(m.id, m.status)}
                                        className="px-2 py-1 bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer"
                                        title="Desfazer quitação desta mensalidade"
                                      >
                                        Desfazer
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePaymentItemStatus(m.id, m.status)}
                                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer shadow-xs"
                                        title="Dar baixa e marcar mensalidade como Paga"
                                      >
                                        Dar Baixa
                                      </button>
                                    )
                                  )}

                                  {(m as any).invoiceUrl && (
                                    <a
                                      href={(m as any).invoiceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition cursor-pointer"
                                      title="Abrir Fatura no Asaas"
                                    >
                                      <ExternalLink size={13} />
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Banner Explicativo de como funciona a Assinatura Recorrente */}
                      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-blue-900 font-black text-[11px] uppercase">
                          <Info size={14} className="text-blue-700 shrink-0" />
                          <span>Como funciona a Mensalidade Recorrente:</span>
                        </div>
                        <p className="text-blue-800 text-[11px] leading-relaxed">
                          O link cadastrado abaixo é o link permanente para este cliente efetuar os pagamentos de mensalidade. O status de cada mês de referência (ex: {modalOverview.currentMonthRef}) pode ser conferido e marcado como pago diretamente nesta tela.
                        </p>
                      </div>

                      {/* Link da Mensalidade */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Link da Assinatura / Mensalidade:</span>
                        {selectedClient.monthlyPaymentLink ? (
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                            <input
                              type="text"
                              readOnly
                              value={selectedClient.monthlyPaymentLink}
                              className="bg-transparent text-xs text-blue-600 font-bold flex-1 outline-none truncate"
                            />
                            <button
                              type="button"
                              onClick={() => handleCopyLink(selectedClient.monthlyPaymentLink || "", "monthly")}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                              title="Copiar Link"
                            >
                              {copiedLinkType === "monthly" ? <Check size={15} className="text-emerald-600 font-bold" /> : <Copy size={15} />}
                            </button>
                            <a
                              href={selectedClient.monthlyPaymentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Abrir Assinatura"
                            >
                              <ExternalLink size={15} />
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            Nenhum link configurado para a assinatura recorrente.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botão de Alternância Manual */}
                    {!isReadOnly && (
                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={handleToggleMonthlyStatus}
                          className={`w-full py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all border ${
                            modalOverview.isMonthlyPaid
                              ? "bg-slate-100 text-slate-600 border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                              : "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800"
                          }`}
                        >
                          {modalOverview.isMonthlyPaid
                            ? "Reverter Mensalidade para Pendente"
                            : `Marcar Mensalidade (${modalOverview.currentMonthRef}) como Paga`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Extrato e Parcelas Detalhadas */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#342825] uppercase">Extrato Detalhado de Cobranças e Parcelas</h4>
                      <p className="text-[11px] text-slate-400 font-bold">Histórico discriminado de todas as faturas e parcelas recebidas</p>
                    </div>

                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setShowAddPaymentForm(!showAddPaymentForm)}
                        className="bg-slate-100 hover:bg-slate-200 text-[#342825] text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Adicionar Fatura / Parcela</span>
                      </button>
                    )}
                  </div>

                  {/* Formulário para Adicionar Parcela Avulsa */}
                  {!isReadOnly && showAddPaymentForm && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-in fade-in">
                      <h5 className="font-black text-xs text-[#342825] uppercase">Nova Cobrança / Parcela Avulsa</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo</label>
                          <select
                            value={newPaymentType}
                            onChange={(e: any) => setNewPaymentType(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                          >
                            <option value="monthly">Mensalidade</option>
                            <option value="configuration">Taxa de Setup</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Valor ($ )</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={newPaymentAmount || ""}
                            onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Data de Vencimento</label>
                          <BrDateInput value={newPaymentDueDate} onChange={setNewPaymentDueDate} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddPaymentForm(false)}
                          className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleAddManualPayment}
                          className="px-4 py-1.5 bg-[#342825] text-white text-xs font-bold rounded-xl hover:bg-[#BD5944] transition-colors"
                        >
                          Salvar Parcela
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tabela de Parcelas */}
                  {allDisplayPayments.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      Nenhuma parcela registrada ainda. Os registros de setup e mensalidade acima são as cobranças padrão.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                      {allDisplayPayments.map((p, idx) => (
                        <div key={p.id || idx} className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white hover:bg-slate-50/60 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-[#342825] uppercase">
                                {p.type === "configuration" 
                                  ? `Taxa de Setup • Parcela ${p.installmentNumber || idx + 1} de ${p.totalInstallments || modalOverview.setupTotalInstallments}` 
                                  : `Mensalidade ${p.monthReference ? `(Ref: ${p.monthReference})` : `Parcela #${idx + 1}`}`}
                              </span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${
                                p.status === "paid" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}>
                                {p.status === "paid" ? "PAGO" : "PENDENTE"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-bold">
                              Vencimento: {formatDateBr(p.dueDate)} {p.paidDate ? `• Quitado em: ${formatDateBr(p.paidDate)}` : ""}
                              {(p as any).asaasPaymentId ? ` • Asaas ID: ${(p as any).asaasPaymentId}` : ""}
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                            <span className="font-black text-sm text-[#342825]">
                              $ {formatMoney(p.amount)}
                            </span>
                            {!isReadOnly && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePaymentItemStatus(p.id, p.status)}
                                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase border transition-all cursor-pointer ${
                                    p.status === "paid"
                                      ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700"
                                      : "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800"
                                  }`}
                                >
                                  {p.status === "paid" ? "Desfazer Pagamento" : "Dar Baixa (Pago)"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePaymentItem(p.id)}
                                  title="Remover esta fatura/parcela deste cliente"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Linha do Tempo e Histórico Financeiro Unificado */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <History size={16} className="text-[#342825]" />
                      <h4 className="font-extrabold text-xs text-[#342825] uppercase">Linha do Tempo e Histórico de Transações</h4>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{unifiedTimeline.length} eventos registrados</span>
                  </div>

                  {unifiedTimeline.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">Nenhum evento financeiro ou notificação registrada ainda.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {unifiedTimeline.map((evt) => (
                        <div key={evt.id} className="text-xs bg-white p-3 rounded-xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border ${evt.badgeColor}`}>
                                {evt.badge}
                              </span>
                              <span className="font-extrabold text-slate-800 text-xs">{evt.title}</span>
                            </div>
                            {evt.description && (
                              <p className="text-slate-500 text-[11px] font-medium">{evt.description}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono font-bold shrink-0 self-end sm:self-center">
                            {evt.displayDate}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-500">
                  Total Contratado: <span className="font-black text-[#342825]">$ {formatMoney((selectedClient.configurationFee || 0) + (selectedClient.monthlyFee || 0))}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedClientId(null); setShowAddPaymentForm(false); }}
                  className="bg-[#342825] hover:bg-[#BD5944] text-white font-black text-xs py-2.5 px-6 rounded-xl uppercase tracking-wider transition-colors cursor-pointer ml-auto"
                >
                  Fechar Detalhes
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-extrabold text-base text-[#342825]">Fechamento & Repasse Mensal (Dia 25)</h3>
              <button onClick={() => setShowBatchModal(false)}><X size={18} /></button>
            </div>
            <div className="space-y-4 text-xs">
              <div className="bg-rose-50 p-4 rounded-xl flex justify-between items-center">
                <div>
                  <span className="font-bold text-rose-800 block">Total a Repassar (10% Líquido):</span>
                  <span className="text-[10px] text-rose-600 font-medium">Líquido de taxas bancárias ($0,49 + 3,49% por cobrança)</span>
                </div>
                <span className="text-xl font-black text-rose-800">$ {formatMoney(totalEgnCommissionPending)}</span>
              </div>
              <BrDateInput value={repasseDate} onChange={setRepasseDate} required />
              <input type="file" accept="image/*,application/pdf" onChange={handleProofFileUpload} className="block w-full text-xs" />
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button type="button" onClick={() => setShowBatchModal(false)} className="px-4 py-2 font-bold text-slate-500">Cancelar</button>
                <button type="button" onClick={handleSaveBatchMonthlyRepasse} disabled={savingRepasse} className="bg-emerald-700 text-white font-bold py-2 px-5 rounded-xl">
                  {savingRepasse ? "Salvando..." : "Confirmar e Zerar Saldo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proof Viewer */}
      {proofViewerModal && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-[#342825]">Comprovante de Repasse</h3>
              <button onClick={() => setProofViewerModal(null)}><X size={18} /></button>
            </div>
            <div className="max-h-[60vh] overflow-auto flex items-center justify-center">
              <img src={proofViewerModal.url} alt="Comprovante" className="max-h-[50vh] object-contain" />
            </div>
            <div className="flex justify-end">
              <button onClick={() => setProofViewerModal(null)} className="bg-[#342825] text-white font-bold py-2 px-4 rounded-xl">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
