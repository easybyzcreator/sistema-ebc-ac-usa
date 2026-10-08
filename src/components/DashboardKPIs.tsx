import React from "react";
import { Lead } from "../types";
import { Users, UserCheck, DollarSign, Award, TrendingUp, Percent, ArrowUpRight } from "lucide-react";
import { calcEgnCommissionSingle } from "../lib/masks";

interface DashboardKPIsProps {
  leads: Lead[];
}

export default function DashboardKPIs({ leads }: DashboardKPIsProps) {
  // Apenas clientes ativos (isActive !== false) entram nas métricas e cálculos financeiros
  const activeLeads = leads.filter(l => l.isActive !== false);
  const totalLeadsCount = activeLeads.length;
  const clientsCount = activeLeads.filter(l => l.status === "client").length;
  const leadCount = totalLeadsCount - clientsCount;
  
  const conversionRate = totalLeadsCount > 0 
    ? Math.round((clientsCount / totalLeadsCount) * 100) 
    : 0;

  // Helper to check if a date string falls in the current batch cycle (25th prev month to 24th curr month)
  const isDateInCurrentBatchPeriod = (dateStr?: string): boolean => {
    if (!dateStr) return true;
    const cleanDate = dateStr.split("T")[0];
    const d = new Date(cleanDate);
    if (isNaN(d.getTime())) return true;

    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let startYear = currentYear;
    let startMonth = currentMonth;
    let endYear = currentYear;
    let endMonth = currentMonth;

    if (currentDay > 24) {
      startMonth = currentMonth;
      endMonth = currentMonth + 1;
      if (endMonth > 11) {
        endMonth = 0;
        endYear += 1;
      }
    } else {
      startMonth = currentMonth - 1;
      if (startMonth < 0) {
        startMonth = 11;
        startYear -= 1;
      }
      endMonth = currentMonth;
    }

    const cycleStart = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
    const cycleEnd = new Date(endYear, endMonth, 24, 23, 59, 59, 999);

    return d >= cycleStart && d <= cycleEnd;
  };

  // Financial calculations from payments marked as "paid"
  let totalSetupCollected = 0; // Total arrecadado em Taxas de Configuração / Setup
  let totalSetupExpected = 0;  // Total previsto em Taxas de Configuração / Setup
  let totalMonthlyCollected = 0; // Total arrecadado em Mensalidades
  let totalCollected = 0; // Total EFETIVAMENTE recebido (Setup + Mensalidades)
  let currentPeriodCollected = 0; // Recebido no ciclo atual (até o dia 24)
  let expectedMRR = 0; // MRR Estimado (Recorrente mensal dos contratos ativos)
  let egnCommissionCurrentPeriod = 0; // 10% sobre o recebido no ciclo
  let egnCommissionEstimated = 0; // 10% estimado sobre MRR ativo

  activeLeads.forEach(l => {
    if (l.status === "client") {
      const mFee = l.monthlyFee || 0;
      const sFee = l.configurationFee || 0;
      expectedMRR += mFee;
      totalSetupExpected += sFee;
      if (mFee > 0) {
        egnCommissionEstimated += calcEgnCommissionSingle(mFee);
      }
      
      const clientPayments: { type?: string; amount: number; status: string; paidDate?: string; dueDate?: string }[] = [];
      const instCount = Number(l.setupInstallments || (sFee > 0 ? 3 : 1));
      const instVal = instCount > 0 ? Math.round((sFee / instCount) * 100) / 100 : sFee;

      if (l.payments && l.payments.length > 0) {
        const validPayments = l.payments.filter(p => {
          const pDate = p.paidDate || p.dueDate || "";
          const isOld = pDate.startsWith("2023") || pDate.startsWith("2022") || pDate.startsWith("2021");
          if (isOld) return false;
          const pVal = Number(p.amount || 0);
          const matches = (sFee > 0 && Math.abs(pVal - instVal) < 0.15) ||
                          (sFee > 0 && Math.abs(pVal - sFee) < 0.15) ||
                          (mFee > 0 && Math.abs(pVal - mFee) < 0.15) ||
                          (sFee === 0 && mFee === 0);
          return matches;
        });
        clientPayments.push(...validPayments);
      } else {
        const isSetupPaid = l.setupPaymentStatus === "paid" || l.configurationFeePaid === true;
        const isMonthlyPaid = l.monthlyPaymentStatus === "paid";
        if (sFee > 0) {
          clientPayments.push({
            type: "configuration",
            amount: sFee,
            status: isSetupPaid ? "paid" : "pending",
            paidDate: isSetupPaid ? (l.updatedAt || l.createdAt) : undefined,
            dueDate: l.setupDueDate || l.createdAt
          });
        }
        if (mFee > 0) {
          clientPayments.push({
            type: "monthly",
            amount: mFee,
            status: isMonthlyPaid ? "paid" : "pending",
            paidDate: isMonthlyPaid ? (l.updatedAt || l.createdAt) : undefined,
            dueDate: l.firstMonthlyDueDate || l.createdAt
          });
        }
      }

      clientPayments.forEach(p => {
        if (p.status === "paid") {
          const val = Number(p.amount) || 0;
          totalCollected += val;
          if (p.type === "configuration") {
            totalSetupCollected += val;
          } else {
            totalMonthlyCollected += val;
          }

          const inBatch = isDateInCurrentBatchPeriod(p.paidDate || p.dueDate);
          if (inBatch) {
            currentPeriodCollected += val;
            egnCommissionCurrentPeriod += calcEgnCommissionSingle(val);
          }
        }
      });
    }
  });

  const formatMoney = (val: number) => {
    const rounded = Math.round((val || 0) * 100) / 100;
    return rounded.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Last 5 registered leads
  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Total Leads */}
        <div className="bg-white rounded-2xl p-5 border border-[#342825]/10 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Contatos</p>
              <h3 className="text-2xl font-black mt-2 text-[#342825]">{totalLeadsCount}</h3>
            </div>
            <div className="w-10 h-10 bg-[#F7F2EC] rounded-xl flex items-center justify-center text-[#342825]">
              <Users size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">{leadCount}</span> contatos inativos
          </div>
        </div>

        {/* Total Clients */}
        <div className="bg-white rounded-2xl p-5 border border-[#342825]/10 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clientes Ativos</p>
              <h3 className="text-2xl font-black mt-2 text-[#BD5944]">{clientsCount}</h3>
            </div>
            <div className="w-10 h-10 bg-[#BD5944]/10 rounded-xl flex items-center justify-center text-[#BD5944]">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            Taxa de Ativação: <span className="font-bold text-[#BD5944]">{conversionRate}%</span>
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white rounded-2xl p-5 border border-[#342825]/10 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Recebido (Geral)</p>
              <h3 className="text-2xl font-black mt-2 text-[#342825]">
                $ {formatMoney(totalCollected)}
              </h3>
            </div>
            <div className="w-10 h-10 bg-[#342825]/10 rounded-xl flex items-center justify-center text-[#342825]">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
            <span className="px-2 py-0.5 rounded-md bg-[#BD5944]/15 text-[#BD5944]">
              Setup: $ {formatMoney(totalSetupCollected)}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#342825]/10 text-[#342825]">
              Mensalidades: $ {formatMoney(totalMonthlyCollected)}
            </span>
          </div>
        </div>

        {/* Taxas de Setup / Configuração */}
        <div className="bg-white rounded-2xl p-5 border border-[#342825]/10 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Taxas de Setup (USD)</p>
              <h3 className="text-2xl font-black mt-2 text-[#BD5944]">
                $ {formatMoney(totalSetupCollected)}
              </h3>
            </div>
            <div className="w-10 h-10 bg-[#BD5944]/10 rounded-xl flex items-center justify-center text-[#BD5944]">
              <Award size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Total Contratado:</span>
            <span className="font-bold text-[#342825]">$ {formatMoney(totalSetupExpected)}</span>
          </div>
        </div>

        {/* Faturamento Estimado / MRR Esperado */}
        <div className="bg-white rounded-2xl p-5 border border-[#342825]/10 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Faturamento Estimado (MRR)</p>
              <h3 className="text-2xl font-black mt-2 text-[#BD5944]">
                $ {formatMoney(expectedMRR)}
              </h3>
            </div>
            <div className="w-10 h-10 bg-[#BD5944]/10 rounded-xl flex items-center justify-center text-[#BD5944]">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            Recorrência mensal prevista dos contratos ativos
          </div>
        </div>

        {/* Repasse Andreia Cakes USA 10% - Current Cycle */}
        <div className="bg-white rounded-2xl p-5 border border-[#342825]/10 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Repasse Andreia (Ciclo Atual)</p>
              <h3 className="text-2xl font-black mt-2 text-[#342825]">
                $ {formatMoney(egnCommissionCurrentPeriod)}
              </h3>
            </div>
            <div className="w-10 h-10 bg-[#342825]/10 rounded-xl flex items-center justify-center text-[#342825]">
              <Award size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-[#342825] font-medium">
            10% líquido sobre cobranças já recebidas no ciclo (Setup + Mensalidades)
          </div>
        </div>

        {/* Estimativa de Comissão Recorrente Mensal */}
        <div className="bg-white rounded-2xl p-5 border border-[#342825]/10 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comissão Mensal Recorrente (MRR)</p>
              <h3 className="text-2xl font-black mt-2 text-[#BD5944]">
                $ {formatMoney(egnCommissionEstimated)}/mês
              </h3>
            </div>
            <div className="w-10 h-10 bg-[#BD5944]/10 rounded-xl flex items-center justify-center text-[#BD5944]">
              <Percent size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            10% líquido previsto por mês das assinaturas ativas (após tx bancária: $0,49 + 3,49%)
          </div>
        </div>
      </div>

      {/* Visual Analytics row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead and conversion graphics card */}
        <div className="bg-white rounded-2xl p-6 border border-[#342825]/10 shadow-xs lg:col-span-2">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 mb-6 flex items-center justify-between">
            <span>Distribuição e Ativação de Contatos</span>
            <span className="text-xs text-slate-500 normal-case font-normal">Representação visual</span>
          </h3>
          
          <div className="flex flex-col sm:flex-row items-center gap-8 py-4">
            {/* SVG Pie/Donut Chart */}
            <div className="relative w-40 h-40 flex-shrink-0">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F7F2EC" strokeWidth="3" />
                <circle 
                  cx="18" 
                  cy="18" 
                  r="15.915" 
                  fill="none" 
                  stroke="#BD5944" 
                  strokeWidth="3.2" 
                  strokeDasharray={`${conversionRate} ${100 - conversionRate}`} 
                  strokeDashoffset="25" 
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-[#342825]">{conversionRate}%</span>
                <span className="text-[10px] uppercase text-slate-400 font-bold">Ativação</span>
              </div>
            </div>

            {/* Custom Legend & Bars */}
            <div className="flex-1 w-full space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#BD5944]"></span> Clientes Ativos (Pagando)</span>
                  <span>{clientsCount} ({conversionRate}%)</span>
                </div>
                <div className="w-full bg-[#F7F2EC] h-2.5 rounded-full overflow-hidden">
                  <div className="bg-[#BD5944] h-full" style={{ width: `${conversionRate}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#342825]/40"></span> Clientes Inativos</span>
                  <span>{leadCount} ({100 - conversionRate}%)</span>
                </div>
                <div className="w-full bg-[#F7F2EC] h-2.5 rounded-full overflow-hidden">
                  <div className="bg-[#342825]/40 h-full" style={{ width: `${100 - conversionRate}%` }}></div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
                Toda vez que novos contatos são inseridos e a EBC realiza a ativação, este gráfico é atualizado de forma instantânea para todos os aparelhos sincronizados.
              </div>
            </div>
          </div>
        </div>

        {/* Recent Registered Activity */}
        <div className="bg-white rounded-2xl p-6 border border-[#342825]/10 shadow-xs">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 mb-5 flex items-center justify-between">
            <span>Últimos Cadastrados</span>
            <TrendingUp size={16} className="text-[#BD5944]" />
          </h3>

          <div className="space-y-4">
            {recentLeads.length === 0 ? (
              <p className="text-slate-400 text-xs italic py-6 text-center">Nenhum contato cadastrado ainda.</p>
            ) : (
              recentLeads.map(l => (
                <div key={l.id} className="flex items-center justify-between p-2.5 hover:bg-[#F7F2EC]/60 rounded-xl transition border border-transparent hover:border-[#342825]/10">
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-[#342825] truncate">{l.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{l.company || l.email}</p>
                  </div>
                  <span className={`text-[10px] font-bold py-1 px-2.5 rounded-full flex-shrink-0 ${
                    l.status === "client" 
                      ? "bg-[#BD5944]/10 text-[#BD5944]" 
                      : "bg-[#342825]/10 text-slate-600"
                  }`}>
                    {l.status === "client" ? "Ativo" : "Inativo"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
