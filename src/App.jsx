import React, { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard, CalendarDays, Wallet, Wrench, CreditCard, TrendingUp,
  ArrowUpRight, ArrowDownRight, Percent, Target, ChevronLeft, ChevronRight,
  Flame, ShieldCheck, Check, Plus, Building2, X, Mail, Lock, User, ArrowRight, Menu,
} from "lucide-react";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------
   Tradedoc — app real conectado ao Supabase (auth + banco de dados)
----------------------------------------------------------------*/

function fmtBRL(v) {
  const sign = v < 0 ? "-" : "+";
  return `${sign}R$ ${Math.abs(v).toLocaleString("pt-BR")}`;
}

const BASE_CAPITAL = 12000;

/* --------------------------- Derived stats --------------------------- */

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Segunda..Domingo (getDay(): 0=dom)
const WEEKDAY_FULL_LABELS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function useDerivedData(trades, accounts) {
  return useMemo(() => {
    const sorted = [...trades].sort((a, b) => parseLocalDate(a.trade_date) - parseLocalDate(b.trade_date));

    const totalPnL = trades.reduce((s, t) => s + Number(t.pnl), 0);
    const currentEquity = accounts.reduce((s, a) => s + Number(a.balance), 0);
    // Reverse-engineer the real starting capital: saldo atual = capital inicial + soma dos trades
    const startingCapital = currentEquity - totalPnL;

    let running = startingCapital;
    let peak = startingCapital;
    let maxDD = 0;
    const equityCurve = [{ d: "início", eq: startingCapital }];
    sorted.forEach((t) => {
      running += Number(t.pnl);
      peak = Math.max(peak, running);
      const dd = peak > 0 ? ((running - peak) / peak) * 100 : 0;
      if (dd < maxDD) maxDD = dd;
      equityCurve.push({ d: `${t.trade_date.slice(8, 10)}/${t.trade_date.slice(5, 7)}`, eq: running });
    });

    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    const winRate = trades.length ? Math.round((wins.length / trades.length) * 100) : 0;
    const grossWin = wins.reduce((s, t) => s + Number(t.pnl), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0));
    const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : "—";

    const assetMap = {};
    trades.forEach((t) => {
      if (!assetMap[t.asset]) assetMap[t.asset] = { asset: t.asset, trades: 0, wins: 0, pnl: 0 };
      assetMap[t.asset].trades += 1;
      if (t.pnl > 0) assetMap[t.asset].wins += 1;
      assetMap[t.asset].pnl += Number(t.pnl);
    });
    const assetPerf = Object.values(assetMap)
      .map((a) => ({ ...a, winRate: Math.round((a.wins / a.trades) * 100) }))
      .sort((a, b) => b.pnl - a.pnl);

    const weekdayMap = {};
    for (let i = 0; i < 7; i++) weekdayMap[i] = 0;
    trades.forEach((t) => {
      const day = parseLocalDate(t.trade_date).getDay();
      weekdayMap[day] += Number(t.pnl);
    });
    const weekdayMaxAbs = Math.max(1, ...Object.values(weekdayMap).map((v) => Math.abs(v)));
    const weekdayPerf = WEEKDAY_ORDER.map((dayIdx) => ({
      label: WEEKDAY_FULL_LABELS[dayIdx],
      pnl: weekdayMap[dayIdx],
      pct: Math.round((Math.abs(weekdayMap[dayIdx]) / weekdayMaxAbs) * 100),
    }));

    const recentTrades = [...trades]
      .sort((a, b) => parseLocalDate(b.trade_date) - parseLocalDate(a.trade_date))
      .slice(0, 6);

    return { equityCurve, winRate, totalPnL, profitFactor, maxDD, assetPerf, weekdayPerf, recentTrades, currentEquity };
  }, [trades, accounts]);
}

/* ------------------------------- UI bits -------------------------------- */

function StatCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="tf-card tf-stat">
      <div className="tf-stat-top">
        <span className="tf-stat-label">{label}</span>
        <span className={`tf-icon-badge tone-${tone}`}><Icon size={15} /></span>
      </div>
      <div className={`tf-stat-value ${tone === "up" ? "text-lime" : tone === "down" ? "text-coral" : ""}`}>{value}</div>
      {sub && <div className="tf-stat-sub">{sub}</div>}
    </div>
  );
}

function Sidebar({ active, setActive, userName, mobileOpen, onClose }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "calendar", label: "Calendário", icon: CalendarDays },
    { id: "accounts", label: "Contas", icon: Wallet },
    { id: "tools", label: "Ferramentas", icon: Wrench },
    { id: "profile", label: "Perfil", icon: User },
    { id: "plans", label: "Planos", icon: CreditCard },
  ];

  const handleSelect = (id) => {
    setActive(id);
    onClose && onClose();
  };

  return (
    <>
      {mobileOpen && <div className="tf-sidebar-backdrop" onClick={onClose} />}
      <aside className={`tf-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="tf-brand">
          <div className="tf-brand-name">TRADE<span className="text-blue">DOC</span></div>
          <button className="tf-sidebar-close" onClick={onClose}><X size={18} /></button>
        </div>
        <nav className="tf-nav">
          {items.map((it) => (
            <button key={it.id} onClick={() => handleSelect(it.id)} className={`tf-nav-item ${active === it.id ? "active" : ""}`}>
              <it.icon size={17} /><span>{it.label}</span>
            </button>
          ))}
        </nav>
        <div className="tf-sidebar-footer">
          {userName && (
            <button className="tf-user-chip" onClick={() => handleSelect("profile")}>
              <span className="tf-user-avatar">{userName.charAt(0).toUpperCase()}</span>
              <span className="tf-user-name">{userName}</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

/* ---------------------------- New trade modal ---------------------------- */

function NewTradeModal({ onClose, onSubmit, accounts, initialDate }) {
  const [asset, setAsset] = useState("WINFUT");
  const [side, setSide] = useState("Compra");
  const [amount, setAmount] = useState("");
  const [outcome, setOutcome] = useState("win");
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = Math.abs(parseFloat(amount.replace(",", "."))) || 0;
    if (val === 0 || !accountId) return;
    const pnl = outcome === "win" ? val : -val;
    setSaving(true);
    await onSubmit({ asset: asset.toUpperCase(), side, pnl, trade_date: date, account_id: accountId });
    setSaving(false);
    onClose();
  };

  return (
    <div className="tf-modal-overlay" onClick={onClose}>
      <div className="tf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-head">
          <h3>Registrar trade</h3>
          <button className="tf-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="tf-form">
          <div className="tf-form-row">
            <label>Ativo</label>
            <input value={asset} onChange={(e) => setAsset(e.target.value)} required />
          </div>
          <div className="tf-form-row-inline">
            <div className="tf-form-row">
              <label>Lado</label>
              <div className="tf-toggle-group">
                <button type="button" className={side === "Compra" ? "active" : ""} onClick={() => setSide("Compra")}>Compra</button>
                <button type="button" className={side === "Venda" ? "active" : ""} onClick={() => setSide("Venda")}>Venda</button>
              </div>
            </div>
            <div className="tf-form-row">
              <label>Resultado</label>
              <div className="tf-toggle-group">
                <button type="button" className={outcome === "win" ? "active tone-win" : ""} onClick={() => setOutcome("win")}>Ganho</button>
                <button type="button" className={outcome === "loss" ? "active tone-loss" : ""} onClick={() => setOutcome("loss")}>Perda</button>
              </div>
            </div>
          </div>
          <div className="tf-form-row-inline">
            <div className="tf-form-row">
              <label>P&L (R$)</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required />
            </div>
            <div className="tf-form-row">
              <label>Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>
          <div className="tf-form-row">
            <label>Conta</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button type="submit" className="tf-btn-primary tf-form-submit" disabled={saving}>
            <Plus size={15} /> {saving ? "Salvando..." : "Salvar trade"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------- Views --------------------------------- */

function DashboardView({ data, onOpenModal }) {
  const { equityCurve, winRate, totalPnL, profitFactor, maxDD, assetPerf, weekdayPerf, recentTrades, currentEquity } = data;
  return (
    <div className="tf-view">
      <div className="tf-view-header">
        <div><h1>Visão geral</h1><p className="tf-muted">Sua performance consolidada</p></div>
        <button className="tf-btn-primary" onClick={onOpenModal}><Plus size={15} /> Novo trade</button>
      </div>

      <div className="tf-stats-grid">
        <StatCard icon={Target} label="Win rate" value={`${winRate}%`} tone="up" />
        <StatCard icon={TrendingUp} label="P&L total" value={fmtBRL(totalPnL)} tone={totalPnL >= 0 ? "up" : "down"} />
        <StatCard icon={ArrowDownRight} label="Drawdown máx." value={`${maxDD.toFixed(1)}%`} tone="down" />
        <StatCard icon={Percent} label="Fator de lucro" value={profitFactor} tone="neutral" />
      </div>

      <div className="tf-card tf-hero-chart">
        <div className="tf-card-head">
          <div><h3>Curva de capital</h3></div>
          <div className="tf-hero-value">R$ {currentEquity.toLocaleString("pt-BR")}</div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={equityCurve} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1FA35C" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0070FF" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1C2537" vertical={false} />
            <XAxis dataKey="d" stroke="#5B6478" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#5B6478" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#131922", border: "1px solid #232C3B", borderRadius: 10, fontSize: 12 }} formatter={(v) => [`R$ ${Number(v).toLocaleString("pt-BR")}`, "Capital"]} />
            <Area type="monotone" dataKey="eq" stroke="#1FA35C" strokeWidth={2.5} fill="url(#eqFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="tf-card" style={{ marginBottom: 16 }}>
        <div className="tf-card-head"><h3>Performance por dia da semana</h3></div>
        {weekdayPerf.every((w) => w.pnl === 0) ? (
          <p className="tf-empty">Nenhum trade registrado ainda.</p>
        ) : (
          <div className="tf-weekday-list">
            {weekdayPerf.map((w) => (
              <div className="tf-weekday-row" key={w.label}>
                <span className="tf-weekday-label">{w.label}</span>
                <div className="tf-weekday-bar-track">
                  <div className={`tf-weekday-bar-fill ${w.pnl >= 0 ? "fill-lime" : "fill-coral"}`} style={{ width: `${w.pnl === 0 ? 2 : w.pct}%` }} />
                </div>
                <span className={`tf-mono tf-weekday-value ${w.pnl >= 0 ? "text-lime" : "text-coral"}`}>{fmtBRL(w.pnl)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="tf-two-col">
        <div className="tf-card">
          <div className="tf-card-head"><h3>Análise por ativo</h3></div>
          <div className="tf-table">
            <div className="tf-table-row tf-table-head"><span>Ativo</span><span>Trades</span><span>Win rate</span><span>P&L</span></div>
            {assetPerf.length === 0 && <div className="tf-empty">Nenhum trade registrado ainda.</div>}
            {assetPerf.map((a) => (
              <div className="tf-asset-block" key={a.asset}>
                <div className="tf-table-row">
                  <span className="tf-mono tf-asset">{a.asset}</span>
                  <span className="tf-mono tf-muted">{a.trades}</span>
                  <span className="tf-mono">{a.winRate}%</span>
                  <span className={`tf-mono ${a.pnl >= 0 ? "text-lime" : "text-coral"}`}>{fmtBRL(a.pnl)}</span>
                </div>
                <div className="tf-asset-bar-track">
                  <div className="tf-asset-bar-fill" style={{ width: `${a.winRate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="tf-card">
          <div className="tf-card-head"><h3>Trades recentes</h3></div>
          <div className="tf-trade-list">
            {recentTrades.length === 0 && <div className="tf-empty">Nenhum trade registrado ainda.</div>}
            {recentTrades.map((t) => (
              <div className="tf-trade-row" key={t.id}>
                <span className={`tf-dot ${t.pnl >= 0 ? "dot-lime" : "dot-coral"}`} />
                <span className="tf-muted tf-mono tf-trade-date">{t.trade_date.slice(8,10)}/{t.trade_date.slice(5,7)}</span>
                <span className="tf-asset">{t.asset}</span>
                <span className="tf-muted tf-trade-side">{t.side}</span>
                <span className={`tf-mono tf-trade-pnl ${t.pnl >= 0 ? "text-lime" : "text-coral"}`}>{fmtBRL(Number(t.pnl))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayDetailModal({ dayTrades, dateLabel, onClose, onAddTrade }) {
  const total = dayTrades.reduce((s, t) => s + Number(t.pnl), 0);
  return (
    <div className="tf-modal-overlay" onClick={onClose}>
      <div className="tf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-head">
          <h3>{dateLabel}</h3>
          <button className="tf-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        {dayTrades.length > 0 ? (
          <>
            <div className="tf-daymodal-total">
              <span className="tf-muted">Total do dia</span>
              <span className={`tf-mono ${total >= 0 ? "text-lime" : "text-coral"}`}>{fmtBRL(total)}</span>
            </div>
            <div className="tf-trade-list" style={{ marginBottom: 14 }}>
              {dayTrades.map((t) => (
                <div className="tf-trade-row" key={t.id}>
                  <span className={`tf-dot ${t.pnl >= 0 ? "dot-lime" : "dot-coral"}`} />
                  <span className="tf-asset">{t.asset}</span>
                  <span className="tf-muted tf-trade-side">{t.side}</span>
                  <span className={`tf-mono tf-trade-pnl ${t.pnl >= 0 ? "text-lime" : "text-coral"}`}>{fmtBRL(Number(t.pnl))}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="tf-empty" style={{ marginBottom: 14 }}>Nenhum trade registrado neste dia.</p>
        )}
        <button className="tf-btn-primary tf-form-submit" onClick={onAddTrade}><Plus size={15} /> Adicionar trade neste dia</button>
      </div>
    </div>
  );
}

const WEEKDAY_LABELS = ["dom","seg","ter","qua","qui","sex","sáb"];
const MONTH_LABELS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function CalendarView({ trades, accounts, onNewTrade }) {
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [addingForDay, setAddingForDay] = useState(null);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const monthTrades = trades.filter((t) => t.trade_date.startsWith(monthPrefix));
  const calendarPnL = {};
  monthTrades.forEach((t) => {
    const day = Number(t.trade_date.slice(8, 10));
    calendarPnL[day] = (calendarPnL[day] || 0) + Number(t.pnl);
  });
  const monthTotal = Object.values(calendarPnL).reduce((s, v) => s + v, 0);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const intensity = (v) => {
    if (v === undefined) return "empty";
    const abs = Math.abs(v);
    if (abs > 450) return v > 0 ? "lime-3" : "coral-3";
    if (abs > 200) return v > 0 ? "lime-2" : "coral-2";
    return v > 0 ? "lime-1" : "coral-1";
  };

  const dayKey = (d) => `${monthPrefix}-${String(d).padStart(2, "0")}`;
  const selectedDayTrades = selectedDay ? monthTrades.filter((t) => t.trade_date === dayKey(selectedDay)) : [];

  return (
    <div className="tf-view">
      <div className="tf-view-header">
        <div>
          <h1>Calendário de trades</h1>
          <p className="tf-muted">Resultado diário consolidado · clique num dia para ver detalhes</p>
        </div>
        <div className="tf-month-nav">
          <button className="tf-icon-btn" onClick={() => setMonthDate(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
          <span className="tf-month-label">{MONTH_LABELS[month]} {year}</span>
          <button className="tf-icon-btn" onClick={() => setMonthDate(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="tf-card">
        <div className="tf-card-head">
          <h3>{MONTH_LABELS[month]}</h3>
          <span className={`tf-mono ${monthTotal >= 0 ? "text-lime" : "text-coral"}`}>{fmtBRL(monthTotal)}</span>
        </div>
        <div className="tf-cal-weekdays">{WEEKDAY_LABELS.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="tf-cal-grid">
          {cells.map((d, i) => (
            <button
              key={i}
              type="button"
              disabled={!d}
              onClick={() => d && setSelectedDay(d)}
              className={`tf-cal-cell ${d ? "has-day" : ""} tone-${intensity(calendarPnL[d])}`}
            >
              {d && (
                <>
                  <span className="tf-cal-day">{d}</span>
                  {calendarPnL[d] !== undefined && <span className="tf-cal-pnl">{fmtBRL(calendarPnL[d])}</span>}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedDay && !addingForDay && (
        <DayDetailModal
          dayTrades={selectedDayTrades}
          dateLabel={`${String(selectedDay).padStart(2, "0")} de ${MONTH_LABELS[month]}`}
          onClose={() => setSelectedDay(null)}
          onAddTrade={() => setAddingForDay(selectedDay)}
        />
      )}

      {addingForDay && (
        <NewTradeModal
          initialDate={dayKey(addingForDay)}
          accounts={accounts}
          onClose={() => setAddingForDay(null)}
          onSubmit={async (trade) => { await onNewTrade(trade); setAddingForDay(null); setSelectedDay(null); }}
        />
      )}
    </div>
  );
}

function AccountsView({ accounts, onAddAccount }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [type, setType] = useState("Real");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const bal = parseFloat(balance.replace(",", ".")) || 0;
    await onAddAccount({ name: name || "Nova conta", type, balance: bal, status: "Ativa" });
    setSaving(false);
    setAdding(false);
    setName(""); setBalance("");
  };

  return (
    <div className="tf-view">
      <div className="tf-view-header">
        <div><h1>Contas</h1><p className="tf-muted">Gerencie suas contas de trading</p></div>
        <button className="tf-btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Adicionar conta</button>
      </div>

      {adding && (
        <div className="tf-card" style={{ marginBottom: 16 }}>
          <form onSubmit={submit} className="tf-form tf-form-inline-3">
            <div className="tf-form-row"><label>Nome da conta</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="tf-form-row"><label>Saldo inicial (R$)</label><input value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" required /></div>
            <div className="tf-form-row"><label>Tipo</label><select value={type} onChange={(e) => setType(e.target.value)}><option>Real</option><option>Prop Firm</option></select></div>
            <div className="tf-form-row" style={{ flexDirection: "row", gap: 8 }}>
              <button type="button" className="tf-btn-outline" onClick={() => setAdding(false)}>Cancelar</button>
              <button type="submit" className="tf-btn-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        </div>
      )}

      <div className="tf-accounts-grid">
        {accounts.map((a) => (
          <div className="tf-card tf-account-card" key={a.id}>
            <div className="tf-account-top">
              <span className="tf-icon-badge tone-neutral"><Building2 size={16} /></span>
              <span className={`tf-badge ${a.type === "Prop Firm" ? "badge-blue" : "badge-outline"}`}>{a.type}</span>
            </div>
            <h3 className="tf-account-name">{a.name}</h3>
            <div className="tf-account-balance">R$ {Number(a.balance).toLocaleString("pt-BR")}</div>
            <div className="tf-account-status"><ShieldCheck size={13} className="text-lime" /> {a.status}</div>
          </div>
        ))}
        {accounts.length === 0 && <p className="tf-empty">Nenhuma conta cadastrada ainda.</p>}
      </div>
    </div>
  );
}

function ProfileView({ userName, userEmail, onUpdateProfile, currentPlan, setActive, onLogout }) {
  const [name, setName] = useState(userName);
  const [savedMsg, setSavedMsg] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");

  const saveProfile = async (e) => {
    e.preventDefault();
    await onUpdateProfile(name);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPwd.length < 6) { setPwdMsg("error:A senha precisa ter ao menos 6 caracteres."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) { setPwdMsg("error:" + error.message); return; }
    setPwdMsg("ok:Senha atualizada com sucesso.");
    setNewPwd("");
    setTimeout(() => setPwdMsg(""), 3000);
  };

  return (
    <div className="tf-view">
      <div className="tf-view-header"><div><h1>Perfil</h1><p className="tf-muted">{userEmail}</p></div></div>
      <div className="tf-two-col" style={{ alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="tf-card">
            <div className="tf-card-head"><h3>Informações pessoais</h3></div>
            <form onSubmit={saveProfile} className="tf-form">
              <div className="tf-form-row"><label>Nome</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button type="submit" className="tf-btn-primary">Salvar alterações</button>
                {savedMsg && <span className="text-lime" style={{ fontSize: 12.5 }}>Salvo</span>}
              </div>
            </form>
          </div>
          <div className="tf-card">
            <div className="tf-card-head"><h3>Alterar senha</h3></div>
            <form onSubmit={changePassword} className="tf-form">
              <div className="tf-form-row"><label>Nova senha</label><input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="mín. 6 caracteres" /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button type="submit" className="tf-btn-outline">Atualizar senha</button>
                {pwdMsg && <span className={pwdMsg.startsWith("ok:") ? "text-lime" : "text-coral"} style={{ fontSize: 12.5 }}>{pwdMsg.split(":")[1]}</span>}
              </div>
            </form>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="tf-card">
            <div className="tf-card-head"><h3>Assinatura</h3></div>
            {currentPlan ? (
              <><div className="tf-badge badge-blue" style={{ display: "inline-block", marginBottom: 10 }}>Plano {currentPlan} ativo</div>
              <button className="tf-btn-outline" onClick={() => setActive("plans")}>Gerenciar assinatura</button></>
            ) : (
              <><div className="tf-badge badge-outline" style={{ display: "inline-block", marginBottom: 10 }}>Nenhum plano ativo</div>
              <button className="tf-btn-primary" onClick={() => setActive("plans")}>Ver planos</button></>
            )}
          </div>
          <div className="tf-card">
            <div className="tf-card-head"><h3>Sessão</h3></div>
            <button className="tf-btn-outline tf-logout-btn" onClick={onLogout}><ArrowRight size={14} style={{ transform: "rotate(180deg)" }} /> Sair da plataforma</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlansView({ currentPlan, onSubscribe }) {
  const plans = [
    { name: "Starter", price: "R$ 39", period: "/mês", features: ["1 conta conectada", "Diário de trades ilimitado", "Relatórios básicos"] },
    { name: "Pro", price: "R$ 390", period: "/ano", highlight: true, features: ["Contas ilimitadas", "Analytics avançado", "Suporte prioritário"] },
  ];
  return (
    <div className="tf-view">
      <div className="tf-view-header"><div><h1>Planos</h1><p className="tf-muted">Escolha o plano ideal</p></div></div>
      <div className="tf-plans-grid">
        {plans.map((p) => {
          const isActive = currentPlan === p.name;
          return (
            <div className={`tf-card tf-plan-card ${p.highlight ? "plan-highlight" : ""}`} key={p.name}>
              {isActive && <span className="tf-plan-tag tf-plan-tag-active">Plano atual</span>}
              <h3>{p.name}</h3>
              <div className="tf-plan-price">{p.price}<span className="tf-muted">{p.period}</span></div>
              <ul className="tf-plan-features">{p.features.map((f) => <li key={f}><Check size={14} className="text-lime" /> {f}</li>)}</ul>
              <button className={isActive ? "tf-btn-outline" : "tf-btn-primary"} onClick={() => !isActive && onSubscribe(p.name)} disabled={isActive}>
                {isActive ? "Assinado" : `Assinar ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>
      <p className="tf-muted" style={{ marginTop: 16, maxWidth: 480 }}>
        Nota: este botão ainda não processa pagamento real — ele só marca a assinatura como ativa no banco de dados, pra você testar o fluxo. A integração com gateway de pagamento (Mercado Pago/Stripe) é o próximo passo.
      </p>
    </div>
  );
}

function ToolsView() {
  return (
    <div className="tf-view">
      <div className="tf-view-header"><div><h1>Ferramentas</h1><p className="tf-muted">Calculadora de risco, simulador de metas e mais — chegando nessa área em breve.</p></div></div>
    </div>
  );
}

/* --------------------------- Login / Onboarding --------------------------- */

function LoginScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setInfo("Conta criada! Se a confirmação de e-mail estiver ativa no seu projeto Supabase, verifique sua caixa de entrada antes de entrar.");
    }
    setLoading(false);
  };

  return (
    <div className="tf-auth-screen">
      <div className="tf-auth-card">
        <div className="tf-brand tf-brand-center"><div className="tf-brand-name tf-brand-name-lg">TRADE<span className="text-blue">DOC</span></div></div>
        <p className="tf-auth-tagline-brand">MENOS EMOÇÃO. <span className="text-blue">MAIS EXECUÇÃO.</span></p>

        <form className="tf-form" onSubmit={submit}>
          <div className="tf-form-row">
            <label>E-mail</label>
            <div className="tf-input-icon"><Mail size={15} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required /></div>
          </div>
          <div className="tf-form-row">
            <label>Senha</label>
            <div className="tf-input-icon"><Lock size={15} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mín. 6 caracteres" required minLength={6} /></div>
          </div>
          {error && <p className="text-coral" style={{ fontSize: 12.5, margin: 0 }}>{error}</p>}
          {info && <p className="text-lime" style={{ fontSize: 12.5, margin: 0 }}>{info}</p>}
          <button type="submit" className="tf-btn-primary tf-form-submit" disabled={loading}>
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"} <ArrowRight size={15} />
          </button>
        </form>
        <button className="tf-skip-link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Não tem conta? Criar agora →" : "Já tem conta? Entrar →"}
        </button>
      </div>
    </div>
  );
}

function OnboardingScreen({ onComplete }) {
  const [name, setName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [balance, setBalance] = useState("12000");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onComplete(name, { name: accountName || "Minha conta", balance: parseFloat(balance.replace(",", ".")) || BASE_CAPITAL });
    setSaving(false);
  };

  return (
    <div className="tf-auth-screen">
      <div className="tf-auth-card">
        <h2 className="tf-onboarding-title">Vamos configurar sua conta</h2>
        <form className="tf-form" onSubmit={submit}>
          <div className="tf-form-row"><label>Seu nome</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="tf-form-row"><label>Nome da conta de trading</label><input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Ex: Conta Real — Clear" required /></div>
          <div className="tf-form-row"><label>Saldo inicial (R$)</label><input value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" required /></div>
          <button type="submit" className="tf-btn-primary tf-form-submit" disabled={saving}>{saving ? "Salvando..." : "Concluir"} <ArrowRight size={15} /></button>
        </form>
      </div>
    </div>
  );
}

/* --------------------------------- App ----------------------------------- */

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [profile, setProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [active, setActive] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); setAccounts([]); setTrades([]); return; }
    loadUserData();
  }, [session]);

  async function loadUserData() {
    const userId = session.user.id;
    const { data: profileData } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(profileData || null);

    const { data: accountsData } = await supabase.from("accounts").select("*").eq("user_id", userId).order("created_at");
    setAccounts(accountsData || []);

    const { data: tradesData } = await supabase.from("trades").select("*").eq("user_id", userId).order("trade_date", { ascending: false });
    setTrades(tradesData || []);

    const { data: subData } = await supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
    setSubscription(subData || null);
  }

  const data = useDerivedData(trades, accounts);

  const handleOnboardingComplete = async (name, firstAccount) => {
    const userId = session.user.id;
    await supabase.from("profiles").insert({ id: userId, name, email: session.user.email });
    await supabase.from("accounts").insert({ user_id: userId, name: firstAccount.name, type: "Real", balance: firstAccount.balance, status: "Ativa" });
    await loadUserData();
  };

  const handleNewTrade = async (trade) => {
    const userId = session.user.id;
    await supabase.from("trades").insert({ ...trade, user_id: userId });
    const account = accounts.find((a) => a.id === trade.account_id);
    if (account) {
      await supabase.from("accounts").update({ balance: Number(account.balance) + trade.pnl }).eq("id", account.id);
    }
    await loadUserData();
  };

  const handleAddAccount = async (acc) => {
    const userId = session.user.id;
    await supabase.from("accounts").insert({ ...acc, user_id: userId });
    await loadUserData();
  };

  const handleUpdateProfile = async (name) => {
    await supabase.from("profiles").update({ name }).eq("id", session.user.id);
    await loadUserData();
  };

  const handleSubscribe = async (planName) => {
    const userId = session.user.id;
    if (subscription) {
      await supabase.from("subscriptions").update({ plan: planName, status: "active" }).eq("id", subscription.id);
    } else {
      await supabase.from("subscriptions").insert({ user_id: userId, plan: planName, status: "active" });
    }
    await loadUserData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setActive("dashboard");
  };

  if (loadingSession) {
    return <div className="tf-app" style={{ alignItems: "center", justifyContent: "center" }}><p className="tf-muted">Carregando...</p></div>;
  }

  const view = (() => {
    switch (active) {
      case "dashboard": return <DashboardView data={data} onOpenModal={() => setShowModal(true)} />;
      case "calendar": return <CalendarView trades={trades} accounts={accounts} onNewTrade={handleNewTrade} />;
      case "accounts": return <AccountsView accounts={accounts} onAddAccount={handleAddAccount} />;
      case "tools": return <ToolsView />;
      case "profile": return <ProfileView userName={profile?.name || ""} userEmail={session?.user?.email} onUpdateProfile={handleUpdateProfile} currentPlan={subscription?.plan} setActive={setActive} onLogout={handleLogout} />;
      case "plans": return <PlansView currentPlan={subscription?.plan} onSubscribe={handleSubscribe} />;
      default: return <DashboardView data={data} onOpenModal={() => setShowModal(true)} />;
    }
  })();

  return (
    <div className="tf-app">
      <style>{APP_STYLES}</style>
      {!session && <LoginScreen />}
      {session && !profile && <OnboardingScreen onComplete={handleOnboardingComplete} />}
      {session && profile && (
        <>
          <div className="tf-mobile-topbar">
            <button className="tf-hamburger-btn" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
            <span className="tf-brand-name">TRADE<span className="text-blue">DOC</span></span>
          </div>
          <Sidebar
            active={active}
            setActive={setActive}
            userName={profile.name}
            mobileOpen={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
          />
          {view}
          {showModal && <NewTradeModal onClose={() => setShowModal(false)} onSubmit={handleNewTrade} accounts={accounts} />}
        </>
      )}
    </div>
  );
}

const APP_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
.tf-app { --bg:#0D1117; --surface:#131922; --surface-2:#182130; --border:#232C3B; --text:#F5F7FA; --muted:#A0A6B2; --blue:#0070FF; --blue-dim:#0C3B7A; --lime:#1FA35C; --coral:#FF5C72; display:flex; min-height:100vh; background:var(--bg); color:var(--text); font-family:'Inter',sans-serif; }
.tf-app * { box-sizing:border-box; }
.text-lime{color:var(--lime);} .text-coral{color:var(--coral);} .text-blue{color:var(--blue);}
.tf-mono{font-family:'JetBrains Mono',monospace;} .tf-muted{color:var(--muted);font-size:13px;} .tf-empty{color:var(--muted);font-size:13px;padding:10px 0;}
.tf-sidebar{width:210px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:20px 14px;}
.tf-brand{padding:0 6px 22px;} .tf-brand-center{padding:0 0 6px;justify-content:center;text-align:center;}
.tf-brand-name{font-family:'Exo 2',sans-serif;font-weight:700;font-size:16.5px;} .tf-brand-name-lg{font-size:22px;margin-top:6px;}
.tf-nav{display:flex;flex-direction:column;gap:3px;flex:1;}
.tf-nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;border:none;background:transparent;color:var(--muted);font-size:13.5px;font-weight:500;cursor:pointer;text-align:left;}
.tf-nav-item:hover{background:var(--surface-2);color:var(--text);} .tf-nav-item.active{background:var(--blue-dim);color:#C9DAFF;}
.tf-sidebar-footer{border-top:1px solid var(--border);padding-top:14px;}
.tf-user-chip{display:flex;align-items:center;gap:8px;padding:6px 4px;background:none;border:none;cursor:pointer;width:100%;border-radius:7px;text-align:left;}
.tf-user-chip:hover{background:var(--surface-2);}
.tf-user-avatar{width:24px;height:24px;border-radius:50%;background:var(--blue-dim);color:#C9DAFF;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;}
.tf-user-name{font-size:12.5px;font-weight:500;}
.tf-view{flex:1;padding:26px 30px;overflow-y:auto;}
.tf-view-header{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px;}
.tf-view-header h1{font-family:'Exo 2',sans-serif;font-size:22px;font-weight:600;margin:0 0 4px;}
.tf-btn-primary{display:inline-flex;align-items:center;gap:6px;background:var(--lime);color:#10170A;border:none;padding:9px 15px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;}
.tf-btn-outline{padding:9px 15px;border-radius:8px;font-weight:600;font-size:13px;background:transparent;border:1px solid var(--border);color:var(--text);cursor:pointer;}
.tf-btn-primary:disabled,.tf-btn-outline:disabled{opacity:.55;cursor:not-allowed;}
.tf-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;}
.tf-card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.tf-card-head h3{font-family:'Exo 2',sans-serif;font-size:14.5px;font-weight:600;margin:0;}
.tf-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;}
.tf-stat{display:flex;flex-direction:column;gap:6px;} .tf-stat-top{display:flex;align-items:center;justify-content:space-between;}
.tf-stat-label{font-size:12px;color:var(--muted);font-weight:500;}
.tf-icon-badge{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;}
.tone-up{background:rgba(31,163,92,0.12);color:var(--lime);} .tone-down{background:rgba(255,92,114,0.12);color:var(--coral);} .tone-neutral{background:rgba(0,112,255,0.14);color:#7FA6FF;}
.tf-stat-value{font-family:'Exo 2',sans-serif;font-size:22px;font-weight:600;}
.tf-hero-chart{margin-bottom:16px;} .tf-hero-value{font-family:'JetBrains Mono',monospace;font-size:15px;}
.tf-two-col{display:grid;grid-template-columns:1.1fr 1fr;gap:16px;}
.tf-table-row{display:grid;grid-template-columns:1.2fr .8fr .8fr 1fr;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;align-items:center;}
.tf-table-row:last-child{border-bottom:none;} .tf-table-head{color:var(--muted);font-size:11.5px;text-transform:uppercase;}
.tf-asset{font-weight:600;}
.tf-trade-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;}
.tf-trade-row:last-child{border-bottom:none;} .tf-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.dot-lime{background:var(--lime);} .dot-coral{background:var(--coral);} .tf-trade-date{width:42px;} .tf-trade-side{flex:1;color:var(--muted);} .tf-trade-pnl{min-width:70px;text-align:right;}
.tf-accounts-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.tf-account-card{display:flex;flex-direction:column;gap:8px;} .tf-account-top{display:flex;align-items:center;justify-content:space-between;}
.tf-badge{font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:20px;text-transform:uppercase;}
.badge-blue{background:rgba(0,112,255,0.18);color:#7FA6FF;} .badge-outline{border:1px solid var(--border);color:var(--muted);}
.tf-account-name{font-size:14px;font-weight:600;margin:2px 0 0;font-family:'Exo 2',sans-serif;}
.tf-account-balance{font-family:'JetBrains Mono',monospace;font-size:19px;font-weight:600;}
.tf-account-status{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);margin-top:2px;}
.tf-plans-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;max-width:620px;}
.tf-plan-card{position:relative;display:flex;flex-direction:column;gap:12px;}
.plan-highlight{border-color:var(--lime);} .tf-plan-tag{position:absolute;top:-10px;right:16px;background:var(--lime);color:#10170A;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:20px;}
.tf-plan-tag-active{background:var(--blue);color:#fff;}
.tf-plan-card h3{font-family:'Exo 2',sans-serif;font-size:16px;margin:6px 0 0;}
.tf-plan-price{font-family:'Exo 2',sans-serif;font-size:28px;font-weight:700;} .tf-plan-price span{font-size:13px;font-weight:500;margin-left:3px;}
.tf-plan-features{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;}
.tf-plan-features li{display:flex;align-items:center;gap:7px;font-size:13px;}
.tf-auth-screen{flex:1;display:flex;align-items:center;justify-content:center;padding:30px;min-height:100vh;}
.tf-auth-card{width:100%;max-width:340px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px 26px;text-align:center;}
.tf-auth-tagline-brand{font-family:'Exo 2',sans-serif;font-weight:700;font-size:11px;letter-spacing:.06em;margin:2px 0 14px;}
.tf-onboarding-title{font-family:'Exo 2',sans-serif;font-size:17px;margin:0 0 14px;}
.tf-form{display:flex;flex-direction:column;gap:12px;text-align:left;}
.tf-form-row{display:flex;flex-direction:column;gap:5px;} .tf-form-row label{font-size:12px;color:var(--muted);font-weight:500;}
.tf-form-row input,.tf-form-row select{background:var(--surface-2);border:1px solid var(--border);color:var(--text);padding:9px 11px;border-radius:8px;font-size:13.5px;outline:none;width:100%;color-scheme:dark;}
.tf-form-row-inline{display:grid;grid-template-columns:1fr 1fr;gap:12px;} .tf-form-inline-3{display:grid;grid-template-columns:1.4fr 1fr 1fr auto;gap:12px;align-items:end;}
.tf-input-icon{display:flex;align-items:center;gap:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:0 11px;}
.tf-input-icon svg{color:var(--muted);} .tf-input-icon input{background:transparent;border:none;padding:9px 0;color-scheme:dark;}
.tf-toggle-group{display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;}
.tf-toggle-group button{flex:1;padding:8px 0;background:var(--surface-2);border:none;color:var(--muted);font-size:12.5px;font-weight:600;cursor:pointer;}
.tf-toggle-group button.active{background:var(--blue-dim);color:#C9DAFF;}
.tf-toggle-group button.active.tone-win{background:rgba(31,163,92,0.18);color:var(--lime);}
.tf-toggle-group button.active.tone-loss{background:rgba(255,92,114,0.18);color:var(--coral);}
.tf-form-submit{justify-content:center;margin-top:4px;}
.tf-skip-link{background:none;border:none;color:var(--muted);font-size:12px;cursor:pointer;margin-top:12px;text-decoration:underline;}
.tf-modal-overlay{position:fixed;inset:0;background:rgba(5,7,12,0.6);display:flex;align-items:center;justify-content:center;z-index:20;}
.tf-modal{width:100%;max-width:380px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin:20px;}
.tf-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
.tf-modal-head h3{font-family:'Exo 2',sans-serif;font-size:15.5px;margin:0;}
.tf-icon-btn{background:var(--surface);border:1px solid var(--border);color:var(--text);width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.tf-logout-btn{display:inline-flex;align-items:center;gap:7px;color:var(--coral);}
.tf-month-nav{display:flex;align-items:center;gap:10px;}
.tf-month-label{font-family:'Exo 2',sans-serif;font-weight:600;font-size:14px;}
.tf-cal-weekdays{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;}
.tf-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;}
.tf-cal-cell{aspect-ratio:1;border-radius:8px;background:var(--surface-2);padding:6px 7px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid transparent;font-family:'Inter',sans-serif;text-align:left;width:100%;cursor:default;}
.tf-cal-cell.has-day{border-color:var(--border);cursor:pointer;} .tf-cal-cell.has-day:hover{border-color:var(--blue);}
.tf-cal-day{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;}
.tf-cal-pnl{font-size:10.5px;font-weight:600;font-family:'JetBrains Mono',monospace;}
.tone-lime-1{background:rgba(31,163,92,0.10);} .tone-lime-1 .tf-cal-pnl{color:#7BD79E;}
.tone-lime-2{background:rgba(31,163,92,0.20);} .tone-lime-2 .tf-cal-pnl{color:var(--lime);}
.tone-lime-3{background:rgba(31,163,92,0.32);} .tone-lime-3 .tf-cal-pnl{color:var(--lime);}
.tone-coral-1{background:rgba(255,92,114,0.10);} .tone-coral-1 .tf-cal-pnl{color:#FF9CAB;}
.tone-coral-2{background:rgba(255,92,114,0.20);} .tone-coral-2 .tf-cal-pnl{color:var(--coral);}
.tone-coral-3{background:rgba(255,92,114,0.32);} .tone-coral-3 .tf-cal-pnl{color:var(--coral);}
.tone-empty{background:transparent;}
.tf-daymodal-total{display:flex;align-items:center;justify-content:space-between;padding:10px 0;margin-bottom:8px;border-bottom:1px solid var(--border);font-size:13.5px;}

.tf-weekday-list{display:flex;flex-direction:column;gap:12px;}
.tf-weekday-row{display:grid;grid-template-columns:70px 1fr auto;align-items:center;gap:12px;}
.tf-weekday-label{font-size:13px;color:var(--text);}
.tf-weekday-bar-track{height:8px;border-radius:20px;background:var(--surface-2);overflow:hidden;}
.tf-weekday-bar-fill{height:100%;border-radius:20px;transition:width .3s;}
.fill-lime{background:var(--lime);} .fill-coral{background:var(--coral);}
.tf-weekday-value{font-size:13px;font-weight:600;min-width:90px;text-align:right;}

.tf-asset-block{padding:8px 0;border-bottom:1px solid var(--border);}
.tf-asset-block:last-child{border-bottom:none;}
.tf-asset-block .tf-table-row{border-bottom:none;padding:0 0 6px;}
.tf-asset-bar-track{height:4px;border-radius:20px;background:var(--surface-2);overflow:hidden;}
.tf-asset-bar-fill{height:100%;border-radius:20px;background:var(--lime);}

/* Mobile top bar (hidden on desktop) */
.tf-mobile-topbar{display:none;}
.tf-hamburger-btn{display:none;}
.tf-sidebar-close{display:none;}
.tf-sidebar-backdrop{display:none;}

/* ===================== RESPONSIVE ===================== */
html, body { overflow-x: hidden; max-width: 100%; }

@media (max-width: 860px) {
  .tf-app { flex-direction: column; min-height: 100vh; }

  .tf-mobile-topbar{
    display:flex; align-items:center; gap:12px;
    padding:14px 16px; background:var(--surface); border-bottom:1px solid var(--border);
    position:sticky; top:0; z-index:15;
  }
  .tf-hamburger-btn{
    display:flex; align-items:center; justify-content:center;
    width:34px; height:34px; border-radius:8px; background:var(--surface-2);
    border:1px solid var(--border); color:var(--text); cursor:pointer; flex-shrink:0;
  }

  /* Sidebar becomes an off-canvas drawer, hidden until opened */
  .tf-sidebar{
    position:fixed; top:0; left:0; bottom:0; width:250px; max-width:80vw; height:100vh;
    transform:translateX(-100%); transition:transform .25s ease;
    border-right:1px solid var(--border); z-index:30;
    padding:20px 14px calc(20px + env(safe-area-inset-bottom));
  }
  .tf-sidebar.mobile-open{ transform:translateX(0); box-shadow:8px 0 24px rgba(0,0,0,0.4); }
  .tf-sidebar-backdrop{
    display:block; position:fixed; inset:0; background:rgba(5,7,12,0.6); z-index:25;
  }
  .tf-brand{ display:flex; align-items:center; justify-content:space-between; }
  .tf-sidebar-close{
    display:flex; align-items:center; justify-content:center;
    width:30px; height:30px; border-radius:8px; background:var(--surface-2);
    border:1px solid var(--border); color:var(--text); cursor:pointer;
  }
  .tf-sidebar-footer{ display:flex; }

  /* Content takes the full width; no permanent offset since the drawer overlays */
  .tf-view{ padding:20px 16px 24px; }

  /* Grids collapse to fewer columns */
  .tf-stats-grid{ grid-template-columns:repeat(2,1fr); gap:10px; }
  .tf-stat-value{ font-size:19px; }
  .tf-two-col{ grid-template-columns:1fr; }
  .tf-accounts-grid{ grid-template-columns:1fr; }
  .tf-plans-grid{ grid-template-columns:1fr; max-width:100%; }
  .tf-tools-grid{ grid-template-columns:1fr; }
  .tf-form-row-inline{ grid-template-columns:1fr; }
  .tf-form-inline-3{ grid-template-columns:1fr; }

  .tf-view-header h1{ font-size:19px; }
  .tf-view-header{ flex-direction:column; align-items:stretch; }
  .tf-view-header .tf-btn-primary{ justify-content:center; }

  /* Table rows: shrink font so nothing overflows */
  .tf-table-row{ font-size:12px; grid-template-columns:1fr .7fr .7fr .9fr; }
  .tf-trade-row{ font-size:12px; flex-wrap:wrap; }

  /* Modal fits small screens */
  .tf-modal{ max-width:calc(100vw - 24px); margin:12px; padding:18px; max-height:calc(100vh - 100px); overflow-y:auto; }
  .tf-modal-overlay{ align-items:flex-end; }
  .tf-modal{ border-radius:16px 16px 0 0; }

  /* Calendar stays 7 columns but tighter */
  .tf-cal-grid{ gap:4px; }
  .tf-cal-cell{ padding:4px 5px; border-radius:6px; }
  .tf-cal-day{ font-size:9.5px; }
  .tf-cal-pnl{ font-size:8.5px; }
  .tf-cal-weekdays{ font-size:9.5px; }

  .tf-auth-screen{ padding:16px; }
  .tf-auth-card{ max-width:100%; padding:24px 20px; }

  .tf-hero-value{ font-size:13px; }

  .tf-weekday-row{ grid-template-columns:56px 1fr auto; gap:8px; }
  .tf-weekday-label{ font-size:11.5px; }
  .tf-weekday-value{ font-size:11.5px; min-width:76px; }

  /* iOS auto-zooms inputs with font-size below 16px on focus — force 16px to prevent it */
  .tf-form-row input, .tf-form-row select, .tf-input-icon input {
    font-size: 16px !important;
  }
}

@media (max-width: 380px) {
  .tf-stats-grid{ grid-template-columns:1fr; }
  .tf-table-row{ grid-template-columns:1fr .6fr .8fr; }
  .tf-table-row span:nth-child(3){ display:none; }
}
`;
