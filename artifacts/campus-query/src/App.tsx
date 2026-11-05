import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  FilePlus2,
  Filter,
  History,
  Home as HomeIcon,
  Library,
  Lightbulb,
  ListFilter,
  LogIn,
  Menu,
  MessageCircleQuestion,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import {
  SearchFaqsSort,
  getGetAdminSummaryQueryKey,
  getGetFaqQueryKey,
  getGetSessionQueryKey,
  getGetDatabaseDemoQueryKey,
  getListBookmarksQueryKey,
  getListFaqsQueryKey,
  getListSearchHistoryQueryKey,
  getSearchFaqsQueryKey,
  useCreateAdminFaq,
  useCreateBookmark,
  useDeleteBookmark,
  useGetAdminSummary,
  useGetDatabaseDemo,
  useGetFaq,
  useGetSession,
  useListBookmarks,
  useListFaqs,
  useListSearchHistory,
  useSearchFaqs,
  useSubmitFeedback,
} from '@workspace/api-client-react';
import type { Faq, FaqInput, KnowledgeDocument } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();
const departments = ['All departments', 'Computer Science & Engineering', 'Business Administration', 'Student Affairs'];
const categories = ['All categories', 'Academics', 'Certificates', 'Internships', 'Campus Life', 'Fees & Finance'];
const asArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

function formatDate(value?: string | null) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function initials(name?: string) {
  return (name || 'Campus Query').split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();
}

function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3" data-testid="link-home-logo">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-accent shadow-[4px_4px_0_hsl(var(--accent)/.35)] transition-transform duration-200 group-hover:-translate-y-0.5">
        <MessageCircleQuestion className="size-5" strokeWidth={2.5} />
      </span>
      {!compact && <span className="font-display text-lg font-bold tracking-tight text-sidebar-foreground">campus<span className="text-accent">query</span></span>}
    </Link>
  );
}

function Avatar({ name, small = false }: { name?: string; small?: boolean }) {
  return <span className={`grid shrink-0 place-items-center rounded-full bg-accent font-mono font-medium text-primary ${small ? 'size-7 text-[10px]' : 'size-9 text-xs'}`} data-testid="avatar-user">{initials(name)}</span>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, isLoading: sessionLoading } = useGetSession();
  const demoRole = typeof window !== 'undefined' ? window.localStorage.getItem('campusquery-demo-role') : null;
  const user = session?.user || (demoRole ? { name: demoRole === 'Admin' ? 'Knowledge steward' : 'Alex Morgan', department: demoRole === 'Admin' ? 'University Library' : 'Undergraduate student', role: demoRole } : undefined);
  const isAdmin = demoRole === 'Admin' || user?.role === 'Admin';
  const navigation = [
    { href: '/', label: 'Ask campus', icon: HomeIcon },
    { href: '/search', label: 'Explore FAQs', icon: Search },
    { href: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
    { href: '/history', label: 'Search history', icon: History },
  ];
  const adminNavigation = [
    { href: '/admin', label: 'Overview', icon: BarChart3 },
    { href: '/admin/faqs/new', label: 'Add FAQ', icon: FilePlus2 },
    { href: '/admin/database-demo', label: 'Database demo', icon: Database },
  ];
  const nav = (
    <div className="flex h-full flex-col px-4 py-5">
      <div className="flex items-center justify-between px-2">
        <AppLogo />
        <button className="rounded-lg p-1.5 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu" data-testid="button-close-menu"><X className="size-4" /></button>
      </div>
      <div className="mt-9 px-2 font-mono text-[10px] uppercase tracking-[.22em] text-sidebar-foreground/45">Workspace</div>
      <nav className="mt-2 space-y-1" aria-label="Primary navigation">
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${location === href ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
            <Icon className={`size-[17px] ${location === href ? 'text-accent' : 'text-sidebar-foreground/50 group-hover:text-accent'}`} strokeWidth={2} />
            {label}
            {location === href && <span className="ml-auto size-1.5 rounded-full bg-accent" />}
          </Link>
        ))}
      </nav>
      {isAdmin && (
        <>
          <div className="mt-8 px-2 font-mono text-[10px] uppercase tracking-[.22em] text-sidebar-foreground/45">Steward tools</div>
          <nav className="mt-2 space-y-1" aria-label="Admin navigation">
            {adminNavigation.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${location === href ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid={`link-admin-${label.toLowerCase().replaceAll(' ', '-')}`}>
                <Icon className={`size-[17px] ${location === href ? 'text-accent' : 'text-sidebar-foreground/50 group-hover:text-accent'}`} strokeWidth={2} />
                {label}
              </Link>
            ))}
          </nav>
        </>
      )}
      <div className="mt-auto">
        <Link href="/login" className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-sidebar-accent" data-testid="link-session">
          {sessionLoading ? <span className="size-8 animate-pulse rounded-full bg-sidebar-accent" /> : <Avatar name={user?.name} small />}
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-sidebar-foreground">{user?.name || 'Demo session'}</span><span className="block truncate text-[10px] text-sidebar-foreground/50">{user?.department || 'Choose a sign-in mode'}</span></span>
          <ArrowUpRight className="size-3.5 text-sidebar-foreground/40" />
        </Link>
      </div>
    </div>
  );
  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-sidebar-border bg-sidebar md:block">{nav}</aside>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-primary/40 md:hidden" onClick={() => setMobileOpen(false)}><aside className="h-full w-[280px] bg-sidebar" onClick={(event) => event.stopPropagation()}>{nav}</aside></div>}
      <div className="md:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center border-b border-border/80 bg-background/90 px-5 backdrop-blur-xl md:px-9">
          <button className="mr-3 rounded-lg p-2 hover:bg-muted md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu" data-testid="button-open-menu"><Menu className="size-5" /></button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="hidden font-mono tracking-[.18em] md:inline">CAMPUSQUERY</span><ChevronRight className="hidden size-3.5 md:inline" /><span className="font-semibold text-foreground">{location.startsWith('/admin') ? 'Steward console' : location === '/' ? 'Student desk' : 'Your workspace'}</span></div>
          <div className="ml-auto flex items-center gap-2"><span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-emerald-500" /> Sources online</span><Link href="/search" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Search FAQs" data-testid="link-header-search"><Search className="size-[18px]" /></Link></div>
        </header>
        <main className="page-enter">{children}</main>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex items-end justify-between gap-4"><div>{eyebrow && <p className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-accent-foreground/70">{eyebrow}</p>}<h1 className="font-display text-3xl font-bold tracking-[-.03em] text-foreground sm:text-[40px]">{title}</h1>{detail && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p>}</div>{action}</div>;
}

function LoadingCards({ count = 3 }: { count?: number }) {
  return <div className="space-y-3" aria-label="Loading"><div className="skeleton-shimmer h-4 w-24 rounded" />{Array.from({ length: count }).map((_, index) => <div key={index} className="rounded-2xl border border-border bg-card p-5"><div className="skeleton-shimmer h-3 w-24 rounded" /><div className="skeleton-shimmer mt-4 h-5 w-4/5 rounded" /><div className="skeleton-shimmer mt-3 h-3 w-full rounded" /><div className="skeleton-shimmer mt-2 h-3 w-2/3 rounded" /></div>)}</div>;
}

function QueryError({ onRetry }: { onRetry?: () => void }) {
  return <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-8 text-center" data-testid="status-query-error"><CircleAlert className="mx-auto size-7 text-destructive" /><h3 className="mt-3 font-display text-lg font-bold">The knowledge desk is taking a beat</h3><p className="mt-1 text-sm text-muted-foreground">We couldn't reach the source index. Try again in a moment.</p>{onRetry && <button onClick={onRetry} className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5" data-testid="button-retry">Try again</button>}</div>;
}

function EmptyState({ title, detail, icon: Icon = Library }: { title: string; detail: string; icon?: typeof Library }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center" data-testid="status-empty"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-primary"><Icon className="size-5" /></span><h3 className="mt-4 font-display text-lg font-bold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{detail}</p></div>;
}

function FaqRow({ faq, bookmarked = false, onBookmark }: { faq: Faq; bookmarked?: boolean; onBookmark?: (faq: Faq) => void }) {
  return <article className="group relative rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_12px_30px_hsl(var(--primary)/.07)]" data-testid={`card-faq-${faq.id}`}>
    <div className="flex items-start justify-between gap-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-accent/20 px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wide text-accent-foreground">{faq.category || 'General'}</span><span className="text-[11px] text-muted-foreground">{faq.department}</span></div>{onBookmark && <button onClick={() => onBookmark(faq)} className={`rounded-lg p-1.5 transition-colors ${bookmarked ? 'text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} aria-label={bookmarked ? 'Remove bookmark' : 'Save bookmark'} data-testid={`button-bookmark-${faq.id}`}>{bookmarked ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}</button>}</div>
    <Link href={`/faqs/${faq.id}`} className="mt-4 block" data-testid={`link-faq-${faq.id}`}><h3 className="max-w-3xl font-display text-[17px] font-bold leading-6 tracking-[-.015em] text-foreground transition-colors group-hover:text-accent-foreground">{faq.question}</h3><p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{faq.answer}</p></Link>
    <div className="mt-5 flex items-center gap-4 border-t border-border/70 pt-4 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><ShieldCheck className="size-3.5 text-emerald-600" /> Verified source</span><span className="flex items-center gap-1"><Clock3 className="size-3.5" /> Updated {formatDate(faq.updatedAt)}</span><span className="ml-auto font-mono">{faq.views || 0} views</span></div>
  </article>;
}

function KnowledgeDocuments({ documents, title = 'From the knowledge base' }: { documents?: KnowledgeDocument[]; title?: string }) {
  const documentList = asArray<KnowledgeDocument>(documents);
  if (!documentList.length) return null;
  return <section className="mt-9" data-testid="section-knowledge-documents"><SectionHeading eyebrow="Document library" title={title} /><div className="grid gap-3 sm:grid-cols-2">{documentList.map((doc) => <article key={doc.documentId} className="rounded-2xl bg-card p-5" data-testid={`card-document-${doc.documentId}`}>
    <div className="flex items-center gap-2"><Library className="size-4 text-accent-foreground" /><span className="rounded-md bg-accent/20 px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wide text-accent-foreground">{doc.documentType}</span><span className="text-[11px] text-muted-foreground">{doc.department}</span></div>
    <h3 className="mt-3 font-display text-base font-bold leading-6">{doc.title}</h3>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{doc.snippet}</p>
    <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 text-[11px] text-muted-foreground"><span>{doc.source}</span>{asArray<string>(doc.tags).slice(0, 3).map((tag) => <span key={tag} className="rounded-full border border-border px-2 py-0.5">#{tag}</span>)}</div>
  </article>)}</div></section>;
}

function Home() {
  const [, setLocation] = useLocation();
  const [question, setQuestion] = useState('');
  const { data: faqs, isLoading, isError, refetch } = useListFaqs();
  // The API contract is an array, but a proxy/error response can be an object.
  // Keep the homepage render safe until the query can surface/retry that response.
  const faqList = Array.isArray(faqs) ? faqs : [];
  const suggestions = ['What is the minimum attendance requirement?', 'How do I apply for a bonafide certificate?', 'What documents are needed for internship approval?'];
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (question.trim().length >= 2) setLocation(`/search?q=${encodeURIComponent(question.trim())}`); };
  return <div className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 sm:py-12">
    <section className="relative overflow-hidden rounded-[28px] bg-primary px-6 py-12 text-primary-foreground shadow-[0_24px_60px_hsl(var(--primary)/.18)] sm:px-12 sm:py-16">
      <div className="absolute -right-16 -top-24 size-72 rounded-full border-[32px] border-accent/15" /><div className="absolute -bottom-28 right-28 size-64 rounded-full border-[1px] border-accent/20" />
      <div className="relative max-w-3xl"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.16em] text-accent"><Sparkles className="size-3.5" /> University knowledge, made findable</div><h1 className="font-display text-4xl font-bold leading-[1.04] tracking-[-.045em] text-white sm:text-6xl">Ask the question.<br /><span className="text-accent">Find the source.</span></h1><p className="mt-6 max-w-xl text-sm leading-6 text-primary-foreground/65 sm:text-base">CampusQuery connects you to clear, trustworthy answers from your university's own knowledge base — not an invented chatbot.</p>
        <form onSubmit={submit} className="mt-9 flex max-w-2xl items-center gap-2 rounded-2xl bg-card p-2 shadow-xl"><Search className="ml-3 size-5 shrink-0 text-muted-foreground" /><input value={question} onChange={(event) => setQuestion(event.target.value)} className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground" placeholder="What do you need to know?" aria-label="Ask a question" data-testid="input-home-question" /><button className="flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5" data-testid="button-ask-question">Ask <ArrowUpRight className="size-4" /></button></form>
        <div className="mt-4 flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => { setQuestion(suggestion); setLocation(`/search?q=${encodeURIComponent(suggestion)}`); }} className="rounded-full border border-white/15 px-3 py-1.5 text-left text-[11px] text-primary-foreground/60 transition-colors hover:border-accent/60 hover:text-accent" data-testid={`button-suggestion-${suggestion.slice(0, 8).replaceAll(' ', '-')}`}>{suggestion}</button>)}</div>
      </div>
    </section>
    <div className="mt-12 grid gap-9 lg:grid-cols-[1fr_310px]"><section><SectionHeading eyebrow="Recently maintained" title="Start with the essentials" detail="A few of the most useful answers, kept current by campus teams." action={<Link href="/search" className="hidden items-center gap-1 text-xs font-bold text-accent-foreground hover:underline sm:flex" data-testid="link-see-all-faqs">See all FAQs <ChevronRight className="size-4" /></Link>} />{isLoading ? <LoadingCards count={3} /> : isError ? <QueryError onRetry={() => refetch()} /> : faqList.length > 0 ? <div className="space-y-3">{faqList.slice(0, 4).map((faq) => <FaqRow key={faq.id} faq={faq} />)}</div> : <EmptyState title="The index is ready for your question" detail="No featured answers are available yet. Try a natural-language search above." icon={Lightbulb} />}</section>
      <aside className="space-y-4"><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">How it works</span><PanelLeft className="size-4 text-accent-foreground" /></div><div className="mt-5 space-y-5">{[['01', 'Ask naturally', 'Use the words you would use with a person.'], ['02', 'We rank the evidence', 'Keyword and meaning work together to find the right source.'], ['03', 'You see the trail', 'Every answer shows its department and source.']].map(([number, title, detail]) => <div className="flex gap-3" key={number}><span className="font-mono text-xs text-accent-foreground">{number}</span><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div></div>)}</div></div><div className="rounded-2xl border border-accent/30 bg-accent/10 p-5"><div className="flex items-center gap-2 text-accent-foreground"><ShieldCheck className="size-4" /><span className="text-xs font-bold">Source-first by design</span></div><p className="mt-2 text-xs leading-5 text-foreground/65">If we don't have a grounded answer, we'll say so. That's the point.</p></div></aside>
    </div>
  </div>;
}

function SearchPage() {
  const [location, setLocation] = useLocation();
  const initialQuery = useMemo(() => new URLSearchParams(location.split('?')[1] || '').get('q') || '', [location]);
  const [query, setQuery] = useState(initialQuery);
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SearchFaqsSort>('relevance');
  const params = useMemo(() => ({ q: query.trim().length >= 2 ? query.trim() : 'campus', department: department || undefined, category: category || undefined, sort }), [query, department, category, sort]);
  const { data, isLoading, isError, refetch } = useSearchFaqs(params, { query: { enabled: query.trim().length >= 2, queryKey: getSearchFaqsQueryKey(params) } });
  const searchResults = asArray<Faq>(data?.results);
  const runSearch = (event: React.FormEvent) => { event.preventDefault(); if (query.trim().length >= 2) setLocation(`/search?q=${encodeURIComponent(query.trim())}`); };
  return <div className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 sm:py-12"><SectionHeading eyebrow="Knowledge explorer" title="Search the campus brain" detail="Ranked answers from published university sources, tuned for how students actually ask." />
    <form onSubmit={runSearch} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-[0_8px_30px_hsl(var(--primary)/.04)]"><Search className="ml-3 size-5 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none" placeholder="Try “How do I get a bonafide certificate?”" aria-label="Search FAQs" data-testid="input-search-query" /><button className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="button-run-search">Search</button></form>
    <div className="mt-7 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center"><div className="flex items-center gap-2 text-xs font-bold"><Filter className="size-4 text-accent-foreground" /> Refine results</div><select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold outline-none" aria-label="Filter by department" data-testid="select-department">{departments.map((item) => <option key={item} value={item === 'All departments' ? '' : item}>{item}</option>)}</select><select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold outline-none" aria-label="Filter by category" data-testid="select-category">{categories.map((item) => <option key={item} value={item === 'All categories' ? '' : item}>{item}</option>)}</select><div className="sm:ml-auto flex items-center gap-2"><ArrowDownUp className="size-3.5 text-muted-foreground" /><select value={sort} onChange={(event) => setSort(event.target.value as SearchFaqsSort)} className="bg-transparent text-xs font-bold outline-none" aria-label="Sort results" data-testid="select-sort"><option value="relevance">Best match</option><option value="viewed">Most viewed</option><option value="updated">Recently updated</option></select></div></div>
    {query.trim().length < 2 ? <div className="mt-10"><EmptyState title="Your next answer starts here" detail="Enter at least two characters to search across the university knowledge base." icon={Search} /></div> : <div className="mt-7"><div className="mb-4 flex items-center justify-between text-xs text-muted-foreground"><span>{isLoading ? 'Searching the index…' : `${data?.total ?? 0} answers for “${query}”`}</span>{data?.tookMs !== undefined && <span className="font-mono">{data.tookMs}ms</span>}</div>{isLoading ? <LoadingCards count={4} /> : isError ? <QueryError onRetry={() => refetch()} /> : searchResults.length ? <div className="space-y-3">{searchResults.map((faq) => <FaqRow faq={faq} key={faq.id} />)}</div> : <EmptyState title="No grounded answers yet" detail="Try a broader phrase, or remove a filter. We would rather show no result than make one up." icon={Lightbulb} />}{!isLoading && !isError && <KnowledgeDocuments documents={data?.knowledgeDocuments} />}</div>}
  </div>;
}

function BookmarkButton({ faqId, bookmarked, onDone }: { faqId: number; bookmarked: boolean; onDone?: () => void }) {
  const client = useQueryClient();
  const create = useCreateBookmark();
  const remove = useDeleteBookmark();
  const [saved, setSaved] = useState(bookmarked);
  const toggle = () => { if (saved) remove.mutate({ faqId }, { onSuccess: () => { setSaved(false); client.invalidateQueries({ queryKey: getListBookmarksQueryKey() }); onDone?.(); } }); else create.mutate({ data: { faqId } }, { onSuccess: () => { setSaved(true); client.invalidateQueries({ queryKey: getListBookmarksQueryKey() }); onDone?.(); } }); };
  return <button onClick={toggle} disabled={create.isPending || remove.isPending} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${saved ? 'border-accent bg-accent/15 text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'}`} data-testid={`button-detail-bookmark-${faqId}`}>{saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}{saved ? 'Saved' : 'Save answer'}</button>;
}

function FaqDetailPage() {
  const { id } = useParams<{ id: string }>();
  const faqId = Number(id);
  const { data, isLoading, isError, refetch } = useGetFaq(faqId, { query: { queryKey: getGetFaqQueryKey(faqId), enabled: Number.isFinite(faqId) } });
  const { data: bookmarks } = useListBookmarks();
  const feedback = useSubmitFeedback();
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const isBookmarked = Array.isArray(bookmarks) && bookmarks.some((item) => item.id === faqId);
  const sendFeedback = (value: number) => { setRating(value); feedback.mutate({ data: { faqId, rating: value } }, { onSuccess: () => setFeedbackSent(true) }); };
  if (isLoading) return <div className="mx-auto max-w-[950px] px-5 py-12 sm:px-8"><LoadingCards count={2} /></div>;
  if (isError || !data) return <div className="mx-auto max-w-[950px] px-5 py-12 sm:px-8"><QueryError onRetry={() => refetch()} /></div>;
  return <div className="mx-auto max-w-[950px] px-5 py-8 sm:px-8 sm:py-12"><Link href="/search" className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground" data-testid="link-back-search"><ArrowLeft className="size-4" /> Back to search</Link><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-accent/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-accent-foreground">{data.category}</span><span className="text-xs text-muted-foreground">{data.department}</span><span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-700"><ShieldCheck className="size-4" /> Verified answer</span></div><h1 className="mt-5 max-w-3xl font-display text-3xl font-bold leading-tight tracking-[-.035em] sm:text-5xl" data-testid={`text-faq-question-${faqId}`}>{data.question}</h1><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><span>Updated {formatDate(data.updatedAt)}</span><span className="font-mono">{data.views || 0} views</span><span>Relevance {Math.round((data.relevance || 0) * 100)}%</span></div>
    <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_285px]"><article className="rounded-2xl bg-card p-6 sm:p-9"><div><BookmarkButton faqId={faqId} bookmarked={isBookmarked} /></div><div className="prose prose-slate mt-7 max-w-none text-[15px] leading-7" data-testid={`text-faq-answer-${faqId}`}><p className="whitespace-pre-line">{data.answer}</p></div>{data.source && <div className="mt-8 rounded-xl bg-accent/50 p-4"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-accent-foreground">Source record</p><p className="mt-2 text-sm font-semibold text-foreground">{data.source}</p></div>}</article><aside className="space-y-4"><div className="rounded-2xl bg-card p-5"><span className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Was this useful?</span>{feedbackSent ? <div className="mt-5 flex items-center gap-2 text-sm font-bold text-emerald-700">Thanks, your rating helps the next student!.</div> : <><p className="mt-2 text-sm text-muted-foreground">A quick signal helps us keep answers sharp.</p><div className="mt-4 flex gap-1">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => sendFeedback(value)} disabled={feedback.isPending} className={`rounded-lg p-2 transition-colors hover:bg-accent/20 ${rating && value <= rating ? 'text-accent-foreground' : 'text-muted-foreground'}`} aria-label={`Rate ${value} out of 5`} data-testid={`button-rating-${value}`}><Star className="size-5" fill={rating && value <= rating ? 'currentColor' : 'none'} /></button>)}</div></>}</div><div className="rounded-2xl bg-muted p-5"><div className="flex items-center gap-2 text-sm font-bold">Answer metadata</div><dl className="mt-4 space-y-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Status</dt><dd className="font-semibold capitalize">{data.status}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Maintained by</dt><dd className="text-right font-semibold">{data.department}</dd></div></dl></div></aside></div>
    <KnowledgeDocuments documents={data.knowledgeDocuments} title="Supporting documents" />{data.related?.length > 0 && <section className="mt-11"><SectionHeading eyebrow="Keep exploring" title="Related questions" /><div className="grid gap-3 sm:grid-cols-2">{data.related.map((faq) => <FaqRow faq={faq} key={faq.id} />)}</div></section>}</div>;
}

function BookmarksPage() {
  const { data, isLoading, isError, refetch } = useListBookmarks();
  const [removed, setRemoved] = useState<number[]>([]);
  const bookmarkList = Array.isArray(data) ? data : [];
  const visible = bookmarkList.filter((faq) => !removed.includes(faq.id));
  const remove = useDeleteBookmark();
  const onRemove = (faq: Faq) => { remove.mutate({ faqId: faq.id }, { onSuccess: () => setRemoved((items) => [...items, faq.id]) }); };
  return <div className="mx-auto max-w-[1000px] px-5 py-8 sm:px-8 sm:py-12"><SectionHeading eyebrow="Your library" title="Saved answers" detail="Keep the answers you will want again, close at hand." />{isLoading ? <LoadingCards count={3} /> : isError ? <QueryError onRetry={() => refetch()} /> : visible.length ? <div className="space-y-3">{visible.map((faq) => <FaqRow faq={faq} key={faq.id} bookmarked onBookmark={onRemove} />)}</div> : <EmptyState title="No saved answers yet" detail="When you find an answer worth keeping, tap Save answer and it will show up here." icon={Bookmark} />}</div>;
}

function HistoryPage() {
  const { data, isLoading, isError, refetch } = useListSearchHistory({ query: { queryKey: getListSearchHistoryQueryKey() } });
  const [, setLocation] = useLocation();
  const history = Array.isArray(data) ? data : [];
  return <div className="mx-auto max-w-[900px] px-5 py-8 sm:px-8 sm:py-12"><SectionHeading eyebrow="Your trail" title="Search history" detail="Pick up where you left off. Your recent questions, with the number of grounded answers found." />{isLoading ? <LoadingCards count={4} /> : isError ? <QueryError onRetry={() => refetch()} /> : history.length ? <div className="overflow-hidden rounded-2xl border border-border bg-card">{history.map((item, index) => <button key={item.id} onClick={() => setLocation(`/search?q=${encodeURIComponent(item.query)}`)} className="flex w-full items-center gap-4 border-b border-border p-5 text-left transition-colors last:border-0 hover:bg-muted/60" data-testid={`button-history-${item.id}`}><span className="grid size-9 place-items-center rounded-xl bg-muted font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{item.query}</span><span className="mt-1 block text-xs text-muted-foreground">{item.resultCount} answers · {formatDate(item.createdAt)}</span></span><ArrowUpRight className="size-4 text-muted-foreground" /></button>)}</div> : <EmptyState title="Your history is clear" detail="Questions you ask will stay here so you can return to them quickly." icon={History} />}</div>;
}

function MetricCard({ label, value, detail, accent = false }: { label: string; value: string | number; detail?: string; accent?: boolean }) {
  return <div className={`min-w-0 rounded-2xl border p-5 ${accent ? 'border-accent/35 bg-accent/15' : 'border-border bg-card'}`}><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{label}</p><p className="mt-3 break-words font-display text-3xl font-bold tracking-[-.04em]">{value}</p>{detail && <p className="mt-1 break-words text-xs text-muted-foreground">{detail}</p>}</div>;
}

function AdminPage() {
  const { data, isLoading, isError, refetch } = useGetAdminSummary();
  if (isLoading) return <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8"><LoadingCards count={3} /></div>;
  if (isError || !data || !data.metrics) return <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8"><QueryError onRetry={() => refetch()} /></div>;
  const searchesOverTime = asArray<{ day: string; searches: number }>(data.searchesOverTime);
  const categoryCounts = asArray<{ label: string; value: number }>(data.categoryCounts);
  const recentFaqs = asArray<Faq>(data.recentFaqs);
  const lowRated = asArray<Faq>(data.lowRated);
  const maxSearch = Math.max(...searchesOverTime.map((point) => point.searches), 1);
  return <div className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8 sm:py-12"><SectionHeading eyebrow="Steward console" title="Knowledge health" detail="A clear view of what students need and where the knowledge base can improve." action={<Link href="/admin/faqs/new" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-transform hover:-translate-y-0.5" data-testid="link-add-faq"><Plus className="size-4" /> Add FAQ</Link>} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Published FAQs" value={data.metrics.totalFaqs} detail={`${data.metrics.totalDocuments} source documents`} accent /><MetricCard label="Students reached" value={data.metrics.totalStudents.toLocaleString()} detail="Across the campus" /><MetricCard label="Searches today" value={data.metrics.searchesToday} detail="Live query volume" /><MetricCard label="Average rating" value={data.metrics.averageRating.toFixed(1)} detail="Out of 5 from students" /></div><div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_1fr]"><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold">Search volume</h2><p className="mt-1 text-xs text-muted-foreground">Last 7 days</p></div><BarChart3 className="size-5 text-accent-foreground" /></div><div className="mt-8 flex h-48 items-end gap-2 border-b border-border pb-0 sm:gap-4">{searchesOverTime.map((point) => <div key={point.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full rounded-t-md bg-primary transition-all hover:bg-accent" style={{ height: `${Math.max(8, (point.searches / maxSearch) * 100)}%` }} title={`${point.searches} searches`} data-testid={`bar-search-${point.day}`} /><span className="font-mono text-[10px] text-muted-foreground">{point.day}</span></div>)}</div></section><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold">Popular categories</h2><p className="mt-1 text-xs text-muted-foreground">Where students look most</p></div><ListFilter className="size-5 text-accent-foreground" /></div><div className="mt-6 space-y-4">{categoryCounts.slice(0, 5).map((item, index) => <div key={item.label}><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold">{item.label}</span><span className="font-mono text-muted-foreground">{item.value}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${index === 0 ? 'bg-accent' : index === 1 ? 'bg-primary' : 'bg-chart-2'}`} style={{ width: `${Math.min(100, (item.value / Math.max(data.categoryCounts[0]?.value || 1, 1)) * 100)}%` }} /></div></div>)}</div></section></div><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]"><section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Recently maintained</h2><MoreHorizontal className="size-4 text-muted-foreground" /></div><div className="mt-4 space-y-1">{recentFaqs.slice(0, 5).map((faq) => <Link key={faq.id} href={`/faqs/${faq.id}`} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted" data-testid={`link-recent-faq-${faq.id}`}><span className="grid size-8 place-items-center rounded-lg bg-muted font-mono text-[10px] text-muted-foreground">{faq.id}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold">{faq.question}</span><ChevronRight className="size-4 text-muted-foreground" /></Link>)}</div></section><section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold">Needs attention</h2></div><CircleAlert className="size-4 text-chart-4" /></div>{lowRated.length ? <div className="mt-4 space-y-1">{lowRated.slice(0, 5).map((faq) => <Link key={faq.id} href={`/faqs/${faq.id}`} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted" data-testid={`link-low-rated-${faq.id}`}><ThumbsDown className="size-4 text-chart-4" /><span className="min-w-0 flex-1 truncate text-xs font-semibold">{faq.question}</span><span className="font-mono text-[10px] text-muted-foreground">{faq.views} views</span></Link>)}</div> : <p className="mt-5 text-sm text-muted-foreground">Nothing flagged right now.</p>}</section></div></div>;
}

function NewFaqPage() {
  const [, setLocation] = useLocation();
  const createFaq = useCreateAdminFaq();
  const [form, setForm] = useState<FaqInput>({ question: '', answer: '', category: 'Academics', department: 'Student Affairs', priority: 3 });
  const [message, setMessage] = useState('');
  const update = (key: keyof FaqInput, value: string | number) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => { event.preventDefault(); setMessage(''); createFaq.mutate({ data: form }, { onSuccess: (faq) => { queryClient.invalidateQueries({ queryKey: getListFaqsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }); setMessage('FAQ published to the campus index.'); setTimeout(() => setLocation(`/faqs/${faq.id}`), 650); }, onError: () => setMessage('We could not publish this FAQ. Check the fields and try again.') }); };
  return <div className="mx-auto max-w-[900px] px-5 py-8 sm:px-8 sm:py-12"><Link href="/admin" className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground" data-testid="link-back-admin"><ArrowLeft className="size-4" /> Back to overview</Link><SectionHeading eyebrow="Steward tools" title="Add a grounded answer" detail="Publish a concise, source-backed response for students across campus." /><form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 sm:p-8"><div className="grid gap-5 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-2 block text-xs font-bold">Question</span><input required minLength={5} value={form.question} onChange={(event) => update('question', event.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-accent-foreground" placeholder="What should a student be able to find?" data-testid="input-faq-question" /></label><label className="sm:col-span-2"><span className="mb-2 block text-xs font-bold">Answer</span><textarea required minLength={10} value={form.answer} onChange={(event) => update('answer', event.target.value)} className="min-h-44 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors focus:border-accent-foreground" placeholder="Write the direct answer first, then add the useful details." data-testid="textarea-faq-answer" /></label><label><span className="mb-2 block text-xs font-bold">Category</span><select value={form.category} onChange={(event) => update('category', event.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm" data-testid="select-faq-category">{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label><span className="mb-2 block text-xs font-bold">Department</span><select value={form.department} onChange={(event) => update('department', event.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm" data-testid="select-faq-department">{departments.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label><span className="mb-2 block text-xs font-bold">Priority <span className="font-normal text-muted-foreground">(1–5)</span></span><input type="number" min={1} max={5} value={form.priority} onChange={(event) => update('priority', Number(event.target.value))} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm" data-testid="input-faq-priority" /></label></div>{message && <div className={`mt-5 rounded-xl p-3 text-sm font-semibold ${message.startsWith('FAQ') ? 'bg-emerald-500/10 text-emerald-700' : 'bg-destructive/10 text-destructive'}`} data-testid="status-faq-form">{message}</div>}<div className="mt-7 flex items-center justify-end gap-3 border-t border-border pt-5"><Link href="/admin" className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted" data-testid="link-cancel-faq">Cancel</Link><button disabled={createFaq.isPending} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60" data-testid="button-publish-faq">{createFaq.isPending ? 'Publishing…' : 'Publish FAQ'}<Send className="size-3.5" /></button></div></form></div>;
}

function DatabaseDemoPage() {
  const { data, isLoading, isError, refetch } = useGetDatabaseDemo({ query: { queryKey: getGetDatabaseDemoQueryKey() } });
  return <div className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 sm:py-12"><SectionHeading eyebrow="Under the hood" title="Database demo" detail="A small, explorable view of the DBMS concepts powering the knowledge index." />{isLoading ? <LoadingCards count={3} /> : isError || !data ? <QueryError onRetry={() => refetch()} /> : <><div className="grid gap-3 sm:grid-cols-3">{(Array.isArray(data.schemaStats) ? data.schemaStats : []).map((stat) => <MetricCard key={stat.label} label={stat.label} value={stat.label === 'MongoDB collections' ? stat.value.split(' ')[0] : stat.value} detail={stat.label === 'MongoDB collections' && stat.value !== 'Unavailable' ? 'knowledge_documents · document_chunks · faq_enrichment' : undefined} />)}</div><div className="mt-6 grid gap-4 sm:grid-cols-2">{(Array.isArray(data.concepts) ? data.concepts : []).map((concept, index) => <article key={concept.name} className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent/50" data-testid={`card-concept-${index}`}><div className="flex items-start justify-between gap-3"><div><span className="font-mono text-[10px] text-accent-foreground">CONCEPT {String(index + 1).padStart(2, '0')}</span><h2 className="mt-2 font-display text-xl font-bold">{concept.name}</h2></div><Database className="size-5 text-muted-foreground" /></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{concept.description}</p><pre className="mt-5 overflow-x-auto rounded-xl bg-primary p-4 font-mono text-[11px] leading-5 text-accent">{concept.sql}</pre></article>)}</div></>}</div>;
}

function LoginPage() {
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const choose = (role: 'Student' | 'Admin') => { if (typeof window !== 'undefined') window.localStorage.setItem('campusquery-demo-role', role); client.invalidateQueries({ queryKey: getGetSessionQueryKey() }); setLocation(role === 'Admin' ? '/admin' : '/'); };
  return <div className="min-h-[100dvh] bg-primary px-5 py-8 text-primary-foreground sm:grid sm:place-items-center"><div className="mx-auto w-full max-w-[860px]"><AppLogo compact /><div className="mt-14 grid gap-10 md:grid-cols-[.9fr_1.1fr] md:items-center"><div><p className="font-mono text-[10px] uppercase tracking-[.22em] text-accent">Demo access</p><h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-[-.04em] text-white sm:text-6xl">A sharper way<br />to ask campus.</h1><p className="mt-5 max-w-sm text-sm leading-6 text-primary-foreground/60">Choose a role to preview CampusQuery. No password, no setup — just the knowledge desk.</p></div><div className="rounded-[24px] bg-card p-2 text-foreground shadow-2xl"><div className="rounded-[18px] border border-border p-6 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Continue as</p><div className="mt-5 grid gap-3"><button onClick={() => choose('Student')} className="group flex items-center gap-4 rounded-2xl border border-border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent-foreground hover:shadow-lg" data-testid="button-login-student"><span className="grid size-11 place-items-center rounded-xl bg-accent/20 text-accent-foreground"><BookOpen className="size-5" /></span><span className="flex-1"><span className="block text-sm font-bold">Student workspace</span><span className="mt-1 block text-xs text-muted-foreground">Ask, search, save, and revisit answers.</span></span><ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></button><button onClick={() => choose('Admin')} className="group flex items-center gap-4 rounded-2xl border border-border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent-foreground hover:shadow-lg" data-testid="button-login-admin"><span className="grid size-11 place-items-center rounded-xl bg-primary text-accent"><SlidersHorizontal className="size-5" /></span><span className="flex-1"><span className="block text-sm font-bold">Knowledge steward</span><span className="mt-1 block text-xs text-muted-foreground">Review health, publish FAQs, inspect MySQL and MongoDB.</span></span><ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></button></div><p className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="size-3.5 text-emerald-600" /> Demo mode — use either path to explore.</p></div></div></div></div></div>;
}

function Router() {
  return <Switch><Route path="/login" component={LoginPage} /><Route path="/" component={() => <Shell><Home /></Shell>} /><Route path="/search" component={() => <Shell><SearchPage /></Shell>} /><Route path="/faqs/:id" component={() => <Shell><FaqDetailPage /></Shell>} /><Route path="/bookmarks" component={() => <Shell><BookmarksPage /></Shell>} /><Route path="/history" component={() => <Shell><HistoryPage /></Shell>} /><Route path="/admin" component={() => <Shell><AdminPage /></Shell>} /><Route path="/admin/faqs/new" component={() => <Shell><NewFaqPage /></Shell>} /><Route path="/admin/database-demo" component={() => <Shell><DatabaseDemoPage /></Shell>} /><Route component={NotFound} /></Switch>;
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><Router /></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
