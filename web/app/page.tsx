'use client';

import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from 'react';
import {
  Contact,
  Deal,
  Interaction,
  Organization,
  Pipeline,
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
  createPipeline,
  createPipelineStage,
  createProject,
  createQuotation,
  createQuotationItem,
  createTask,
  deleteContacts,
  deleteDeals,
  deleteInteractions,
  deleteOrganizations,
  deletePipelineStages,
  deletePipelines,
  deleteProjects,
  deleteQuotationItems,
  deleteQuotations,
  deleteTasks,
  getMe,
  getSettings,
  getState,
  login,
  logout,
  updateSettings
} from '../lib/api';

const views = ['dashboard', 'pipelines', 'organizations', 'contacts', 'deals', 'projects', 'tasks', 'quotations', 'interactions', 'settings'] as const;
type View = (typeof views)[number];

type AppSettings = {
  theme?: string;
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

function currency(amount: number, code: string) {
  const safe = Number.isFinite(amount) ? amount : 0;
  const c = code || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(safe);
  } catch {
    return `${safe.toFixed(2)} ${c}`;
  }
}

type CrudKind =
  | 'organization'
  | 'contact'
  | 'deal'
  | 'pipeline'
  | 'pipelineStage'
  | 'project'
  | 'task'
  | 'quotation'
  | 'quotationItem'
  | 'interaction';

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

export default function HomePage() {
  const [view, setView] = useState<View>('dashboard');
  const [me, setMe] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('admin@wemadeit.local');
  const [loginPassword, setLoginPassword] = useState('admin');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
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

  const [dealOrgId, setDealOrgId] = useState('');
  const [dealContactId, setDealContactId] = useState('');
  const [dealTitle, setDealTitle] = useState('');
  const [dealValue, setDealValue] = useState<number>(0);
  const [dealCurrency, setDealCurrency] = useState('USD');
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

  const [projectDealId, setProjectDealId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projectBudget, setProjectBudget] = useState<number>(0);
  const [projectCurrency, setProjectCurrency] = useState('USD');

  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskStatus, setTaskStatus] = useState('todo');
  const [taskPriority, setTaskPriority] = useState<number>(1);
  const [taskEstimatedHours, setTaskEstimatedHours] = useState<number>(1);

  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDescription, setPipelineDescription] = useState('');
  const [pipelineDefault, setPipelineDefault] = useState(true);

  const [stagePipelineId, setStagePipelineId] = useState('');
  const [stageName, setStageName] = useState('');
  const [stageColor, setStageColor] = useState('#CF8445');
  const [stageProbability, setStageProbability] = useState<number>(10);

  const [quoteDealId, setQuoteDealId] = useState('');
  const [quoteTitle, setQuoteTitle] = useState('');
  const [quoteCurrency, setQuoteCurrency] = useState('USD');
  const [quoteTaxRate, setQuoteTaxRate] = useState<number>(22);
  const [quoteDiscountAmount, setQuoteDiscountAmount] = useState<number>(0);
  const [quoteValidUntil, setQuoteValidUntil] = useState('');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>('');

  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0);
  const [itemUnitType, setItemUnitType] = useState('hour');

  const [interactionType, setInteractionType] = useState('note');
  const [interactionSubject, setInteractionSubject] = useState('');
  const [interactionBody, setInteractionBody] = useState('');
  const [interactionOrgId, setInteractionOrgId] = useState('');
  const [interactionContactId, setInteractionContactId] = useState('');
  const [interactionDealId, setInteractionDealId] = useState('');

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  const [crudBusy, setCrudBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(null);

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    const theme = (settings?.theme || 'sand').toLowerCase();
    document.documentElement.dataset.theme = theme;
  }, [settings?.theme]);

  useEffect(() => {
    if (!dealStageId && pipelineStages.length > 0) {
      setDealStageId(pipelineStages[0].id);
    }
  }, [dealStageId, pipelineStages]);

  useEffect(() => {
    if (!stagePipelineId && pipelines.length > 0) {
      setStagePipelineId(pipelines[0].id);
    }
  }, [pipelines, stagePipelineId]);

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
      setPipelines(data.pipelines);
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
    const email = loginEmail.trim();
    const password = loginPassword;
    if (!email || !password) {
      setAuthError('Email and password are required.');
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      const result = await login(email, password);
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

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const pipelineById = useMemo(() => {
    const map = new Map<string, Pipeline>();
    pipelines.forEach((p) => map.set(p.id, p));
    return map;
  }, [pipelines]);

  const stageById = useMemo(() => {
    const map = new Map<string, PipelineStage>();
    pipelineStages.forEach((st) => map.set(st.id, st));
    return map;
  }, [pipelineStages]);

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
  const dealsByStageId = useMemo(() => {
    const map = new Map<string, number>();
    deals.forEach((d) => {
      const id = (d.pipelineStageId || '').trim();
      if (!id) return;
      map.set(id, (map.get(id) || 0) + 1);
    });
    return map;
  }, [deals]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const kindLabels: Record<CrudKind, { singular: string; plural: string }> = {
    organization: { singular: 'organization', plural: 'organizations' },
    contact: { singular: 'contact', plural: 'contacts' },
    deal: { singular: 'deal', plural: 'deals' },
    pipeline: { singular: 'pipeline', plural: 'pipelines' },
    pipelineStage: { singular: 'stage', plural: 'stages' },
    project: { singular: 'project', plural: 'projects' },
    task: { singular: 'task', plural: 'tasks' },
    quotation: { singular: 'quotation', plural: 'quotations' },
    quotationItem: { singular: 'quotation item', plural: 'quotation items' },
    interaction: { singular: 'interaction', plural: 'interactions' }
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
    setEdit({ kind, draft: { ...item } });
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
          break;
        case 'deal':
          await deleteDeals(clean);
          break;
        case 'pipeline':
          await deletePipelines(clean);
          break;
        case 'pipelineStage':
          await deletePipelineStages(clean);
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
        case 'pipeline':
          await createPipeline(edit.draft as Pipeline);
          break;
        case 'pipelineStage':
          await createPipelineStage(edit.draft as PipelineStage);
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
        currency: dealCurrency.trim() || 'USD',
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
      await createDeal({
        ...deal,
        pipelineStageId: stageId
      });
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update deal';
      setNotice(msg);
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
        currency: projectCurrency.trim() || 'USD',
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

  async function onCreatePipeline() {
    setNotice(null);
    const name = pipelineName.trim();
    if (!name) {
      setNotice('Pipeline name is required.');
      return;
    }
    try {
      const created = await createPipeline({
        name,
        description: pipelineDescription.trim(),
        default: pipelineDefault
      });
      setPipelineName('');
      setPipelineDescription('');
      setPipelineDefault(false);
      setStagePipelineId(created.id);
      await refresh();
      setNotice('Pipeline saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create pipeline';
      setNotice(msg);
    }
  }

  async function onCreateStage() {
    setNotice(null);
    const pipelineId = stagePipelineId.trim();
    const name = stageName.trim();
    if (!pipelineId) {
      setNotice('Select a pipeline.');
      return;
    }
    if (!name) {
      setNotice('Stage name is required.');
      return;
    }
    try {
      await createPipelineStage({
        pipelineId,
        name,
        color: stageColor.trim(),
        probability: Number(stageProbability) || 0
      });
      setStageName('');
      setStageProbability(10);
      await refresh();
      setNotice('Stage saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create stage';
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
        currency: quoteCurrency.trim() || 'USD',
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

  async function onCreateInteraction() {
    setNotice(null);
    const body = interactionBody.trim();
    if (!body && !interactionSubject.trim()) {
      setNotice('Add a subject or body.');
      return;
    }
    try {
      await createInteraction({
        interactionType: interactionType.trim(),
        subject: interactionSubject.trim(),
        body,
        organizationId: interactionOrgId.trim(),
        contactId: interactionContactId.trim(),
        dealId: interactionDealId.trim(),
        occurredAt: new Date().toISOString()
      });
      setInteractionSubject('');
      setInteractionBody('');
      await refresh();
      setNotice('Interaction saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create interaction';
      setNotice(msg);
    }
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
                <span className="field-label">Email</span>
                <input
                  className="field-input"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@wemadeit.local"
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
                className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {authBusy ? 'Signing in...' : 'Sign in'}
              </button>

              <div className="rounded-xl border border-sand-200 bg-white/70 p-3 text-xs text-sand-700">
                Default dev login: <span className="font-semibold">admin@wemadeit.local</span> / <span className="font-semibold">admin</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-sand-50 text-stoneink">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-sand-200/50 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-orange-200/35 blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/3 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full max-w-none grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[320px_1fr] lg:px-8">
        <aside className="panel animate-enter p-5 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-hidden">
          <div className="mb-6 border-b border-sand-200 pb-4">
            <h1 className="text-3xl leading-none text-sand-900">WeMadeIt</h1>
            <p className="mt-2 max-w-[24ch] text-sm text-sand-700">Pipeline to delivery, in one place.</p>
          </div>

          <div className="mb-6 grid gap-3 rounded-xl border border-sand-200 bg-white/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-stone-900">{me.name}</div>
                <div className="mt-1 text-xs text-sand-700">{me.emailAddress}</div>
              </div>
              <span className="pill">{me.role}</span>
            </div>
            <button
              onClick={() => void onLogout()}
              className="rounded-lg border border-sand-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-100"
            >
              Sign out
            </button>
          </div>

          <nav className="space-y-2">
            {views.map((v) => (
              <button
                key={v}
                onClick={() => {
                  setNotice(null);
                  setSettingsNotice(null);
                  setView(v);
                }}
                className={[
                  'group w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold tracking-wide transition',
                  view === v
                    ? 'border-sand-500 bg-sand-100 text-sand-900'
                    : 'border-transparent bg-white/50 text-sand-700 hover:border-sand-300 hover:bg-white'
                ].join(' ')}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </nav>

          <div className="mt-6 grid gap-2 rounded-xl border border-sand-200 bg-white/70 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span>Orgs</span>
              <strong>{organizations.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Contacts</span>
              <strong>{contacts.length}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Pipelines</span>
              <strong>{pipelines.length}</strong>
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
            className="mt-4 w-full rounded-xl border border-sand-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-100"
          >
            Refresh
          </button>

          {notice && (
            <div className="mt-4 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">{notice}</div>
          )}
        </aside>

        <section className="space-y-6">
          {view === 'dashboard' && (
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="panel animate-enter p-6" style={{ animationDelay: '40ms' }}>
                <h2 className="text-3xl text-sand-900">Now</h2>
                <p className="mt-1 text-sm text-sand-700">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-xl border border-sand-200 bg-white p-4">
                    <div className="field-label">Open Deals</div>
                    <div className="mt-2 text-2xl font-semibold text-stone-900">{openDeals}</div>
                  </div>
                  <div className="rounded-xl border border-sand-200 bg-white p-4">
                    <div className="field-label">Projects</div>
                    <div className="mt-2 text-2xl font-semibold text-stone-900">{projects.length}</div>
                  </div>
                  <div className="rounded-xl border border-sand-200 bg-white p-4">
                    <div className="field-label">Tasks Done</div>
                    <div className="mt-2 text-2xl font-semibold text-stone-900">
                      {doneTasks} <span className="text-sm text-sand-700">/ {tasks.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel animate-enter p-6" style={{ animationDelay: '110ms' }}>
                <h2 className="text-3xl text-sand-900">Recent Deals</h2>
                <div className="mt-4 space-y-3">
                  {deals.length === 0 && <div className="text-sm text-sand-700">No deals yet.</div>}
                  {deals.slice(0, 6).map((d) => {
                    const org = orgById.get(d.organizationId);
                    const contact = contactById.get(d.contactId);
                    const stage = stageById.get(d.pipelineStageId);
                    return (
                      <div key={d.id} className="rounded-xl border border-sand-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-lg font-semibold text-stone-900">{d.title}</div>
                            <div className="mt-1 text-sm text-sand-700">
                              {org?.name || 'Unknown org'}
                              {contact ? ` · ${contact.firstName} ${contact.lastName}` : ''}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="pill">{d.status}</span>
                            {stage && <span className="pill">{stage.name}</span>}
                            <span className="pill">{currency(d.value, d.currency)}</span>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-sand-700">Probability: {d.probability || 0}%</div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <span className="field-label">Stage</span>
                          <select
                            className="w-full max-w-xs rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-sand-500 focus:outline-none focus:ring-2 focus:ring-sand-300"
                            value={d.pipelineStageId || ''}
                            onChange={(e) => void onUpdateDealStage(d, e.target.value)}
                          >
                            <option value="">None</option>
                            {pipelineStages.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {view === 'pipelines' && (
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <div className="space-y-6">
                <div className="panel animate-enter p-6">
                  <h2 className="text-3xl text-sand-900">New Pipeline</h2>
                  <div className="mt-4 grid gap-4">
                    <label>
                      <span className="field-label">Name</span>
                      <input className="field-input" value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} placeholder="Sales pipeline" />
                    </label>
                    <label>
                      <span className="field-label">Description</span>
                      <input
                        className="field-input"
                        value={pipelineDescription}
                        onChange={(e) => setPipelineDescription(e.target.value)}
                        placeholder="Optional"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-sand-700">
                      <input type="checkbox" checked={pipelineDefault} onChange={(e) => setPipelineDefault(e.target.checked)} />
                      Default pipeline
                    </label>
                    <button
                      onClick={() => void onCreatePipeline()}
                      className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="panel animate-enter p-6" style={{ animationDelay: '60ms' }}>
                  <h2 className="text-3xl text-sand-900">New Stage</h2>
                  <div className="mt-4 grid gap-4">
                    <label>
                      <span className="field-label">Pipeline</span>
                      <select className="field-input" value={stagePipelineId} onChange={(e) => setStagePipelineId(e.target.value)}>
                        <option value="">Select...</option>
                        {pipelines.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="field-label">Name</span>
                      <input className="field-input" value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="Lead" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label>
                        <span className="field-label">Color</span>
                        <input className="field-input" type="color" value={stageColor} onChange={(e) => setStageColor(e.target.value)} />
                      </label>
                      <label>
                        <span className="field-label">Probability (%)</span>
                        <input
                          className="field-input"
                          value={String(stageProbability)}
                          onChange={(e) => setStageProbability(Number(e.target.value))}
                          inputMode="numeric"
                          placeholder="10"
                        />
                      </label>
                    </div>
                    <button
                      onClick={() => void onCreateStage()}
                      className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800"
                      disabled={pipelines.length === 0}
                    >
                      Save
                    </button>
                    {pipelines.length === 0 && <div className="text-sm text-sand-700">Create a pipeline first.</div>}
                  </div>
                </div>
              </div>

              <div className="panel animate-enter p-6" style={{ animationDelay: '120ms' }}>
                <h2 className="text-3xl text-sand-900">Pipelines</h2>
                <div className="mt-4 space-y-4">
                  {pipelines.length === 0 && <div className="text-sm text-sand-700">No pipelines yet.</div>}
                  {pipelines.map((p) => {
                    const stages = pipelineStages
                      .filter((st) => st.pipelineId === p.id)
                      .slice()
                      .sort((a, b) => (a.position || 0) - (b.position || 0));
                    return (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-sand-200 bg-white p-5"
                        onContextMenu={(e) => onItemContextMenu(e, 'pipeline', p)}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-lg font-semibold text-stone-900">{p.name}</div>
                            {p.description && <div className="mt-1 text-sm text-sand-700">{p.description}</div>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {p.default && <span className="pill">DEFAULT</span>}
                            <span className="pill">{stages.length} stages</span>
                            <button
                              type="button"
                              onClick={(e) => onItemActionsClick(e, 'pipeline', p)}
                              className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                            >
                              ...
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {stages.map((st) => (
                            <div
                              key={st.id}
                              className="rounded-xl border border-sand-200 bg-sand-50 p-3"
                              onContextMenu={(e) => onItemContextMenu(e, 'pipelineStage', st)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-stone-900">{st.name}</div>
                                <div className="flex items-start gap-2">
                                  <div className="h-4 w-4 rounded-full border border-sand-200" style={{ background: st.color || '#e9c29a' }} />
                                  <button
                                    type="button"
                                    onClick={(e) => onItemActionsClick(e, 'pipelineStage', st)}
                                    className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sand-700 transition hover:bg-sand-50"
                                  >
                                    ...
                                  </button>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-sand-700">
                                <span className="pill">{st.probability || 0}%</span>
                                <span className="pill">{dealsByStageId.get(st.id) || 0} deals</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {view === 'organizations' && (
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <div className="panel animate-enter p-6">
                <h2 className="text-3xl text-sand-900">New Organization</h2>
                <div className="mt-4 grid gap-4">
                  <label>
                    <span className="field-label">Name</span>
                    <input className="field-input" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Inc." />
                  </label>
                  <label>
                    <span className="field-label">Website</span>
                    <input
                      className="field-input"
                      value={orgWebsite}
                      onChange={(e) => setOrgWebsite(e.target.value)}
                      placeholder="https://acme.com"
                    />
                  </label>
                  <label>
                    <span className="field-label">Industry</span>
                    <input className="field-input" value={orgIndustry} onChange={(e) => setOrgIndustry(e.target.value)} placeholder="SaaS" />
                  </label>
                  <button
                    onClick={() => void onCreateOrganization()}
                    className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="panel animate-enter p-6" style={{ animationDelay: '60ms' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-3xl text-sand-900">Organizations</h2>
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

                <div className="mt-4 grid gap-3">
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

          {view === 'contacts' && (
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <div className="panel animate-enter p-6">
                <h2 className="text-3xl text-sand-900">New Contact</h2>
                <div className="mt-4 grid gap-4">
                  <label>
                    <span className="field-label">Organization</span>
                    <select className="field-input" value={contactOrgId} onChange={(e) => setContactOrgId(e.target.value)}>
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
                    <input className="field-input" value={contactFirstName} onChange={(e) => setContactFirstName(e.target.value)} placeholder="First" />
                  </label>
                  <label>
                    <span className="field-label">Last Name</span>
                    <input className="field-input" value={contactLastName} onChange={(e) => setContactLastName(e.target.value)} placeholder="Last" />
                  </label>
                  <label>
                    <span className="field-label">Email</span>
                    <input className="field-input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="name@company.com" />
                  </label>
                  <label>
                    <span className="field-label">Job Title</span>
                    <input className="field-input" value={contactJobTitle} onChange={(e) => setContactJobTitle(e.target.value)} placeholder="VP Ops" />
                  </label>

                  <label className="flex items-center gap-2 text-sm text-sand-700">
                    <input type="checkbox" checked={contactPrimary} onChange={(e) => setContactPrimary(e.target.checked)} />
                    Primary contact
                  </label>

                  <button
                    onClick={() => void onCreateContact()}
                    className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800"
                    disabled={organizations.length === 0}
                  >
                    Save
                  </button>
                  {organizations.length === 0 && <div className="text-sm text-sand-700">Create an organization first.</div>}
                </div>
              </div>

              <div className="panel animate-enter p-6" style={{ animationDelay: '60ms' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-3xl text-sand-900">Contacts</h2>
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

                <div className="mt-4 grid gap-3">
                  {contacts.length === 0 && <div className="text-sm text-sand-700">No contacts yet.</div>}
                  {contacts.map((c) => {
                    const org = orgById.get(c.organizationId);
                    return (
                      <div
                        key={c.id}
                        className="rounded-xl border border-sand-200 bg-white p-4"
                        onContextMenu={(e) => onItemContextMenu(e, 'contact', c)}
                      >
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={selectedSet.has(c.id)} onChange={() => toggleSelected(c.id)} className="mt-1" />
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
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <div className="panel animate-enter p-6">
                <h2 className="text-3xl text-sand-900">New Deal</h2>
                <div className="mt-4 grid gap-4">
                  <label>
                    <span className="field-label">Organization</span>
                    <select
                      className="field-input"
                      value={dealOrgId}
                      onChange={(e) => {
                        setDealOrgId(e.target.value);
                        setDealContactId('');
                      }}
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
                    <select className="field-input" value={dealContactId} onChange={(e) => setDealContactId(e.target.value)}>
                      <option value="">Select...</option>
                      {contacts
                        .filter((c) => !dealOrgId || c.organizationId === dealOrgId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.firstName} {c.lastName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Stage</span>
                    <select className="field-input" value={dealStageId} onChange={(e) => setDealStageId(e.target.value)}>
                      <option value="">None</option>
                      {pipelineStages.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Title</span>
                    <input className="field-input" value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} placeholder="Retainer renewal" />
                  </label>
                  <label>
                    <span className="field-label">Value</span>
                    <input
                      className="field-input"
                      value={String(dealValue)}
                      onChange={(e) => setDealValue(Number(e.target.value))}
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="field-label">Currency</span>
                      <input className="field-input" value={dealCurrency} onChange={(e) => setDealCurrency(e.target.value)} placeholder="USD" />
                    </label>
                    <label>
                      <span className="field-label">Probability (%)</span>
                      <input
                        className="field-input"
                        value={String(dealProbability)}
                        onChange={(e) => setDealProbability(Number(e.target.value))}
                        inputMode="numeric"
                        placeholder="35"
                      />
                    </label>
                  </div>
                  <details className="rounded-xl border border-sand-200 bg-white p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-sand-800">Job details (domain, costs, taxes)</summary>
                    <div className="mt-3 grid gap-3">
                      <label>
                        <span className="field-label">Domain</span>
                        <input className="field-input" value={dealDomain} onChange={(e) => setDealDomain(e.target.value)} placeholder="example.com" />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label>
                          <span className="field-label">Domain Acquired</span>
                          <input
                            className="field-input"
                            type="date"
                            value={dealDomainAcquiredAt}
                            onChange={(e) => setDealDomainAcquiredAt(e.target.value)}
                          />
                        </label>
                        <label>
                          <span className="field-label">Domain Expires</span>
                          <input
                            className="field-input"
                            type="date"
                            value={dealDomainExpiresAt}
                            onChange={(e) => setDealDomainExpiresAt(e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label>
                          <span className="field-label">Domain Cost</span>
                          <input
                            className="field-input"
                            inputMode="decimal"
                            value={String(dealDomainCost)}
                            onChange={(e) => setDealDomainCost(Number(e.target.value))}
                            placeholder="0"
                          />
                        </label>
                        <label>
                          <span className="field-label">Work Type</span>
                          <input
                            className="field-input"
                            value={dealWorkType}
                            onChange={(e) => setDealWorkType(e.target.value)}
                            placeholder="Website / Support"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label>
                          <span className="field-label">Deposit (Acconto)</span>
                          <input
                            className="field-input"
                            inputMode="decimal"
                            value={String(dealDeposit)}
                            onChange={(e) => setDealDeposit(Number(e.target.value))}
                            placeholder="0"
                          />
                        </label>
                        <label>
                          <span className="field-label">Costs</span>
                          <input
                            className="field-input"
                            inputMode="decimal"
                            value={String(dealCosts)}
                            onChange={(e) => setDealCosts(Number(e.target.value))}
                            placeholder="0"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label>
                          <span className="field-label">Taxes</span>
                          <input
                            className="field-input"
                            inputMode="decimal"
                            value={String(dealTaxes)}
                            onChange={(e) => setDealTaxes(Number(e.target.value))}
                            placeholder="0"
                          />
                        </label>
                        <label>
                          <span className="field-label">Net Total</span>
                          <input
                            className="field-input"
                            inputMode="decimal"
                            value={String(dealNetTotal)}
                            onChange={(e) => setDealNetTotal(Number(e.target.value))}
                            placeholder="0"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label>
                          <span className="field-label">Gil</span>
                          <input
                            className="field-input"
                            inputMode="decimal"
                            value={String(dealShareGil)}
                            onChange={(e) => setDealShareGil(Number(e.target.value))}
                            placeholder="0"
                          />
                        </label>
                        <label>
                          <span className="field-label">Ric</span>
                          <input
                            className="field-input"
                            inputMode="decimal"
                            value={String(dealShareRic)}
                            onChange={(e) => setDealShareRic(Number(e.target.value))}
                            placeholder="0"
                          />
                        </label>
                      </div>
                      <label>
                        <span className="field-label">Work Closed</span>
                        <input className="field-input" type="date" value={dealWorkClosedAt} onChange={(e) => setDealWorkClosedAt(e.target.value)} />
                      </label>
                    </div>
                  </details>
                  <button
                    onClick={() => void onCreateDeal()}
                    className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800"
                    disabled={organizations.length === 0 || contacts.length === 0}
                  >
                    Save
                  </button>
                  {(organizations.length === 0 || contacts.length === 0) && (
                    <div className="text-sm text-sand-700">Create an organization and contact first.</div>
                  )}
                </div>
              </div>

              <div className="panel animate-enter p-6" style={{ animationDelay: '60ms' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-3xl text-sand-900">Deals</h2>
                  {deals.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-sand-700">
                      <input
                        type="checkbox"
                        checked={deals.length > 0 && deals.every((d) => selectedSet.has(d.id))}
                        onChange={(e) => selectAll(deals.map((d) => d.id), e.target.checked)}
                      />
                      Select all
                    </label>
                  )}
                </div>

                {selectedIds.length > 0 && (
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

                <div className="mt-4 grid gap-3">
                  {deals.length === 0 && <div className="text-sm text-sand-700">No deals yet.</div>}
                  {deals.map((d) => {
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
                        className="rounded-xl border border-sand-200 bg-white p-4"
                        onContextMenu={(e) => onItemContextMenu(e, 'deal', d)}
                      >
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={selectedSet.has(d.id)} onChange={() => toggleSelected(d.id)} className="mt-1" />
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
            </div>
          )}

          {view === 'projects' && (
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <div className="panel animate-enter p-6">
                <h2 className="text-3xl text-sand-900">New Project</h2>
                <div className="mt-4 grid gap-4">
                  <label>
                    <span className="field-label">Deal</span>
                    <select className="field-input" value={projectDealId} onChange={(e) => setProjectDealId(e.target.value)}>
                      <option value="">Select...</option>
                      {deals.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Name</span>
                    <input className="field-input" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Client website build" />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="field-label">Code</span>
                      <input className="field-input" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} placeholder="WM-002" />
                    </label>
                    <label>
                      <span className="field-label">Budget</span>
                      <input
                        className="field-input"
                        value={String(projectBudget)}
                        onChange={(e) => setProjectBudget(Number(e.target.value))}
                        inputMode="decimal"
                        placeholder="0"
                      />
                    </label>
                  </div>
                  <label>
                    <span className="field-label">Currency</span>
                    <input className="field-input" value={projectCurrency} onChange={(e) => setProjectCurrency(e.target.value)} placeholder="USD" />
                  </label>
                  <button
                    onClick={() => void onCreateProject()}
                    className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800"
                    disabled={deals.length === 0}
                  >
                    Save
                  </button>
                  {deals.length === 0 && <div className="text-sm text-sand-700">Create a deal first.</div>}
                </div>
              </div>

              <div className="panel animate-enter p-6" style={{ animationDelay: '60ms' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-3xl text-sand-900">Projects</h2>
                  {projects.length > 0 && (
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

                <div className="mt-4 grid gap-3">
                  {projects.length === 0 && <div className="text-sm text-sand-700">No projects yet.</div>}
                  {projects.map((p) => {
                    const deal = dealById.get(p.dealId);
                    return (
                      <div
                        key={p.id}
                        className="rounded-xl border border-sand-200 bg-white p-4"
                        onContextMenu={(e) => onItemContextMenu(e, 'project', p)}
                      >
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={selectedSet.has(p.id)} onChange={() => toggleSelected(p.id)} className="mt-1" />
                          <div className="min-w-0 flex-1">
                            <div className="text-lg font-semibold text-stone-900">{p.name}</div>
                            <div className="mt-1 text-sm text-sand-700">{deal?.title || 'Unknown deal'}</div>
                            {p.code && <div className="mt-2 pill">{p.code}</div>}
                          </div>
                          <div className="flex flex-wrap items-start gap-2">
                            <span className="pill">{p.status}</span>
                            <span className="pill">{currency(p.budget, p.currency)}</span>
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
            </div>
          )}

          {view === 'tasks' && (
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <div className="panel animate-enter p-6">
                <h2 className="text-3xl text-sand-900">New Task</h2>
                <div className="mt-4 grid gap-4">
                  <label>
                    <span className="field-label">Project</span>
                    <select className="field-input" value={taskProjectId} onChange={(e) => setTaskProjectId(e.target.value)}>
                      <option value="">Select...</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Title</span>
                    <input className="field-input" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Define scope" />
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="col-span-2">
                      <span className="field-label">Status</span>
                      <select className="field-input" value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)}>
                        <option value="todo">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="done">Done</option>
                      </select>
                    </label>
                    <label>
                      <span className="field-label">Priority</span>
                      <input
                        className="field-input"
                        value={String(taskPriority)}
                        onChange={(e) => setTaskPriority(Number(e.target.value))}
                        inputMode="numeric"
                        placeholder="1"
                      />
                    </label>
                  </div>
                  <label>
                    <span className="field-label">Estimated hours</span>
                    <input
                      className="field-input"
                      value={String(taskEstimatedHours)}
                      onChange={(e) => setTaskEstimatedHours(Number(e.target.value))}
                      inputMode="numeric"
                      placeholder="1"
                    />
                  </label>
                  <button
                    onClick={() => void onCreateTask()}
                    className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800"
                    disabled={projects.length === 0}
                  >
                    Save
                  </button>
                  {projects.length === 0 && <div className="text-sm text-sand-700">Create a project first.</div>}
                </div>
              </div>

              <div className="panel animate-enter p-6" style={{ animationDelay: '60ms' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-3xl text-sand-900">Tasks</h2>
                  {tasks.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-sand-700">
                      <input
                        type="checkbox"
                        checked={tasks.length > 0 && tasks.every((t) => selectedSet.has(t.id))}
                        onChange={(e) => selectAll(tasks.map((t) => t.id), e.target.checked)}
                      />
                      Select all
                    </label>
                  )}
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

                <div className="mt-4 grid gap-3">
                  {tasks.length === 0 && <div className="text-sm text-sand-700">No tasks yet.</div>}
                  {tasks.map((t) => {
                    const project = projectById.get(t.projectId);
                    return (
                      <div
                        key={t.id}
                        className="rounded-xl border border-sand-200 bg-white p-4"
                        onContextMenu={(e) => onItemContextMenu(e, 'task', t)}
                      >
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={selectedSet.has(t.id)} onChange={() => toggleSelected(t.id)} className="mt-1" />
                          <div className="min-w-0 flex-1">
                            <div className="text-lg font-semibold text-stone-900">{t.title}</div>
                            <div className="mt-1 text-sm text-sand-700">{project?.name || 'Unknown project'}</div>
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
                  })}
                </div>
              </div>
            </div>
          )}

          {view === 'quotations' && (
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <div className="space-y-6">
                <div className="panel animate-enter p-6">
                  <h2 className="text-3xl text-sand-900">New Quotation</h2>
                  <div className="mt-4 grid gap-4">
                    <label>
                      <span className="field-label">Deal</span>
                      <select className="field-input" value={quoteDealId} onChange={(e) => setQuoteDealId(e.target.value)}>
                        <option value="">Select...</option>
                        {deals.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="field-label">Title</span>
                      <input className="field-input" value={quoteTitle} onChange={(e) => setQuoteTitle(e.target.value)} placeholder="Proposal" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label>
                        <span className="field-label">Currency</span>
                        <input className="field-input" value={quoteCurrency} onChange={(e) => setQuoteCurrency(e.target.value)} placeholder="USD" />
                      </label>
                      <label>
                        <span className="field-label">Valid until</span>
                        <input className="field-input" type="date" value={quoteValidUntil} onChange={(e) => setQuoteValidUntil(e.target.value)} />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label>
                        <span className="field-label">Tax rate (%)</span>
                        <input
                          className="field-input"
                          value={String(quoteTaxRate)}
                          onChange={(e) => setQuoteTaxRate(Number(e.target.value))}
                          inputMode="numeric"
                        />
                      </label>
                      <label>
                        <span className="field-label">Discount</span>
                        <input
                          className="field-input"
                          value={String(quoteDiscountAmount)}
                          onChange={(e) => setQuoteDiscountAmount(Number(e.target.value))}
                          inputMode="decimal"
                        />
                      </label>
                    </div>
                    <button
                      onClick={() => void onCreateQuotation()}
                      className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800"
                      disabled={deals.length === 0}
                    >
                      Save
                    </button>
                    {deals.length === 0 && <div className="text-sm text-sand-700">Create a deal first.</div>}
                  </div>
                </div>

                <div className="panel animate-enter p-6" style={{ animationDelay: '60ms' }}>
                  <h2 className="text-3xl text-sand-900">Add Item</h2>
                  <div className="mt-4 grid gap-4">
                    <label>
                      <span className="field-label">Quotation</span>
                      <select className="field-input" value={selectedQuotationId} onChange={(e) => setSelectedQuotationId(e.target.value)}>
                        <option value="">Select...</option>
                        {quotations.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.number} · {q.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="field-label">Name</span>
                      <input className="field-input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Discovery workshop" />
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <label>
                        <span className="field-label">Qty</span>
                        <input className="field-input" value={String(itemQty)} onChange={(e) => setItemQty(Number(e.target.value))} inputMode="decimal" />
                      </label>
                      <label>
                        <span className="field-label">Unit price</span>
                        <input
                          className="field-input"
                          value={String(itemUnitPrice)}
                          onChange={(e) => setItemUnitPrice(Number(e.target.value))}
                          inputMode="decimal"
                        />
                      </label>
                      <label>
                        <span className="field-label">Unit</span>
                        <input className="field-input" value={itemUnitType} onChange={(e) => setItemUnitType(e.target.value)} placeholder="hour" />
                      </label>
                    </div>
                    <button
                      onClick={() => void onCreateQuotationItem()}
                      className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800"
                      disabled={quotations.length === 0}
                    >
                      Save
                    </button>
                    {quotations.length === 0 && <div className="text-sm text-sand-700">Create a quotation first.</div>}
                  </div>
                </div>
              </div>

              <div className="panel animate-enter p-6" style={{ animationDelay: '120ms' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-3xl text-sand-900">Quotations</h2>
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

                <div className="mt-4 space-y-3">
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

          {view === 'interactions' && (
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <div className="panel animate-enter p-6">
                <h2 className="text-3xl text-sand-900">New Interaction</h2>
                <div className="mt-4 grid gap-4">
                  <label>
                    <span className="field-label">Type</span>
                    <select className="field-input" value={interactionType} onChange={(e) => setInteractionType(e.target.value)}>
                      <option value="note">note</option>
                      <option value="call">call</option>
                      <option value="email">email</option>
                      <option value="meeting">meeting</option>
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Organization (optional)</span>
                    <select className="field-input" value={interactionOrgId} onChange={(e) => setInteractionOrgId(e.target.value)}>
                      <option value="">None</option>
                      {organizations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Contact (optional)</span>
                    <select className="field-input" value={interactionContactId} onChange={(e) => setInteractionContactId(e.target.value)}>
                      <option value="">None</option>
                      {contacts
                        .filter((c) => !interactionOrgId || c.organizationId === interactionOrgId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.firstName} {c.lastName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Deal (optional)</span>
                    <select className="field-input" value={interactionDealId} onChange={(e) => setInteractionDealId(e.target.value)}>
                      <option value="">None</option>
                      {deals.map((d) => (
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
                      value={interactionSubject}
                      onChange={(e) => setInteractionSubject(e.target.value)}
                      placeholder="Follow up"
                    />
                  </label>
                  <label>
                    <span className="field-label">Body</span>
                    <textarea
                      className="field-input"
                      value={interactionBody}
                      onChange={(e) => setInteractionBody(e.target.value)}
                      placeholder="Notes, summary, next steps..."
                      rows={6}
                    />
                  </label>
                  <button
                    onClick={() => void onCreateInteraction()}
                    className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="panel animate-enter p-6" style={{ animationDelay: '60ms' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-3xl text-sand-900">Interactions</h2>
                  {interactions.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-sand-700">
                      <input
                        type="checkbox"
                        checked={interactions.length > 0 && interactions.every((i) => selectedSet.has(i.id))}
                        onChange={(e) => selectAll(interactions.map((i) => i.id), e.target.checked)}
                      />
                      Select all
                    </label>
                  )}
                </div>

                {selectedIds.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-700">
                    <div>
                      Selected: <span className="font-semibold">{selectedIds.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => askDelete('interaction', selectedIds)}
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

                <div className="mt-4 grid gap-3">
                  {interactions.length === 0 && <div className="text-sm text-sand-700">No interactions yet.</div>}
                  {interactions.map((i) => {
                    const org = orgById.get(i.organizationId);
                    const contact = contactById.get(i.contactId);
                    const deal = dealById.get(i.dealId);
                    const when = i.occurredAt ? new Date(i.occurredAt).toLocaleString() : '';
                    return (
                      <div
                        key={i.id}
                        className="rounded-2xl border border-sand-200 bg-white p-5"
                        onContextMenu={(e) => onItemContextMenu(e, 'interaction', i)}
                      >
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={selectedSet.has(i.id)} onChange={() => toggleSelected(i.id)} className="mt-1" />
                          <div className="min-w-0 flex-1">
                            <div className="text-lg font-semibold text-stone-900">{i.subject || '(No subject)'}</div>
                            <div className="mt-1 text-sm text-sand-700">
                              {org?.name || 'No org'}
                              {contact ? ` · ${contact.firstName} ${contact.lastName}` : ''}
                              {deal ? ` · ${deal.title}` : ''}
                            </div>
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
          )}

          {view === 'settings' && (
            <div className="panel animate-enter p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-3xl text-sand-900">Settings</h2>
                  <p className="mt-1 text-sm text-sand-700">Optional AI provider settings (mirrors TimeManage).</p>
                </div>
                <button
                  onClick={() => void saveSettings()}
                  className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800"
                  disabled={!settings}
                >
                  Save
                </button>
              </div>

              {settingsNotice && <div className="mt-4 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">{settingsNotice}</div>}

              {!settings && <div className="mt-4 text-sm text-sand-700">Settings not available.</div>}

              {settings && (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label>
                    <span className="field-label">Theme</span>
                    <select
                      className="field-input"
                      value={settings.theme || 'sand'}
                      onChange={(e) => setSettings((prev) => ({ ...(prev || {}), theme: e.target.value }))}
                    >
                      <option value="sand">Sand (default)</option>
                      <option value="ocean">Ocean</option>
                      <option value="forest">Forest</option>
                      <option value="graphite">Graphite</option>
                      <option value="rose">Rose</option>
                    </select>
                  </label>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={() => setEdit(null)}>
          <div className="panel w-full max-w-4xl p-6" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-sand-700">Edit</div>
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

            {edit.kind === 'pipeline' && (
              <div className="mt-6 grid gap-4">
                <label>
                  <span className="field-label">Name</span>
                  <input className="field-input" value={edit.draft.name || ''} onChange={(e) => updateEditDraft({ name: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Description</span>
                  <input
                    className="field-input"
                    value={edit.draft.description || ''}
                    onChange={(e) => updateEditDraft({ description: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-sand-700">
                  <input type="checkbox" checked={!!edit.draft.default} onChange={(e) => updateEditDraft({ default: e.target.checked })} />
                  Default pipeline
                </label>
              </div>
            )}

            {edit.kind === 'pipelineStage' && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="field-label">Pipeline</span>
                  <select className="field-input" value={edit.draft.pipelineId || ''} onChange={(e) => updateEditDraft({ pipelineId: e.target.value })}>
                    <option value="">Select...</option>
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">Name</span>
                  <input className="field-input" value={edit.draft.name || ''} onChange={(e) => updateEditDraft({ name: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Color</span>
                  <input className="field-input" type="color" value={edit.draft.color || '#CF8445'} onChange={(e) => updateEditDraft({ color: e.target.value })} />
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
                <label>
                  <span className="field-label">Probability (%)</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.probability ?? 0)}
                    onChange={(e) => updateEditDraft({ probability: Number(e.target.value) || 0 })}
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
                <label className="md:col-span-2">
                  <span className="field-label">Name</span>
                  <input className="field-input" value={edit.draft.name || ''} onChange={(e) => updateEditDraft({ name: e.target.value })} />
                </label>
                <label>
                  <span className="field-label">Code</span>
                  <input className="field-input" value={edit.draft.code || ''} onChange={(e) => updateEditDraft({ code: e.target.value })} />
                </label>
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
                <label>
                  <span className="field-label">Budget</span>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={String(edit.draft.budget ?? 0)}
                    onChange={(e) => updateEditDraft({ budget: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  <span className="field-label">Currency</span>
                  <input className="field-input" value={edit.draft.currency || ''} onChange={(e) => updateEditDraft({ currency: e.target.value })} />
                </label>
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
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
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
                className="rounded-xl bg-sand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-50"
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
            {confirmDelete.kind === 'quotation' && (
              <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">
                Deleting a quotation also deletes its quotation items.
              </div>
            )}
            {confirmDelete.kind === 'pipelineStage' && (
              <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">
                Deals in this stage will be moved to another stage (or become unassigned) before deletion.
              </div>
            )}
            {confirmDelete.kind === 'pipeline' && (
              <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">
                Stages in this pipeline will be removed; deals will be moved to another pipeline&apos;s first stage (or become unassigned).
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
