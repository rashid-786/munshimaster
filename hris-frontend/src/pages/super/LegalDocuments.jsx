import { useState, useEffect, useRef, useCallback } from 'react';
import { superService } from '../../services/super.service';
import ConfirmModal from '../../components/ConfirmModal';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

const CATEGORIES = [
  { value: 'privacy', label: 'Privacy Policy' },
  { value: 'terms', label: 'Terms & Conditions' },
  { value: 'refund', label: 'Refund & Cancellation' },
  { value: 'subscription', label: 'Subscription Policy' },
  { value: 'other', label: 'Other' },
];

const STATUS_BADGE = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  archived: 'bg-gray-100 text-gray-500 border-gray-200',
};

function publicUrl(slug) {
  return `${API_BASE}/public/legal/${slug}`;
}

/* ─── Rich text editor (dependency-free) ─────────────────────── */

function exec(command, value = null) {
  document.execCommand(command, false, value);
  // Keep focus on the editor after toolbar clicks.
  const sel = window.getSelection();
  if (sel.rangeCount > 0) sel.getRangeAt(0);
}

function RichTextEditor({ value, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = () => {
    onChange(ref.current.innerHTML);
  };

  const insertLink = () => {
    const url = window.prompt('Enter link URL (https://...)');
    if (url) exec('createLink', url);
    ref.current?.focus();
  };

  const ToolbarBtn = ({ label, title, onClick, active }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => { onClick(); ref.current?.focus(); }}
      className={`px-2.5 py-1.5 text-xs font-semibold rounded border transition-colors ${
        active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-gray-50 border-b border-gray-200">
        <ToolbarBtn label="B" title="Bold" onClick={() => exec('bold')} />
        <ToolbarBtn label="I" title="Italic" onClick={() => exec('italic')} />
        <ToolbarBtn label="U" title="Underline" onClick={() => exec('underline')} />
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <ToolbarBtn label="H2" title="Heading 2" onClick={() => exec('formatBlock', 'h2')} />
        <ToolbarBtn label="H3" title="Heading 3" onClick={() => exec('formatBlock', 'h3')} />
        <ToolbarBtn label="¶" title="Paragraph" onClick={() => exec('formatBlock', 'p')} />
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <ToolbarBtn label="• List" title="Bulleted list" onClick={() => exec('insertUnorderedList')} />
        <ToolbarBtn label="1. List" title="Numbered list" onClick={() => exec('insertOrderedList')} />
        <ToolbarBtn label="❝" title="Quote" onClick={() => exec('formatBlock', 'blockquote')} />
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <ToolbarBtn label="Link" title="Insert link" onClick={insertLink} />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="legal-editor min-h-[320px] max-h-[520px] overflow-y-auto p-4 text-sm text-gray-800 focus:outline-none"
      />
    </div>
  );
}

/* ─── Create / Edit document form ────────────────────────────── */

function DocumentForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    slug: initial?.slug || '',
    category: initial?.category || 'other',
    description: initial?.description || '',
    requiresAcceptance: initial?.requires_acceptance ?? true,
    body: initial?.body || '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{initial?.id ? 'Edit Document' : 'New Legal Document'}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">Title *</label>
              <input className="input-field mt-1" value={form.title} onChange={set('title')} placeholder="e.g. Privacy Policy" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Slug (URL identifier) *</label>
              <input className="input-field mt-1" value={form.slug} onChange={set('slug')} placeholder="e.g. privacy-policy"
                disabled={!!initial?.id} required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">Category</label>
              <select className="input-field mt-1" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.requiresAcceptance} onChange={set('requiresAcceptance')} className="w-4 h-4 accent-indigo-600" />
                Require users to accept this policy
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Short description</label>
            <textarea className="input-field mt-1" rows={2} value={form.description} onChange={set('description')} placeholder="One-line summary shown in listings" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Content</label>
            <div className="mt-1">
              <RichTextEditor value={form.body} onChange={(body) => setForm((f) => ({ ...f, body }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5">{saving ? 'Saving...' : 'Save Document'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────── */

function LegalStyles() {
  return (
    <style>{`
      .legal-editor h2, .legal-preview h2 { font-size: 1.35em; font-weight: 700; margin: 0.8em 0 0.3em; }
      .legal-editor h3, .legal-preview h3 { font-size: 1.15em; font-weight: 700; margin: 0.7em 0 0.3em; }
      .legal-editor ul, .legal-preview ul { list-style: disc; padding-left: 1.5em; margin: 0.4em 0; }
      .legal-editor ol, .legal-preview ol { list-style: decimal; padding-left: 1.5em; margin: 0.4em 0; }
      .legal-editor a, .legal-preview a { color: #4f46e5; text-decoration: underline; }
      .legal-editor blockquote, .legal-preview blockquote { border-left: 3px solid #e5e7eb; padding-left: 0.8em; color: #6b7280; margin: 0.5em 0; }
      .legal-preview { font-size: 14px; line-height: 1.6; color: #1f2937; }
      .legal-preview h2, .legal-preview h3 { color: #111827; }
    `}</style>
  );
}

function PreviewModal({ doc, onClose }) {
  if (!doc) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{doc.title} <span className="text-sm font-medium text-gray-400 ml-1">v{doc.version}</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="legal-preview" dangerouslySetInnerHTML={{ __html: doc.body || '<p><em>Empty content</em></p>' }} />
        </div>
      </div>
    </div>
  );
}

function AcceptancesModal({ acceptances, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">User Acceptances</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-6 overflow-y-auto">
          {acceptances.length === 0 ? (
            <p className="text-sm text-gray-500">No acceptances recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-semibold">Version</th>
                  <th className="pb-2 font-semibold">User</th>
                  <th className="pb-2 font-semibold">Business</th>
                  <th className="pb-2 font-semibold">Phone</th>
                  <th className="pb-2 font-semibold">Accepted At</th>
                  <th className="pb-2 font-semibold">Platform</th>
                  <th className="pb-2 font-semibold">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {acceptances.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 font-medium">v{a.version}</td>
                    <td className="py-2.5">{[a.first_name, a.last_name].filter(Boolean).join(' ') || a.user_id}</td>
                    <td className="py-2.5">{a.company_name || '—'}</td>
                    <td className="py-2.5">{a.phone || '—'}</td>
                    <td className="py-2.5">{new Date(a.accepted_at).toLocaleString()}</td>
                    <td className="py-2.5">{a.platform || '—'}</td>
                    <td className="py-2.5 text-gray-500 truncate max-w-[160px]">{a.device_info || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LegalDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingDraft, setEditingDraft] = useState(null);
  const [draftForm, setDraftForm] = useState({ title: '', body: '', effectiveDate: '', changeNote: '' });
  const [showPreview, setShowPreview] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [showAcceptances, setShowAcceptances] = useState(false);
  const [acceptances, setAcceptances] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const notify = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadDocuments = useCallback(async () => {
    try {
      const res = await superService.listLegalDocuments();
      setDocuments(res.documents || []);
    } catch (err) {
      notify('error', err.response?.data?.error || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const res = await superService.getLegalDocument(id);
      setDetail(res.document || null);
    } catch (err) {
      notify('error', err.response?.data?.error || 'Failed to load document.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const openEditDraft = (version) => {
    if (version.status === 'published') return;
    setEditingDraft(version);
    setDraftForm({
      title: version.title,
      body: version.body || '',
      effectiveDate: version.effective_date || '',
      changeNote: version.change_note || '',
    });
  };

  const handleCreate = async (form) => {
    setSaving(true);
    try {
      await superService.createLegalDocument({
        title: form.title,
        slug: form.slug,
        category: form.category,
        description: form.description,
        requiresAcceptance: form.requiresAcceptance,
        body: form.body,
      });
      notify('success', 'Document created.');
      setShowCreate(false);
      loadDocuments();
    } catch (err) {
      notify('error', err.response?.data?.error || 'Failed to create document.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMeta = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await superService.updateLegalDocument(detail.id, {
        title: detail.title,
        description: detail.description,
        category: detail.category,
        requiresAcceptance: detail.requires_acceptance,
      });
      notify('success', 'Document updated.');
      loadDetail(detail.id);
      loadDocuments();
    } catch (err) {
      notify('error', err.response?.data?.error || 'Failed to update document.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!detail || !editingDraft) return;
    setSaving(true);
    try {
      await superService.updateLegalDraftVersion(detail.id, editingDraft.id, {
        title: draftForm.title,
        body: draftForm.body,
        effectiveDate: draftForm.effectiveDate || null,
        changeNote: draftForm.changeNote,
      });
      notify('success', 'Draft saved.');
      setEditingDraft(null);
      loadDetail(detail.id);
    } catch (err) {
      notify('error', err.response?.data?.error || 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await superService.createLegalVersion(detail.id, { title: detail.title, body: '', changeNote: 'New draft' });
      notify('success', 'New draft version created.');
      loadDetail(detail.id);
    } catch (err) {
      notify('error', err.response?.data?.error || 'Failed to create version.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = (version) => {
    if (!detail) return;
    setConfirm({ action: 'publish', version });
  };

  const handleArchive = () => {
    if (!detail) return;
    setConfirm({ action: 'archive' });
  };

  const handleDelete = () => {
    if (!detail) return;
    setConfirm({ action: 'delete' });
  };

  const runConfirm = async () => {
    if (!detail || !confirm) return;
    setConfirmLoading(true);
    try {
      if (confirm.action === 'publish') {
        await superService.publishLegalVersion(detail.id, confirm.version.id);
        notify('success', `Version ${confirm.version.version} published.`);
        loadDetail(detail.id);
        loadDocuments();
      } else if (confirm.action === 'archive') {
        await superService.archiveLegalDocument(detail.id);
        notify('success', 'Document archived.');
        setSelectedId(null);
        loadDocuments();
      } else if (confirm.action === 'delete') {
        await superService.deleteLegalDocument(detail.id);
        notify('success', 'Document deleted.');
        setSelectedId(null);
        loadDocuments();
      }
      setConfirm(null);
    } catch (err) {
      notify('error', err.response?.data?.error || 'Operation failed.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handlePreview = (version) => {
    setPreviewDoc(version);
    setShowPreview(true);
  };

  const handleViewAcceptances = async () => {
    if (!detail) return;
    try {
      const res = await superService.listLegalAcceptances(detail.id);
      setAcceptances(res.acceptances || []);
      setShowAcceptances(true);
    } catch (err) {
      notify('error', err.response?.data?.error || 'Failed to load acceptances.');
    }
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text).then(() => notify('success', 'Link copied.'));
  };

  /* ─── Loading ─── */
  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  /* ─── Detail view ─── */
  if (selectedId) {
    if (detailLoading || !detail) {
      return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
    }

    const published = detail.versions.filter((v) => v.status === 'published');

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <LegalStyles />
        <button onClick={() => { setSelectedId(null); setEditingDraft(null); }} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          ← Back to all documents
        </button>

        {message && (
          <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {/* Header */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{detail.title}</h1>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[detail.status] || STATUS_BADGE.draft}`}>{detail.status}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">slug: {detail.slug} · {detail.category}</p>
              <button onClick={() => copy(publicUrl(detail.slug))} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                Copy public URL: {publicUrl(detail.slug)}
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handleArchive} disabled={saving || detail.status === 'archived'} className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed">
                Archive
              </button>
              <button onClick={handleDelete} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                Delete
              </button>
            </div>
          </div>

          {/* Meta form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <div>
              <label className="text-xs font-semibold text-gray-600">Title</label>
              <input className="input-field mt-1" value={detail.title} onChange={(e) => setDetail({ ...detail, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Category</label>
              <select className="input-field mt-1" value={detail.category} onChange={(e) => setDetail({ ...detail, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={detail.requires_acceptance} onChange={(e) => setDetail({ ...detail, requires_acceptance: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
                Require acceptance
              </label>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs font-semibold text-gray-600">Description</label>
            <textarea className="input-field mt-1" rows={2} value={detail.description || ''} onChange={(e) => setDetail({ ...detail, description: e.target.value })} />
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={handleUpdateMeta} disabled={saving} className="btn-primary px-5 py-2">{saving ? 'Saving...' : 'Save Metadata'}</button>
          </div>
        </div>

        {/* Published version */}
        {published.length > 0 && (
          <div className="card p-5">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Published Version</h2>
            {published.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-4 py-2.5 border-b border-gray-50 last:border-0 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-800">v{v.version} — {v.title}</p>
                  <p className="text-xs text-gray-500">Effective {v.effective_date || '—'} · Published {v.published_at ? new Date(v.published_at).toLocaleString() : '—'}</p>
                </div>
                <button onClick={() => handlePreview(v)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Preview</button>
              </div>
            ))}
          </div>
        )}

        {/* Draft versions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Drafts & Version History</h2>
            {detail.status !== 'archived' && (
              <button onClick={handleCreateVersion} disabled={saving} className="px-3.5 py-2 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
                + New Draft Version
              </button>
            )}
          </div>
          {detail.versions.length === 0 && <p className="text-sm text-gray-500">No versions yet.</p>}
          <div className="divide-y divide-gray-100">
            {detail.versions.map((v) => (
              <div key={v.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-800">v{v.version}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${v.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{v.status}</span>
                    {v.version === detail.current_version && v.status === 'published' && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">LIVE</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{v.title}</p>
                  <p className="text-xs text-gray-400">
                    Effective {v.effective_date || 'not set'} · {v.change_note || 'No change note'}
                    {v.created_at ? ` · Created ${new Date(v.created_at).toLocaleString()}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePreview(v)} className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Preview</button>
                  {v.status === 'draft' && (
                    <>
                      <button onClick={() => openEditDraft(v)} className="px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">Edit</button>
                      {detail.status !== 'archived' && (
                        <button onClick={() => handlePublish(v)} disabled={saving} className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">Publish</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <button onClick={handleViewAcceptances} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">View user acceptances →</button>
          </div>
        </div>

        {/* Draft editor */}
        {editingDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Editing draft v{editingDraft.version}</h2>
                <button onClick={() => setEditingDraft(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Title</label>
                  <input className="input-field mt-1" value={draftForm.title} onChange={(e) => setDraftForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Effective date</label>
                    <input type="date" className="input-field mt-1" value={draftForm.effectiveDate} onChange={(e) => setDraftForm((f) => ({ ...f, effectiveDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Change note</label>
                    <input className="input-field mt-1" value={draftForm.changeNote} onChange={(e) => setDraftForm((f) => ({ ...f, changeNote: e.target.value }))} placeholder="e.g. Updated refund timelines" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Content</label>
                  <div className="mt-1">
                    <RichTextEditor value={draftForm.body} onChange={(body) => setDraftForm((f) => ({ ...f, body }))} />
                  </div>
                </div>
<div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setEditingDraft(null)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSaveDraft} disabled={saving} className="btn-primary px-6 py-2.5">{saving ? 'Saving...' : 'Save Draft'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

      {showPreview && <PreviewModal doc={previewDoc} onClose={() => setShowPreview(false)} />}
      {showAcceptances && <AcceptancesModal acceptances={acceptances} onClose={() => setShowAcceptances(false)} />}

      <ConfirmModal
        open={!!confirm}
        title={confirm?.action === 'publish' ? 'Publish Version' : confirm?.action === 'archive' ? 'Archive Document' : 'Delete Document'}
        message={
          confirm?.action === 'publish'
            ? `Publish version ${confirm.version.version} of "${detail.title}"? It will become live for all apps.`
            : confirm?.action === 'archive'
              ? `Archive "${detail.title}"? It will no longer be served to apps.`
              : `Permanently delete "${detail.title}"? All ${detail.versions.length} version(s) and every user acceptance record will be removed. This cannot be undone.`
        }
        confirmLabel={confirm?.action === 'publish' ? 'Publish' : confirm?.action === 'archive' ? 'Archive' : 'Delete'}
        variant={confirm?.action === 'publish' ? 'warning' : 'danger'}
        loading={confirmLoading}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

  /* ─── List view ─── */
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <LegalStyles />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Legal Documents</h1>
          <p className="text-sm text-gray-500 mt-1">Manage policies served to the Bahi360 apps and public compliance URLs.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary px-5 py-2.5">+ New Document</button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-gray-500">No legal documents yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedId(doc.id)}
              className="card p-5 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-bold text-gray-900">{doc.title}</h3>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[doc.status] || STATUS_BADGE.draft}`}>{doc.status}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">/{doc.slug} · {doc.category}{doc.requires_acceptance ? ' · requires acceptance' : ''}</p>
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{doc.description || 'No description'}</p>
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                <span>{doc.version_count || 0} version{doc.version_count === 1 ? '' : 's'} · current v{doc.current_version || '—'}</span>
                <span>{doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : ''}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <DocumentForm
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
          saving={saving}
        />
      )}

      {/* Preview modal */}
      {showPreview && <PreviewModal doc={previewDoc} onClose={() => setShowPreview(false)} />}

      {/* Acceptances modal */}
      {showAcceptances && <AcceptancesModal acceptances={acceptances} onClose={() => setShowAcceptances(false)} />}
    </div>
  );
}