import { useState, useEffect, useCallback, useRef } from 'react';
import { superService } from '../../services/super.service';

const TABS = [
  { key: 'pages', label: 'Pages' },
  { key: 'header', label: 'Header Menu' },
  { key: 'footer', label: 'Footer Menu' },
  { key: 'social', label: 'Social & Footer' },
  { key: 'help', label: 'Help & Support' },
];

const STATUS_BADGE = {
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
};

/* ─── Rich text editor (dependency-free) ─────────────────────── */

function RichEditor({ value, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (command, val = null) => {
    document.execCommand(command, false, val);
  };

  const Btn = ({ label, title, onClick }) => (
    <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={() => { onClick(); ref.current?.focus(); }}
      className="px-2.5 py-1.5 text-xs font-semibold rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
      {label}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-gray-50 border-b border-gray-200">
        <Btn label="B" title="Bold" onClick={() => exec('bold')} />
        <Btn label="I" title="Italic" onClick={() => exec('italic')} />
        <Btn label="U" title="Underline" onClick={() => exec('underline')} />
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <Btn label="H2" title="Heading 2" onClick={() => exec('formatBlock', 'h2')} />
        <Btn label="H3" title="Heading 3" onClick={() => exec('formatBlock', 'h3')} />
        <Btn label="¶" title="Paragraph" onClick={() => exec('formatBlock', 'p')} />
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <Btn label="• List" title="Bulleted list" onClick={() => exec('insertUnorderedList')} />
        <Btn label="1. List" title="Numbered list" onClick={() => exec('insertOrderedList')} />
        <Btn label="❝" title="Quote" onClick={() => exec('formatBlock', 'blockquote')} />
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <Btn label="Link" title="Insert link" onClick={() => { const u = window.prompt('Link URL'); if (u) exec('createLink', u); }} />
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning onInput={() => onChange(ref.current.innerHTML)}
        className="legal-editor min-h-[260px] max-h-[420px] overflow-y-auto p-4 text-sm text-gray-800 focus:outline-none" />
    </div>
  );
}

/* ─── Small UI helpers ───────────────────────────────────────── */

function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
    </label>
  );
}

function Field({ label, children, required }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600">{label}{required ? ' *' : ''}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function WideModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────── */

export default function Cms() {
  const [tab, setTab] = useState('pages');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const notify = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  /* ── Pages ── */
  const [pages, setPages] = useState([]);
  const [pageModal, setPageModal] = useState(null); // { page? } or 'new'
  const [pageForm, setPageForm] = useState({});
  const [saving, setSaving] = useState(false);

  const loadPages = useCallback(async () => {
    try {
      const res = await superService.listCmsPages();
      setPages(res.pages || []);
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to load pages.'); }
  }, []);

  /* ── Header menus ── */
  const [headerMenus, setHeaderMenus] = useState([]);
  const [headerModal, setHeaderModal] = useState(null);
  const [headerForm, setHeaderForm] = useState({});

  const loadHeader = useCallback(async () => {
    try {
      const res = await superService.listHeaderMenus();
      setHeaderMenus(res.menus || []);
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to load menus.'); }
  }, []);

  /* ── Footer ── */
  const [footer, setFooter] = useState([]);
  const [catModal, setCatModal] = useState(null);
  const [catForm, setCatForm] = useState({});
  const [linkModal, setLinkModal] = useState(null); // { categoryId, link? }
  const [linkForm, setLinkForm] = useState({});

  const loadFooter = useCallback(async () => {
    try {
      const res = await superService.getCmsFooter();
      setFooter(res.categories || []);
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to load footer.'); }
  }, []);

  /* ── Social & settings ── */
  const [social, setSocial] = useState({ linkedin: { url: '', is_visible: true }, x: { url: '', is_visible: true }, instagram: { url: '', is_visible: true } });
  const [site, setSite] = useState({ logoUrl: '', footerDescription: '', supportEmail: '', whatsappNumber: '', copyright: '' });

  /* ── Help & Support ── */
  const [helpTopics, setHelpTopics] = useState([]);
  const [helpFaqs, setHelpFaqs] = useState([]);
  const [helpSettings, setHelpSettings] = useState({ heroTitle: '', heroSubtitle: '', tutorialsTitle: '', tutorialsSubtitle: '', contactWhatsapp: '', contactPhone: '', contactEmail: '' });
  const [topicModal, setTopicModal] = useState(null); // 'new' | id
  const [topicForm, setTopicForm] = useState({ key: '', label: '', subtitle: '', content: '', icon: '' });
  const [faqModal, setFaqModal] = useState(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '' });

  const loadHelp = useCallback(async () => {
    try {
      const [t, f, s] = await Promise.all([
        superService.listHelpTopics(),
        superService.listHelpFaqs(),
        superService.getHelpSettings(),
      ]);
      setHelpTopics(t.topics || []);
      setHelpFaqs(f.faqs || []);
      const st = s.settings || {};
      setHelpSettings({
        heroTitle: st.hero_title || '',
        heroSubtitle: st.hero_subtitle || '',
        tutorialsTitle: st.tutorials_title || '',
        tutorialsSubtitle: st.tutorials_subtitle || '',
        contactWhatsapp: st.contact_whatsapp || '',
        contactPhone: st.contact_phone || '',
        contactEmail: st.contact_email || '',
      });
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to load help content.'); }
  }, []);

  const saveHelpTopic = async () => {
    if (!topicForm.key || !topicForm.label) return notify('error', 'Key and label are required.');
    setSaving(true);
    try {
      if (topicModal === 'new') await superService.createHelpTopic(topicForm);
      else await superService.updateHelpTopic(topicModal, topicForm);
      notify('success', 'Help topic saved.');
      setTopicModal(null);
      loadHelp();
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to save topic.'); }
    finally { setSaving(false); }
  };

  const deleteHelpTopic = async (t) => {
    if (!window.confirm(`Delete help topic "${t.label}"?`)) return;
    try { await superService.deleteHelpTopic(t.id); loadHelp(); }
    catch (e) { notify('error', e.response?.data?.error || 'Failed to delete topic.'); }
  };

  const saveHelpFaq = async () => {
    if (!faqForm.question || !faqForm.answer) return notify('error', 'Question and answer are required.');
    setSaving(true);
    try {
      if (faqModal === 'new') await superService.createHelpFaq(faqForm);
      else await superService.updateHelpFaq(faqModal, faqForm);
      notify('success', 'FAQ saved.');
      setFaqModal(null);
      loadHelp();
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to save FAQ.'); }
    finally { setSaving(false); }
  };

  const deleteHelpFaq = async (f) => {
    if (!window.confirm(`Delete FAQ "${f.question}"?`)) return;
    try { await superService.deleteHelpFaq(f.id); loadHelp(); }
    catch (e) { notify('error', e.response?.data?.error || 'Failed to delete FAQ.'); }
  };

  const saveHelpSettings = async () => {
    setSaving(true);
    try {
      await superService.updateHelpSettings(helpSettings);
      notify('success', 'Help settings saved.');
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to save settings.'); }
    finally { setSaving(false); }
  };

  const loadSocialSettings = useCallback(async () => {
    try {
      const [s, set] = await Promise.all([superService.getCmsSocial(), superService.getCmsSettings()]);
      const map = { linkedin: { url: '', is_visible: true }, x: { url: '', is_visible: true }, instagram: { url: '', is_visible: true } };
      for (const r of s.social || []) if (map[r.platform]) map[r.platform] = { url: r.url || '', is_visible: r.is_visible !== false };
      setSocial(map);
      const st = set.settings || {};
      setSite({
        logoUrl: st.logo_url || '',
        footerDescription: st.footer_description || '',
        supportEmail: st.support_email || '',
        whatsappNumber: st.whatsapp_number || '',
        copyright: st.footer_copyright || '',
      });
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to load settings.'); }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPages(), loadHeader(), loadFooter(), loadSocialSettings(), loadHelp()]);
    setLoading(false);
  }, [loadPages, loadHeader, loadFooter, loadSocialSettings, loadHelp]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── Reorder helper (drag & drop) ── */
  const dragId = useRef(null);

  const reorder = (list, fromId, toId) => {
    const next = [...list];
    const from = next.findIndex((x) => x.id === fromId);
    const to = next.findIndex((x) => x.id === toId);
    if (from === -1 || to === -1 || from === to) return list;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  /* ── Page actions ── */
  const openNewPage = () => {
    setPageForm({ title: '', slug: '', seoTitle: '', seoDescription: '', content: '', featuredImage: '', status: 'draft' });
    setPageModal('new');
  };
  const openEditPage = (p) => {
    setPageForm({
      title: p.title, slug: p.slug, seoTitle: p.seo_title || '', seoDescription: p.seo_description || '',
      content: p.content || '', featuredImage: p.featured_image || '', status: p.status,
    });
    setPageModal(p.id);
  };
  const savePage = async () => {
    if (!pageForm.title || !pageForm.slug) return notify('error', 'Title and slug are required.');
    setSaving(true);
    try {
      if (pageModal === 'new') {
        await superService.createCmsPage(pageForm);
        notify('success', 'Page created.');
      } else {
        await superService.updateCmsPage(pageModal, pageForm);
        notify('success', 'Page updated.');
      }
      setPageModal(null);
      loadPages();
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to save page.'); }
    finally { setSaving(false); }
  };
  const togglePageStatus = async (p) => {
    try {
      await superService.setCmsPageStatus(p.id, p.status === 'published' ? 'draft' : 'published');
      notify('success', `Page ${p.status === 'published' ? 'unpublished' : 'published'}.`);
      loadPages();
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to update status.'); }
  };
  const deletePage = async (p) => {
    if (!window.confirm(`Delete page "${p.title}"? This cannot be undone.`)) return;
    try {
      await superService.deleteCmsPage(p.id);
      notify('success', 'Page deleted.');
      loadPages();
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to delete page.'); }
  };

  /* ── Header menu actions ── */
  const saveHeaderMenu = async () => {
    if (!headerForm.label) return notify('error', 'Label is required.');
    setSaving(true);
    try {
      if (headerModal === 'new') await superService.createHeaderMenu(headerForm);
      else await superService.updateHeaderMenu(headerModal, headerForm);
      notify('success', 'Menu item saved.');
      setHeaderModal(null);
      loadHeader();
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to save menu item.'); }
    finally { setSaving(false); }
  };
  const toggleHeaderVisible = async (m) => {
    try { await superService.updateHeaderMenu(m.id, { isVisible: !m.is_visible }); loadHeader(); }
    catch (e) { notify('error', e.response?.data?.error || 'Failed to update.'); }
  };
  const deleteHeaderMenu = async (m) => {
    if (!window.confirm(`Delete menu item "${m.label}"?`)) return;
    try { await superService.deleteHeaderMenu(m.id); loadHeader(); }
    catch (e) { notify('error', e.response?.data?.error || 'Failed to delete.'); }
  };
  const dropHeader = async (toId) => {
    if (!dragId.current || dragId.current === toId) return;
    setHeaderMenus((prev) => {
      const next = reorder(prev, dragId.current, toId);
      superService.reorderHeaderMenus(next.map((x) => x.id)).catch(() => notify('error', 'Failed to save order.'));
      return next;
    });
    dragId.current = null;
  };

  /* ── Footer category actions ── */
  const saveCategory = async () => {
    if (!catForm.title) return notify('error', 'Category title is required.');
    setSaving(true);
    try {
      if (catModal === 'new') await superService.createFooterCategory(catForm);
      else await superService.updateFooterCategory(catModal, catForm);
      notify('success', 'Category saved.');
      setCatModal(null);
      loadFooter();
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to save category.'); }
    finally { setSaving(false); }
  };
  const deleteCategory = async (c) => {
    if (!window.confirm(`Delete footer category "${c.title}" and all its links?`)) return;
    try { await superService.deleteFooterCategory(c.id); loadFooter(); }
    catch (e) { notify('error', e.response?.data?.error || 'Failed to delete category.'); }
  };
  const dropCategory = async (toId) => {
    if (!dragId.current || dragId.current === toId) return;
    setFooter((prev) => {
      const next = reorder(prev, dragId.current, toId);
      superService.reorderFooterCategories(next.map((x) => x.id)).catch(() => notify('error', 'Failed to save order.'));
      return next;
    });
    dragId.current = null;
  };

  /* ── Footer link actions ── */
  const saveFooterLink = async () => {
    if (!linkForm.label) return notify('error', 'Link label is required.');
    setSaving(true);
    try {
      if (linkModal.link) await superService.updateFooterLink(linkModal.link.id, linkForm);
      else await superService.createFooterLink(linkModal.categoryId, linkForm);
      notify('success', 'Link saved.');
      setLinkModal(null);
      loadFooter();
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to save link.'); }
    finally { setSaving(false); }
  };
  const deleteFooterLink = async (l) => {
    if (!window.confirm(`Delete link "${l.label}"?`)) return;
    try { await superService.deleteFooterLink(l.id); loadFooter(); }
    catch (e) { notify('error', e.response?.data?.error || 'Failed to delete link.'); }
  };
  const dropFooterLink = async (categoryId, toId) => {
    if (!dragId.current || dragId.current === toId) return;
    setFooter((prev) => {
      const next = prev.map((c) => c.id === categoryId ? { ...c, links: reorder(c.links || [], dragId.current, toId) } : c);
      const cat = next.find((c) => c.id === categoryId);
      if (cat) superService.reorderFooterLinks((cat.links || []).map((x) => x.id)).catch(() => notify('error', 'Failed to save order.'));
      return next;
    });
    dragId.current = null;
  };

  /* ── Social & settings save ── */
  const saveSocial = async () => {
    setSaving(true);
    try {
      for (const [platform, v] of Object.entries(social)) {
        await superService.updateCmsSocial(platform, v);
      }
      await superService.updateCmsSettings({
        footerCopyright: site.copyright,
        logoUrl: site.logoUrl,
        footerDescription: site.footerDescription,
        supportEmail: site.supportEmail,
        whatsappNumber: site.whatsappNumber,
      });
      notify('success', 'Site settings & social links saved.');
      loadSocialSettings();
    } catch (e) { notify('error', e.response?.data?.error || 'Failed to save settings.'); }
    finally { setSaving(false); }
  };

  const isExternal = (f) => f.link_type === 'external';

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Content Management</h1>
        <p className="text-sm text-gray-500 mt-1">Manage website pages, header & footer menus, social links and footer settings.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${tab === t.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* ═════════ PAGES ═════════ */}
      {tab === 'pages' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openNewPage} className="btn-primary px-4 py-2 text-sm">+ New Page</button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="p-3 font-semibold">Title</th>
                  <th className="p-3 font-semibold">Slug</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Updated</th>
                  <th className="p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pages.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3 font-medium">{p.title}</td>
                    <td className="p-3 text-gray-500">/{p.slug}</td>
                    <td className="p-3"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[p.status]}`}>{p.status}</span></td>
                    <td className="p-3 text-gray-500">{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditPage(p)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Edit</button>
                        <button onClick={() => togglePageStatus(p)} className="text-xs font-semibold text-amber-600 hover:text-amber-800">{p.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                        <button onClick={() => deletePage(p)} className="text-xs font-semibold text-red-600 hover:text-red-800">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═════════ HEADER MENU ═════════ */}
      {tab === 'header' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setHeaderForm({ label: '', link_type: 'page', page_slug: '', external_url: '' }); setHeaderModal('new'); }} className="btn-primary px-4 py-2 text-sm">+ Add Menu Item</button>
          </div>
          <div className="card divide-y divide-gray-100">
            {headerMenus.length === 0 && <p className="p-6 text-sm text-gray-500">No header menu items.</p>}
            {headerMenus.map((m) => (
              <div key={m.id} draggable onDragStart={() => (dragId.current = m.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => dropHeader(m.id)}
                className="flex items-center gap-3 p-4 cursor-grab active:cursor-grabbing">
                <span className="text-gray-300 select-none">⠿</span>
                <span className="font-medium">{m.label}</span>
                <span className="text-xs text-gray-400">{isExternal(m) ? m.external_url : `/${m.page_slug}`}</span>
                <span className="flex-1" />
                <Toggle checked={m.is_visible} onChange={() => toggleHeaderVisible(m)} />
                <button onClick={() => { setHeaderForm({ label: m.label, link_type: m.link_type, page_slug: m.page_slug || '', external_url: m.external_url || '' }); setHeaderModal(m.id); }} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Edit</button>
                <button onClick={() => deleteHeaderMenu(m)} className="text-xs font-semibold text-red-600 hover:text-red-800">Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════════ FOOTER MENU ═════════ */}
      {tab === 'footer' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setCatForm({ title: '' }); setCatModal('new'); }} className="btn-primary px-4 py-2 text-sm">+ Add Category</button>
          </div>
          {footer.map((c) => (
            <div key={c.id} className="card p-5">
              <div draggable onDragStart={() => (dragId.current = c.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => dropCategory(c.id)}
                className="flex items-center gap-3 pb-4 border-b border-gray-100 cursor-grab active:cursor-grabbing">
                <span className="text-gray-300 select-none">⠿</span>
                <span className="font-bold text-gray-900">{c.title}</span>
                <span className="flex-1" />
                <span className="text-xs text-gray-400">{c.links?.length || 0} links</span>
                <Toggle checked={c.is_visible} onChange={async (v) => { try { await superService.updateFooterCategory(c.id, { isVisible: v }); loadFooter(); } catch (e) { notify('error', 'Failed to update.'); } }} />
                <button onClick={() => { setCatForm({ title: c.title }); setCatModal(c.id); }} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Edit</button>
                <button onClick={() => deleteCategory(c)} className="text-xs font-semibold text-red-600 hover:text-red-800">Delete</button>
                <button onClick={() => { setLinkForm({ label: '', link_type: 'page', page_slug: '', external_url: '' }); setLinkModal({ categoryId: c.id }); }} className="px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-50">+ Link</button>
              </div>
              <div className="divide-y divide-gray-50">
                {(c.links || []).map((l) => (
                  <div key={l.id} draggable onDragStart={() => (dragId.current = l.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => dropFooterLink(c.id, l.id)}
                    className="flex items-center gap-3 py-3 cursor-grab active:cursor-grabbing">
                    <span className="text-gray-300 select-none pl-6">⠿</span>
                    <span className="text-sm font-medium">{l.label}</span>
                    <span className="text-xs text-gray-400">{isExternal(l) ? l.external_url : `/${l.page_slug}`}</span>
                    <span className="flex-1" />
                    <Toggle checked={l.is_visible} onChange={async (v) => { try { await superService.updateFooterLink(l.id, { isVisible: v }); loadFooter(); } catch (e) { notify('error', 'Failed to update.'); } }} />
                    <button onClick={() => { setLinkForm({ label: l.label, link_type: l.link_type, page_slug: l.page_slug || '', external_url: l.external_url || '' }); setLinkModal({ categoryId: c.id, link: l }); }} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Edit</button>
                    <button onClick={() => deleteFooterLink(l)} className="text-xs font-semibold text-red-600 hover:text-red-800">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═════════ SOCIAL & FOOTER ═════════ */}
      {tab === 'social' && (
        <div className="space-y-6 max-w-3xl">
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Site Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">Logo URL</label>
                <input className="input-field mt-1" value={site.logoUrl} onChange={(e) => setSite((s) => ({ ...s, logoUrl: e.target.value }))} placeholder="/logo.png" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">WhatsApp Contact (number only)</label>
                <input className="input-field mt-1" value={site.whatsappNumber} onChange={(e) => setSite((s) => ({ ...s, whatsappNumber: e.target.value }))} placeholder="971500000000" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Support Email</label>
              <input className="input-field mt-1" value={site.supportEmail} onChange={(e) => setSite((s) => ({ ...s, supportEmail: e.target.value }))} placeholder="support@bahi360.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Footer Description</label>
              <textarea className="input-field mt-1" rows={3} value={site.footerDescription} onChange={(e) => setSite((s) => ({ ...s, footerDescription: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Copyright text</label>
              <input className="input-field mt-1" value={site.copyright} onChange={(e) => setSite((s) => ({ ...s, copyright: e.target.value }))} placeholder="© 2026 Bahi360. All rights reserved." />
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Social Media Links</h2>
            {['linkedin', 'x', 'instagram'].map((platform) => (
              <div key={platform} className="flex items-center gap-3">
                <span className="w-24 text-sm font-semibold text-gray-700 capitalize">{platform === 'x' ? 'X (Twitter)' : platform}</span>
                <input className="input-field flex-1" placeholder={`https://${platform === 'x' ? 'x.com' : platform}.com/...`}
                  value={social[platform]?.url || ''} onChange={(e) => setSocial((s) => ({ ...s, [platform]: { ...s[platform], url: e.target.value } }))} />
                <Toggle checked={social[platform]?.is_visible} onChange={(v) => setSocial((s) => ({ ...s, [platform]: { ...s[platform], is_visible: v } }))} />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button onClick={saveSocial} disabled={saving} className="btn-primary px-6 py-2.5">{saving ? 'Saving...' : 'Save Settings'}</button>
          </div>
        </div>
      )}

      {/* ═════════ HELP & SUPPORT ═════════ */}
      {tab === 'help' && (
        <div className="space-y-6">
          {/* Settings */}
          <div className="card p-5 space-y-4 max-w-3xl">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Hero & Tutorials</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs font-semibold text-gray-600">Hero Title</label><input className="input-field mt-1" value={helpSettings.heroTitle} onChange={(e) => setHelpSettings((s) => ({ ...s, heroTitle: e.target.value }))} /></div>
              <div><label className="text-xs font-semibold text-gray-600">Tutorials Title</label><input className="input-field mt-1" value={helpSettings.tutorialsTitle} onChange={(e) => setHelpSettings((s) => ({ ...s, tutorialsTitle: e.target.value }))} /></div>
            </div>
            <div><label className="text-xs font-semibold text-gray-600">Hero Subtitle</label><input className="input-field mt-1" value={helpSettings.heroSubtitle} onChange={(e) => setHelpSettings((s) => ({ ...s, heroSubtitle: e.target.value }))} /></div>
            <div><label className="text-xs font-semibold text-gray-600">Tutorials Subtitle</label><input className="input-field mt-1" value={helpSettings.tutorialsSubtitle} onChange={(e) => setHelpSettings((s) => ({ ...s, tutorialsSubtitle: e.target.value }))} /></div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider pt-2 border-t border-gray-100">Contact Support</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="text-xs font-semibold text-gray-600">WhatsApp (number)</label><input className="input-field mt-1" value={helpSettings.contactWhatsapp} onChange={(e) => setHelpSettings((s) => ({ ...s, contactWhatsapp: e.target.value }))} /></div>
              <div><label className="text-xs font-semibold text-gray-600">Phone</label><input className="input-field mt-1" value={helpSettings.contactPhone} onChange={(e) => setHelpSettings((s) => ({ ...s, contactPhone: e.target.value }))} /></div>
              <div><label className="text-xs font-semibold text-gray-600">Email</label><input className="input-field mt-1" value={helpSettings.contactEmail} onChange={(e) => setHelpSettings((s) => ({ ...s, contactEmail: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end"><button onClick={saveHelpSettings} disabled={saving} className="btn-primary px-5 py-2">{saving ? 'Saving...' : 'Save Settings'}</button></div>
          </div>

          {/* Help topics */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Help Topics</h2>
              <button onClick={() => { setTopicForm({ key: '', label: '', subtitle: '', content: '', icon: '' }); setTopicModal('new'); }} className="btn-primary px-4 py-2 text-sm">+ Add Topic</button>
            </div>
            <div className="divide-y divide-gray-100">
              {helpTopics.map((t) => (
                <div key={t.id} draggable onDragStart={() => (dragId.current = t.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId.current && dragId.current !== t.id) { setHelpTopics((prev) => { const next = reorder(prev, dragId.current, t.id); superService.reorderHelpTopics(next.map((x) => x.id)).catch(() => notify('error', 'Failed to save order.')); return next; }); } dragId.current = null; }}
                  className="flex items-center gap-3 py-3 cursor-grab active:cursor-grabbing">
                  <span className="text-gray-300 select-none">⠿</span>
                  <span className="text-lg">{t.icon || '📘'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{t.label} <span className="text-xs text-gray-400 ml-1">({t.key})</span></p>
                    <p className="text-xs text-gray-500 truncate">{t.subtitle || '—'}</p>
                  </div>
                  <Toggle checked={t.is_visible} onChange={async (v) => { try { await superService.updateHelpTopic(t.id, { isVisible: v }); loadHelp(); } catch (e) { notify('error', 'Failed to update.'); } }} />
                  <button onClick={() => { setTopicForm({ key: t.key, label: t.label, subtitle: t.subtitle || '', content: t.content || '', icon: t.icon || '' }); setTopicModal(t.id); }} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Edit</button>
                  <button onClick={() => deleteHelpTopic(t)} className="text-xs font-semibold text-red-600 hover:text-red-800">Delete</button>
                </div>
              ))}
            </div>
          </div>

          {/* FAQs */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">FAQs</h2>
              <button onClick={() => { setFaqForm({ question: '', answer: '' }); setFaqModal('new'); }} className="btn-primary px-4 py-2 text-sm">+ Add FAQ</button>
            </div>
            <div className="divide-y divide-gray-100">
              {helpFaqs.map((f) => (
                <div key={f.id} draggable onDragStart={() => (dragId.current = f.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId.current && dragId.current !== f.id) { setHelpFaqs((prev) => { const next = reorder(prev, dragId.current, f.id); superService.reorderHelpFaqs(next.map((x) => x.id)).catch(() => notify('error', 'Failed to save order.')); return next; }); } dragId.current = null; }}
                  className="flex items-center gap-3 py-3 cursor-grab active:cursor-grabbing">
                  <span className="text-gray-300 select-none">⠿</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{f.question}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{f.answer}</p>
                  </div>
                  <Toggle checked={f.is_visible} onChange={async (v) => { try { await superService.updateHelpFaq(f.id, { isVisible: v }); loadHelp(); } catch (e) { notify('error', 'Failed to update.'); } }} />
                  <button onClick={() => { setFaqForm({ question: f.question, answer: f.answer }); setFaqModal(f.id); }} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Edit</button>
                  <button onClick={() => deleteHelpFaq(f)} className="text-xs font-semibold text-red-600 hover:text-red-800">Delete</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Page modal ── */}
      {pageModal !== null && (
        <WideModal title={pageModal === 'new' ? 'New Page' : 'Edit Page'} onClose={() => setPageModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Title" required><input className="input-field" value={pageForm.title} onChange={(e) => setPageForm((f) => ({ ...f, title: e.target.value }))} /></Field>
              <Field label="Slug" required><input className="input-field" value={pageForm.slug} onChange={(e) => setPageForm((f) => ({ ...f, slug: e.target.value }))} placeholder="e.g. about-us" disabled={pageModal !== 'new'} /></Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="SEO Title"><input className="input-field" value={pageForm.seoTitle} onChange={(e) => setPageForm((f) => ({ ...f, seoTitle: e.target.value }))} /></Field>
              <Field label="Featured Image URL"><input className="input-field" value={pageForm.featuredImage} onChange={(e) => setPageForm((f) => ({ ...f, featuredImage: e.target.value }))} placeholder="https://..." /></Field>
            </div>
            <Field label="SEO Description"><textarea className="input-field" rows={2} value={pageForm.seoDescription} onChange={(e) => setPageForm((f) => ({ ...f, seoDescription: e.target.value }))} /></Field>
            <Field label="Content"><RichEditor value={pageForm.content} onChange={(content) => setPageForm((f) => ({ ...f, content }))} /></Field>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-600">Status</span>
              <select className="input-field max-w-[180px]" value={pageForm.status} onChange={(e) => setPageForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setPageModal(null)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={savePage} disabled={saving} className="btn-primary px-6 py-2.5">{saving ? 'Saving...' : 'Save Page'}</button>
            </div>
          </div>
        </WideModal>
      )}

      {/* ── Header menu modal ── */}
      {headerModal !== null && (
        <WideModal title={headerModal === 'new' ? 'Add Menu Item' : 'Edit Menu Item'} onClose={() => setHeaderModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Label" required><input className="input-field" value={headerForm.label} onChange={(e) => setHeaderForm((f) => ({ ...f, label: e.target.value }))} /></Field>
              <Field label="Link Type">
                <select className="input-field" value={headerForm.link_type} onChange={(e) => setHeaderForm((f) => ({ ...f, link_type: e.target.value }))}>
                  <option value="page">Internal page</option>
                  <option value="external">External URL</option>
                </select>
              </Field>
            </div>
            {isExternal(headerForm) ? (
              <Field label="External URL"><input className="input-field" value={headerForm.external_url} onChange={(e) => setHeaderForm((f) => ({ ...f, external_url: e.target.value }))} placeholder="https://..." /></Field>
            ) : (
              <Field label="Page">
                <select className="input-field" value={headerForm.page_slug} onChange={(e) => setHeaderForm((f) => ({ ...f, page_slug: e.target.value }))}>
                  <option value="">Select page</option>
                  {pages.map((p) => <option key={p.id} value={p.slug}>/{p.slug}</option>)}
                </select>
              </Field>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setHeaderModal(null)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={saveHeaderMenu} disabled={saving} className="btn-primary px-6 py-2.5">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </WideModal>
      )}

      {/* ── Category modal ── */}
      {catModal !== null && (
        <WideModal title={catModal === 'new' ? 'Add Footer Category' : 'Edit Footer Category'} onClose={() => setCatModal(null)}>
          <div className="space-y-4">
            <Field label="Category Title" required><input className="input-field" value={catForm.title} onChange={(e) => setCatForm((f) => ({ ...f, title: e.target.value }))} /></Field>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setCatModal(null)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={saveCategory} disabled={saving} className="btn-primary px-6 py-2.5">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </WideModal>
      )}

      {/* ── Footer link modal ── */}
      {linkModal !== null && (
        <WideModal title={linkModal.link ? 'Edit Link' : 'Add Link'} onClose={() => setLinkModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Label" required><input className="input-field" value={linkForm.label} onChange={(e) => setLinkForm((f) => ({ ...f, label: e.target.value }))} /></Field>
              <Field label="Link Type">
                <select className="input-field" value={linkForm.link_type} onChange={(e) => setLinkForm((f) => ({ ...f, link_type: e.target.value }))}>
                  <option value="page">Internal page</option>
                  <option value="external">External URL</option>
                </select>
              </Field>
            </div>
            {isExternal(linkForm) ? (
              <Field label="External URL"><input className="input-field" value={linkForm.external_url} onChange={(e) => setLinkForm((f) => ({ ...f, external_url: e.target.value }))} placeholder="https://..." /></Field>
            ) : (
              <Field label="Page">
                <select className="input-field" value={linkForm.page_slug} onChange={(e) => setLinkForm((f) => ({ ...f, page_slug: e.target.value }))}>
                  <option value="">Select page</option>
                  {pages.map((p) => <option key={p.id} value={p.slug}>/{p.slug}</option>)}
                </select>
              </Field>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setLinkModal(null)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={saveFooterLink} disabled={saving} className="btn-primary px-6 py-2.5">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </WideModal>
      )}

      {/* ── Help topic modal ── */}
      {topicModal !== null && (
        <WideModal title={topicModal === 'new' ? 'Add Help Topic' : 'Edit Help Topic'} onClose={() => setTopicModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Key" required><input className="input-field" value={topicForm.key} onChange={(e) => setTopicForm((f) => ({ ...f, key: e.target.value }))} placeholder="e.g. gettingStarted" disabled={topicModal !== 'new'} /></Field>
              <Field label="Icon (emoji)"><input className="input-field" value={topicForm.icon} onChange={(e) => setTopicForm((f) => ({ ...f, icon: e.target.value }))} placeholder="🚀" /></Field>
            </div>
            <Field label="Label" required><input className="input-field" value={topicForm.label} onChange={(e) => setTopicForm((f) => ({ ...f, label: e.target.value }))} /></Field>
            <Field label="Subtitle"><input className="input-field" value={topicForm.subtitle} onChange={(e) => setTopicForm((f) => ({ ...f, subtitle: e.target.value }))} /></Field>
            <Field label="Help Content (HTML)"><RichEditor value={topicForm.content} onChange={(content) => setTopicForm((f) => ({ ...f, content }))} /></Field>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setTopicModal(null)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={saveHelpTopic} disabled={saving} className="btn-primary px-6 py-2.5">{saving ? 'Saving...' : 'Save Topic'}</button>
            </div>
          </div>
        </WideModal>
      )}

      {/* ── FAQ modal ── */}
      {faqModal !== null && (
        <WideModal title={faqModal === 'new' ? 'Add FAQ' : 'Edit FAQ'} onClose={() => setFaqModal(null)}>
          <div className="space-y-4">
            <Field label="Question" required><input className="input-field" value={faqForm.question} onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))} /></Field>
            <Field label="Answer" required><textarea className="input-field" rows={4} value={faqForm.answer} onChange={(e) => setFaqForm((f) => ({ ...f, answer: e.target.value }))} /></Field>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setFaqModal(null)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={saveHelpFaq} disabled={saving} className="btn-primary px-6 py-2.5">{saving ? 'Saving...' : 'Save FAQ'}</button>
            </div>
          </div>
        </WideModal>
      )}
    </div>
  );
}