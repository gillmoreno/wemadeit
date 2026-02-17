export type Organization = {
  id: string;
  name: string;
  industry: string;
  website: string;
  email: string;
  phone: string;
  billingEmail: string;
  taxId: string;
  address: string;
  city: string;
  country: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Contact = {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
  mobile: string;
  linkedinUrl: string;
  notes: string;
  primaryContact: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Deal = {
  id: string;
  organizationId: string;
  contactId: string;
  pipelineStageId: string;
  title: string;
  description: string;
  domain: string;
  domainAcquiredAt?: string;
  domainExpiresAt?: string;
  domainCost: number;
  deposit: number;
  costs: number;
  taxes: number;
  netTotal: number;
  shareGil: number;
  shareRic: number;
  workType: string;
  workClosedAt?: string;
  value: number;
  currency: string;
  expectedCloseAt?: string;
  status: string;
  probability: number;
  source: string;
  notes: string;
  lostReason: string;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  dealId: string;
  title: string;
  amount: number;
  currency: string;
  status: string; // planned | paid | void
  dueAt?: string;
  paidAt?: string;
  method: string;
  notes: string;
  gilAmount: number;
  ricAmount: number;
  createdAt: string;
  updatedAt: string;
};

export type PipelineStage = {
  id: string;
  pipelineId: string;
  name: string;
  color: string;
  position: number;
  probability: number;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  dealId: string;
  name: string;
  description: string;
  code: string;
  status: string;
  startDate?: string;
  targetEndDate?: string;
  actualEndDate?: string;
  budget: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type Quotation = {
  id: string;
  dealId: string;
  createdByUserId: string;
  number: string;
  title: string;
  introduction: string;
  terms: string;
  currency: string;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  validUntil?: string;
  version: number;
  publicToken: string;
  createdAt: string;
  updatedAt: string;
};

export type QuotationItem = {
  id: string;
  quotationId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitType: string;
  lineTotal: number;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type Interaction = {
  id: string;
  userId: string;
  organizationId: string;
  contactId: string;
  dealId: string;
  interactionType: string;
  subject: string;
  body: string;
  occurredAt: string;
  durationMinutes: number;
  transcript: string;
  cleanedTranscript: string;
  followUpCompleted: boolean;
  followUpDate?: string;
  followUpNotes: string;
  transcriptionLanguage: string;
  transcriptionStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type User = {
  id: string;
  username: string;
  emailAddress: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  projectId: string;
  ownerUserId: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  dueDate?: string;
  estimatedHours: number;
  actualHours: number;
  createdAt: string;
  updatedAt: string;
};

export type AppState = {
  organizations: Organization[];
  contacts: Contact[];
  deals: Deal[];
  payments: Payment[];
  pipelineStages: PipelineStage[];
  projects: Project[];
  tasks: Task[];
  quotations: Quotation[];
  quotationItems: QuotationItem[];
  interactions: Interaction[];
  users: User[];
};

export type AgentActionResult = {
  tool: string;
  status: string;
  message: string;
  task?: Task;
};

export type AgentCommandResponse = {
  reply: string;
  results: AgentActionResult[];
};

function apiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  const v = (raw || '').trim();
  if (v) return v.replace(/\/$/, '');

  // Default to same-origin in the browser so production (nginx reverse proxy) works:
  // fetch("/api/...") hits the current domain, and nginx proxies it to the Go API.
  if (typeof window !== 'undefined') return '';

  // Fallback for SSR/node (we currently use a fully client-side page, but keep this safe).
  return 'http://localhost:8080';
}

const base = apiBase();

type RequestOptions = RequestInit & { skipAuth?: boolean };

function getToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem('wemadeit_token') || '';
  } catch {
    return '';
  }
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const token = options?.skipAuth ? '' : getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as any)
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function login(login: string, password: string) {
  return request<{ token: string; user: User }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
    skipAuth: true
  });
}

export async function logout() {
  return request<{ ok: boolean }>('/api/logout', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export async function getMe() {
  return request<User>('/api/me');
}

export async function getState(): Promise<AppState> {
  const data = await request<any>('/api/state');
  return {
    organizations: Array.isArray(data?.organizations) ? (data.organizations as Organization[]) : [],
    contacts: Array.isArray(data?.contacts) ? (data.contacts as Contact[]) : [],
    deals: Array.isArray(data?.deals) ? (data.deals as Deal[]) : [],
    payments: Array.isArray(data?.payments) ? (data.payments as Payment[]) : [],
    pipelineStages: Array.isArray(data?.pipelineStages) ? (data.pipelineStages as PipelineStage[]) : [],
    projects: Array.isArray(data?.projects) ? (data.projects as Project[]) : [],
    tasks: Array.isArray(data?.tasks) ? (data.tasks as Task[]) : [],
    quotations: Array.isArray(data?.quotations) ? (data.quotations as Quotation[]) : [],
    quotationItems: Array.isArray(data?.quotationItems) ? (data.quotationItems as QuotationItem[]) : [],
    interactions: Array.isArray(data?.interactions) ? (data.interactions as Interaction[]) : [],
    users: Array.isArray(data?.users) ? (data.users as User[]) : []
  };
}

export async function createOrganization(org: Partial<Organization>) {
  return request<Organization>('/api/organizations', {
    method: 'POST',
    body: JSON.stringify(org)
  });
}

export async function createContact(contact: Partial<Contact>) {
  return request<Contact>('/api/contacts', {
    method: 'POST',
    body: JSON.stringify(contact)
  });
}

export async function createDeal(deal: Partial<Deal>) {
  return request<Deal>('/api/deals', {
    method: 'POST',
    body: JSON.stringify(deal)
  });
}

export async function createPayment(payment: Partial<Payment>) {
  return request<Payment>('/api/payments', {
    method: 'POST',
    body: JSON.stringify(payment)
  });
}

export async function createProject(project: Partial<Project>) {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(project)
  });
}

export async function createTask(task: Partial<Task>) {
  return request<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task)
  });
}

export async function createUser(user: Partial<User> & { password?: string }) {
  return request<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify(user)
  });
}

export async function createQuotation(quotation: Partial<Quotation>) {
  return request<Quotation>('/api/quotations', {
    method: 'POST',
    body: JSON.stringify(quotation)
  });
}

export async function createQuotationItem(item: Partial<QuotationItem>) {
  return request<QuotationItem>('/api/quotation_items', {
    method: 'POST',
    body: JSON.stringify(item)
  });
}

export async function createInteraction(interaction: Partial<Interaction>) {
  return request<Interaction>('/api/interactions', {
    method: 'POST',
    body: JSON.stringify(interaction)
  });
}

type DeleteResponse = { ok: boolean; deleted?: string[] };

function normalizeIDs(ids: string[] | string): string[] {
  if (Array.isArray(ids)) return ids;
  return [ids];
}

export async function deleteOrganizations(ids: string[] | string) {
  return request<DeleteResponse>('/api/organizations', {
    method: 'DELETE',
    body: JSON.stringify({ ids: normalizeIDs(ids) })
  });
}

export async function deleteContacts(ids: string[] | string) {
  return request<DeleteResponse>('/api/contacts', {
    method: 'DELETE',
    body: JSON.stringify({ ids: normalizeIDs(ids) })
  });
}

export async function deleteDeals(ids: string[] | string) {
  return request<DeleteResponse>('/api/deals', {
    method: 'DELETE',
    body: JSON.stringify({ ids: normalizeIDs(ids) })
  });
}

export async function deletePayments(ids: string[] | string) {
  return request<DeleteResponse>('/api/payments', {
    method: 'DELETE',
    body: JSON.stringify({ ids: normalizeIDs(ids) })
  });
}

export async function deleteProjects(ids: string[] | string) {
  return request<DeleteResponse>('/api/projects', {
    method: 'DELETE',
    body: JSON.stringify({ ids: normalizeIDs(ids) })
  });
}

export async function deleteTasks(ids: string[] | string) {
  return request<DeleteResponse>('/api/tasks', {
    method: 'DELETE',
    body: JSON.stringify({ ids: normalizeIDs(ids) })
  });
}

export async function deleteQuotations(ids: string[] | string) {
  return request<DeleteResponse>('/api/quotations', {
    method: 'DELETE',
    body: JSON.stringify({ ids: normalizeIDs(ids) })
  });
}

export async function deleteQuotationItems(ids: string[] | string) {
  return request<DeleteResponse>('/api/quotation_items', {
    method: 'DELETE',
    body: JSON.stringify({ ids: normalizeIDs(ids) })
  });
}

export async function deleteInteractions(ids: string[] | string) {
  return request<DeleteResponse>('/api/interactions', {
    method: 'DELETE',
    body: JSON.stringify({ ids: normalizeIDs(ids) })
  });
}

export async function deleteUsers(ids: string[] | string) {
  return request<DeleteResponse>('/api/users', {
    method: 'DELETE',
    body: JSON.stringify({ ids: normalizeIDs(ids) })
  });
}

export async function getSettings() {
  return request<any>('/api/settings');
}

export async function updateSettings(payload: any) {
  const safePayload = {
    provider: payload?.provider,
    model: payload?.model,
    ollama_base_url: payload?.ollama_base_url,
    ollama_header_timeout_seconds: payload?.ollama_header_timeout_seconds,
    ollama_overall_timeout_seconds: payload?.ollama_overall_timeout_seconds,
    ollama_max_attempts: payload?.ollama_max_attempts,
    ollama_backoff_base_ms: payload?.ollama_backoff_base_ms,
    max_tokens: payload?.max_tokens,
    temperature: payload?.temperature,
    verbose: payload?.verbose,
    use_ansi: payload?.use_ansi,
    auto_summary: payload?.auto_summary,
    openai_key: payload?.openai_key,
    anthropic_key: payload?.anthropic_key
  };
  return request<any>('/api/settings', {
    method: 'POST',
    body: JSON.stringify(safePayload)
  });
}

export async function runAgentCommand(message: string) {
  return request<AgentCommandResponse>('/api/agent/command', {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}
