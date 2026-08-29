const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Legal Documents content management.
 *
 * Documents are versioned: admins create draft versions with rich-text HTML
 * bodies, publish them (setting an effective date), and archive obsolete
 * documents. Apps always read the latest published version. User acceptances
 * are recorded per (user, version) for compliance.
 */

const ALLOWED_CATEGORIES = ['privacy', 'terms', 'refund', 'subscription', 'other'];
const ALLOWED_DOC_STATUS = ['draft', 'published', 'archived'];
const ALLOWED_VERSION_STATUS = ['draft', 'published'];

function assertValidSlug(slug) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '')) {
    throw new Error('Slug must contain only lowercase letters, numbers and dashes.');
  }
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Fetch the latest published version of a document.
 */
async function getLatestPublishedVersion(documentId) {
  const [rows] = await db.execute(
    `SELECT * FROM hris_saas.legal_document_versions
      WHERE document_id = ? AND status = 'published'
      ORDER BY version DESC
      LIMIT 1`,
    [documentId]
  );
  return rows[0] || null;
}

async function getDocumentRow(id) {
  const [rows] = await db.execute(
    'SELECT * FROM hris_saas.legal_documents WHERE id = ?', [id]
  );
  return rows[0] || null;
}

async function getDocumentRowBySlug(slug) {
  const [rows] = await db.execute(
    'SELECT * FROM hris_saas.legal_documents WHERE slug = ?', [slug]
  );
  return rows[0] || null;
}

async function getVersionRow(versionId) {
  const [rows] = await db.execute(
    'SELECT * FROM hris_saas.legal_document_versions WHERE id = ?', [versionId]
  );
  return rows[0] || null;
}

async function hasAcceptedVersion(tenantId, userId, versionId) {
  const [rows] = await db.execute(
    `SELECT id FROM hris_saas.legal_document_acceptances
      WHERE tenant_id = ? AND user_id = ? AND document_version_id = ?`,
    [tenantId, userId, versionId]
  );
  return rows.length > 0;
}

// ─── Super admin: management ──────────────────────────────────

async function listAll() {
  const [docs] = await db.execute(
    `SELECT d.*,
            COUNT(v.id) FILTER (WHERE v.status = 'published') AS published_version_count,
            COUNT(v.id) AS version_count,
            (SELECT v.version FROM hris_saas.legal_document_versions v
              WHERE v.document_id = d.id AND v.status = 'published'
              ORDER BY v.version DESC LIMIT 1) AS current_version
       FROM hris_saas.legal_documents d
       LEFT JOIN hris_saas.legal_document_versions v ON v.document_id = d.id
      GROUP BY d.id
      ORDER BY d.updated_at DESC`
  );

  return { documents: docs };
}

async function getDocument(id) {
  const doc = await getDocumentRow(id);
  if (!doc) throw new Error('Document not found.');

  const [versions] = await db.execute(
    `SELECT v.*, d.title AS document_title
       FROM hris_saas.legal_document_versions v
       JOIN hris_saas.legal_documents d ON d.id = v.document_id
      WHERE v.document_id = ?
      ORDER BY v.version DESC`,
    [id]
  );

  return { document: { ...doc, versions } };
}

async function createDocument(data, actor = null) {
  const { title, slug, category, description, requires_acceptance, body, effectiveDate, changeNote } = data;
  if (!title || !slug) throw new Error('Title and slug are required.');
  if (!ALLOWED_CATEGORIES.includes(category || 'other')) throw new Error('Invalid category.');
  assertValidSlug(slug);

  const existing = await getDocumentRowBySlug(slug);
  if (existing) throw new Error('A document with this slug already exists.');

  const docId = uuidv4();
  await db.query('START TRANSACTION');
  try {
    await db.execute(
      `INSERT INTO hris_saas.legal_documents
         (id, slug, title, category, description, status, requires_acceptance, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
      [docId, slug, title, category || 'other', description || null, requires_acceptance !== false, actor, actor]
    );

    const versionId = uuidv4();
    await db.execute(
      `INSERT INTO hris_saas.legal_document_versions
         (id, document_id, version, title, body, effective_date, status, change_note, created_by)
       VALUES (?, ?, 1, ?, ?, ?, 'draft', ?, ?)`,
      [versionId, docId, title, body || '', effectiveDate || null, changeNote || 'Initial draft', actor]
    );

    await db.query('COMMIT');
    return { documentId: docId, versionId };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function updateDocument(id, data, actor = null) {
  const doc = await getDocumentRow(id);
  if (!doc) throw new Error('Document not found.');
  if (doc.status === 'archived') throw new Error('Archived documents cannot be edited.');

  const { title, description, category, requires_acceptance } = data;
  if (category && !ALLOWED_CATEGORIES.includes(category)) throw new Error('Invalid category.');

  await db.execute(
    `UPDATE hris_saas.legal_documents
        SET title = COALESCE(?, title),
            description = COALESCE(?, description),
            category = COALESCE(?, category),
            requires_acceptance = COALESCE(?, requires_acceptance),
            updated_by = ?,
            updated_at = NOW()
      WHERE id = ?`,
    [title || null, description || null, category || null,
     requires_acceptance === undefined ? null : !!requires_acceptance,
     actor, id]
  );

  return getDocumentRow(id);
}

async function createVersion(docId, data, actor = null) {
  const doc = await getDocumentRow(docId);
  if (!doc) throw new Error('Document not found.');
  if (doc.status === 'archived') throw new Error('Archived documents cannot be edited.');

  const { title, body, effectiveDate, changeNote } = data;

  const [maxRow] = await db.execute(
    'SELECT COALESCE(MAX(version), 0) AS m FROM hris_saas.legal_document_versions WHERE document_id = ?',
    [docId]
  );
  const version = Number(maxRow[0]?.m || 0) + 1;

  const versionId = uuidv4();
  await db.execute(
    `INSERT INTO hris_saas.legal_document_versions
       (id, document_id, version, title, body, effective_date, status, change_note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [versionId, docId, version, title || doc.title, body || '', effectiveDate || null, changeNote || null, actor]
  );

  return { documentId: docId, versionId, version };
}

async function updateDraftVersion(docId, versionId, data, actor = null) {
  const version = await getVersionRow(versionId);
  if (!version) throw new Error('Version not found.');
  if (version.document_id !== docId) throw new Error('Version does not belong to this document.');
  if (version.status === 'published') throw new Error('Published versions cannot be edited. Create a new version instead.');

  const { title, body, effectiveDate, changeNote } = data;

  await db.execute(
    `UPDATE hris_saas.legal_document_versions
        SET title = COALESCE(?, title),
            body = COALESCE(?, body),
            effective_date = COALESCE(?, effective_date),
            change_note = COALESCE(?, change_note),
            updated_at = NOW()
      WHERE id = ?`,
    [title || null, body || null, effectiveDate || null, changeNote || null, versionId]
  );

  return getVersionRow(versionId);
}

async function publishVersion(docId, versionId, actor = null) {
  const version = await getVersionRow(versionId);
  if (!version) throw new Error('Version not found.');
  if (version.document_id !== docId) throw new Error('Version does not belong to this document.');
  if (version.status === 'published') throw new Error('This version is already published.');

  const effectiveDate = version.effective_date || new Date().toISOString().slice(0, 10);

  await db.query('START TRANSACTION');
  try {
    await db.execute(
      `UPDATE hris_saas.legal_document_versions
          SET status = 'published', effective_date = ?, published_at = NOW(), published_by = ?
        WHERE id = ?`,
      [effectiveDate, actor, versionId]
    );

    await db.execute(
      `UPDATE hris_saas.legal_documents
          SET status = 'published', current_version_id = ?, updated_by = ?, updated_at = NOW()
        WHERE id = ?`,
      [versionId, actor, docId]
    );

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }

  return getDocumentRow(docId);
}

async function archiveDocument(id, actor = null) {
  const doc = await getDocumentRow(id);
  if (!doc) throw new Error('Document not found.');
  if (doc.status === 'archived') throw new Error('Document is already archived.');

  await db.execute(
    `UPDATE hris_saas.legal_documents SET status = 'archived', updated_by = ?, updated_at = NOW() WHERE id = ?`,
    [actor, id]
  );

  return getDocumentRow(id);
}

/**
 * Permanently delete a document. All of its versions and user acceptance
 * records are removed via ON DELETE CASCADE.
 */
async function deleteDocument(id) {
  const doc = await getDocumentRow(id);
  if (!doc) throw new Error('Document not found.');

  await db.execute('DELETE FROM hris_saas.legal_documents WHERE id = ?', [id]);
  return { deleted: true, id };
}

async function listAcceptances(docId, limit = 100) {
  const [rows] = await db.execute(
    `SELECT a.*, v.version, d.title AS document_title,
            e.first_name, e.last_name, e.phone, t.company_name
       FROM hris_saas.legal_document_acceptances a
       JOIN hris_saas.legal_document_versions v ON v.id = a.document_version_id
       JOIN hris_saas.legal_documents d ON d.id = a.document_id
       LEFT JOIN hris_saas.employees e ON e.id = a.user_id
       LEFT JOIN hris_saas.tenants t ON t.id = a.tenant_id
      WHERE a.document_id = ?
      ORDER BY a.accepted_at DESC
      LIMIT ?`,
    [docId, limit]
  );
  return { acceptances: rows };
}

// ─── Apps / tenants ───────────────────────────────────────────

async function listPublishedForTenant(tenantId, userId) {
  const [docs] = await db.execute(
    `SELECT d.id, d.slug, d.title, d.category, d.description, d.requires_acceptance
       FROM hris_saas.legal_documents d
      WHERE d.status = 'published'
      ORDER BY d.title`
  );

  const documents = [];
  for (const doc of docs) {
    const latest = await getLatestPublishedVersion(doc.id);
    if (!latest) continue;

    let requiresAcceptance = false;
    if (doc.requires_acceptance) {
      requiresAcceptance = !(await hasAcceptedVersion(tenantId, userId, latest.id));
    }

    documents.push({
      id: doc.id,
      slug: doc.slug,
      title: latest.title || doc.title,
      category: doc.category,
      description: doc.description,
      requiresAcceptance,
      version: latest.version,
      versionId: latest.id,
      effectiveDate: latest.effective_date,
      publishedAt: latest.published_at,
    });
  }

  return { documents };
}

async function getPublishedForTenant(slug, tenantId, userId) {
  const doc = await getDocumentRowBySlug(slug);
  if (!doc || doc.status !== 'published') throw new Error('Document not found.');

  const latest = await getLatestPublishedVersion(doc.id);
  if (!latest) throw new Error('Document not found.');

  let requiresAcceptance = false;
  if (doc.requires_acceptance) {
    requiresAcceptance = !(await hasAcceptedVersion(tenantId, userId, latest.id));
  }

  return {
    document: {
      id: doc.id,
      slug: doc.slug,
      category: doc.category,
      title: latest.title || doc.title,
      body: latest.body,
      version: latest.version,
      versionId: latest.id,
      effectiveDate: latest.effective_date,
      publishedAt: latest.published_at,
      requiresAcceptance,
    },
  };
}

async function recordAcceptance({ tenantId, userId, documentId, versionId, platform, deviceInfo, appVersion, ipAddress }) {
  const version = await getVersionRow(versionId);
  if (!version) throw new Error('Version not found.');
  if (version.document_id !== documentId) throw new Error('Version does not belong to this document.');
  if (version.status !== 'published') throw new Error('Only published versions can be accepted.');

  // Idempotent: re-accepting the same version is a no-op.
  const existing = await db.execute(
    `SELECT id FROM hris_saas.legal_document_acceptances
      WHERE tenant_id = ? AND user_id = ? AND document_version_id = ?`,
    [tenantId, userId, versionId]
  );
  if (existing[0].length > 0) {
    return { alreadyAccepted: true, documentId, versionId };
  }

  await db.execute(
    `INSERT INTO hris_saas.legal_document_acceptances
       (id, document_id, document_version_id, tenant_id, user_id, platform, device_info, app_version, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), documentId, versionId, tenantId, userId, platform || null, deviceInfo || null, appVersion || null, ipAddress || null]
  );

  return { accepted: true, documentId, versionId };
}

// ─── Public ───────────────────────────────────────────────────

/**
 * Record acceptance of the latest published version of each listed document
 * for a freshly created account (e.g. the signup consent checkbox). Missing or
 * unpublished documents are skipped; failures never block signup.
 */
async function acceptDocumentsForSignup(tenantId, userId, slugs) {
  if (!Array.isArray(slugs) || slugs.length === 0) return [];

  const accepted = [];
  for (const slug of slugs) {
    try {
      const doc = await getDocumentRowBySlug(slug);
      if (!doc || doc.status !== 'published' || !doc.requires_acceptance) continue;
      const latest = await getLatestPublishedVersion(doc.id);
      if (!latest) continue;
      await recordAcceptance({
        tenantId,
        userId,
        documentId: doc.id,
        versionId: latest.id,
        platform: 'signup',
        deviceInfo: 'account signup',
        appVersion: null,
        ipAddress: null,
      });
      accepted.push(slug);
    } catch (err) {
      // Best-effort: never fail registration because of an acceptance write.
    }
  }
  return accepted;
}

async function getLatestPublishedBySlug(slug) {
  const doc = await getDocumentRowBySlug(slug);
  if (!doc || doc.status !== 'published') return null;

  const latest = await getLatestPublishedVersion(doc.id);
  if (!latest) return null;

  return {
    slug: doc.slug,
    title: latest.title || doc.title,
    category: doc.category,
    body: latest.body,
    version: latest.version,
    effectiveDate: latest.effective_date,
    publishedAt: latest.published_at,
    updatedAt: latest.updated_at,
  };
}

module.exports = {
  listAll,
  getDocument,
  createDocument,
  updateDocument,
  createVersion,
  updateDraftVersion,
  publishVersion,
  archiveDocument,
  deleteDocument,
  listAcceptances,
  listPublishedForTenant,
  getPublishedForTenant,
  recordAcceptance,
  acceptDocumentsForSignup,
  getLatestPublishedBySlug,
  ALLOWED_CATEGORIES,
  ALLOWED_DOC_STATUS,
  ALLOWED_VERSION_STATUS,
};