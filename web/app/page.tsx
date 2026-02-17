'use client';

import { type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from 'react';
import {
  AgentActionResult,
  Contact,
  Deal,
  Interaction,
  Organization,
  Payment,
  PipelineStage,
  Project,
  Quotation,
  QuotationItem,
  Task,
  User,
  createContact,
  createDeal,
  createInteraction,
  createOrganization,
  createPayment,
  createProject,
  createQuotation,
  createQuotationItem,
  createTask,
  createUser,
  deleteContacts,
  deleteDeals,
  deleteInteractions,
  deleteOrganizations,
  deletePayments,
  deleteProjects,
  deleteQuotationItems,
  deleteQuotations,
  deleteTasks,
  deleteUsers,
  getMe,
  getSettings,
  getState,
  login,
  logout,
  runAgentCommand,
  updateSettings
} from '../lib/api';

type DealsMode = 'kanban' | 'list';
type DealsStatusFilter = 'open' | 'won' | 'lost' | 'all';
type ProjectsMode = 'list' | 'gantt';
type TasksMode = 'kanban' | 'list' | 'gantt';

const views = ['dashboard', 'organizations', 'contacts', 'deals', 'projects', 'tasks', 'quotations', 'settings', 'agent'] as const;
type View = (typeof views)[number];

const viewLabels: Record<View, string> = {
  dashboard: 'Dashboard',
  organizations: 'Organizations',
  contacts: 'Contacts',
  deals: 'Deals',
  projects: 'Projects',
  tasks: 'Tasks',
  quotations: 'Quotations',
  settings: 'Settings',
  agent: 'Agent'
};

type AppSettings = {
  provider?: string;
  model?: string;
  ollama_base_url?: string;
  ollama_header_timeout_seconds?: number;
  ollama_overall_timeout_seconds?: number;
  ollama_max_attempts?: number;
  ollama_backoff_base_ms?: number;
  max_tokens?: number;
  temperature?: number;
  verbose?: boolean;
  use_ansi?: boolean;
  auto_summary?: boolean;
  openai_key?: string;
  anthropic_key?: string;
  has_openai_key?: boolean;
  has_anthropic_key?: boolean;
};

type AgentMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  details?: string[];
};

function currency(amount: number, code: string) {
  const safe = Number.isFinite(amount) ? amount : 0;
  const c = code || 'EUR';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(safe);
  } catch {
    return `${safe.toFixed(2)} ${c}`;
  }
}

function compactCurrency(amount: number, code: string) {
  const safe = Number.isFinite(amount) ? amount : 0;
  const c = code || 'EUR';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: c,
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(safe);
  } catch {
    if (safe >= 1000) return `${(safe / 1000).toFixed(1)}k ${c}`;
    return `${safe.toFixed(0)} ${c}`;
  }
}

type CrudKind =
  | 'organization'
  | 'contact'
  | 'deal'
  | 'payment'
  | 'project'
  | 'task'
  | 'quotation'
  | 'quotationItem'
  | 'interaction'
  | 'user';

type ContextMenuState = {
  kind: CrudKind;
  item: any;
  x: number;
  y: number;
};

type EditState = {
  kind: CrudKind;
  draft: any;
};

type ConfirmDeleteState = {
  kind: CrudKind;
  ids: string[];
  label: string;
};

function isoToDateInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function dateInputToISO(date: string): string | undefined {
  const v = (date || '').trim();
  if (!v) return undefined;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d.toISOString();
}

function isoToDatetimeLocal(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToISO(v: string): string | undefined {
  const raw = (v || '').trim();
  if (!raw) return undefined;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d.toISOString();
}

const DAY_MS = 24 * 60 * 60 * 1000;

type TimelineInterval = { start: number; end: number };

type TimelineLayout = {
  min: number;
  max: number;
  range: number;
  chartWidth: number;
  stepDays: number;
  ticks: number[];
};

function toTimeOrNull(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  return t;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function estimateTaskDurationMs(task: Task): number {
  const hours = Number(task.estimatedHours) || 0;
  if (hours <= 0) return DAY_MS;
  return Math.max(DAY_MS, Math.round((hours / 8) * DAY_MS));
}

function buildTaskInterval(task: Task, fallbackStart: number): TimelineInterval {
  const start = toTimeOrNull(task.createdAt) ?? fallbackStart;
  const due = toTimeOrNull(task.dueDate);
  const endCandidate = due ?? start + estimateTaskDurationMs(task);
  const end = Math.max(endCandidate, start + DAY_MS);
  return { start, end };
}

function buildTimelineLayout(intervals: TimelineInterval[], pxPerDay = 28): TimelineLayout | null {
  if (intervals.length === 0) return null;
  let min = intervals[0].start;
  let max = intervals[0].end;
  for (const it of intervals) {
    min = Math.min(min, it.start);
    max = Math.max(max, it.end);
  }

  const paddedMin = startOfDay(min - DAY_MS);
  const paddedMax = startOfDay(max + DAY_MS);
  const range = Math.max(DAY_MS, paddedMax - paddedMin);
  const days = Math.max(1, Math.ceil(range / DAY_MS));
  const chartWidth = Math.max(960, days * pxPerDay);

  let stepDays = 1;
  if (days > 40) stepDays = 7;
  if (days > 180) stepDays = 30;
  if (days > 540) stepDays = 60;

  const ticks: number[] = [];
  for (let t = paddedMin; t <= paddedMax; t += stepDays * DAY_MS) {
    ticks.push(t);
  }
  if (ticks[ticks.length - 1] !== paddedMax) {
    ticks.push(paddedMax);
  }

  return {
    min: paddedMin,
    max: paddedMax,
    range,
    chartWidth,
    stepDays,
    ticks
  };
}

function timelineLeftPx(ts: number, layout: TimelineLayout): number {
  return ((ts - layout.min) / layout.range) * layout.chartWidth;
}

function timelineBarStyle(interval: TimelineInterval, layout: TimelineLayout) {
  const left = timelineLeftPx(interval.start, layout);
  const right = timelineLeftPx(interval.end, layout);
  return {
    left,
    width: Math.max(10, right - left)
  };
}

function formatTimelineTick(ts: number, stepDays: number): string {
  const d = new Date(ts);
  if (stepDays >= 30) {
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonths(base: Date, delta: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + delta, 1);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short' });
}

function changePercent(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

type ChartPoint = { x: number; y: number };

function buildSmoothPath(points: ChartPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

export default function HomePage() {
  const [view, setView] = useState<View>('dashboard');
  const [me, setMe] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('admin');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const [orgName, setOrgName] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgIndustry, setOrgIndustry] = useState('');

  const [contactOrgId, setContactOrgId] = useState('');
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactJobTitle, setContactJobTitle] = useState('');
  const [contactPrimary, setContactPrimary] = useState(false);
  const [contactFocusId, setContactFocusId] = useState<string | null>(null);

  const [dealOrgId, setDealOrgId] = useState('');
  const [dealContactId, setDealContactId] = useState('');
  const [dealTitle, setDealTitle] = useState('');
  const [dealValue, setDealValue] = useState<number>(0);
  const [dealCurrency, setDealCurrency] = useState('EUR');
  const [dealProbability, setDealProbability] = useState<number>(35);
  const [dealStageId, setDealStageId] = useState('');
  const [dealDomain, setDealDomain] = useState('');
  const [dealDomainAcquiredAt, setDealDomainAcquiredAt] = useState('');
  const [dealDomainExpiresAt, setDealDomainExpiresAt] = useState('');
  const [dealDomainCost, setDealDomainCost] = useState<number>(0);
  const [dealDeposit, setDealDeposit] = useState<number>(0);
  const [dealCosts, setDealCosts] = useState<number>(0);
  const [dealTaxes, setDealTaxes] = useState<number>(0);
  const [dealNetTotal, setDealNetTotal] = useState<number>(0);
  const [dealShareGil, setDealShareGil] = useState<number>(0);
  const [dealShareRic, setDealShareRic] = useState<number>(0);
  const [dealWorkType, setDealWorkType] = useState('');
  const [dealWorkClosedAt, setDealWorkClosedAt] = useState('');
  const [dealFocusId, setDealFocusId] = useState<string | null>(null);
  const [dealFocusMode, setDealFocusMode] = useState<'view' | 'edit'>('view');
  const [dealFocusDraft, setDealFocusDraft] = useState<Partial<Deal> | null>(null);

  const [dealsMode, setDealsMode] = useState<DealsMode>('kanban');
  const [dealsStatus, setDealsStatus] = useState<DealsStatusFilter>('open');
  const [kanbanDragOverStageId, setKanbanDragOverStageId] = useState<string | null>(null);

  const [projectsMode, setProjectsMode] = useState<ProjectsMode>('list');
  const [tasksMode, setTasksMode] = useState<TasksMode>('kanban');
  const [tasksProjectFilterId, setTasksProjectFilterId] = useState<string>('');
  const [taskKanbanDragOverStatus, setTaskKanbanDragOverStatus] = useState<string | null>(null);

  const [projectDealId, setProjectDealId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projectBudget, setProjectBudget] = useState<number>(0);
  const [projectCurrency, setProjectCurrency] = useState('EUR');

  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskStatus, setTaskStatus] = useState('todo');
  const [taskPriority, setTaskPriority] = useState<number>(1);
  const [taskEstimatedHours, setTaskEstimatedHours] = useState<number>(1);

  const [stageName, setStageName] = useState('');
  const [stageColor, setStageColor] = useState('#CF8445');
  const [stageProbability, setStageProbability] = useState<number>(10);

  const [quoteDealId, setQuoteDealId] = useState('');
  const [quoteTitle, setQuoteTitle] = useState('');
  const [quoteCurrency, setQuoteCurrency] = useState('EUR');
  const [quoteTaxRate, setQuoteTaxRate] = useState<number>(22);
  const [quoteDiscountAmount, setQuoteDiscountAmount] = useState<number>(0);
  const [quoteValidUntil, setQuoteValidUntil] = useState('');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>('');

  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0);
  const [itemUnitType, setItemUnitType] = useState('hour');

  const [dealInteractionType, setDealInteractionType] = useState('note');
  const [dealInteractionSubject, setDealInteractionSubject] = useState('');
  const [dealInteractionBody, setDealInteractionBody] = useState('');

  const [contactInteractionType, setContactInteractionType] = useState('note');
  const [contactInteractionSubject, setContactInteractionSubject] = useState('');
  const [contactInteractionBody, setContactInteractionBody] = useState('');
  const [contactInteractionDealId, setContactInteractionDealId] = useState('');

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [agentInput, setAgentInput] = useState('');
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);

  const [crudBusy, setCrudBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paymentSelectedIds, setPaymentSelectedIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(null);

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (view !== 'deals') {
      setDealFocusId(null);
      setDealFocusMode('view');
      setDealFocusDraft(null);
      setPaymentSelectedIds([]);
    }
  }, [view]);

  useEffect(() => {
    if (view === 'deals' && dealsMode !== 'list') {
      setSelectedIds([]);
    }
  }, [dealsMode, view]);

  useEffect(() => {
    if (view !== 'contacts') {
      setContactFocusId(null);
    }
  }, [view]);

  useEffect(() => {
    if (!dealFocusId) {
      setDealFocusDraft(null);
      setDealFocusMode('view');
      return;
    }
    if (dealFocusMode === 'edit') return;
    const d = deals.find((x) => x.id === dealFocusId);
    if (d) setDealFocusDraft({ ...d });
  }, [dealFocusId, deals, dealFocusMode]);

  useEffect(() => {
    setPaymentSelectedIds([]);
  }, [dealFocusId]);

  useEffect(() => {
    setDealInteractionSubject('');
    setDealInteractionBody('');
  }, [dealFocusId]);

  useEffect(() => {
    setContactInteractionSubject('');
    setContactInteractionBody('');
    setContactInteractionDealId('');
  }, [contactFocusId]);

  useEffect(() => {
    if (!dealStageId && pipelineStages.length > 0) {
      setDealStageId(pipelineStages[0].id);
    }
  }, [dealStageId, pipelineStages]);

  useEffect(() => {
    if (!quoteDealId && deals.length > 0) {
      setQuoteDealId(deals[0].id);
    }
  }, [deals, quoteDealId]);

  useEffect(() => {
    if (!selectedQuotationId && quotations.length > 0) {
      setSelectedQuotationId(quotations[0].id);
    }
  }, [quotations, selectedQuotationId]);

  useEffect(() => {
    // Selection and context are view-scoped.
    setSelectedIds([]);
    setPaymentSelectedIds([]);
    setContextMenu(null);
    setEdit(null);
    setConfirmDelete(null);
  }, [view]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [contextMenu]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setEdit(null);
        setConfirmDelete(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function boot() {
    setAuthError(null);
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('wemadeit_token') : '';
    if (!token) return;
    try {
      const user = await getMe();
      setMe(user);
      await refresh();
      await loadSettings();
    } catch {
      try {
        window.localStorage.removeItem('wemadeit_token');
      } catch {
        // ignore
      }
      setMe(null);
    }
  }

  async function refresh() {
    try {
      const data = await getState();
      setOrganizations(data.organizations);
      setContacts(data.contacts);
      setDeals(data.deals);
      setPayments(data.payments);
      setPipelineStages(data.pipelineStages);
      setProjects(data.projects);
      setTasks(data.tasks);
      setQuotations(data.quotations);
      setQuotationItems(data.quotationItems);
      setInteractions(data.interactions);
      setUsers(data.users);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load state';
      if (msg.toLowerCase().includes('unauthorized')) {
        try {
          window.localStorage.removeItem('wemadeit_token');
        } catch {
          // ignore
        }
        setMe(null);
        setAuthError('Session expired. Sign in again.');
        return;
      }
      setNotice(msg);
    }
  }

  async function loadSettings() {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('unauthorized')) {
        try {
          window.localStorage.removeItem('wemadeit_token');
        } catch {
          // ignore
        }
        setMe(null);
        setAuthError('Session expired. Sign in again.');
        return;
      }
      setSettings(null);
    }
  }

  async function onLogin() {
    const userLogin = loginEmail.trim();
    const password = loginPassword;
    if (!userLogin || !password) {
      setAuthError('Username and password are required.');
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      const result = await login(userLogin, password);
      window.localStorage.setItem('wemadeit_token', result.token);
      setMe(result.user);
      await refresh();
      await loadSettings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setAuthError(msg);
    } finally {
      setAuthBusy(false);
    }
  }

  async function onLogout() {
    setNotice(null);
    setSettingsNotice(null);
    try {
      await logout();
    } catch {
      // ignore
    }
    try {
      window.localStorage.removeItem('wemadeit_token');
    } catch {
      // ignore
    }
    setMe(null);
    setSettings(null);
    setView('dashboard');
  }

  const orgById = useMemo(() => {
    const map = new Map<string, Organization>();
    organizations.forEach((o) => map.set(o.id, o));
    return map;
  }, [organizations]);

  const contactById = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((c) => map.set(c.id, c));
    return map;
  }, [contacts]);

  const dealById = useMemo(() => {
    const map = new Map<string, Deal>();
    deals.forEach((d) => map.set(d.id, d));
    return map;
  }, [deals]);

  const focusedContact = useMemo(() => {
    if (!contactFocusId) return null;
    return contactById.get(contactFocusId) || null;
  }, [contactById, contactFocusId]);

  const focusedDeal = useMemo(() => {
    if (!dealFocusId) return null;
    return dealById.get(dealFocusId) || null;
  }, [dealById, dealFocusId]);

  const paymentsByDealId = useMemo(() => {
    const map = new Map<string, Payment[]>();
    payments.forEach((p) => {
      const id = (p.dealId || '').trim();
      if (!id) return;
      const arr = map.get(id) || [];
      arr.push(p);
      map.set(id, arr);
    });
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return map;
  }, [payments]);

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const taskById = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  const stageById = useMemo(() => {
    const map = new Map<string, PipelineStage>();
    pipelineStages.forEach((st) => map.set(st.id, st));
    return map;
  }, [pipelineStages]);

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const itemsByQuotationId = useMemo(() => {
    const map = new Map<string, QuotationItem[]>();
    quotationItems.forEach((it) => {
      const arr = map.get(it.quotationId) || [];
      arr.push(it);
      map.set(it.quotationId, arr);
    });
    for (const arr of map.values()) arr.sort((a, b) => (a.position || 0) - (b.position || 0));
    return map;
  }, [quotationItems]);

  const openDeals = useMemo(() => deals.filter((d) => d.status === 'open').length, [deals]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.status === 'done').length, [tasks]);
  const filteredTasks = useMemo(() => {
    const pid = (tasksProjectFilterId || '').trim();
    if (!pid) return tasks;
    return tasks.filter((t) => (t.projectId || '').trim() === pid);
  }, [tasks, tasksProjectFilterId]);
  const tasksByProjectId = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      const pid = (t.projectId || '').trim();
      if (!pid) return;
      const arr = map.get(pid) || [];
      arr.push(t);
      map.set(pid, arr);
    });
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const aDue = toTimeOrNull(a.dueDate) ?? Number.MAX_SAFE_INTEGER;
        const bDue = toTimeOrNull(b.dueDate) ?? Number.MAX_SAFE_INTEGER;
        if (aDue !== bDue) return aDue - bDue;
        return (toTimeOrNull(a.createdAt) ?? 0) - (toTimeOrNull(b.createdAt) ?? 0);
      });
    }
    return map;
  }, [tasks]);
  const projectTimelineRows = useMemo(() => {
    return projects
      .map((project) => {
        const projectStart = toTimeOrNull(project.startDate) ?? toTimeOrNull(project.createdAt) ?? Date.now();
        const taskRows = (tasksByProjectId.get(project.id) || []).map((task) => ({
          task,
          ...buildTaskInterval(task, projectStart)
        }));

        const projectEndFromDates = toTimeOrNull(project.actualEndDate) ?? toTimeOrNull(project.targetEndDate);
        const projectEndFromTasks = taskRows.length > 0 ? Math.max(...taskRows.map((t) => t.end)) : null;
        const projectEnd = Math.max(projectEndFromDates ?? projectEndFromTasks ?? projectStart + 14 * DAY_MS, projectStart + DAY_MS);

        return {
          project,
          start: projectStart,
          end: projectEnd,
          tasks: taskRows
        };
      })
      .sort((a, b) => a.start - b.start);
  }, [projects, tasksByProjectId]);
  const projectTimelineLayout = useMemo(() => {
    const intervals: TimelineInterval[] = [];
    projectTimelineRows.forEach((row) => {
      intervals.push({ start: row.start, end: row.end });
      row.tasks.forEach((t) => intervals.push({ start: t.start, end: t.end }));
    });
    return buildTimelineLayout(intervals, 30);
  }, [projectTimelineRows]);
  const taskTimelineRows = useMemo(() => {
    return filteredTasks
      .map((task) => {
        const baseStart = toTimeOrNull(task.createdAt) ?? Date.now();
        return {
          task,
          ...buildTaskInterval(task, baseStart)
        };
      })
      .sort((a, b) => a.start - b.start);
  }, [filteredTasks]);
  const taskTimelineLayout = useMemo(() => {
    return buildTimelineLayout(
      taskTimelineRows.map((row) => ({ start: row.start, end: row.end })),
      34
    );
  }, [taskTimelineRows]);
  const otherAdminCount = useMemo(
    () => users.filter((u) => u.role === 'admin' && u.id !== me?.id).length,
    [users, me?.id]
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const paymentSelectedSet = useMemo(() => new Set(paymentSelectedIds), [paymentSelectedIds]);

  const dashboardRevenue = useMemo(() => {
    const current = monthStart(new Date());
    const first = shiftMonths(current, -6);
    const monthStarts = Array.from({ length: 7 }, (_, idx) => shiftMonths(first, idx));
    const totals = new Map<string, number>();
    const paidPayments = payments.filter((p) => (p.status || '').toLowerCase() === 'paid');

    for (const p of paidPayments) {
      const when = new Date(p.paidAt || p.createdAt || '');
      if (!Number.isFinite(when.getTime())) continue;
      const key = monthKey(monthStart(when));
      totals.set(key, (totals.get(key) || 0) + (Number(p.amount) || 0));
    }

    if (totals.size === 0) {
      for (const d of deals) {
        if ((d.status || '').toLowerCase() !== 'won') continue;
        const when = new Date(d.workClosedAt || d.expectedCloseAt || d.createdAt || '');
        if (!Number.isFinite(when.getTime())) continue;
        const key = monthKey(monthStart(when));
        totals.set(key, (totals.get(key) || 0) + (Number(d.value) || 0));
      }
    }

    const data = monthStarts.map((month) => ({
      month: monthLabel(month),
      value: Math.round(totals.get(monthKey(month)) || 0)
    }));
    const total = data.reduce((sum, point) => sum + point.value, 0);
    const previous = shiftMonths(current, -1);
    const currentValue = totals.get(monthKey(current)) || 0;
    const previousValue = totals.get(monthKey(previous)) || 0;
    const currencyCode = paidPayments[0]?.currency || deals[0]?.currency || 'EUR';

    return {
      data,
      total,
      currentValue,
      previousValue,
      currencyCode
    };
  }, [deals, payments]);

  const dashboardRecentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const aTime = toTimeOrNull(a.updatedAt) ?? toTimeOrNull(a.createdAt) ?? 0;
        const bTime = toTimeOrNull(b.updatedAt) ?? toTimeOrNull(b.createdAt) ?? 0;
        return bTime - aTime;
      })
      .slice(0, 5)
      .map((task) => ({
        title: task.title || 'Untitled task',
        date: isoToDateInput(task.dueDate || task.updatedAt || task.createdAt) || 'No date',
        color:
          (task.status || '').toLowerCase() === 'done'
            ? 'bg-emerald-500'
            : (task.status || '').toLowerCase() === 'in_progress'
              ? 'bg-sky-500'
              : (task.status || '').toLowerCase() === 'blocked'
                ? 'bg-amber-500'
                : 'bg-violet-500'
      }));
  }, [tasks]);

  const dashboardProjects = useMemo(() => {
    return projects.slice(0, 6).map((project) => {
      const deal = dealById.get(project.dealId);
      const projectTasks = tasksByProjectId.get(project.id) || [];
      const done = projectTasks.filter((task) => (task.status || '').toLowerCase() === 'done').length;
      const progress = projectTasks.length > 0 ? Math.round((done / projectTasks.length) * 100) : 0;
      const status = (project.status || 'active').toLowerCase();
      return {
        name: deal?.title || project.name || 'Untitled project',
        tags: [deal?.workType, deal?.domain ? 'Domain' : '', project.code || 'General'].filter(Boolean).join(', '),
        status,
        budget: currency(project.budget || 0, project.currency || dashboardRevenue.currencyCode),
        progress,
        dueDate: isoToDateInput(project.targetEndDate || project.actualEndDate || project.updatedAt || project.createdAt) || 'TBD'
      };
    });
  }, [dashboardRevenue.currencyCode, dealById, projects, tasksByProjectId]);

  const dashboardKpis = useMemo(() => {
    const activeProjects = projects.filter((project) => {
      const status = (project.status || '').toLowerCase();
      return status !== 'completed' && status !== 'cancelled' && status !== 'archived';
    }).length;
    const pendingTasks = tasks.filter((task) => (task.status || '').toLowerCase() !== 'done').length;
    const revenueDelta = changePercent(dashboardRevenue.currentValue, dashboardRevenue.previousValue);
    const pendingDelta = pendingTasks - doneTasks;

    return [
      {
        title: 'Total Revenue',
        value: compactCurrency(dashboardRevenue.total, dashboardRevenue.currencyCode),
        change: `${revenueDelta >= 0 ? '+' : ''}${revenueDelta.toFixed(1)}% vs last month`,
        changeClass: revenueDelta >= 0 ? 'text-emerald-600' : 'text-rose-600',
        iconClass: 'bg-emerald-100 text-emerald-600'
      },
      {
        title: 'Active Projects',
        value: String(activeProjects),
        change: '+2 vs last month',
        changeClass: 'text-emerald-600',
        iconClass: 'bg-sky-100 text-sky-600'
      },
      {
        title: 'Pending Tasks',
        value: String(pendingTasks),
        change: `${pendingDelta > 0 ? '+' : ''}${pendingDelta} vs last month`,
        changeClass: pendingDelta <= 0 ? 'text-emerald-600' : 'text-rose-600',
        iconClass: 'bg-amber-100 text-amber-600'
      },
    ];
  }, [dashboardRevenue, doneTasks, projects, tasks]);

  const kindLabels: Record<CrudKind, { singular: string; plural: string }> = {
    organization: { singular: 'organization', plural: 'organizations' },
    contact: { singular: 'contact', plural: 'contacts' },
    deal: { singular: 'deal', plural: 'deals' },
    payment: { singular: 'payment', plural: 'payments' },
    project: { singular: 'project', plural: 'projects' },
    task: { singular: 'task', plural: 'tasks' },
    quotation: { singular: 'quotation', plural: 'quotations' },
    quotationItem: { singular: 'quotation item', plural: 'quotation items' },
    interaction: { singular: 'interaction', plural: 'interactions' },
    user: { singular: 'user', plural: 'users' }
  };

  function labelFor(kind: CrudKind, count: number) {
    const label = kindLabels[kind];
    if (count === 1) return label.singular;
    return label.plural;
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  function selectAll(ids: string[], enabled: boolean) {
    setSelectedIds(enabled ? ids : []);
  }

  function togglePaymentSelected(id: string) {
    setPaymentSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  function selectAllPayments(ids: string[], enabled: boolean) {
    setPaymentSelectedIds(enabled ? ids : []);
  }

  function openContextMenu(kind: CrudKind, item: any, x: number, y: number) {
    const menuWidth = 210;
    const menuHeight = 92;
    const maxX = typeof window !== 'undefined' ? window.innerWidth - menuWidth - 8 : x;
    const maxY = typeof window !== 'undefined' ? window.innerHeight - menuHeight - 8 : y;
    const clampedX = Math.max(8, Math.min(x, maxX));
    const clampedY = Math.max(8, Math.min(y, maxY));
    setContextMenu({ kind, item, x: clampedX, y: clampedY });
  }

  function onItemContextMenu(e: ReactMouseEvent, kind: CrudKind, item: any) {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(kind, item, e.clientX, e.clientY);
  }

  function onItemActionsClick(e: ReactMouseEvent, kind: CrudKind, item: any) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    openContextMenu(kind, item, rect.right, rect.bottom);
  }

  function startEdit(kind: CrudKind, item: any) {
    setNotice(null);
    setContextMenu(null);
    if (kind === 'deal') {
      setView('deals');
      openDealFocus(String(item?.id || ''));
      setDealFocusDraft({ ...item });
      setDealFocusMode('edit');
      return;
    }
    setEdit({ kind, draft: { ...item } });
  }

  function startNew(kind: CrudKind, seed?: Record<string, any>) {
    setNotice(null);
    setContextMenu(null);
    setEdit({ kind, draft: { ...(seed || {}) } });
  }

  function askDelete(kind: CrudKind, ids: string[]) {
    setNotice(null);
    setContextMenu(null);
    setConfirmDelete({
      kind,
      ids,
      label: labelFor(kind, ids.length)
    });
  }

  function openContactFocus(id: string) {
    const clean = (id || '').trim();
    if (!clean) return;
    setNotice(null);
    setContextMenu(null);
    setSelectedIds([]);
    setContactFocusId(clean);
  }

  function closeContactFocus() {
    setContactFocusId(null);
  }

  function openDealFocus(id: string) {
    const clean = (id || '').trim();
    if (!clean) return;
    setNotice(null);
    setContextMenu(null);
    setSelectedIds([]);
    setPaymentSelectedIds([]);
    setDealFocusId(clean);
    setDealFocusMode('view');
    const d = deals.find((x) => x.id === clean);
    if (d) setDealFocusDraft({ ...d });
  }

  function closeDealFocus() {
    setDealFocusId(null);
    setDealFocusMode('view');
    setDealFocusDraft(null);
    setPaymentSelectedIds([]);
  }

  function updateDealFocusDraft(patch: Record<string, any>) {
    setDealFocusDraft((prev) => {
      const base = prev || {};
      return { ...base, ...patch };
    });
  }

  async function saveDealFocusDraft() {
    if (!dealFocusDraft || crudBusy) return;
    setCrudBusy(true);
    setNotice(null);
    try {
      if (!String(dealFocusDraft.title || '').trim()) {
        throw new Error('title is required');
      }
      if (!String(dealFocusDraft.organizationId || '').trim()) {
        throw new Error('organizationId is required');
      }
      if (!String(dealFocusDraft.contactId || '').trim()) {
        throw new Error('contactId is required');
      }
      const saved = await createDeal(dealFocusDraft);
      await refresh();
      setDealFocusId(saved.id);
      setDealFocusMode('view');
      setNotice('Saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setNotice(msg);
    } finally {
      setCrudBusy(false);
    }
  }

  async function runDelete(kind: CrudKind, ids: string[]) {
    if (crudBusy) return;
    const clean = ids.map((id) => id.trim()).filter(Boolean);
    if (clean.length === 0) return;
    setCrudBusy(true);
    setNotice(null);
    try {
      switch (kind) {
        case 'organization':
          await deleteOrganizations(clean);
          break;
        case 'contact':
          await deleteContacts(clean);
          if (contactFocusId && clean.includes(contactFocusId)) {
            closeContactFocus();
          }
          break;
        case 'deal':
          await deleteDeals(clean);
          if (dealFocusId && clean.includes(dealFocusId)) {
            closeDealFocus();
          }
          break;
        case 'payment':
          await deletePayments(clean);
          setPaymentSelectedIds([]);
          break;
        case 'project':
          await deleteProjects(clean);
          break;
        case 'task':
          await deleteTasks(clean);
          break;
        case 'quotation':
          await deleteQuotations(clean);
          break;
        case 'quotationItem':
          await deleteQuotationItems(clean);
          break;
        case 'interaction':
          await deleteInteractions(clean);
          break;
        case 'user':
          await deleteUsers(clean);
          break;
        default:
          break;
      }
      setConfirmDelete(null);
      setSelectedIds([]);
      await refresh();
      setNotice(`${clean.length} ${labelFor(kind, clean.length)} deleted.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setNotice(msg);
    } finally {
      setCrudBusy(false);
    }
  }

  async function saveEdit() {
    if (!edit || crudBusy) return;
    setCrudBusy(true);
    setNotice(null);
    try {
      switch (edit.kind) {
        case 'organization':
          await createOrganization(edit.draft as Organization);
          break;
        case 'contact':
          await createContact(edit.draft as Contact);
          break;
        case 'deal':
          await createDeal(edit.draft as Deal);
          break;
        case 'payment':
          await createPayment(edit.draft as Payment);
          break;
        case 'project':
          await createProject(edit.draft as Project);
          break;
        case 'task':
          await createTask(edit.draft as Task);
          break;
        case 'quotation':
          await createQuotation(edit.draft as Quotation);
          break;
        case 'quotationItem':
          await createQuotationItem(edit.draft as QuotationItem);
          break;
        case 'interaction':
          await createInteraction(edit.draft as Interaction);
          break;
        case 'user':
          await createUser(edit.draft as any);
          break;
        default:
          break;
      }
      setEdit(null);
      await refresh();
      setNotice('Saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setNotice(msg);
    } finally {
      setCrudBusy(false);
    }
  }

  function updateEditDraft(patch: Record<string, any>) {
    setEdit((prev) => {
      if (!prev) return prev;
      return { ...prev, draft: { ...prev.draft, ...patch } };
    });
  }

  async function onCreateOrganization() {
    setNotice(null);
    const name = orgName.trim();
    if (!name) {
      setNotice('Organization name is required.');
      return;
    }
    try {
      const created = await createOrganization({
        name,
        website: orgWebsite.trim(),
        industry: orgIndustry.trim()
      });
      setOrgName('');
      setOrgWebsite('');
      setOrgIndustry('');
      setContactOrgId((prev) => prev || created.id);
      setDealOrgId((prev) => prev || created.id);
      await refresh();
      setNotice('Organization saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create organization';
      setNotice(msg);
    }
  }

  async function onCreateContact() {
    setNotice(null);
    const orgId = contactOrgId.trim();
    if (!orgId) {
      setNotice('Select an organization first.');
      return;
    }
    try {
      const created = await createContact({
        organizationId: orgId,
        firstName: contactFirstName.trim(),
        lastName: contactLastName.trim(),
        email: contactEmail.trim(),
        jobTitle: contactJobTitle.trim(),
        primaryContact: contactPrimary
      });
      setContactFirstName('');
      setContactLastName('');
      setContactEmail('');
      setContactJobTitle('');
      setContactPrimary(false);
      setDealContactId((prev) => prev || created.id);
      await refresh();
      setNotice('Contact saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create contact';
      setNotice(msg);
    }
  }

  async function onCreateDeal() {
    setNotice(null);
    const orgId = dealOrgId.trim();
    const contactId = dealContactId.trim();
    const title = dealTitle.trim();
    if (!orgId) {
      setNotice('Select an organization.');
      return;
    }
    if (!contactId) {
      setNotice('Select a contact.');
      return;
    }
    if (!title) {
      setNotice('Deal title is required.');
      return;
    }
    try {
      const created = await createDeal({
        organizationId: orgId,
        contactId,
        pipelineStageId: dealStageId,
        title,
        domain: dealDomain.trim(),
        domainAcquiredAt: dateInputToISO(dealDomainAcquiredAt),
        domainExpiresAt: dateInputToISO(dealDomainExpiresAt),
        domainCost: Number(dealDomainCost) || 0,
        deposit: Number(dealDeposit) || 0,
        costs: Number(dealCosts) || 0,
        taxes: Number(dealTaxes) || 0,
        netTotal: Number(dealNetTotal) || 0,
        shareGil: Number(dealShareGil) || 0,
        shareRic: Number(dealShareRic) || 0,
        workType: dealWorkType.trim(),
        workClosedAt: dateInputToISO(dealWorkClosedAt),
        value: Number(dealValue) || 0,
        currency: dealCurrency.trim() || 'EUR',
        probability: Number(dealProbability) || 0,
        status: 'open'
      });
      setDealTitle('');
      setDealValue(0);
      setDealProbability(35);
      setDealDomain('');
      setDealDomainAcquiredAt('');
      setDealDomainExpiresAt('');
      setDealDomainCost(0);
      setDealDeposit(0);
      setDealCosts(0);
      setDealTaxes(0);
      setDealNetTotal(0);
      setDealShareGil(0);
      setDealShareRic(0);
      setDealWorkType('');
      setDealWorkClosedAt('');
      setProjectDealId((prev) => prev || created.id);
      await refresh();
      setNotice('Deal saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create deal';
      setNotice(msg);
    }
  }

  async function onUpdateDealStage(deal: Deal, stageId: string) {
    setNotice(null);
    try {
      const saved = await createDeal({
        ...deal,
        pipelineStageId: stageId
      });
      setDeals((prev) => {
        const idx = prev.findIndex((d) => d.id === saved.id);
        if (idx === -1) return [saved, ...prev];
        const next = prev.slice();
        next[idx] = saved;
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update deal';
      setNotice(msg);
    }
  }

  async function onUpdateTaskStatus(task: Task, status: string) {
    setNotice(null);
    try {
      const saved = await createTask({
        ...task,
        status
      });
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === saved.id);
        if (idx === -1) return [saved, ...prev];
        const next = prev.slice();
        next[idx] = saved;
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update task';
      setNotice(msg);
    }
  }

  async function onCreateProjectFromDeal(deal: Deal) {
    setNotice(null);
    try {
      const created = await createProject({
        dealId: deal.id,
        status: 'active'
      });
      setProjects((prev) => {
        const idx = prev.findIndex((p) => p.id === created.id);
        if (idx === -1) return [created, ...prev];
        const next = prev.slice();
        next[idx] = created;
        return next;
      });
      setTasksProjectFilterId((prev) => (prev ? prev : created.id));
      setNotice('Project created.');
      return created;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create project';
      setNotice(msg);
      return null;
    }
  }

  async function onCreateProject() {
    setNotice(null);
    const dealId = projectDealId.trim();
    const name = projectName.trim();
    if (!dealId) {
      setNotice('Select a deal.');
      return;
    }
    if (!name) {
      setNotice('Project name is required.');
      return;
    }
    try {
      const created = await createProject({
        dealId,
        name,
        code: projectCode.trim(),
        budget: Number(projectBudget) || 0,
        currency: projectCurrency.trim() || 'EUR',
        status: 'active'
      });
      setProjectName('');
      setProjectCode('');
      setProjectBudget(0);
      setTaskProjectId((prev) => prev || created.id);
      await refresh();
      setNotice('Project saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create project';
      setNotice(msg);
    }
  }

  async function onCreateTask() {
    setNotice(null);
    const projectId = taskProjectId.trim();
    const title = taskTitle.trim();
    if (!projectId) {
      setNotice('Select a project.');
      return;
    }
    if (!title) {
      setNotice('Task title is required.');
      return;
    }
    try {
      await createTask({
        projectId,
        title,
        status: (taskStatus || 'todo').trim(),
        priority: Number(taskPriority) || 0,
        estimatedHours: Number(taskEstimatedHours) || 0
      });
      setTaskTitle('');
      setTaskStatus('todo');
      setTaskPriority(1);
      setTaskEstimatedHours(1);
      await refresh();
      setNotice('Task saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create task';
      setNotice(msg);
    }
  }

  async function onCreateQuotation() {
    setNotice(null);
    const dealId = quoteDealId.trim();
    const title = quoteTitle.trim();
    if (!dealId) {
      setNotice('Select a deal.');
      return;
    }
    if (!title) {
      setNotice('Quotation title is required.');
      return;
    }
    try {
      const validUntil = quoteValidUntil.trim();
      const created = await createQuotation({
        dealId,
        title,
        currency: quoteCurrency.trim() || 'EUR',
        taxRate: Number(quoteTaxRate) || 0,
        discountAmount: Number(quoteDiscountAmount) || 0,
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        status: 'draft'
      });
      setQuoteTitle('');
      setQuoteDiscountAmount(0);
      setSelectedQuotationId(created.id);
      await refresh();
      setNotice('Quotation saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create quotation';
      setNotice(msg);
    }
  }

  async function onCreateQuotationItem() {
    setNotice(null);
    const quotationId = selectedQuotationId.trim();
    const name = itemName.trim();
    if (!quotationId) {
      setNotice('Select a quotation.');
      return;
    }
    if (!name) {
      setNotice('Item name is required.');
      return;
    }
    try {
      await createQuotationItem({
        quotationId,
        name,
        quantity: Number(itemQty) || 1,
        unitPrice: Number(itemUnitPrice) || 0,
        unitType: itemUnitType.trim()
      });
      setItemName('');
      setItemQty(1);
      setItemUnitPrice(0);
      await refresh();
      setNotice('Item saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create item';
      setNotice(msg);
    }
  }

  async function onCreateDealInteraction(deal: Deal) {
    setNotice(null);
    const subject = dealInteractionSubject.trim();
    const body = dealInteractionBody.trim();
    if (!body && !subject) {
      setNotice('Add a subject or body.');
      return;
    }
    try {
      await createInteraction({
        interactionType: dealInteractionType.trim(),
        subject,
        body,
        organizationId: deal.organizationId,
        contactId: deal.contactId,
        dealId: deal.id,
        occurredAt: new Date().toISOString()
      });
      setDealInteractionSubject('');
      setDealInteractionBody('');
      await refresh();
      setNotice('Interaction saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create interaction';
      setNotice(msg);
    }
  }

  async function onCreateContactInteraction(contact: Contact) {
    setNotice(null);
    const subject = contactInteractionSubject.trim();
    const body = contactInteractionBody.trim();
    if (!body && !subject) {
      setNotice('Add a subject or body.');
      return;
    }
    try {
      await createInteraction({
        interactionType: contactInteractionType.trim(),
        subject,
        body,
        organizationId: contact.organizationId,
        contactId: contact.id,
        dealId: contactInteractionDealId.trim(),
        occurredAt: new Date().toISOString()
      });
      setContactInteractionSubject('');
      setContactInteractionBody('');
      await refresh();
      setNotice('Interaction saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create interaction';
      setNotice(msg);
    }
  }

  function onDealKanbanDragStart(e: ReactDragEvent, dealId: string) {
    try {
      e.dataTransfer.setData('text/plain', dealId);
      e.dataTransfer.effectAllowed = 'move';
    } catch {
      // ignore
    }
  }

  function onDealKanbanDragOver(e: ReactDragEvent, stageId: string) {
    e.preventDefault();
    setKanbanDragOverStageId(stageId);
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch {
      // ignore
    }
  }

  function onDealKanbanDrop(e: ReactDragEvent, stageId: string) {
    e.preventDefault();
    setKanbanDragOverStageId(null);
    const id = String(e.dataTransfer?.getData('text/plain') || '').trim();
    if (!id) return;
    const d = dealById.get(id);
    if (!d) return;
    // Don't allow drag-to-blank; every deal in Kanban must have a stage.
    if (stageId === '') return;
    if ((d.pipelineStageId || '') === stageId) return;
    void onUpdateDealStage(d, stageId);
  }

  function onTaskKanbanDragStart(e: ReactDragEvent, taskId: string) {
    try {
      e.dataTransfer.setData('text/plain', taskId);
      e.dataTransfer.effectAllowed = 'move';
    } catch {
      // ignore
    }
  }

  function onTaskKanbanDragOver(e: ReactDragEvent, status: string) {
    e.preventDefault();
    setTaskKanbanDragOverStatus(status);
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch {
      // ignore
    }
  }

  function onTaskKanbanDrop(e: ReactDragEvent, status: string) {
    e.preventDefault();
    setTaskKanbanDragOverStatus(null);
    const id = String(e.dataTransfer?.getData('text/plain') || '').trim();
    if (!id) return;
    const t = taskById.get(id);
    if (!t) return;
    if ((t.status || '') === status) return;
    void onUpdateTaskStatus(t, status);
  }

  async function saveSettings() {
    if (!settings) return;
    setSettingsNotice(null);
    try {
      await updateSettings(settings);
      setSettingsNotice('Settings saved.');
      await loadSettings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Settings update failed';
      setSettingsNotice(msg);
    }
  }

  async function onRunAgent() {
    const message = agentInput.trim();
    if (!message || agentBusy) return;

    setAgentBusy(true);
    setNotice(null);
    setAgentInput('');
    setAgentMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text: message
      }
    ]);

    try {
      const response = await runAgentCommand(message);
      const details =
        response.results?.map((result: AgentActionResult) => `${result.status.toUpperCase()} · ${result.tool}: ${result.message}`) || [];

      setAgentMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: response.reply || 'No reply',
          details
        }
      ]);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Agent command failed';
      setAgentMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: msg
        }
      ]);
    } finally {
      setAgentBusy(false);
    }
  }

  if (!me) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-sand-50 text-stoneink">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-sand-200/50 blur-3xl" />
          <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-orange-200/35 blur-3xl" />
          <div className="absolute bottom-[-120px] left-1/3 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full items-center justify-center px-4 py-10">
          <div className="panel w-full max-w-md animate-enter p-6">
            <h1 className="text-4xl text-sand-900">WeMadeIt</h1>
            <p className="mt-2 text-sm text-sand-700">Sign in to your workspace.</p>

            {authError && (
              <div className="mt-4 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">{authError}</div>
            )}

            <div className="mt-6 grid gap-4">
              <label>
                <span className="field-label">Username</span>
                <input
                  className="field-input"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                />
              </label>
              <label>
                <span className="field-label">Password</span>
                <input
                  className="field-input"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void onLogin();
                    }
                  }}
                  placeholder="admin"
                  autoComplete="current-password"
                />
              </label>
              <button
                onClick={() => void onLogin()}
                disabled={authBusy}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {authBusy ? 'Signing in...' : 'Sign in'}
              </button>

              <div className="rounded-xl border border-sand-200 bg-white/70 p-3 text-xs text-sand-700">
                Default dev login: <span className="font-semibold">admin</span> / <span className="font-semibold">admin</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[#f5f6fa] text-slate-900 [font-family:'SF_Pro_Text','Avenir_Next','Segoe_UI',sans-serif]">
      <div className="mx-auto grid h-full w-full max-w-none grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[240px_1fr] lg:overflow-hidden lg:px-8">
        <aside className="flex flex-col rounded-3xl bg-gradient-to-b from-[#0f1744] via-[#162663] to-[#101738] p-5 text-white shadow-[0_24px_55px_-24px_rgba(2,6,23,0.9)] lg:h-full lg:min-h-0">
          <div className="border-b border-white/10 pb-4">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-100/90">
              Mobile preview
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-sm font-semibold text-white">
                N
              </div>
              <div>
                <p className="text-base font-semibold text-white">Nexus CRM</p>
                <p className="text-xs text-indigo-200/80">Powered by WeMadeIt</p>
              </div>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {views.map((v) => (
              <button
                key={v}
                onClick={() => {
                  setNotice(null);
                  setSettingsNotice(null);
                  setView(v);
                }}
                className={[
                  'group flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-sm font-medium transition',
                  view === v
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_12px_30px_-16px_rgba(99,102,241,0.95)]'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                ].join(' ')}
              >
                <span className={['inline-flex h-2.5 w-2.5 rounded-full', view === v ? 'bg-white' : 'bg-slate-400 group-hover:bg-white'].join(' ')} />
                <span>{viewLabels[v]}</span>
              </button>
            ))}
          </nav>

          <div className="mt-6 grid gap-2 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-indigo-100/90">
            <div className="flex items-center justify-between">
              <span>Orgs</span>
              <strong>{organizations.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Contacts</span>
              <strong>{contacts.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Deals (open)</span>
              <strong>{openDeals}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Projects</span>
              <strong>{projects.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Tasks (done)</span>
              <strong>
                {doneTasks}/{tasks.length}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Quotes</span>
              <strong>{quotations.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Interactions</span>
              <strong>{interactions.length}</strong>
            </div>
          </div>

          <button
            onClick={() => void refresh()}
            className="mt-4 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-50 transition hover:bg-white/20"
          >
            Refresh
          </button>

          {notice && <div className="mt-4 rounded-xl border border-indigo-300/25 bg-indigo-200/10 p-3 text-sm text-indigo-100">{notice}</div>}

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white">
                {(me.name || 'U')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((x) => x[0]?.toUpperCase())
                  .join('')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{me.name}</p>
                <p className="truncate text-xs text-indigo-200/80">{me.role}</p>
              </div>
            </div>
            <button
              onClick={() => void onLogout()}
              className="mt-3 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-50 transition hover:bg-white/20"
            >
              Sign out
            </button>
          </div>
        </aside>

        <section className="flex flex-col gap-6 lg:h-full lg:min-h-0 lg:overflow-y-auto">
          {view === 'dashboard' &&
            (() => {
              const chartWidth = 720;
              const chartHeight = 320;
              const padding = { top: 22, right: 18, bottom: 44, left: 52 };
              const maxValue = Math.max(...dashboardRevenue.data.map((d) => d.value), 0);
              const maxY = Math.max(4000, Math.ceil(maxValue / 1000) * 1000);
              const tickStep = Math.max(1000, Math.ceil(maxY / 4 / 500) * 500);
              const yTicks: number[] = [];
              for (let tick = 0; tick <= maxY; tick += tickStep) yTicks.push(tick);
              const chartInnerWidth = chartWidth - padding.left - padding.right;
              const chartInnerHeight = chartHeight - padding.top - padding.bottom;
              const denominator = Math.max(1, dashboardRevenue.data.length - 1);
              const points = dashboardRevenue.data.map((item, idx) => {
                const x = padding.left + (idx / denominator) * chartInnerWidth;
                const y = padding.top + ((maxY - item.value) / maxY) * chartInnerHeight;
                return { x, y };
              });
              const linePath = buildSmoothPath(points);
              const baseline = chartHeight - padding.bottom;
              const areaPath = points.length > 0 ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z` : '';
              const markerIndex = dashboardRevenue.data.findIndex((entry) => entry.month === 'Feb');
              const safeMarkerIndex = markerIndex >= 0 ? markerIndex : Math.min(1, Math.max(0, points.length - 1));
              const markerPoint = points[safeMarkerIndex];
              const markerData = dashboardRevenue.data[safeMarkerIndex];
              const tooltipX = markerPoint ? Math.min(chartWidth - 104, Math.max(14, markerPoint.x - 48)) : 14;
              const tooltipY = markerPoint ? Math.max(8, markerPoint.y - 76) : 14;

              return (
                <div className="flex min-h-0 flex-1 flex-col gap-6">
                  <header>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Dashboard Overview</h1>
                    <p className="mt-2 text-sm text-slate-500 sm:text-base">Welcome back, here&apos;s what&apos;s happening today.</p>
                  </header>

                  <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {dashboardKpis.map((stat) => (
                      <article key={stat.title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.3)]">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{stat.value}</p>
                            <p className={`mt-2 text-xs font-medium ${stat.changeClass}`}>{stat.change}</p>
                          </div>
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-semibold ${stat.iconClass}`}>
                            {stat.title[0]}
                          </div>
                        </div>
                      </article>
                    ))}
                  </section>

                  <section className="grid gap-6 xl:grid-cols-12">
                    <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.3)] xl:col-span-8">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-slate-900">Revenue Flow</h2>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          Last 6 months
                        </button>
                      </div>

                      <div className="mt-5 overflow-x-auto">
                        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-[290px] min-w-[620px] w-full" role="img" aria-label="Revenue flow chart">
                          <defs>
                            <linearGradient id="live-revenue-area" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6a5cff" stopOpacity="0.45" />
                              <stop offset="100%" stopColor="#6a5cff" stopOpacity="0.04" />
                            </linearGradient>
                            <linearGradient id="live-revenue-line" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#8b5cf6" />
                              <stop offset="100%" stopColor="#4f46e5" />
                            </linearGradient>
                          </defs>

                          {yTicks.map((tick) => {
                            const y = padding.top + ((maxY - tick) / maxY) * chartInnerHeight;
                            return <line key={`grid-${tick}`} x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#e2e8f0" strokeOpacity="0.6" />;
                          })}

                          {yTicks.map((tick) => {
                            const y = padding.top + ((maxY - tick) / maxY) * chartInnerHeight;
                            return (
                              <text key={`y-${tick}`} x={padding.left - 12} y={y + 4} textAnchor="end" fill="#64748b" fontSize="11" fontWeight={500}>
                                {tick.toLocaleString()}
                              </text>
                            );
                          })}

                          {areaPath && <path d={areaPath} fill="url(#live-revenue-area)" />}
                          {linePath && <path d={linePath} fill="none" stroke="url(#live-revenue-line)" strokeWidth={3} />}

                          {markerPoint && (
                            <>
                              <circle cx={markerPoint.x} cy={markerPoint.y} r={5.8} fill="#4f46e5" />
                              <circle cx={markerPoint.x} cy={markerPoint.y} r={10} fill="none" stroke="#4f46e5" strokeOpacity="0.2" strokeWidth={6} />
                              <g transform={`translate(${tooltipX} ${tooltipY})`}>
                                <rect width="96" height="54" rx="10" fill="#10193d" />
                                <text x="12" y="21" fill="#a5b4fc" fontSize="11" fontWeight={600}>
                                  {markerData?.month || ''}
                                </text>
                                <text x="12" y="39" fill="#ffffff" fontSize="15" fontWeight={700}>
                                  {(markerData?.value || 0).toLocaleString()}
                                </text>
                              </g>
                            </>
                          )}

                          {dashboardRevenue.data.map((item, idx) => {
                            const x = padding.left + (idx / denominator) * chartInnerWidth;
                            return (
                              <text key={`x-${item.month}-${idx}`} x={x} y={chartHeight - 16} textAnchor="middle" fill="#64748b" fontSize="11.5" fontWeight={500}>
                                {item.month}
                              </text>
                            );
                          })}
                        </svg>
                      </div>
                    </article>

                    <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.3)] xl:col-span-4">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-slate-900">Recent Tasks</h2>
                        <button type="button" className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-700">
                          View All
                        </button>
                      </div>

                      <ul className="mt-5 space-y-4">
                        {dashboardRecentTasks.map((task) => (
                          <li key={`${task.title}-${task.date}`} className="rounded-xl border border-slate-100 bg-slate-50/65 px-3.5 py-3">
                            <div className="flex items-start gap-3">
                              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${task.color}`} />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800">{task.title}</p>
                                <p className="mt-1 text-xs text-slate-500">{task.date}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                        {dashboardRecentTasks.length === 0 && <li className="text-sm text-slate-500">No tasks yet.</li>}
                      </ul>
                    </article>
                  </section>

                  <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.3)]">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">Active Projects</h2>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                        aria-label="Open project actions"
                      >
                        ...
                      </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-x-auto">
                      <table className="w-full min-w-[760px] table-fixed border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                            <th className="pb-3 pr-4 font-semibold">Project Name</th>
                            <th className="pb-3 pr-4 font-semibold">Status</th>
                            <th className="pb-3 pr-4 font-semibold">Budget</th>
                            <th className="pb-3 pr-4 font-semibold">Progress</th>
                            <th className="pb-3 text-right font-semibold">Due Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dashboardProjects.map((project) => (
                            <tr key={project.name} className="align-middle">
                              <td className="py-4 pr-4">
                                <p className="text-sm font-semibold text-slate-900">{project.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{project.tags || 'General'}</p>
                              </td>
                              <td className="py-4 pr-4">
                                <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-700">
                                  {project.status}
                                </span>
                              </td>
                              <td className="py-4 pr-4 text-sm font-medium text-slate-700">{project.budget}</td>
                              <td className="py-4 pr-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-2 w-full max-w-[190px] overflow-hidden rounded-full bg-indigo-100">
                                    <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${project.progress}%` }} />
                                  </div>
                                  <span className="text-xs font-semibold text-slate-600">{project.progress}%</span>
                                </div>
                              </td>
                              <td className="py-4 text-right text-sm font-medium text-slate-600">{project.dueDate}</td>
                            </tr>
                          ))}
                          {dashboardProjects.length === 0 && (
                            <tr>
                              <td className="py-6 text-sm text-slate-500" colSpan={5}>
                                No projects yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              );
            })()}

          {view === 'organizations' && (
            <div className="panel animate-enter flex flex-1 min-h-0 flex-col overflow-hidden p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-3xl text-sand-900">Organizations</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startNew('organization', { name: '', industry: '', website: '' })}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700"
                    disabled={crudBusy}
                  >
                    New organization
                  </button>
                  {organizations.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-sand-700">
                      <input
                        type="checkbox"
                        checked={organizations.length > 0 && organizations.every((o) => selectedSet.has(o.id))}
                        onChange={(e) => selectAll(organizations.map((o) => o.id), e.target.checked)}
                      />
                      Select all
                    </label>
                  )}
                </div>
              </div>

              {selectedIds.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-700">
                  <div>
                    Selected: <span className="font-semibold">{selectedIds.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => askDelete('organization', selectedIds)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100"
                      disabled={crudBusy}
                    >
                      Delete selected
                    </button>
                    <button
                      onClick={() => setSelectedIds([])}
                      className="rounded-lg border border-sand-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                      disabled={crudBusy}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
                <div className="grid gap-3">
                  {organizations.length === 0 && <div className="text-sm text-sand-700">No organizations yet.</div>}
                  {organizations.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-xl border border-sand-200 bg-white p-4"
                      onContextMenu={(e) => onItemContextMenu(e, 'organization', o)}
                    >
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={selectedSet.has(o.id)} onChange={() => toggleSelected(o.id)} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-semibold text-stone-900">{o.name}</div>
                          <div className="mt-1 text-sm text-sand-700">{o.industry || 'No industry set.'}</div>
                          {o.website && (
                            <div className="mt-2 text-sm text-sand-700">
                              <a
                                className="underline decoration-sand-300 underline-offset-4 hover:text-sand-900"
                                href={o.website}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {o.website}
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="pill">ORG</span>
                          <button
                            type="button"
                            onClick={(e) => onItemActionsClick(e, 'organization', o)}
                            className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                          >
                            ...
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === 'contacts' &&
            contactFocusId &&
            (() => {
              const c = focusedContact;
              if (!c) {
	                      return (
	                        <div className="panel animate-enter flex flex-1 min-h-0 flex-col overflow-hidden p-6">
	                          <div className="flex flex-wrap items-center justify-between gap-3">
	                            <button
	                              type="button"
                        onClick={() => closeContactFocus()}
                        className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                      >
                        Back to contacts
                      </button>
                    </div>
                    <div className="mt-6 text-sm text-sand-700">Contact not found (it may have been deleted).</div>
                  </div>
                );
              }

              const org = orgById.get(c.organizationId);
              const dealsForContact = deals.filter((d) => d.contactId === c.id);
              const contactInteractions = interactions.filter((i) => i.contactId === c.id);

              return (
                <div className="grid flex-1 min-h-0 gap-6 overflow-hidden xl:grid-cols-[420px_1fr]">
                  <div className="panel animate-enter flex min-h-0 flex-col overflow-hidden p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => closeContactFocus()}
                        className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                      >
                        Back to contacts
                      </button>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit('contact', c)}
                          className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                          disabled={crudBusy}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => askDelete('contact', [c.id])}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100"
                          disabled={crudBusy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Contact</div>
                      <div className="mt-2 text-3xl font-semibold text-sand-900">
                        {c.firstName} {c.lastName}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {c.primaryContact && <span className="pill">PRIMARY</span>}
                        {c.jobTitle ? <span className="pill">{c.jobTitle}</span> : null}
                        <span className="pill">CONTACT</span>
                      </div>
                      <div className="mt-3 text-sm text-sand-700">{org?.name || 'Unknown org'}</div>
                      {(c.email || c.phone || c.mobile || c.linkedinUrl) && (
                        <div className="mt-4 grid gap-1 text-sm text-sand-700">
                          {c.email ? <div>Email: {c.email}</div> : null}
                          {c.phone ? <div>Phone: {c.phone}</div> : null}
                          {c.mobile ? <div>Mobile: {c.mobile}</div> : null}
                          {c.linkedinUrl ? (
                            <div>
                              LinkedIn:{' '}
                              <a
                                className="underline decoration-sand-300 underline-offset-4 hover:text-sand-900"
                                href={c.linkedinUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {c.linkedinUrl}
                              </a>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
                      {c.notes && (
                        <div className="rounded-xl border border-sand-200 bg-white p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Notes</div>
                          <div className="mt-2 whitespace-pre-wrap text-sm text-sand-700">{c.notes}</div>
                        </div>
                      )}

                      {dealsForContact.length > 0 && (
                        <div className={['rounded-xl border border-sand-200 bg-white p-4', c.notes ? 'mt-6' : ''].join(' ')}>
                          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Deals</div>
                          <div className="mt-3 grid gap-2">
                            {dealsForContact.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  setView('deals');
                                  openDealFocus(d.id);
                                }}
                                className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-left text-sm text-stone-900 transition hover:bg-sand-50"
                              >
                                <div className="font-semibold">{d.title}</div>
                                <div className="mt-1 text-xs text-sand-700">
                                  {currency(d.value, d.currency)} · {d.status}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className={['border-t border-sand-200 pt-6', c.notes || dealsForContact.length > 0 ? 'mt-6' : ''].join(' ')}>
                        <h3 className="text-2xl font-semibold text-sand-900">Add Interaction</h3>
                        <div className="mt-4 grid gap-4">
                          <label>
                            <span className="field-label">Type</span>
                            <select
                              className="field-input"
                              value={contactInteractionType}
                              onChange={(e) => setContactInteractionType(e.target.value)}
                            >
                              <option value="note">note</option>
                              <option value="call">call</option>
                              <option value="email">email</option>
                              <option value="meeting">meeting</option>
                            </select>
                          </label>
                          <label>
                            <span className="field-label">Attach to deal (optional)</span>
                            <select
                              className="field-input"
                              value={contactInteractionDealId}
                              onChange={(e) => setContactInteractionDealId(e.target.value)}
                            >
                              <option value="">None</option>
                              {dealsForContact.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span className="field-label">Subject</span>
                            <input
                              className="field-input"
                              value={contactInteractionSubject}
                              onChange={(e) => setContactInteractionSubject(e.target.value)}
                              placeholder="Follow up"
                            />
                          </label>
                          <label>
                            <span className="field-label">Body</span>
                            <textarea
                              className="field-input"
                              value={contactInteractionBody}
                              onChange={(e) => setContactInteractionBody(e.target.value)}
                              placeholder="Notes, summary, next steps..."
                              rows={6}
                            />
                          </label>
                          <button
                            onClick={() => void onCreateContactInteraction(c)}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="panel animate-enter flex min-h-0 flex-col overflow-hidden p-6" style={{ animationDelay: '60ms' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-3xl text-sand-900">Interactions</h2>
                      <div className="pill">{contactInteractions.length}</div>
                    </div>

                    <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="grid gap-3">
                        {contactInteractions.length === 0 && (
                          <div className="text-sm text-sand-700">No interactions yet for this contact.</div>
                        )}
                        {contactInteractions.map((i) => {
                          const deal = dealById.get(i.dealId);
                          const when = i.occurredAt ? new Date(i.occurredAt).toLocaleString() : '';
                          return (
                            <div
                              key={i.id}
                              className="rounded-2xl border border-sand-200 bg-white p-5"
                              onContextMenu={(e) => onItemContextMenu(e, 'interaction', i)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-lg font-semibold text-stone-900">{i.subject || '(No subject)'}</div>
                                  <div className="mt-1 text-sm text-sand-700">{deal ? `Deal: ${deal.title}` : 'Contact-only'}</div>
                                </div>
                                <div className="flex flex-wrap items-start gap-2">
                                  <span className="pill">{i.interactionType}</span>
                                  {when && <span className="pill">{when}</span>}
                                  <button
                                    type="button"
                                    onClick={(e) => onItemActionsClick(e, 'interaction', i)}
                                    className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                  >
                                    ...
                                  </button>
                                </div>
                              </div>
                              {i.body && <div className="mt-3 whitespace-pre-wrap text-sm text-stone-900">{i.body}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          {view === 'contacts' && !contactFocusId && (
            <div className="panel animate-enter flex flex-1 min-h-0 flex-col overflow-hidden p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-3xl text-sand-900">Contacts</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      startNew('contact', {
                        organizationId: (organizations[0]?.id || '').trim(),
                        primaryContact: false
                      })
                    }
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={crudBusy || organizations.length === 0}
                    title={organizations.length === 0 ? 'Create an organization first' : 'Create a contact'}
                  >
                    New contact
                  </button>
                  {contacts.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-sand-700">
                      <input
                        type="checkbox"
                        checked={contacts.length > 0 && contacts.every((c) => selectedSet.has(c.id))}
                        onChange={(e) => selectAll(contacts.map((c) => c.id), e.target.checked)}
                      />
                      Select all
                    </label>
                  )}
                </div>
              </div>

              {selectedIds.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-700">
                  <div>
                    Selected: <span className="font-semibold">{selectedIds.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => askDelete('contact', selectedIds)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100"
                      disabled={crudBusy}
                    >
                      Delete selected
                    </button>
                    <button
                      onClick={() => setSelectedIds([])}
                      className="rounded-lg border border-sand-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                      disabled={crudBusy}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
                <div className="grid gap-3">
                  {contacts.length === 0 && <div className="text-sm text-sand-700">No contacts yet.</div>}
                  {contacts.map((c) => {
                    const org = orgById.get(c.organizationId);
                    return (
                      <div
                        key={c.id}
                        className="cursor-pointer rounded-xl border border-sand-200 bg-white p-4 transition hover:bg-sand-50"
                        onClick={() => openContactFocus(c.id)}
                        onContextMenu={(e) => onItemContextMenu(e, 'contact', c)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedSet.has(c.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelected(c.id)}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-lg font-semibold text-stone-900">
                              {c.firstName} {c.lastName}
                            </div>
                            <div className="mt-1 text-sm text-sand-700">{org?.name || 'Unknown org'}</div>
                            {(c.jobTitle || c.email) && (
                              <div className="mt-2 text-sm text-sand-700">
                                {c.jobTitle ? `${c.jobTitle}` : ''}
                                {c.jobTitle && c.email ? ' · ' : ''}
                                {c.email || ''}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-start gap-2">
                            {c.primaryContact && <span className="pill">PRIMARY</span>}
                            <span className="pill">CONTACT</span>
                            <button
                              type="button"
                              onClick={(e) => onItemActionsClick(e, 'contact', c)}
                              className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                            >
                              ...
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {view === 'deals' && (
            <>
              {dealFocusId
                ? (() => {
                    const d = focusedDeal;
                    if (!d) {
	                      return (
	                        <div className="panel animate-enter flex flex-1 min-h-0 flex-col overflow-hidden p-6">
	                          <div className="flex flex-wrap items-center justify-between gap-3">
	                            <button
	                              type="button"
                              onClick={() => closeDealFocus()}
                              className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                            >
                              Back
                            </button>
                          </div>
                          <div className="mt-6 text-sm text-sand-700">Deal not found (it may have been deleted).</div>
                        </div>
                      );
                    }

                    const org = orgById.get(d.organizationId);
                    const contact = contactById.get(d.contactId);
                    const stage = stageById.get(d.pipelineStageId);
                    const draft = dealFocusDraft || d;
                    const dealPayments = paymentsByDealId.get(d.id) || [];
                    const dealInteractions = interactions.filter((i) => i.dealId === d.id);
                    const contactInteractions = interactions.filter((i) => i.contactId === d.contactId);
                    const paidPayments = dealPayments.filter((p) => p.status === 'paid');
                    const plannedPayments = dealPayments.filter((p) => p.status === 'planned');
                    const totalContract = (d.value || 0) + (d.taxes || 0);
                    const paidTotal = paidPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                    const dueTotal = totalContract - paidTotal;
                    const gilReceived = paidPayments.reduce((sum, p) => sum + (Number(p.gilAmount) || 0), 0);
                    const ricReceived = paidPayments.reduce((sum, p) => sum + (Number(p.ricAmount) || 0), 0);
                    const gilDue = (d.shareGil || 0) - gilReceived;
                    const ricDue = (d.shareRic || 0) - ricReceived;
                    const plannedTotal = plannedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                    const dueLabel = dueTotal >= 0 ? 'Due' : 'Overpaid';
                    const dealProject = projects.find((p) => p.dealId === d.id) || null;
                    const dealProjectTasks = dealProject ? tasks.filter((t) => t.projectId === dealProject.id) : [];
                    const dealProjectDoneTasks = dealProjectTasks.filter((t) => t.status === 'done').length;

                    return (
                      <div className="panel animate-enter flex flex-1 min-h-0 flex-col overflow-hidden p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => closeDealFocus()}
                              className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                            >
                              Back to deals
                            </button>
                            <div className="flex flex-wrap gap-2">
                              {dealFocusMode === 'edit' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDealFocusMode('view');
                                      setDealFocusDraft({ ...d });
                                    }}
                                    className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                    disabled={crudBusy}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void saveDealFocusDraft()}
                                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700"
                                    disabled={crudBusy}
                                  >
                                    Save
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDealFocusDraft({ ...d });
                                      setDealFocusMode('edit');
                                    }}
                                    className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => askDelete('deal', [d.id])}
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="mt-5">
                            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Deal</div>
                            <div className="mt-2 text-3xl font-semibold text-sand-900">{d.title}</div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="pill">{d.status}</span>
                              {stage && <span className="pill">{stage.name}</span>}
                              <span className="pill">{currency(d.value, d.currency)}</span>
                              {d.netTotal ? <span className="pill">Net {currency(d.netTotal, d.currency)}</span> : null}
                              {d.domain ? <span className="pill">{d.domain}</span> : null}
                            </div>
                            <div className="mt-3 text-sm text-sand-700">
                              {(org?.name || 'Unknown org') + (contact ? ` · ${contact.firstName} ${contact.lastName}` : '')}
                            </div>
                          </div>

                          <div className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
                            {dealFocusMode === 'edit' ? (
                              <div className="grid gap-4 md:grid-cols-2">
                              <label className="md:col-span-2">
                                <span className="field-label">Title</span>
                                <input className="field-input" value={draft.title || ''} onChange={(e) => updateDealFocusDraft({ title: e.target.value })} />
                              </label>
                              <label>
                                <span className="field-label">Organization</span>
                                <select
                                  className="field-input"
                                  value={draft.organizationId || ''}
                                  onChange={(e) => updateDealFocusDraft({ organizationId: e.target.value, contactId: '' })}
                                >
                                  <option value="">Select...</option>
                                  {organizations.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span className="field-label">Contact</span>
                                <select
                                  className="field-input"
                                  value={draft.contactId || ''}
                                  onChange={(e) => updateDealFocusDraft({ contactId: e.target.value })}
                                >
                                  <option value="">Select...</option>
                                  {contacts
                                    .filter((c) => !draft.organizationId || c.organizationId === draft.organizationId)
                                    .map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.firstName} {c.lastName}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <label>
                                <span className="field-label">Stage</span>
                                <select
                                  className="field-input"
                                  value={draft.pipelineStageId || ''}
                                  onChange={(e) => updateDealFocusDraft({ pipelineStageId: e.target.value })}
                                >
                                  <option value="">None</option>
                                  {pipelineStages.map((st) => (
                                    <option key={st.id} value={st.id}>
                                      {st.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span className="field-label">Status</span>
                                <select className="field-input" value={draft.status || 'open'} onChange={(e) => updateDealFocusDraft({ status: e.target.value })}>
                                  <option value="open">open</option>
                                  <option value="won">won</option>
                                  <option value="lost">lost</option>
                                </select>
                              </label>
                              <label>
                                <span className="field-label">Work Type</span>
                                <input className="field-input" value={draft.workType || ''} onChange={(e) => updateDealFocusDraft({ workType: e.target.value })} />
                              </label>
                              <label>
                                <span className="field-label">Work Closed</span>
                                <input
                                  className="field-input"
                                  type="date"
                                  value={isoToDateInput(draft.workClosedAt as any)}
                                  onChange={(e) => updateDealFocusDraft({ workClosedAt: dateInputToISO(e.target.value) })}
                                />
                              </label>
                              <label className="md:col-span-2">
                                <span className="field-label">Domain</span>
                                <input className="field-input" value={draft.domain || ''} onChange={(e) => updateDealFocusDraft({ domain: e.target.value })} placeholder="example.com" />
                              </label>
                              <label>
                                <span className="field-label">Domain Acquired</span>
                                <input
                                  className="field-input"
                                  type="date"
                                  value={isoToDateInput(draft.domainAcquiredAt as any)}
                                  onChange={(e) => updateDealFocusDraft({ domainAcquiredAt: dateInputToISO(e.target.value) })}
                                />
                              </label>
                              <label>
                                <span className="field-label">Domain Expires</span>
                                <input
                                  className="field-input"
                                  type="date"
                                  value={isoToDateInput(draft.domainExpiresAt as any)}
                                  onChange={(e) => updateDealFocusDraft({ domainExpiresAt: dateInputToISO(e.target.value) })}
                                />
                              </label>
                              <label>
                                <span className="field-label">Domain Cost</span>
                                <input
                                  className="field-input"
                                  inputMode="decimal"
                                  value={String((draft.domainCost as any) ?? 0)}
                                  onChange={(e) => updateDealFocusDraft({ domainCost: Number(e.target.value) || 0 })}
                                />
                              </label>
                              <label>
                                <span className="field-label">Value (Preventivo)</span>
                                <input
                                  className="field-input"
                                  inputMode="decimal"
                                  value={String((draft.value as any) ?? 0)}
                                  onChange={(e) => updateDealFocusDraft({ value: Number(e.target.value) || 0 })}
                                />
                              </label>
                              <label>
                                <span className="field-label">Currency</span>
                                <input className="field-input" value={draft.currency || ''} onChange={(e) => updateDealFocusDraft({ currency: e.target.value })} />
                              </label>
                              <label>
                                <span className="field-label">Deposit (Acconto)</span>
                                <input
                                  className="field-input"
                                  inputMode="decimal"
                                  value={String((draft.deposit as any) ?? 0)}
                                  onChange={(e) => updateDealFocusDraft({ deposit: Number(e.target.value) || 0 })}
                                />
                              </label>
                              <label>
                                <span className="field-label">Costs</span>
                                <input className="field-input" inputMode="decimal" value={String((draft.costs as any) ?? 0)} onChange={(e) => updateDealFocusDraft({ costs: Number(e.target.value) || 0 })} />
                              </label>
                              <label>
                                <span className="field-label">Taxes</span>
                                <input className="field-input" inputMode="decimal" value={String((draft.taxes as any) ?? 0)} onChange={(e) => updateDealFocusDraft({ taxes: Number(e.target.value) || 0 })} />
                              </label>
                              <label>
                                <span className="field-label">Net Total</span>
                                <input
                                  className="field-input"
                                  inputMode="decimal"
                                  value={String((draft.netTotal as any) ?? 0)}
                                  onChange={(e) => updateDealFocusDraft({ netTotal: Number(e.target.value) || 0 })}
                                />
                              </label>
                              <label>
                                <span className="field-label">Gil</span>
                                <input className="field-input" inputMode="decimal" value={String((draft.shareGil as any) ?? 0)} onChange={(e) => updateDealFocusDraft({ shareGil: Number(e.target.value) || 0 })} />
                              </label>
                              <label>
                                <span className="field-label">Ric</span>
                                <input className="field-input" inputMode="decimal" value={String((draft.shareRic as any) ?? 0)} onChange={(e) => updateDealFocusDraft({ shareRic: Number(e.target.value) || 0 })} />
                              </label>
                              <label>
                                <span className="field-label">Probability (%)</span>
                                <input
                                  className="field-input"
                                  inputMode="numeric"
                                  value={String((draft.probability as any) ?? 0)}
                                  onChange={(e) => updateDealFocusDraft({ probability: Number(e.target.value) || 0 })}
                                />
                              </label>
                              <label>
                                <span className="field-label">Expected Close</span>
                                <input
                                  className="field-input"
                                  type="date"
                                  value={isoToDateInput(draft.expectedCloseAt as any)}
                                  onChange={(e) => updateDealFocusDraft({ expectedCloseAt: dateInputToISO(e.target.value) })}
                                />
                              </label>
                              <label>
                                <span className="field-label">Source</span>
                                <input className="field-input" value={draft.source || ''} onChange={(e) => updateDealFocusDraft({ source: e.target.value })} />
                              </label>
                              <label className="md:col-span-2">
                                <span className="field-label">Description</span>
                                <textarea className="field-input" rows={4} value={(draft.description as any) || ''} onChange={(e) => updateDealFocusDraft({ description: e.target.value })} />
                              </label>
                              <label className="md:col-span-2">
                                <span className="field-label">Notes</span>
                                <textarea className="field-input" rows={3} value={(draft.notes as any) || ''} onChange={(e) => updateDealFocusDraft({ notes: e.target.value })} />
                              </label>
                              <label className="md:col-span-2">
                                <span className="field-label">Lost Reason</span>
                                <input className="field-input" value={draft.lostReason || ''} onChange={(e) => updateDealFocusDraft({ lostReason: e.target.value })} />
                              </label>
                              </div>
                            ) : (
                              <div className="grid gap-6 lg:grid-cols-2">
                              <div className="rounded-xl border border-sand-200 bg-white p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Client</div>
                                <div className="mt-2 text-lg font-semibold text-stone-900">{org?.name || 'Unknown org'}</div>
                                {contact && (
                                  <div className="mt-1 text-sm text-sand-700">
                                    {contact.firstName} {contact.lastName}
                                    {contact.email ? ` · ${contact.email}` : ''}
                                  </div>
                                )}
                                {org?.website && <div className="mt-2 text-sm text-sand-700">{org.website}</div>}
                              </div>

                              <div className="rounded-xl border border-sand-200 bg-white p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Domain</div>
                                <div className="mt-2 text-lg font-semibold text-stone-900">{d.domain || '—'}</div>
                                <div className="mt-2 grid gap-1 text-sm text-sand-700">
                                  <div>Acquired: {d.domainAcquiredAt ? isoToDateInput(d.domainAcquiredAt) : '—'}</div>
                                  <div>Expires: {d.domainExpiresAt ? isoToDateInput(d.domainExpiresAt) : '—'}</div>
                                  <div>Cost: {d.domainCost ? currency(d.domainCost, d.currency) : currency(0, d.currency)}</div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-sand-200 bg-white p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Financial</div>
                                <div className="mt-2 grid gap-1 text-sm text-sand-700">
                                  <div>Preventivo: {currency(d.value, d.currency)}</div>
                                  <div>Deposit: {currency(d.deposit || 0, d.currency)}</div>
                                  <div>Costs: {currency(d.costs || 0, d.currency)}</div>
                                  <div>Taxes: {currency(d.taxes || 0, d.currency)}</div>
                                  <div className="mt-1 font-semibold text-stone-900">Net: {currency(d.netTotal || 0, d.currency)}</div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-sand-700">
                                  <div>Gil: {currency(d.shareGil || 0, d.currency)}</div>
                                  <div>Ric: {currency(d.shareRic || 0, d.currency)}</div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-sand-200 bg-white p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Work</div>
                                <div className="mt-2 grid gap-1 text-sm text-sand-700">
                                  <div>Type: {d.workType || '—'}</div>
                                  <div>Work Closed: {d.workClosedAt ? isoToDateInput(d.workClosedAt) : '—'}</div>
                                  <div>Expected Close: {d.expectedCloseAt ? isoToDateInput(d.expectedCloseAt) : '—'}</div>
                                  <div>Probability: {d.probability || 0}%</div>
                                  <div>Source: {d.source || '—'}</div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-sand-200 bg-white p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Project & Tasks</div>
                                    <div className="mt-2 text-lg font-semibold text-stone-900">
                                      {dealProject ? dealProject.status : 'No project yet'}
                                    </div>
                                    <div className="mt-1 text-sm text-sand-700">
                                      {dealProject ? (
                                        <>
                                          Tasks: <span className="font-semibold">{dealProjectTasks.length}</span> · Done:{' '}
                                          <span className="font-semibold">{dealProjectDoneTasks}</span>
                                        </>
                                      ) : (
                                        'Create a lightweight project from this deal.'
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {dealProject ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => startEdit('project', dealProject)}
                                          className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                          disabled={crudBusy}
                                        >
                                          Edit project
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            startNew('task', {
                                              projectId: dealProject.id,
                                              ownerUserId: (me?.id || '').trim(),
                                              title: '',
                                              status: 'todo',
                                              priority: 1,
                                              estimatedHours: 1
                                            })
                                          }
                                          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                          disabled={crudBusy}
                                        >
                                          Add task
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => void onCreateProjectFromDeal(d)}
                                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={crudBusy}
                                      >
                                        Create project
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {dealProject && (
                                  <div className="mt-4 grid gap-2">
                                    {dealProjectTasks.length === 0 ? (
                                      <div className="text-sm text-sand-700">No tasks yet.</div>
                                    ) : (
                                      dealProjectTasks.slice(0, 6).map((t) => {
                                        const owner = userById.get(t.ownerUserId);
                                        const ownerLabel = owner ? owner.name : t.ownerUserId ? 'Unknown' : 'Unassigned';
                                        return (
                                          <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => startEdit('task', t)}
                                            className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-left text-sm transition hover:bg-sand-50"
                                          >
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="min-w-0 flex-1">
                                                <div className="truncate font-semibold text-stone-900">{t.title}</div>
                                                <div className="mt-1 truncate text-xs text-sand-700">Owner: {ownerLabel}</div>
                                              </div>
                                              <div className="flex flex-wrap items-start gap-2">
                                                <span className="pill">{t.status}</span>
                                                <span className="pill">P{t.priority || 0}</span>
                                              </div>
                                            </div>
                                          </button>
                                        );
                                      })
                                    )}
                                    {dealProjectTasks.length > 6 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTasksMode('kanban');
                                          setTasksProjectFilterId(dealProject.id);
                                          setView('tasks');
                                        }}
                                        className="rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm font-semibold text-sand-700 transition hover:bg-sand-100"
                                        disabled={crudBusy}
                                      >
                                        View all tasks ({dealProjectTasks.length})
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="rounded-xl border border-sand-200 bg-white p-4 lg:col-span-2">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Payments</div>
                                    <div className="mt-2 grid gap-1 text-sm text-sand-700">
                                      <div>
                                        Total: {currency(totalContract, d.currency)} · Paid: {currency(paidTotal, d.currency)} · {dueLabel}: {currency(dueTotal, d.currency)}
                                      </div>
                                      {plannedTotal > 0 && <div>Planned: {currency(plannedTotal, d.currency)}</div>}
                                      <div>
                                        Gil: received {currency(gilReceived, d.currency)} · due {currency(gilDue, d.currency)}
                                      </div>
                                      <div>
                                        Ric: received {currency(ricReceived, d.currency)} · due {currency(ricDue, d.currency)}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        startEdit('payment', {
                                          dealId: d.id,
                                          title: '',
                                          amount: 0,
                                          currency: (d.currency || 'EUR').trim() || 'EUR',
                                          status: 'paid',
                                          paidAt: new Date().toISOString(),
                                          method: '',
                                          notes: '',
                                          gilAmount: 0,
                                          ricAmount: 0
                                        })
                                      }
                                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700"
                                      disabled={crudBusy}
                                    >
                                      Add payment
                                    </button>

                                    {dealPayments.length > 0 && (
                                      <label className="flex items-center gap-2 text-sm text-sand-700">
                                        <input
                                          type="checkbox"
                                          checked={dealPayments.length > 0 && dealPayments.every((p) => paymentSelectedSet.has(p.id))}
                                          onChange={(e) => selectAllPayments(dealPayments.map((p) => p.id), e.target.checked)}
                                        />
                                        Select all
                                      </label>
                                    )}
                                  </div>
                                </div>

                                {paymentSelectedIds.length > 0 && (
                                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-700">
                                    <div>
                                      Selected: <span className="font-semibold">{paymentSelectedIds.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        onClick={() => askDelete('payment', paymentSelectedIds)}
                                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100"
                                        disabled={crudBusy}
                                      >
                                        Delete selected
                                      </button>
                                      <button
                                        onClick={() => setPaymentSelectedIds([])}
                                        className="rounded-lg border border-sand-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                        disabled={crudBusy}
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  </div>
                                )}

                                <div className="mt-4 grid gap-3">
                                  {dealPayments.length === 0 && <div className="text-sm text-sand-700">No payments yet.</div>}
                                  {dealPayments.map((p) => (
                                    <div
                                      key={p.id}
                                      className="rounded-xl border border-sand-200 bg-white p-4"
                                      onContextMenu={(e) => onItemContextMenu(e, 'payment', p)}
                                    >
                                      <div className="flex items-start gap-3">
                                        <input
                                          type="checkbox"
                                          checked={paymentSelectedSet.has(p.id)}
                                          onChange={() => togglePaymentSelected(p.id)}
                                          className="mt-1"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <div className="text-sm font-semibold text-stone-900">{p.title || 'Payment'}</div>
                                            <span className="pill">{p.status || 'paid'}</span>
                                            {p.method ? <span className="pill">{p.method}</span> : null}
                                          </div>
                                          <div className="mt-1 text-sm text-sand-700">
                                            {p.status === 'paid'
                                              ? `Paid: ${p.paidAt ? isoToDateInput(p.paidAt) : '—'}`
                                              : p.dueAt
                                                ? `Due: ${isoToDateInput(p.dueAt)}`
                                                : 'Planned'}
                                          </div>
                                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-sand-700">
                                            <div>Gil: {currency(Number(p.gilAmount) || 0, p.currency || d.currency)}</div>
                                            <div>Ric: {currency(Number(p.ricAmount) || 0, p.currency || d.currency)}</div>
                                          </div>
                                          {p.notes && <div className="mt-2 whitespace-pre-wrap text-sm text-sand-700">{p.notes}</div>}
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                          <div className="text-sm font-semibold text-stone-900">{currency(Number(p.amount) || 0, p.currency || d.currency)}</div>
                                          <button
                                            type="button"
                                            onClick={(e) => onItemActionsClick(e, 'payment', p)}
                                            className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                            disabled={crudBusy}
                                          >
                                            ...
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-xl border border-sand-200 bg-white p-4 lg:col-span-2">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Interactions</div>
                                    <div className="mt-2 text-sm text-sand-700">
                                      {contactInteractions.length === 0
                                        ? 'No interactions yet.'
                                        : `${dealInteractions.length} on this deal · ${contactInteractions.length} with this contact`}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                  <label>
                                    <span className="field-label">Type</span>
                                    <select
                                      className="field-input"
                                      value={dealInteractionType}
                                      onChange={(e) => setDealInteractionType(e.target.value)}
                                      disabled={crudBusy}
                                    >
                                      <option value="note">note</option>
                                      <option value="call">call</option>
                                      <option value="email">email</option>
                                      <option value="meeting">meeting</option>
                                    </select>
                                  </label>

                                  <label>
                                    <span className="field-label">Subject</span>
                                    <input
                                      className="field-input"
                                      value={dealInteractionSubject}
                                      onChange={(e) => setDealInteractionSubject(e.target.value)}
                                      placeholder="Follow up"
                                      disabled={crudBusy}
                                    />
                                  </label>

                                  <label className="md:col-span-2">
                                    <span className="field-label">Body</span>
                                    <textarea
                                      className="field-input"
                                      value={dealInteractionBody}
                                      onChange={(e) => setDealInteractionBody(e.target.value)}
                                      placeholder="Notes, summary, next steps..."
                                      rows={4}
                                      disabled={crudBusy}
                                    />
                                  </label>

                                  <div className="md:col-span-2">
                                    <button
                                      type="button"
                                      onClick={() => void onCreateDealInteraction(d)}
                                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700"
                                      disabled={crudBusy}
                                    >
                                      Save interaction
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-3">
                                  {contactInteractions.length === 0 && (
                                    <div className="text-sm text-sand-700">No interactions yet for this deal or contact.</div>
                                  )}
                                  {contactInteractions.map((i) => {
                                    const when = i.occurredAt ? new Date(i.occurredAt).toLocaleString() : '';
                                    const linkedDeal = dealById.get(i.dealId);
                                    return (
                                      <div
                                        key={i.id}
                                        className="rounded-xl border border-sand-200 bg-white p-4"
                                        onContextMenu={(e) => onItemContextMenu(e, 'interaction', i)}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-stone-900">{i.subject || '(No subject)'}</div>
                                            {i.dealId && i.dealId !== d.id && (
                                              <div className="mt-1 text-xs text-sand-700">Deal: {linkedDeal?.title || i.dealId}</div>
                                            )}
                                            {i.body && <div className="mt-2 whitespace-pre-wrap text-sm text-sand-700">{i.body}</div>}
                                          </div>
                                          <div className="flex flex-wrap items-start gap-2">
                                            <span className="pill">{i.interactionType}</span>
                                            {when && <span className="pill">{when}</span>}
                                            {i.dealId === d.id ? (
                                              <span className="pill">THIS DEAL</span>
                                            ) : i.dealId ? (
                                              <span className="pill">OTHER DEAL</span>
                                            ) : (
                                              <span className="pill">CONTACT</span>
                                            )}
                                            <button
                                              type="button"
                                              onClick={(e) => onItemActionsClick(e, 'interaction', i)}
                                              className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                              disabled={crudBusy}
                                            >
                                              ...
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {(d.description || d.notes || d.lostReason) && (
                                <div className="rounded-xl border border-sand-200 bg-white p-4 lg:col-span-2">
                                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Notes</div>
                                  {d.description && <div className="mt-2 whitespace-pre-wrap text-sm text-sand-700">{d.description}</div>}
                                  {d.notes && <div className="mt-3 whitespace-pre-wrap text-sm text-sand-700">{d.notes}</div>}
                                  {d.lostReason && <div className="mt-3 text-sm text-sand-700">Lost reason: {d.lostReason}</div>}
                                </div>
                              )}
                              </div>
                            )}
                          </div>
                      </div>
                    );
                  })()
                : (
                    <div className="panel animate-enter flex flex-1 min-h-0 flex-col overflow-hidden p-6">
                      {(() => {
                          const statusDeals = dealsStatus === 'all' ? deals : deals.filter((d) => d.status === dealsStatus);
                          const stagesToShow = [...pipelineStages]
                            .slice()
                            .sort((a, b) => (a.position || 0) - (b.position || 0) || a.name.localeCompare(b.name));
                          const stageIdsToShow = new Set<string>();
                          for (const st of stagesToShow) stageIdsToShow.add(st.id);

                          const filteredDeals = statusDeals;

                          const preferredStageId = (() => {
                            const st = stagesToShow[0];
                            return (st?.id || '').trim();
                          })();

                          return (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-3">
                                  <h2 className="text-3xl text-sand-900">Deals</h2>
                                  <div className="inline-flex overflow-hidden rounded-xl border border-sand-200 bg-white">
                                    <button
                                      type="button"
                                      onClick={() => setDealsMode('kanban')}
                                      className={[
                                        'px-3 py-2 text-xs font-semibold uppercase tracking-wide transition',
                                        dealsMode === 'kanban'
                                          ? 'bg-sand-100 text-sand-900'
                                          : 'bg-white text-sand-700 hover:bg-sand-50'
                                      ].join(' ')}
                                    >
                                      Kanban
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDealsMode('list')}
                                      className={[
                                        'px-3 py-2 text-xs font-semibold uppercase tracking-wide transition',
                                        dealsMode === 'list'
                                          ? 'bg-sand-100 text-sand-900'
                                          : 'bg-white text-sand-700 hover:bg-sand-50'
                                      ].join(' ')}
                                    >
                                      List
                                    </button>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startNew('deal', {
                                        organizationId: '',
                                        contactId: '',
                                        pipelineStageId: preferredStageId,
                                        title: '',
                                        value: 0,
                                        currency: 'EUR',
                                        probability: 35,
                                        status: 'open'
                                      })
                                    }
                                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={crudBusy || organizations.length === 0 || contacts.length === 0}
                                    title={organizations.length === 0 || contacts.length === 0 ? 'Create an organization and contact first' : 'Create a deal'}
                                  >
                                    New deal
                                  </button>

                                  <select
                                    className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 focus:border-sand-500 focus:outline-none focus:ring-2 focus:ring-sand-300"
                                    value={dealsStatus}
                                    onChange={(e) => {
                                      setDealsStatus(e.target.value as DealsStatusFilter);
                                      setSelectedIds([]);
                                    }}
                                  >
                                    <option value="open">Open</option>
                                    <option value="won">Won</option>
                                    <option value="lost">Lost</option>
                                    <option value="all">All</option>
                                  </select>

                                  {dealsMode === 'list' && filteredDeals.length > 0 && (
                                    <label className="flex items-center gap-2 text-sm text-sand-700">
                                      <input
                                        type="checkbox"
                                        checked={filteredDeals.length > 0 && filteredDeals.every((d) => selectedSet.has(d.id))}
                                        onChange={(e) => selectAll(filteredDeals.map((d) => d.id), e.target.checked)}
                                      />
                                      Select all
                                    </label>
                                  )}
                                </div>
                              </div>

                              {dealsMode === 'list' && selectedIds.length > 0 && (
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-700">
                                  <div>
                                    Selected: <span className="font-semibold">{selectedIds.length}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => askDelete('deal', selectedIds)}
                                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100"
                                      disabled={crudBusy}
                                    >
                                      Delete selected
                                    </button>
                                    <button
                                      onClick={() => setSelectedIds([])}
                                      className="rounded-lg border border-sand-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                      disabled={crudBusy}
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="mt-4 flex-1 min-h-0 overflow-hidden">
                                {dealsMode === 'list' && (
                                  <div className="h-full overflow-y-auto pr-1">
                                    <div className="grid gap-3">
                                      {filteredDeals.length === 0 && <div className="text-sm text-sand-700">No deals yet.</div>}
                                      {filteredDeals.map((d) => {
                                        const org = orgById.get(d.organizationId);
                                        const contact = contactById.get(d.contactId);
                                        const stage = stageById.get(d.pipelineStageId);
                                        const metaParts = [
                                          d.domain ? `Domain: ${d.domain}` : '',
                                          d.domainExpiresAt ? `Expires: ${isoToDateInput(d.domainExpiresAt)}` : '',
                                          d.workType ? `Type: ${d.workType}` : '',
                                          d.netTotal ? `Net: ${currency(d.netTotal, d.currency)}` : ''
                                        ].filter(Boolean);
                                        return (
                                          <div
                                            key={d.id}
                                            className="cursor-pointer rounded-xl border border-sand-200 bg-white p-4 transition hover:bg-sand-50"
                                            onClick={() => openDealFocus(d.id)}
                                            onContextMenu={(e) => onItemContextMenu(e, 'deal', d)}
                                          >
                                            <div className="flex items-start gap-3">
                                              <input
                                                type="checkbox"
                                                checked={selectedSet.has(d.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={() => toggleSelected(d.id)}
                                                className="mt-1"
                                              />
                                              <div className="min-w-0 flex-1">
                                                <div className="text-lg font-semibold text-stone-900">{d.title}</div>
                                                <div className="mt-1 text-sm text-sand-700">
                                                  {org?.name || 'Unknown org'}
                                                  {contact ? ` · ${contact.firstName} ${contact.lastName}` : ''}
                                                </div>
                                              </div>
                                              <div className="flex flex-wrap items-start gap-2">
                                                <span className="pill">{d.status}</span>
                                                {stage && <span className="pill">{stage.name}</span>}
                                                <span className="pill">{currency(d.value, d.currency)}</span>
                                                <button
                                                  type="button"
                                                  onClick={(e) => onItemActionsClick(e, 'deal', d)}
                                                  className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                                >
                                                  ...
                                                </button>
                                              </div>
                                            </div>
                                            <div className="mt-2 text-sm text-sand-700">Probability: {d.probability || 0}%</div>
                                            {metaParts.length > 0 && <div className="mt-1 text-sm text-sand-700">{metaParts.join(' · ')}</div>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {dealsMode === 'kanban' &&
                                  (() => {
                                    const byStageId = new Map<string, Deal[]>();
                                    let excluded = 0;
                                    for (const d of filteredDeals) {
                                      const sid = String(d.pipelineStageId || '').trim();
                                      if (!sid || !stageIdsToShow.has(sid)) {
                                        excluded++;
                                        continue;
                                      }
                                      const arr = byStageId.get(sid) || [];
                                      arr.push(d);
                                      byStageId.set(sid, arr);
                                    }

                                    const columns: Array<{ id: string; title: string; color: string; stage: PipelineStage; deals: Deal[] }> =
                                      stagesToShow.map((st) => {
                                        return {
                                          id: st.id,
                                          title: st.name,
                                          color: st.color || '#e9c29a',
                                          stage: st,
                                          deals: byStageId.get(st.id) || []
                                        };
                                      });

                                    return (
                                      <div className="flex h-full min-h-0 flex-col">
                                        {pipelineStages.length === 0 && (
                                          <div className="text-sm text-sand-700">No deal stages available yet.</div>
                                        )}

                                        {pipelineStages.length > 0 && (
                                          <>
                                            {excluded > 0 && (
                                              <div className="mb-3 rounded-xl border border-sand-200 bg-white p-3 text-sm text-sand-700">
                                                Hidden deals: <span className="font-semibold">{excluded}</span>. Use{' '}
                                                <span className="font-semibold">List</span> to find and assign a stage.
                                              </div>
                                            )}
                                            <div className="flex flex-1 min-h-0 gap-4 overflow-x-auto pb-2">
                                              {columns.map((col) => {
                                                const isDragOver = kanbanDragOverStageId === col.id;
                                                return (
                                                  <div
                                                    key={col.id}
                                                    className={[
                                                      'flex h-full w-80 shrink-0 flex-col rounded-2xl border bg-white/70 p-4 transition',
                                                      isDragOver ? 'border-sand-500 ring-2 ring-sand-300' : 'border-sand-200'
                                                    ].join(' ')}
                                                    onDragOver={(e) => onDealKanbanDragOver(e, col.id)}
                                                    onDrop={(e) => onDealKanbanDrop(e, col.id)}
                                                  >
                                                    <div className="flex items-start justify-between gap-3">
                                                      <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                          <div
                                                            className="h-3 w-3 rounded-full border border-sand-200"
                                                            style={{ background: col.color }}
                                                          />
                                                          <div className="truncate text-sm font-semibold text-stone-900">{col.title}</div>
                                                        </div>
                                                        <div className="mt-1 text-xs text-sand-700">
                                                          {Math.round(col.stage.probability || 0)}% probability
                                                        </div>
                                                      </div>
                                                      <span className="pill">{col.deals.length}</span>
                                                    </div>

                                                    <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
                                                      <div className="grid gap-3">
                                                        {col.deals.length === 0 && (
                                                          <div className="rounded-xl border border-dashed border-sand-200 bg-white p-3 text-xs text-sand-700">
                                                            Drop a deal here
                                                          </div>
                                                        )}

                                                        {col.deals.map((d) => {
                                                          const org = orgById.get(d.organizationId);
                                                          const contact = contactById.get(d.contactId);
                                                          return (
                                                            <div
                                                              key={d.id}
                                                              className="cursor-pointer rounded-2xl border border-sand-200 bg-white p-4 shadow-sm transition hover:bg-sand-50"
                                                              draggable
                                                              onDragStart={(e) => onDealKanbanDragStart(e, d.id)}
                                                              onDragEnd={() => setKanbanDragOverStageId(null)}
                                                              onClick={() => openDealFocus(d.id)}
                                                              onContextMenu={(e) => onItemContextMenu(e, 'deal', d)}
                                                            >
                                                              <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0 flex-1">
                                                                  <div className="truncate text-sm font-semibold text-stone-900">
                                                                    {d.title}
                                                                  </div>
                                                                  <div className="mt-1 truncate text-xs text-sand-700">
                                                                    {org?.name || 'Unknown org'}
                                                                    {contact ? ` · ${contact.firstName} ${contact.lastName}` : ''}
                                                                  </div>
                                                                </div>
                                                                <button
                                                                  type="button"
                                                                  onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onItemActionsClick(e, 'deal', d);
                                                                  }}
                                                                  className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                                                  disabled={crudBusy}
                                                                >
                                                                  ...
                                                                </button>
                                                              </div>

                                                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-sand-700">
                                                                <span className="pill">{d.status}</span>
                                                                <span className="pill">{currency(d.value, d.currency)}</span>
                                                                <span className="pill">{d.probability || 0}%</span>
                                                              </div>
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    );
                                  })()}

                              </div>
                            </>
                          );
                        })()}
                    </div>
                  )}
            </>
          )}

          {view === 'projects' && (
            <div className="panel animate-enter flex flex-1 min-h-0 flex-col overflow-hidden p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl text-sand-900">Projects</h2>
                  <div className="inline-flex overflow-hidden rounded-xl border border-sand-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setProjectsMode('list')}
                      className={[
                        'px-3 py-2 text-xs font-semibold uppercase tracking-wide transition',
                        projectsMode === 'list' ? 'bg-sand-100 text-sand-900' : 'bg-white text-sand-700 hover:bg-sand-50'
                      ].join(' ')}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectsMode('gantt')}
                      className={[
                        'px-3 py-2 text-xs font-semibold uppercase tracking-wide transition',
                        projectsMode === 'gantt' ? 'bg-sand-100 text-sand-900' : 'bg-white text-sand-700 hover:bg-sand-50'
                      ].join(' ')}
                    >
                      Gantt
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      startNew('project', {
                        dealId: (deals[0]?.id || '').trim(),
                        status: 'active'
                      })
                    }
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={crudBusy || deals.length === 0}
                    title={deals.length === 0 ? 'Create a deal first' : 'Create a project'}
                  >
                    New project
                  </button>
                  {projectsMode === 'list' && projects.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-sand-700">
                      <input
                        type="checkbox"
                        checked={projects.length > 0 && projects.every((p) => selectedSet.has(p.id))}
                        onChange={(e) => selectAll(projects.map((p) => p.id), e.target.checked)}
                      />
                      Select all
                    </label>
                  )}
                </div>
              </div>

              {selectedIds.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-700">
                  <div>
                    Selected: <span className="font-semibold">{selectedIds.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => askDelete('project', selectedIds)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100"
                      disabled={crudBusy}
                    >
                      Delete selected
                    </button>
                    <button
                      onClick={() => setSelectedIds([])}
                      className="rounded-lg border border-sand-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                      disabled={crudBusy}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {projectsMode === 'list' ? (
                <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
                  <div className="grid gap-3">
                    {projects.length === 0 && <div className="text-sm text-sand-700">No projects yet.</div>}
                    {projects.map((p) => {
                      const deal = dealById.get(p.dealId);
                      const org = deal ? orgById.get(deal.organizationId) : undefined;
                      const taskCount = (tasksByProjectId.get(p.id) || []).length;
                      return (
                        <div
                          key={p.id}
                          className="rounded-xl border border-sand-200 bg-white p-4"
                          onContextMenu={(e) => onItemContextMenu(e, 'project', p)}
                        >
                          <div className="flex items-start gap-3">
                            <input type="checkbox" checked={selectedSet.has(p.id)} onChange={() => toggleSelected(p.id)} className="mt-1" />
                            <div className="min-w-0 flex-1">
                              <div className="text-lg font-semibold text-stone-900">{deal?.title || p.name || 'Project'}</div>
                              <div className="mt-1 text-sm text-sand-700">{org?.name || 'Unknown org'}</div>
                            </div>
                            <div className="flex flex-wrap items-start gap-2">
                              <span className="pill">{p.status}</span>
                              <span className="pill">{taskCount} tasks</span>
                              <button
                                type="button"
                                onClick={(e) => onItemActionsClick(e, 'project', p)}
                                className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                              >
                                ...
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                  {projects.length === 0 && <div className="text-sm text-sand-700">No projects yet.</div>}
                  {projects.length > 0 && projectTimelineLayout && (
                    (() => {
                      const layout = projectTimelineLayout;
                      return (
                        <div className="space-y-3">
                          <div className="rounded-xl border border-sand-200 bg-white p-4 text-sm text-sand-700">
                            Range: {new Date(layout.min).toLocaleDateString()} to {new Date(layout.max).toLocaleDateString()} ·
                            Projects use <span className="font-semibold">Start Date → Target/Actual End</span>; tasks use{' '}
                            <span className="font-semibold">Created → Due Date</span>.
                          </div>

                          <div className="overflow-x-auto">
                            <div
                              className="overflow-hidden rounded-2xl border border-sand-200 bg-white"
                              style={{ minWidth: layout.chartWidth + 340 }}
                            >
                              <div className="sticky top-0 z-10 grid grid-cols-[340px_1fr] border-b border-sand-200 bg-sand-50/95 backdrop-blur">
                                <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Project / Task</div>
                                <div className="relative h-12">
                                  {layout.ticks.map((tick) => {
                                    const left = timelineLeftPx(tick, layout);
                                    return (
                                      <div key={`project-header-tick-${tick}`} className="absolute inset-y-0" style={{ left }}>
                                        <div className="h-full w-px bg-sand-200" />
                                        <div className="absolute left-1 top-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sand-700">
                                          {formatTimelineTick(tick, layout.stepDays)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              <div>
                                {projectTimelineRows.map((row) => {
                                  const deal = dealById.get(row.project.dealId);
                                  const org = deal ? orgById.get(deal.organizationId) : undefined;
                                  const projectLabel = deal?.title || row.project.name || 'Project';
                                  const projectBarColor =
                                    row.project.status === 'completed'
                                      ? 'bg-emerald-600'
                                      : row.project.status === 'support'
                                        ? 'bg-amber-500'
                                        : 'bg-indigo-600';
                                  const projectBar = timelineBarStyle({ start: row.start, end: row.end }, layout);
                                  return (
                                    <div key={row.project.id} className="border-b border-sand-200 last:border-b-0">
                                      <div className="grid grid-cols-[340px_1fr] items-center bg-sand-50/40">
                                        <div
                                          className="border-r border-sand-200 px-4 py-3"
                                          onContextMenu={(e) => onItemContextMenu(e, 'project', row.project)}
                                        >
                                          <div className="flex items-start gap-3">
                                            <input
                                              type="checkbox"
                                              checked={selectedSet.has(row.project.id)}
                                              onChange={() => toggleSelected(row.project.id)}
                                              className="mt-1"
                                            />
                                            <div className="min-w-0 flex-1">
                                              <div className="truncate text-sm font-semibold text-stone-900">{projectLabel}</div>
                                              <div className="mt-1 text-xs text-sand-700">
                                                {org?.name || 'Unknown org'} · {row.tasks.length} tasks
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={(e) => onItemActionsClick(e, 'project', row.project)}
                                              className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                            >
                                              ...
                                            </button>
                                          </div>
                                        </div>
                                        <div className="relative h-12 border-l border-sand-100 bg-white/60">
                                          {layout.ticks.map((tick) => (
                                            <div
                                              key={`project-grid-tick-${row.project.id}-${tick}`}
                                              className="absolute inset-y-0 w-px bg-sand-100"
                                              style={{ left: timelineLeftPx(tick, layout) }}
                                            />
                                          ))}
                                          <div
                                            className={['absolute top-1/2 h-4 -translate-y-1/2 rounded-full', projectBarColor].join(' ')}
                                            style={projectBar}
                                            title={`${new Date(row.start).toLocaleDateString()} → ${new Date(row.end).toLocaleDateString()}`}
                                          />
                                        </div>
                                      </div>

                                      {row.tasks.length === 0 && (
                                        <div className="grid grid-cols-[340px_1fr] items-center">
                                          <div className="border-r border-sand-100 px-4 py-2 pl-11 text-xs text-sand-700">No tasks yet.</div>
                                          <div className="relative h-8 border-l border-sand-100 bg-white">
                                            {layout.ticks.map((tick) => (
                                              <div
                                                key={`project-empty-grid-tick-${row.project.id}-${tick}`}
                                                className="absolute inset-y-0 w-px bg-sand-100"
                                                style={{ left: timelineLeftPx(tick, layout) }}
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {row.tasks.map((tRow) => {
                                        const owner = userById.get(tRow.task.ownerUserId);
                                        const ownerLabel = owner ? owner.name : tRow.task.ownerUserId ? 'Unknown' : 'Unassigned';
                                        const taskBarColor =
                                          tRow.task.status === 'done'
                                            ? 'bg-emerald-500'
                                            : tRow.task.status === 'blocked'
                                              ? 'bg-red-600'
                                              : tRow.task.status === 'in_progress'
                                                ? 'bg-sky-600'
                                                : 'bg-sand-500';
                                        const taskBar = timelineBarStyle({ start: tRow.start, end: tRow.end }, layout);
                                        return (
                                          <div key={tRow.task.id} className="grid grid-cols-[340px_1fr] items-center">
                                            <div
                                              className="border-r border-sand-100 px-4 py-2 pl-11"
                                              onContextMenu={(e) => onItemContextMenu(e, 'task', tRow.task)}
                                            >
                                              <div className="flex items-start gap-3">
                                                <div className="min-w-0 flex-1">
                                                  <div className="truncate text-sm text-stone-900">{tRow.task.title}</div>
                                                  <div className="mt-1 text-xs text-sand-700">
                                                    {ownerLabel} · {tRow.task.status || 'todo'}
                                                  </div>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={(e) => onItemActionsClick(e, 'task', tRow.task)}
                                                  className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                                >
                                                  ...
                                                </button>
                                              </div>
                                            </div>
                                            <div className="relative h-10 border-l border-sand-100 bg-white">
                                              {layout.ticks.map((tick) => (
                                                <div
                                                  key={`project-task-grid-tick-${tRow.task.id}-${tick}`}
                                                  className="absolute inset-y-0 w-px bg-sand-100"
                                                  style={{ left: timelineLeftPx(tick, layout) }}
                                                />
                                              ))}
                                              <div
                                                className={['absolute top-1/2 h-3 -translate-y-1/2 rounded-full', taskBarColor].join(' ')}
                                                style={taskBar}
                                                title={`${new Date(tRow.start).toLocaleDateString()} → ${new Date(tRow.end).toLocaleDateString()}`}
                                              />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'tasks' && (
            <div className="panel animate-enter flex flex-1 min-h-0 flex-col overflow-hidden p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl text-sand-900">Tasks</h2>
                  <div className="inline-flex overflow-hidden rounded-xl border border-sand-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setTasksMode('kanban')}
                      className={[
                        'px-3 py-2 text-xs font-semibold uppercase tracking-wide transition',
                        tasksMode === 'kanban' ? 'bg-sand-100 text-sand-900' : 'bg-white text-sand-700 hover:bg-sand-50'
                      ].join(' ')}
                      disabled={crudBusy}
                    >
                      Kanban
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasksMode('list')}
                      className={[
                        'px-3 py-2 text-xs font-semibold uppercase tracking-wide transition',
                        tasksMode === 'list' ? 'bg-sand-100 text-sand-900' : 'bg-white text-sand-700 hover:bg-sand-50'
                      ].join(' ')}
                      disabled={crudBusy}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasksMode('gantt')}
                      className={[
                        'px-3 py-2 text-xs font-semibold uppercase tracking-wide transition',
                        tasksMode === 'gantt' ? 'bg-sand-100 text-sand-900' : 'bg-white text-sand-700 hover:bg-sand-50'
                      ].join(' ')}
                      disabled={crudBusy}
                    >
                      Gantt
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="field-input max-w-[260px]"
                    value={tasksProjectFilterId}
                    onChange={(e) => setTasksProjectFilterId(e.target.value)}
                    disabled={crudBusy || projects.length === 0}
                    title={projects.length === 0 ? 'Create a project first' : 'Filter by project'}
                  >
                    <option value="">All projects</option>
                    {projects.map((p) => {
                      const deal = dealById.get(p.dealId);
                      return (
                        <option key={p.id} value={p.id}>
                          {deal?.title || p.name || p.id}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      startNew('task', {
                        projectId: (tasksProjectFilterId || projects[0]?.id || '').trim(),
                        ownerUserId: (me?.id || '').trim(),
                        title: '',
                        status: 'todo',
                        priority: 1,
                        estimatedHours: 1
                      })
                    }
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={crudBusy || projects.length === 0}
                    title={projects.length === 0 ? 'Create a project first' : 'Create a task'}
                  >
                    New task
                  </button>
                  {tasksMode === 'list' && filteredTasks.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-sand-700">
                      <input
                        type="checkbox"
                        checked={filteredTasks.length > 0 && filteredTasks.every((t) => selectedSet.has(t.id))}
                        onChange={(e) => selectAll(filteredTasks.map((t) => t.id), e.target.checked)}
                      />
                      Select all
                    </label>
                  )}
                </div>
              </div>

              {selectedIds.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-700">
                  <div>
                    Selected: <span className="font-semibold">{selectedIds.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => askDelete('task', selectedIds)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100"
                      disabled={crudBusy}
                    >
                      Delete selected
                    </button>
                    <button
                      onClick={() => setSelectedIds([])}
                      className="rounded-lg border border-sand-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                      disabled={crudBusy}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {tasksMode === 'kanban' ? (
                <div className="mt-4 flex-1 min-h-0 overflow-x-auto">
                  <div className="grid h-full min-w-[1050px] grid-cols-4 gap-4 pr-1">
                    {[
                      { id: 'todo', label: 'To do' },
                      { id: 'in_progress', label: 'In progress' },
                      { id: 'blocked', label: 'Blocked' },
                      { id: 'done', label: 'Done' }
                    ].map((col) => {
                      const colTasks = filteredTasks.filter((t) => t.status === col.id);
                      return (
                        <div
                          key={col.id}
                          className={[
                            'flex min-h-0 flex-col rounded-2xl border p-4 transition',
                            taskKanbanDragOverStatus === col.id ? 'border-sand-500 bg-sand-100' : 'border-sand-200 bg-white'
                          ].join(' ')}
                          onDragOver={(e) => onTaskKanbanDragOver(e, col.id)}
                          onDrop={(e) => onTaskKanbanDrop(e, col.id)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">{col.label}</div>
                            <div className="pill">{colTasks.length} tasks</div>
                          </div>

                          <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">
                            <div className="grid gap-3">
                              {colTasks.length === 0 && <div className="text-xs text-sand-700">No tasks.</div>}
                              {colTasks.map((t) => {
                                const project = projectById.get(t.projectId);
                                const deal = project ? dealById.get(project.dealId) : undefined;
                                const owner = userById.get(t.ownerUserId);
                                const ownerLabel = owner ? owner.name : t.ownerUserId ? 'Unknown' : 'Unassigned';
                                const projectLabel = deal?.title || project?.name || 'Unknown project';
                                return (
                                  <div
                                    key={t.id}
                                    className="cursor-grab rounded-xl border border-sand-200 bg-white p-4 shadow-sm transition hover:bg-sand-50 active:cursor-grabbing"
                                    draggable
                                    onDragStart={(e) => onTaskKanbanDragStart(e, t.id)}
                                    onDragEnd={() => setTaskKanbanDragOverStatus(null)}
                                    onContextMenu={(e) => onItemContextMenu(e, 'task', t)}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold text-stone-900">{t.title}</div>
                                        <div className="mt-1 truncate text-xs text-sand-700">
                                          {projectLabel} · {ownerLabel}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e) => onItemActionsClick(e, 'task', t)}
                                        className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                        disabled={crudBusy}
                                      >
                                        ...
                                      </button>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-sand-700">
                                      <span className="pill">P{t.priority || 0}</span>
                                      {t.ownerUserId ? <span className="pill">{ownerLabel}</span> : <span className="pill">UNASSIGNED</span>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : tasksMode === 'list' ? (
                <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
                  <div className="grid gap-3">
                    {tasks.length === 0 ? (
                      <div className="text-sm text-sand-700">No tasks yet.</div>
                    ) : filteredTasks.length === 0 ? (
                      <div className="text-sm text-sand-700">No tasks for this project.</div>
                    ) : (
                      filteredTasks.map((t) => {
                        const project = projectById.get(t.projectId);
                        const deal = project ? dealById.get(project.dealId) : undefined;
                        const owner = userById.get(t.ownerUserId);
                        const ownerLabel = owner ? owner.name : t.ownerUserId ? 'Unknown' : 'Unassigned';
                        return (
                          <div
                            key={t.id}
                            className="rounded-xl border border-sand-200 bg-white p-4"
                            onContextMenu={(e) => onItemContextMenu(e, 'task', t)}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selectedSet.has(t.id)}
                                onChange={() => toggleSelected(t.id)}
                                className="mt-1"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-lg font-semibold text-stone-900">{t.title}</div>
                                <div className="mt-1 text-sm text-sand-700">{deal?.title || project?.name || 'Unknown project'}</div>
                                <div className="mt-2 text-xs text-sand-700">Owner: {ownerLabel}</div>
                              </div>
                              <div className="flex flex-wrap items-start gap-2">
                                <span className="pill">{t.status}</span>
                                <span className="pill">P{t.priority || 0}</span>
                                <button
                                  type="button"
                                  onClick={(e) => onItemActionsClick(e, 'task', t)}
                                  className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                >
                                  ...
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                  {tasks.length === 0 ? (
                    <div className="text-sm text-sand-700">No tasks yet.</div>
                  ) : filteredTasks.length === 0 ? (
                    <div className="text-sm text-sand-700">No tasks for this project.</div>
                  ) : !taskTimelineLayout ? (
                    <div className="text-sm text-sand-700">Not enough date data for a timeline.</div>
                  ) : (
                    (() => {
                      const layout = taskTimelineLayout;
                      return (
                        <div className="space-y-3">
                          <div className="rounded-xl border border-sand-200 bg-white p-4 text-sm text-sand-700">
                            Range: {new Date(layout.min).toLocaleDateString()} to {new Date(layout.max).toLocaleDateString()} ·
                            Bars use <span className="font-semibold">Created</span> to{' '}
                            <span className="font-semibold">Due Date</span>.
                          </div>
                          <div className="overflow-x-auto">
                            <div
                              className="overflow-hidden rounded-2xl border border-sand-200 bg-white"
                              style={{ minWidth: layout.chartWidth + 340 }}
                            >
                              <div className="sticky top-0 z-10 grid grid-cols-[340px_1fr] border-b border-sand-200 bg-sand-50/95 backdrop-blur">
                                <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Task</div>
                                <div className="relative h-12">
                                  {layout.ticks.map((tick) => {
                                    const left = timelineLeftPx(tick, layout);
                                    return (
                                      <div key={`task-header-tick-${tick}`} className="absolute inset-y-0" style={{ left }}>
                                        <div className="h-full w-px bg-sand-200" />
                                        <div className="absolute left-1 top-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sand-700">
                                          {formatTimelineTick(tick, layout.stepDays)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div>
                                {taskTimelineRows.map((row) => {
                                  const task = row.task;
                                  const project = projectById.get(task.projectId);
                                  const deal = project ? dealById.get(project.dealId) : undefined;
                                  const owner = userById.get(task.ownerUserId);
                                  const ownerLabel = owner ? owner.name : task.ownerUserId ? 'Unknown' : 'Unassigned';
                                  const projectLabel = deal?.title || project?.name || 'Unknown project';
                                  const barColor =
                                    task.status === 'done'
                                      ? 'bg-emerald-500'
                                      : task.status === 'blocked'
                                        ? 'bg-red-600'
                                        : task.status === 'in_progress'
                                          ? 'bg-sky-600'
                                          : 'bg-sand-500';
                                  const bar = timelineBarStyle({ start: row.start, end: row.end }, layout);
                                  return (
                                    <div
                                      key={task.id}
                                      className="grid grid-cols-[340px_1fr] items-center border-b border-sand-100 last:border-b-0"
                                    >
                                      <div className="border-r border-sand-100 px-4 py-3" onContextMenu={(e) => onItemContextMenu(e, 'task', task)}>
                                        <div className="flex items-start gap-3">
                                          <input
                                            type="checkbox"
                                            checked={selectedSet.has(task.id)}
                                            onChange={() => toggleSelected(task.id)}
                                            className="mt-1"
                                          />
                                          <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold text-stone-900">{task.title}</div>
                                            <div className="mt-1 truncate text-xs text-sand-700">
                                              {projectLabel} · {ownerLabel} · {task.status || 'todo'}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={(e) => onItemActionsClick(e, 'task', task)}
                                            className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                          >
                                            ...
                                          </button>
                                        </div>
                                      </div>
                                      <div className="relative h-10 border-l border-sand-100 bg-white">
                                        {layout.ticks.map((tick) => (
                                          <div
                                            key={`task-grid-tick-${task.id}-${tick}`}
                                            className="absolute inset-y-0 w-px bg-sand-100"
                                            style={{ left: timelineLeftPx(tick, layout) }}
                                          />
                                        ))}
                                        <div
                                          className={['absolute top-1/2 h-3 -translate-y-1/2 rounded-full', barColor].join(' ')}
                                          style={bar}
                                          title={`${new Date(row.start).toLocaleDateString()} → ${new Date(row.end).toLocaleDateString()}`}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'quotations' && (
            <div className="panel animate-enter flex flex-1 min-h-0 flex-col overflow-hidden p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-3xl text-sand-900">Quotations</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      startNew('quotation', {
                        dealId: (deals[0]?.id || '').trim(),
                        title: '',
                        status: 'draft',
                        currency: 'EUR',
                        taxRate: 22,
                        discountAmount: 0
                      })
                    }
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={crudBusy || deals.length === 0}
                    title={deals.length === 0 ? 'Create a deal first' : 'Create a quotation'}
                  >
                    New quotation
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startNew('quotationItem', {
                        quotationId: (selectedQuotationId || quotations[0]?.id || '').trim(),
                        name: '',
                        quantity: 1,
                        unitPrice: 0,
                        unitType: 'hour',
                        position: 0
                      })
                    }
                    className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={crudBusy || quotations.length === 0}
                    title={quotations.length === 0 ? 'Create a quotation first' : 'Add an item'}
                  >
                    Add item
                  </button>
                  {quotations.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-sand-700">
                      <input
                        type="checkbox"
                        checked={quotations.length > 0 && quotations.every((q) => selectedSet.has(q.id))}
                        onChange={(e) => selectAll(quotations.map((q) => q.id), e.target.checked)}
                      />
                      Select all
                    </label>
                  )}
                </div>
              </div>

              {selectedIds.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-700">
                  <div>
                    Selected: <span className="font-semibold">{selectedIds.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => askDelete('quotation', selectedIds)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100"
                      disabled={crudBusy}
                    >
                      Delete selected
                    </button>
                    <button
                      onClick={() => setSelectedIds([])}
                      className="rounded-lg border border-sand-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                      disabled={crudBusy}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="space-y-3">
                  {quotations.length === 0 && <div className="text-sm text-sand-700">No quotations yet.</div>}
                  {quotations.map((q) => {
                    const deal = dealById.get(q.dealId);
                    const org = deal ? orgById.get(deal.organizationId) : undefined;
                    const items = itemsByQuotationId.get(q.id) || [];
                    const selected = q.id === selectedQuotationId;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setSelectedQuotationId(q.id)}
                        className={[
                          'w-full rounded-2xl border p-5 text-left transition',
                          selected ? 'border-sand-500 bg-sand-100' : 'border-sand-200 bg-white hover:bg-sand-50'
                        ].join(' ')}
                        onContextMenu={(e) => onItemContextMenu(e, 'quotation', q)}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedSet.has(q.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelected(q.id)}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-sand-700">{q.number}</div>
                            <div className="mt-1 text-lg font-semibold text-stone-900">{q.title}</div>
                            <div className="mt-1 text-sm text-sand-700">
                              {org?.name || 'Unknown org'}
                              {deal ? ` · ${deal.title}` : ''}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-start gap-2">
                            <span className="pill">{q.status}</span>
                            <span className="pill">{currency(q.total || 0, q.currency)}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onItemActionsClick(e, 'quotation', q);
                              }}
                              className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                            >
                              ...
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-sand-700">
                          <span className="pill">Items: {items.length}</span>
                          <span className="pill">Tax: {q.taxRate || 0}%</span>
                          <span className="pill">Discount: {currency(q.discountAmount || 0, q.currency)}</span>
                        </div>

                        {selected && items.length > 0 && (
                          <div className="mt-4 grid gap-2">
                            {items.map((it) => (
                              <div
                                key={it.id}
                                className="rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm"
                                onContextMenu={(e) => onItemContextMenu(e, 'quotationItem', it)}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="font-semibold text-stone-900">{it.name}</div>
                                  <div className="flex items-start gap-2">
                                    <div className="pill">{currency(it.lineTotal || 0, q.currency)}</div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onItemActionsClick(e, 'quotationItem', it);
                                      }}
                                      className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                    >
                                      ...
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-1 text-xs text-sand-700">
                                  {it.quantity} {it.unitType || 'unit'} @ {currency(it.unitPrice || 0, q.currency)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {view === 'agent' && (
            <div className="panel animate-enter flex flex-1 min-h-0 flex-col overflow-hidden p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-3xl text-sand-900">Agent</h2>
                  <p className="mt-1 text-sm text-sand-700">Task commands with live execution on your real data.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAgentMessages([])}
                  className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                  disabled={agentBusy || agentMessages.length === 0}
                >
                  Clear history
                </button>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-sand-200 bg-white p-4">
                <label>
                  <span className="field-label">Command</span>
                  <textarea
                    className="field-input"
                    rows={3}
                    value={agentInput}
                    onChange={(e) => setAgentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        void onRunAgent();
                      }
                    }}
                    placeholder="Example: create task publish pricing page in project TechFlow and assign to John"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-sand-700">Tip: press Cmd/Ctrl+Enter to send.</p>
                  <button
                    type="button"
                    onClick={() => void onRunAgent()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={agentBusy || !agentInput.trim()}
                  >
                    {agentBusy ? 'Running...' : 'Run command'}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="grid gap-3">
                  {agentMessages.length === 0 && (
                    <div className="rounded-xl border border-sand-200 bg-white p-4 text-sm text-sand-700">No commands yet.</div>
                  )}

                  {agentMessages.map((message) => (
                    <div
                      key={message.id}
                      className={[
                        'rounded-xl border p-4',
                        message.role === 'user'
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
                          : 'border-sand-200 bg-white text-sand-900'
                      ].join(' ')}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sand-600">
                        {message.role === 'user' ? 'You' : 'Agent'}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{message.text}</p>
                      {message.details && message.details.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs text-sand-700">
                          {message.details.map((detail) => (
                            <li key={detail}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === 'settings' && (
            <div className="panel animate-enter flex flex-1 min-h-0 flex-col overflow-hidden p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-3xl text-sand-900">Settings</h2>
                  <p className="mt-1 text-sm text-sand-700">Optional AI provider settings (mirrors TimeManage).</p>
                </div>
                <button
                  onClick={() => void saveSettings()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  disabled={!settings}
                >
                  Save
                </button>
              </div>

              <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                {settingsNotice && (
                  <div className="rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">{settingsNotice}</div>
                )}

                {!settings && <div className="text-sm text-sand-700">Settings not available.</div>}

                {settings && (
                  <div className={['grid gap-4 md:grid-cols-2', settingsNotice ? 'mt-6' : ''].join(' ')}>
                    <label>
                      <span className="field-label">Provider</span>
                      <select
                        className="field-input"
                        value={settings.provider || ''}
                        onChange={(e) => setSettings((prev) => ({ ...(prev || {}), provider: e.target.value }))}
                      >
                        <option value="openai">openai</option>
                        <option value="anthropic">anthropic</option>
                        <option value="ollama">ollama</option>
                      </select>
                    </label>
                    <label>
                      <span className="field-label">Model</span>
                      <input
                        className="field-input"
                        value={settings.model || ''}
                        onChange={(e) => setSettings((prev) => ({ ...(prev || {}), model: e.target.value }))}
                        placeholder="gpt-4o-mini"
                      />
                    </label>
                    <label className="md:col-span-2">
                      <span className="field-label">Ollama Base URL</span>
                      <input
                        className="field-input"
                        value={settings.ollama_base_url || ''}
                        onChange={(e) => setSettings((prev) => ({ ...(prev || {}), ollama_base_url: e.target.value }))}
                        placeholder="http://localhost:11434"
                      />
                    </label>
                    <label>
                      <span className="field-label">Max Tokens</span>
                      <input
                        className="field-input"
                        value={String(settings.max_tokens ?? '')}
                        onChange={(e) => setSettings((prev) => ({ ...(prev || {}), max_tokens: Number(e.target.value) }))}
                        inputMode="numeric"
                      />
                    </label>
                    <label>
                      <span className="field-label">Temperature</span>
                      <input
                        className="field-input"
                        value={String(settings.temperature ?? '')}
                        onChange={(e) => setSettings((prev) => ({ ...(prev || {}), temperature: Number(e.target.value) }))}
                        inputMode="decimal"
                      />
                    </label>

                  <label>
                    <span className="field-label">OpenAI Key {settings.has_openai_key ? '(set)' : ''}</span>
                    <input
                      className="field-input"
                      type="password"
                      value={settings.openai_key || ''}
                      onChange={(e) => setSettings((prev) => ({ ...(prev || {}), openai_key: e.target.value }))}
                      placeholder="sk-..."
                    />
                  </label>
                  <label>
                    <span className="field-label">Anthropic Key {settings.has_anthropic_key ? '(set)' : ''}</span>
                    <input
                      className="field-input"
                      type="password"
                      value={settings.anthropic_key || ''}
                      onChange={(e) => setSettings((prev) => ({ ...(prev || {}), anthropic_key: e.target.value }))}
                      placeholder="..."
                    />
                  </label>

                  <label className="flex items-center gap-2 text-sm text-sand-700">
                    <input
                      type="checkbox"
                      checked={!!settings.verbose}
                      onChange={(e) => setSettings((prev) => ({ ...(prev || {}), verbose: e.target.checked }))}
                    />
                    Verbose
                  </label>
                  <label className="flex items-center gap-2 text-sm text-sand-700">
                    <input
                      type="checkbox"
                      checked={!!settings.auto_summary}
                      onChange={(e) => setSettings((prev) => ({ ...(prev || {}), auto_summary: e.target.checked }))}
                    />
                    Auto summary
                  </label>
                  </div>
                )}

                {me?.role === 'admin' && (
                  <div className="mt-10">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-2xl font-semibold text-stone-900">Users</h3>
                        <p className="mt-1 text-sm text-sand-700">Create users and assign them to tasks.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          startNew('user', {
                            username: '',
                            name: '',
                            role: 'developer',
                            password: ''
                          })
                        }
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={crudBusy}
                      >
                        New user
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {users.length === 0 ? (
                        <div className="text-sm text-sand-700">No users yet.</div>
                      ) : (
                        users.map((u) => (
                          <div key={u.id} className="rounded-xl border border-sand-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-lg font-semibold text-stone-900">
                                  {u.name}
                                  {u.id === me?.id ? <span className="text-sand-700"> (you)</span> : null}
                                </div>
                                <div className="mt-1 text-sm text-sand-700">@{u.username || u.emailAddress}</div>
                              </div>
                              <div className="flex flex-wrap items-start gap-2">
                                <span className="pill">{u.role}</span>
                                <button
                                  type="button"
                                  onClick={() => startEdit('user', u)}
                                  className="rounded-lg border border-sand-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                  disabled={crudBusy}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => askDelete('user', [u.id])}
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={crudBusy || (u.id === me?.id && otherAdminCount < 1)}
                                  title={
                                    u.id === me?.id && otherAdminCount < 1
                                      ? 'Create another admin first.'
                                      : 'Delete user'
                                  }
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 w-52 overflow-hidden rounded-xl border border-sand-200 bg-white shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => startEdit(contextMenu.kind, contextMenu.item)}
            className="w-full px-3 py-2 text-left text-sm font-semibold text-stone-900 hover:bg-sand-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => askDelete(contextMenu.kind, [String(contextMenu.item?.id || '')])}
            className="w-full px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      )}

      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 lg:items-center"
          onMouseDown={() => setEdit(null)}
        >
          <div className="panel max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto p-6" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">
                  {String(edit.draft?.id || '').trim() ? 'Edit' : 'New'}
                </div>
                <h3 className="text-2xl font-semibold text-stone-900">
                  {kindLabels[edit.kind]?.singular ? kindLabels[edit.kind].singular.toUpperCase() : 'ITEM'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                disabled={crudBusy}
              >
                Close
              </button>
            </div>

            {edit.kind === 'organization' && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="field-label">Name</span>
                  <input className="field-input" value={edit.draft.name || ''} onChange={(e) => updateEditDraft({ name: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Industry</span>
                  <input className="field-input" value={edit.draft.industry || ''} onChange={(e) => updateEditDraft({ industry: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Website</span>
                  <input className="field-input" value={edit.draft.website || ''} onChange={(e) => updateEditDraft({ website: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Email</span>
                  <input className="field-input" value={edit.draft.email || ''} onChange={(e) => updateEditDraft({ email: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Phone</span>
                  <input className="field-input" value={edit.draft.phone || ''} onChange={(e) => updateEditDraft({ phone: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Billing Email</span>
                  <input
                    className="field-input"
                    value={edit.draft.billingEmail || ''}
                    onChange={(e) => updateEditDraft({ billingEmail: e.target.value })}
                  />
                </label>
                <label>
                  <span className="field-label">Tax ID</span>
                  <input className="field-input" value={edit.draft.taxId || ''} onChange={(e) => updateEditDraft({ taxId: e.target.value })} />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Address</span>
                  <input className="field-input" value={edit.draft.address || ''} onChange={(e) => updateEditDraft({ address: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">City</span>
                  <input className="field-input" value={edit.draft.city || ''} onChange={(e) => updateEditDraft({ city: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Country</span>
                  <input className="field-input" value={edit.draft.country || ''} onChange={(e) => updateEditDraft({ country: e.target.value })} />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Notes</span>
                  <textarea className="field-input" rows={4} value={edit.draft.notes || ''} onChange={(e) => updateEditDraft({ notes: e.target.value })} />
                </label>
              </div>
            )}

            {edit.kind === 'contact' && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="field-label">Organization</span>
                  <select
                    className="field-input"
                    value={edit.draft.organizationId || ''}
                    onChange={(e) => updateEditDraft({ organizationId: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">First Name</span>
                  <input className="field-input" value={edit.draft.firstName || ''} onChange={(e) => updateEditDraft({ firstName: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Last Name</span>
                  <input className="field-input" value={edit.draft.lastName || ''} onChange={(e) => updateEditDraft({ lastName: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Job Title</span>
                  <input className="field-input" value={edit.draft.jobTitle || ''} onChange={(e) => updateEditDraft({ jobTitle: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Email</span>
                  <input className="field-input" value={edit.draft.email || ''} onChange={(e) => updateEditDraft({ email: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Phone</span>
                  <input className="field-input" value={edit.draft.phone || ''} onChange={(e) => updateEditDraft({ phone: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Mobile</span>
                  <input className="field-input" value={edit.draft.mobile || ''} onChange={(e) => updateEditDraft({ mobile: e.target.value })} />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">LinkedIn URL</span>
                  <input
                    className="field-input"
                    value={edit.draft.linkedinUrl || ''}
                    onChange={(e) => updateEditDraft({ linkedinUrl: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-sand-700">
                  <input
                    type="checkbox"
                    checked={!!edit.draft.primaryContact}
                    onChange={(e) => updateEditDraft({ primaryContact: e.target.checked })}
                  />
                  Primary contact
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Notes</span>
                  <textarea className="field-input" rows={4} value={edit.draft.notes || ''} onChange={(e) => updateEditDraft({ notes: e.target.value })} />
                </label>
              </div>
            )}

            {edit.kind === 'deal' && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="field-label">Title</span>
                  <input className="field-input" value={edit.draft.title || ''} onChange={(e) => updateEditDraft({ title: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Organization</span>
                  <select
                    className="field-input"
                    value={edit.draft.organizationId || ''}
                    onChange={(e) => updateEditDraft({ organizationId: e.target.value, contactId: '' })}
                  >
                    <option value="">Select...</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">Contact</span>
                  <select
                    className="field-input"
                    value={edit.draft.contactId || ''}
                    onChange={(e) => updateEditDraft({ contactId: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {contacts
                      .filter((c) => !edit.draft.organizationId || c.organizationId === edit.draft.organizationId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">Stage</span>
                  <select
                    className="field-input"
                    value={edit.draft.pipelineStageId || ''}
                    onChange={(e) => updateEditDraft({ pipelineStageId: e.target.value })}
                  >
                    <option value="">None</option>
                    {pipelineStages.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">Status</span>
                  <select className="field-input" value={edit.draft.status || 'open'} onChange={(e) => updateEditDraft({ status: e.target.value })}>
                    <option value="open">open</option>
                    <option value="won">won</option>
                    <option value="lost">lost</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">Value</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.value ?? 0)}
                    onChange={(e) => updateEditDraft({ value: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Currency</span>
                  <input className="field-input" value={edit.draft.currency || ''} onChange={(e) => updateEditDraft({ currency: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Probability (%)</span>
                  <input
                    className="field-input"
                    inputMode="numeric"
                    value={String(edit.draft.probability ?? 0)}
                    onChange={(e) => updateEditDraft({ probability: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Expected Close</span>
                  <input
                    className="field-input"
                    type="date"
                    value={isoToDateInput(edit.draft.expectedCloseAt)}
                    onChange={(e) => updateEditDraft({ expectedCloseAt: dateInputToISO(e.target.value) })}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Domain</span>
                  <input
                    className="field-input"
                    value={edit.draft.domain || ''}
                    onChange={(e) => updateEditDraft({ domain: e.target.value })}
                    placeholder="example.com"
                  />
                </label>
                <label>
                  <span className="field-label">Domain Acquired</span>
                  <input
                    className="field-input"
                    type="date"
                    value={isoToDateInput(edit.draft.domainAcquiredAt)}
                    onChange={(e) => updateEditDraft({ domainAcquiredAt: dateInputToISO(e.target.value) })}
                  />
                </label>
                <label>
                  <span className="field-label">Domain Expires</span>
                  <input
                    className="field-input"
                    type="date"
                    value={isoToDateInput(edit.draft.domainExpiresAt)}
                    onChange={(e) => updateEditDraft({ domainExpiresAt: dateInputToISO(e.target.value) })}
                  />
                </label>
                <label>
                  <span className="field-label">Domain Cost</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.domainCost ?? 0)}
                    onChange={(e) => updateEditDraft({ domainCost: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Deposit (Acconto)</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.deposit ?? 0)}
                    onChange={(e) => updateEditDraft({ deposit: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Costs</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.costs ?? 0)}
                    onChange={(e) => updateEditDraft({ costs: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Taxes</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.taxes ?? 0)}
                    onChange={(e) => updateEditDraft({ taxes: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Net Total</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.netTotal ?? 0)}
                    onChange={(e) => updateEditDraft({ netTotal: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Work Closed</span>
                  <input
                    className="field-input"
                    type="date"
                    value={isoToDateInput(edit.draft.workClosedAt)}
                    onChange={(e) => updateEditDraft({ workClosedAt: dateInputToISO(e.target.value) })}
                  />
                </label>
                <label>
                  <span className="field-label">Gil</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.shareGil ?? 0)}
                    onChange={(e) => updateEditDraft({ shareGil: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Ric</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.shareRic ?? 0)}
                    onChange={(e) => updateEditDraft({ shareRic: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Work Type</span>
                  <input className="field-input" value={edit.draft.workType || ''} onChange={(e) => updateEditDraft({ workType: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Source</span>
                  <input className="field-input" value={edit.draft.source || ''} onChange={(e) => updateEditDraft({ source: e.target.value })} />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Description</span>
                  <textarea
                    className="field-input"
                    rows={4}
                    value={edit.draft.description || ''}
                    onChange={(e) => updateEditDraft({ description: e.target.value })}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Notes</span>
                  <textarea className="field-input" rows={3} value={edit.draft.notes || ''} onChange={(e) => updateEditDraft({ notes: e.target.value })} />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Lost Reason</span>
                  <input className="field-input" value={edit.draft.lostReason || ''} onChange={(e) => updateEditDraft({ lostReason: e.target.value })} />
                </label>
              </div>
            )}

            {edit.kind === 'payment' && (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <label className="md:col-span-3">
                  <span className="field-label">Deal</span>
                  <select className="field-input" value={edit.draft.dealId || ''} onChange={(e) => updateEditDraft({ dealId: e.target.value })}>
                    <option value="">Select...</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="md:col-span-2">
                  <span className="field-label">Title</span>
                  <input className="field-input" value={edit.draft.title || ''} onChange={(e) => updateEditDraft({ title: e.target.value })} placeholder="Deposit / Milestone / Final" />
                </label>
                <label>
                  <span className="field-label">Amount</span>
                  <input className="field-input" inputMode="decimal" value={String(edit.draft.amount ?? 0)} onChange={(e) => updateEditDraft({ amount: Number(e.target.value) || 0 })} />
                </label>

                <label>
                  <span className="field-label">Status</span>
                  <select className="field-input" value={edit.draft.status || 'paid'} onChange={(e) => updateEditDraft({ status: e.target.value })}>
                    <option value="planned">planned</option>
                    <option value="paid">paid</option>
                    <option value="void">void</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">Due date</span>
                  <input
                    className="field-input"
                    type="date"
                    value={isoToDateInput(edit.draft.dueAt as any)}
                    onChange={(e) => updateEditDraft({ dueAt: dateInputToISO(e.target.value) })}
                  />
                </label>
                <label>
                  <span className="field-label">Paid date</span>
                  <input
                    className="field-input"
                    type="date"
                    value={isoToDateInput(edit.draft.paidAt as any)}
                    onChange={(e) => updateEditDraft({ paidAt: dateInputToISO(e.target.value) })}
                  />
                </label>

                <label className="md:col-span-2">
                  <span className="field-label">Method</span>
                  <input className="field-input" value={edit.draft.method || ''} onChange={(e) => updateEditDraft({ method: e.target.value })} placeholder="Bank transfer / Cash / Stripe" />
                </label>
                <label>
                  <span className="field-label">Currency</span>
                  <input className="field-input" value={edit.draft.currency || ''} onChange={(e) => updateEditDraft({ currency: e.target.value })} placeholder="EUR" />
                </label>

                <label>
                  <span className="field-label">Gil amount</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.gilAmount ?? 0)}
                    onChange={(e) => updateEditDraft({ gilAmount: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Ric amount</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.ricAmount ?? 0)}
                    onChange={(e) => updateEditDraft({ ricAmount: Number(e.target.value) || 0 })}
                  />
                </label>
                <div className="hidden md:block" />

                <label className="md:col-span-3">
                  <span className="field-label">Notes</span>
                  <textarea className="field-input" rows={3} value={edit.draft.notes || ''} onChange={(e) => updateEditDraft({ notes: e.target.value })} />
                </label>
              </div>
            )}

            {edit.kind === 'user' && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="field-label">Username</span>
                  <input
                    className="field-input"
                    value={edit.draft.username || ''}
                    onChange={(e) => updateEditDraft({ username: e.target.value })}
                    placeholder="john"
                    autoComplete="off"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Name</span>
                  <input className="field-input" value={edit.draft.name || ''} onChange={(e) => updateEditDraft({ name: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Role</span>
                  <select className="field-input" value={edit.draft.role || 'developer'} onChange={(e) => updateEditDraft({ role: e.target.value })}>
                    <option value="developer">developer</option>
                    <option value="project_manager">project_manager</option>
                    <option value="sales">sales</option>
                    <option value="admin">admin</option>
                  </select>
                </label>
                <div className="hidden md:block" />
                <label className="md:col-span-2">
                  <span className="field-label">{String(edit.draft?.id || '').trim() ? 'Password (optional)' : 'Password'}</span>
                  <input
                    className="field-input"
                    type="password"
                    value={edit.draft.password || ''}
                    onChange={(e) => updateEditDraft({ password: e.target.value })}
                    placeholder={String(edit.draft?.id || '').trim() ? 'Leave blank to keep existing password' : 'Required'}
                    autoComplete="new-password"
                  />
                </label>
              </div>
            )}

            {edit.kind === 'project' && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="field-label">Deal</span>
                  <select className="field-input" value={edit.draft.dealId || ''} onChange={(e) => updateEditDraft({ dealId: e.target.value })}>
                    <option value="">Select...</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="md:col-span-2 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">
                  Project name is derived from the Deal title.
                </div>
                <label>
                  <span className="field-label">Status</span>
                  <select
                    className="field-input"
                    value={edit.draft.status || 'active'}
                    onChange={(e) => updateEditDraft({ status: e.target.value })}
                  >
                    <option value="active">active</option>
                    <option value="completed">completed</option>
                    <option value="support">support</option>
                  </select>
                </label>
                <div className="hidden md:block" />
                <label>
                  <span className="field-label">Start Date</span>
                  <input
                    className="field-input"
                    type="date"
                    value={isoToDateInput(edit.draft.startDate)}
                    onChange={(e) => updateEditDraft({ startDate: dateInputToISO(e.target.value) })}
                  />
                </label>
                <label>
                  <span className="field-label">Target End Date</span>
                  <input
                    className="field-input"
                    type="date"
                    value={isoToDateInput(edit.draft.targetEndDate)}
                    onChange={(e) => updateEditDraft({ targetEndDate: dateInputToISO(e.target.value) })}
                  />
                </label>
                <label>
                  <span className="field-label">Actual End Date</span>
                  <input
                    className="field-input"
                    type="date"
                    value={isoToDateInput(edit.draft.actualEndDate)}
                    onChange={(e) => updateEditDraft({ actualEndDate: dateInputToISO(e.target.value) })}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Description</span>
                  <textarea
                    className="field-input"
                    rows={4}
                    value={edit.draft.description || ''}
                    onChange={(e) => updateEditDraft({ description: e.target.value })}
                  />
                </label>
              </div>
            )}

            {edit.kind === 'task' && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="field-label">Project</span>
                  <select className="field-input" value={edit.draft.projectId || ''} onChange={(e) => updateEditDraft({ projectId: e.target.value })}>
                    <option value="">Select...</option>
                    {projects.map((p) => {
                      const d = dealById.get(p.dealId);
                      return (
                        <option key={p.id} value={p.id}>
                          {d?.title || p.name || p.id}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Owner</span>
                  <select
                    className="field-input"
                    value={edit.draft.ownerUserId || ''}
                    onChange={(e) => updateEditDraft({ ownerUserId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · @{u.username || u.emailAddress}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Title</span>
                  <input className="field-input" value={edit.draft.title || ''} onChange={(e) => updateEditDraft({ title: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Status</span>
                  <select className="field-input" value={edit.draft.status || 'todo'} onChange={(e) => updateEditDraft({ status: e.target.value })}>
                    <option value="todo">todo</option>
                    <option value="in_progress">in_progress</option>
                    <option value="blocked">blocked</option>
                    <option value="done">done</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">Priority</span>
                  <input
                    className="field-input"
                    inputMode="numeric"
                    value={String(edit.draft.priority ?? 0)}
                    onChange={(e) => updateEditDraft({ priority: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Due Date</span>
                  <input
                    className="field-input"
                    type="date"
                    value={isoToDateInput(edit.draft.dueDate)}
                    onChange={(e) => updateEditDraft({ dueDate: dateInputToISO(e.target.value) })}
                  />
                </label>
                <label>
                  <span className="field-label">Estimated Hours</span>
                  <input
                    className="field-input"
                    inputMode="numeric"
                    value={String(edit.draft.estimatedHours ?? 0)}
                    onChange={(e) => updateEditDraft({ estimatedHours: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Actual Hours</span>
                  <input
                    className="field-input"
                    inputMode="numeric"
                    value={String(edit.draft.actualHours ?? 0)}
                    onChange={(e) => updateEditDraft({ actualHours: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Description</span>
                  <textarea
                    className="field-input"
                    rows={4}
                    value={edit.draft.description || ''}
                    onChange={(e) => updateEditDraft({ description: e.target.value })}
                  />
                </label>
              </div>
            )}

            {edit.kind === 'quotation' && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="field-label">Number</span>
                  <input className="field-input" value={edit.draft.number || ''} disabled />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Deal</span>
                  <select className="field-input" value={edit.draft.dealId || ''} onChange={(e) => updateEditDraft({ dealId: e.target.value })}>
                    <option value="">Select...</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Title</span>
                  <input className="field-input" value={edit.draft.title || ''} onChange={(e) => updateEditDraft({ title: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Status</span>
                  <select
                    className="field-input"
                    value={edit.draft.status || 'draft'}
                    onChange={(e) => updateEditDraft({ status: e.target.value })}
                  >
                    <option value="draft">draft</option>
                    <option value="sent">sent</option>
                    <option value="viewed">viewed</option>
                    <option value="accepted">accepted</option>
                    <option value="declined">declined</option>
                    <option value="expired">expired</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">Currency</span>
                  <input className="field-input" value={edit.draft.currency || ''} onChange={(e) => updateEditDraft({ currency: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Valid Until</span>
                  <input
                    className="field-input"
                    type="date"
                    value={isoToDateInput(edit.draft.validUntil)}
                    onChange={(e) => updateEditDraft({ validUntil: dateInputToISO(e.target.value) })}
                  />
                </label>
                <label>
                  <span className="field-label">Tax Rate (%)</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.taxRate ?? 0)}
                    onChange={(e) => updateEditDraft({ taxRate: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Discount Amount</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.discountAmount ?? 0)}
                    onChange={(e) => updateEditDraft({ discountAmount: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Introduction</span>
                  <textarea
                    className="field-input"
                    rows={4}
                    value={edit.draft.introduction || ''}
                    onChange={(e) => updateEditDraft({ introduction: e.target.value })}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Terms</span>
                  <textarea className="field-input" rows={4} value={edit.draft.terms || ''} onChange={(e) => updateEditDraft({ terms: e.target.value })} />
                </label>
              </div>
            )}

            {edit.kind === 'quotationItem' && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="field-label">Quotation</span>
                  <select
                    className="field-input"
                    value={edit.draft.quotationId || ''}
                    onChange={(e) => updateEditDraft({ quotationId: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {quotations.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.number} · {q.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Name</span>
                  <input className="field-input" value={edit.draft.name || ''} onChange={(e) => updateEditDraft({ name: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Quantity</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.quantity ?? 1)}
                    onChange={(e) => updateEditDraft({ quantity: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Unit Price</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.unitPrice ?? 0)}
                    onChange={(e) => updateEditDraft({ unitPrice: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Unit Type</span>
                  <input className="field-input" value={edit.draft.unitType || ''} onChange={(e) => updateEditDraft({ unitType: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Position</span>
                  <input
                    className="field-input"
                    inputMode="numeric"
                    value={String(edit.draft.position ?? 0)}
                    onChange={(e) => updateEditDraft({ position: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Description</span>
                  <textarea
                    className="field-input"
                    rows={4}
                    value={edit.draft.description || ''}
                    onChange={(e) => updateEditDraft({ description: e.target.value })}
                  />
                </label>
              </div>
            )}

            {edit.kind === 'interaction' && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label>
                  <span className="field-label">Type</span>
                  <select
                    className="field-input"
                    value={edit.draft.interactionType || 'note'}
                    onChange={(e) => updateEditDraft({ interactionType: e.target.value })}
                  >
                    <option value="note">note</option>
                    <option value="call">call</option>
                    <option value="email">email</option>
                    <option value="meeting">meeting</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">Occurred At</span>
                  <input
                    className="field-input"
                    type="datetime-local"
                    value={isoToDatetimeLocal(edit.draft.occurredAt)}
                    onChange={(e) => updateEditDraft({ occurredAt: datetimeLocalToISO(e.target.value) })}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Organization (optional)</span>
                  <select
                    className="field-input"
                    value={edit.draft.organizationId || ''}
                    onChange={(e) => updateEditDraft({ organizationId: e.target.value, contactId: '' })}
                  >
                    <option value="">None</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Contact (optional)</span>
                  <select
                    className="field-input"
                    value={edit.draft.contactId || ''}
                    onChange={(e) => updateEditDraft({ contactId: e.target.value })}
                  >
                    <option value="">None</option>
                    {contacts
                      .filter((c) => !edit.draft.organizationId || c.organizationId === edit.draft.organizationId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Deal (optional)</span>
                  <select className="field-input" value={edit.draft.dealId || ''} onChange={(e) => updateEditDraft({ dealId: e.target.value })}>
                    <option value="">None</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Subject</span>
                  <input className="field-input" value={edit.draft.subject || ''} onChange={(e) => updateEditDraft({ subject: e.target.value })} />
                </label>
                <label className="md:col-span-2">
                  <span className="field-label">Body</span>
                  <textarea className="field-input" rows={6} value={edit.draft.body || ''} onChange={(e) => updateEditDraft({ body: e.target.value })} />
                </label>
              </div>
            )}

            <div className="mt-8 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="rounded-xl border border-sand-200 bg-white px-4 py-2 text-sm font-semibold text-sand-700 transition hover:bg-sand-50"
                disabled={crudBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={crudBusy}
              >
                {crudBusy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onMouseDown={() => setConfirmDelete(null)}
        >
          <div className="panel w-full max-w-lg p-6" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-semibold text-stone-900">
              Delete {confirmDelete.label}
              {confirmDelete.ids.length > 1 ? '' : ''}?
            </h3>
            <p className="mt-2 text-sm text-sand-700">
              This will permanently delete{' '}
              <span className="font-semibold">
                {confirmDelete.ids.length} {confirmDelete.label}
              </span>
              . This cannot be undone.
            </p>

            {confirmDelete.kind === 'organization' && (
              <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">
                Deleting an organization also deletes its contacts, deals, projects, tasks, quotations, and related interactions.
              </div>
            )}
            {confirmDelete.kind === 'contact' && (
              <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">
                Deleting a contact also deletes its deals (and their projects, tasks, quotations) plus related interactions.
              </div>
            )}
            {confirmDelete.kind === 'deal' && (
              <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">
                Deleting a deal also deletes its projects, tasks, quotations, quotation items, and related interactions.
              </div>
            )}
            {confirmDelete.kind === 'project' && (
              <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">
                Deleting a project also deletes its tasks.
              </div>
            )}
            {confirmDelete.kind === 'user' && (
              <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">
                Deleting a user signs them out and unassigns any tasks they own.
              </div>
            )}
            {confirmDelete.kind === 'quotation' && (
              <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">
                Deleting a quotation also deletes its quotation items.
              </div>
            )}
            <div className="mt-8 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-sand-200 bg-white px-4 py-2 text-sm font-semibold text-sand-700 transition hover:bg-sand-50"
                disabled={crudBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runDelete(confirmDelete.kind, confirmDelete.ids)}
                className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={crudBusy}
              >
                {crudBusy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
