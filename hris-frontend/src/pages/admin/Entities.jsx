import { useState, useEffect } from 'react';
import { hrService } from '../../services/hr.service';
import ConfirmModal from '../../components/ConfirmModal';

const PLAN_RANK = { FREE: 0, MANAGE: 1, BUSINESS: 2, BUSINESS_PRO: 3 };

export default function Entities() {
  const groupLabels = JSON.parse(localStorage.getItem('group_labels') || '{}');
  const tenantData = JSON.parse(localStorage.getItem('tenant_data') || '{}');
  const planRank = PLAN_RANK[tenantData.subscriptionPlan] ?? 0;
  const isLowPlan = planRank <= 1;
  const entityLabel = groupLabels['Entities'] || (isLowPlan ? 'My Stores' : 'Entities');
  const entitySingular = isLowPlan ? 'Store' : 'Entity';
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ companyName: '', branchName: '', gstin: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [modal, setModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchEntities = async () => {
    try {
      const data = await hrService.getEntities();
      setEntities(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntities(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      if (editing) {
        await hrService.updateEntity(editing, form);
        setMessage({ type: 'success', text: `${entitySingular} updated successfully.` });
      } else {
        await hrService.createEntity(form);
        setMessage({ type: 'success', text: `${entitySingular} created successfully.` });
      }
      setShowForm(false);
      setEditing(null);
      setForm({ companyName: '', branchName: '', gstin: '' });
      fetchEntities();
    } catch (e) {
      const data = e.response?.data;
      setMessage({ type: 'error', text: data?.message || data?.error || `Failed to save ${entitySingular.toLowerCase()}.` });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (entity) => {
    setEditing(entity.id);
    setForm({
      companyName: entity.company_name || entity.companyName || '',
      branchName: entity.branch_name || entity.branchName || '',
      gstin: entity.settings?.sellerGstin || '',
    });
    setShowForm(true);
    setMessage(null);
  };

  const handleDelete = (id, name) => {
    setModal({
      variant: 'danger',
      title: `Delete ${entitySingular}`,
      message: `Permanently delete "${name}"? This will deactivate the ${entitySingular.toLowerCase()} and all its data.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setModalLoading(true);
        try {
          await hrService.deleteEntity(id);
          setModal(null);
          setMessage({ type: 'success', text: `${entitySingular} deleted.` });
          fetchEntities();
        } catch (e) {
          setMessage({ type: 'error', text: e.response?.data?.error || `Failed to delete ${entitySingular.toLowerCase()}.` });
          setModal(null);
        } finally { setModalLoading(false); }
      },
    });
  };

  const handleSwitch = async (id) => {
    try {
      setMessage(null);
      const res = await hrService.switchEntity(id);
      localStorage.setItem('auth_token', res.token);
      localStorage.setItem('tenant_id', res.tenant.id);
      localStorage.setItem('tenant_data', JSON.stringify({
        id: res.tenant.id,
        name: res.tenant.companyName,
        branchName: res.tenant.branchName,
        subscriptionPlan: res.tenant.subscriptionPlan,
        settings: {},
      }));
      window.location.reload();
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Switch failed.' });
    }
  };

  const currentTenantId = localStorage.getItem('tenant_id');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{entityLabel}</h2>
          <p className="text-sm text-gray-500 mt-1">Manage multi-company / multi-branch setup</p>
        </div>
        {!showForm && (
          <button onClick={() => { setEditing(null); setForm({ companyName: '', branchName: '', gstin: '' }); setShowForm(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            + Add {entitySingular}
          </button>
        )}
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">{editing ? `Edit ${entitySingular}` : `New ${entitySingular}`}</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input type="text" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
                <input type="text" value={form.branchName} onChange={e => setForm(f => ({ ...f, branchName: e.target.value }))}
                  placeholder="e.g. Mumbai Office" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                <input type="text" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))}
                  placeholder="e.g. 27AAACP1234A1Z5" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {submitting ? 'Saving...' : editing ? `Update ${entitySingular}` : `Create ${entitySingular}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Entity list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : entities.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No {entitySingular.toLowerCase()} yet. Add your first {entitySingular.toLowerCase()}.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Branch</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((entity, idx) => {
                const isActive = entity.id === currentTenantId;
                return (
                  <tr key={entity.id} className={`border-t border-gray-100 ${isActive ? 'bg-indigo-50/40' : ''} ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{entity.company_name || entity.companyName}</td>
                    <td className="px-4 py-3 text-gray-600">{entity.branch_name || entity.branchName || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${entity.entity_type === 'primary' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {entity.entity_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entity.subscription_plan}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isActive && (
                          <button onClick={() => handleSwitch(entity.id)} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">Switch</button>
                        )}
                        {isActive && <span className="text-xs text-green-600 font-medium mr-2">Current</span>}
                        {entity.entity_type !== 'primary' && (
                          <>
                            <button onClick={() => openEdit(entity)} className="btn-secondary !py-1 !px-3 text-xs">Edit</button>
                            <button onClick={() => handleDelete(entity.id, entity.company_name || entity.companyName)} className="btn-danger !py-1 !px-3 text-xs">Delete</button>
                          </>
                        )}
                        {entity.entity_type === 'primary' && (
                          <button onClick={() => openEdit(entity)} className="btn-secondary !py-1 !px-3 text-xs">Edit</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!modal}
        title={modal?.title}
        message={modal?.message}
        confirmLabel={modal?.confirmLabel}
        variant={modal?.variant}
        loading={modalLoading}
        onConfirm={modal?.onConfirm || (() => {})}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}