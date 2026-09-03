const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * CMS — dynamic management of website static pages, header menus, footer
 * menus/categories, social media links, and footer settings.
 */

function assertValidSlug(slug) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '')) {
    throw new Error('Slug must contain only lowercase letters, numbers and dashes.');
  }
}

// ─── Pages ─────────────────────────────────────────────────────

async function listPages({ status } = {}) {
  const params = [];
  let where = '';
  if (status && status !== 'all') {
    where = 'WHERE status = ?';
    params.push(status);
  }
  const [rows] = await db.execute(
    `SELECT id, slug, title, seo_title, seo_description, status, featured_image, updated_at, created_at
       FROM hris_saas.cms_pages ${where}
      ORDER BY created_at`,
    params
  );
  return { pages: rows };
}

async function getPage(id) {
  const [rows] = await db.execute('SELECT * FROM hris_saas.cms_pages WHERE id = ?', [id]);
  return rows[0] || null;
}

async function getPageBySlug(slug) {
  const [rows] = await db.execute('SELECT * FROM hris_saas.cms_pages WHERE slug = ?', [slug]);
  return rows[0] || null;
}

async function createPage(data, actor = null) {
  const { slug, title, seoTitle, seoDescription, content, featuredImage, status } = data;
  if (!slug || !title) throw new Error('Title and slug are required.');
  assertValidSlug(slug);

  const existing = await getPageBySlug(slug);
  if (existing) throw new Error('A page with this slug already exists.');

  const id = uuidv4();
  await db.execute(
    `INSERT INTO hris_saas.cms_pages
       (id, slug, title, seo_title, seo_description, content, featured_image, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, slug, title, seoTitle || null, seoDescription || null, content || '',
     featuredImage || null, status === 'published' ? 'published' : 'draft', actor, actor]
  );

  return getPage(id);
}

async function updatePage(id, data, actor = null) {
  const page = await getPage(id);
  if (!page) throw new Error('Page not found.');

  const { slug, title, seoTitle, seoDescription, content, featuredImage, status } = data;

  if (slug && slug !== page.slug) {
    assertValidSlug(slug);
    const conflict = await getPageBySlug(slug);
    if (conflict && conflict.id !== id) throw new Error('A page with this slug already exists.');
  }

  await db.execute(
    `UPDATE hris_saas.cms_pages
        SET slug = COALESCE(?, slug),
            title = COALESCE(?, title),
            seo_title = COALESCE(?, seo_title),
            seo_description = COALESCE(?, seo_description),
            content = COALESCE(?, content),
            featured_image = COALESCE(?, featured_image),
            status = COALESCE(?, status),
            updated_by = ?,
            updated_at = NOW()
      WHERE id = ?`,
    [slug || null, title || null, seoTitle || null, seoDescription || null,
     content || null, featuredImage || null, status || null, actor, id]
  );

  return getPage(id);
}

async function deletePage(id) {
  const page = await getPage(id);
  if (!page) throw new Error('Page not found.');
  await db.execute('DELETE FROM hris_saas.cms_pages WHERE id = ?', [id]);
  return { deleted: true, id };
}

async function setPageStatus(id, status, actor = null) {
  if (!['draft', 'published'].includes(status)) throw new Error('Invalid status.');
  const page = await getPage(id);
  if (!page) throw new Error('Page not found.');
  await db.execute(
    `UPDATE hris_saas.cms_pages SET status = ?, updated_by = ?, updated_at = NOW() WHERE id = ?`,
    [status, actor, id]
  );
  return getPage(id);
}

// ─── Header menus ──────────────────────────────────────────────

async function listHeaderMenus() {
  const [rows] = await db.execute(
    'SELECT * FROM hris_saas.cms_header_menus ORDER BY sort_order, created_at'
  );
  return { menus: rows };
}

async function createHeaderMenu(data) {
  const { label, linkType, pageSlug, externalUrl } = data;
  if (!label) throw new Error('Label is required.');
  const id = uuidv4();
  const [maxRow] = await db.execute(
    'SELECT COALESCE(MAX(sort_order), 0) AS m FROM hris_saas.cms_header_menus'
  );
  await db.execute(
    `INSERT INTO hris_saas.cms_header_menus (id, label, link_type, page_slug, external_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, label, linkType === 'external' ? 'external' : 'page', pageSlug || null, externalUrl || null, Number(maxRow[0]?.m || 0) + 1]
  );
  return { id };
}

async function updateHeaderMenu(id, data) {
  const { label, linkType, pageSlug, externalUrl, isVisible } = data;
  const [rows] = await db.execute('SELECT id FROM hris_saas.cms_header_menus WHERE id = ?', [id]);
  if (rows.length === 0) throw new Error('Menu item not found.');

  await db.execute(
    `UPDATE hris_saas.cms_header_menus
        SET label = COALESCE(?, label),
            link_type = COALESCE(?, link_type),
            page_slug = COALESCE(?, page_slug),
            external_url = COALESCE(?, external_url),
            is_visible = COALESCE(?, is_visible),
            updated_at = NOW()
      WHERE id = ?`,
    [label || null, linkType || null, pageSlug || null, externalUrl || null,
     isVisible === undefined ? null : !!isVisible, id]
  );
  return { updated: true };
}

async function deleteHeaderMenu(id) {
  await db.execute('DELETE FROM hris_saas.cms_header_menus WHERE id = ?', [id]);
  return { deleted: true };
}

async function reorderHeaderMenus(orderedIds) {
  if (!Array.isArray(orderedIds)) throw new Error('orderedIds array required.');
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute(
      'UPDATE hris_saas.cms_header_menus SET sort_order = ? WHERE id = ?',
      [i + 1, orderedIds[i]]
    );
  }
  return { reordered: true };
}

// ─── Footer categories & links ─────────────────────────────────

async function listFooter() {
  const [cats] = await db.execute(
    'SELECT * FROM hris_saas.cms_footer_categories ORDER BY sort_order, created_at'
  );
  const [links] = await db.execute(
    'SELECT * FROM hris_saas.cms_footer_links ORDER BY sort_order, created_at'
  );
  const categories = cats.map((c) => ({
    ...c,
    links: links.filter((l) => l.category_id === c.id),
  }));
  return { categories };
}

async function createFooterCategory(data) {
  const { title } = data;
  if (!title) throw new Error('Category title is required.');
  const id = uuidv4();
  const [maxRow] = await db.execute(
    'SELECT COALESCE(MAX(sort_order), 0) AS m FROM hris_saas.cms_footer_categories'
  );
  await db.execute(
    `INSERT INTO hris_saas.cms_footer_categories (id, title, sort_order) VALUES (?, ?, ?)`,
    [id, title, Number(maxRow[0]?.m || 0) + 1]
  );
  return { id };
}

async function updateFooterCategory(id, data) {
  const { title, isVisible } = data;
  const [rows] = await db.execute('SELECT id FROM hris_saas.cms_footer_categories WHERE id = ?', [id]);
  if (rows.length === 0) throw new Error('Category not found.');
  await db.execute(
    `UPDATE hris_saas.cms_footer_categories
        SET title = COALESCE(?, title), is_visible = COALESCE(?, is_visible), updated_at = NOW()
      WHERE id = ?`,
    [title || null, isVisible === undefined ? null : !!isVisible, id]
  );
  return { updated: true };
}

async function deleteFooterCategory(id) {
  await db.execute('DELETE FROM hris_saas.cms_footer_categories WHERE id = ?', [id]);
  return { deleted: true };
}

async function reorderFooterCategories(orderedIds) {
  if (!Array.isArray(orderedIds)) throw new Error('orderedIds array required.');
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute(
      'UPDATE hris_saas.cms_footer_categories SET sort_order = ? WHERE id = ?',
      [i + 1, orderedIds[i]]
    );
  }
  return { reordered: true };
}

async function createFooterLink(categoryId, data) {
  const { label, linkType, pageSlug, externalUrl } = data;
  if (!label) throw new Error('Link label is required.');
  const id = uuidv4();
  const [maxRow] = await db.execute(
    'SELECT COALESCE(MAX(sort_order), 0) AS m FROM hris_saas.cms_footer_links WHERE category_id = ?',
    [categoryId]
  );
  await db.execute(
    `INSERT INTO hris_saas.cms_footer_links (id, category_id, label, link_type, page_slug, external_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, categoryId, label, linkType === 'external' ? 'external' : 'page', pageSlug || null,
     externalUrl || null, Number(maxRow[0]?.m || 0) + 1]
  );
  return { id };
}

async function updateFooterLink(id, data) {
  const { label, linkType, pageSlug, externalUrl, isVisible } = data;
  const [rows] = await db.execute('SELECT id FROM hris_saas.cms_footer_links WHERE id = ?', [id]);
  if (rows.length === 0) throw new Error('Link not found.');
  await db.execute(
    `UPDATE hris_saas.cms_footer_links
        SET label = COALESCE(?, label),
            link_type = COALESCE(?, link_type),
            page_slug = COALESCE(?, page_slug),
            external_url = COALESCE(?, external_url),
            is_visible = COALESCE(?, is_visible),
            updated_at = NOW()
      WHERE id = ?`,
    [label || null, linkType || null, pageSlug || null, externalUrl || null,
     isVisible === undefined ? null : !!isVisible, id]
  );
  return { updated: true };
}

async function deleteFooterLink(id) {
  await db.execute('DELETE FROM hris_saas.cms_footer_links WHERE id = ?', [id]);
  return { deleted: true };
}

async function reorderFooterLinks(orderedIds) {
  if (!Array.isArray(orderedIds)) throw new Error('orderedIds array required.');
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute(
      'UPDATE hris_saas.cms_footer_links SET sort_order = ? WHERE id = ?',
      [i + 1, orderedIds[i]]
    );
  }
  return { reordered: true };
}

// ─── Social links ──────────────────────────────────────────────

async function getSocialLinks() {
  const [rows] = await db.execute(
    'SELECT platform, url, is_visible FROM hris_saas.cms_social_links ORDER BY platform'
  );
  return { social: rows };
}

async function updateSocialLink(platform, data) {
  const { url, isVisible } = data;
  if (!['linkedin', 'x', 'instagram'].includes(platform)) throw new Error('Invalid platform.');
  await db.execute(
    `INSERT INTO hris_saas.cms_social_links (platform, url, is_visible)
     VALUES (?, ?, ?)
     ON CONFLICT (platform) DO UPDATE
       SET url = EXCLUDED.url, is_visible = EXCLUDED.is_visible, updated_at = NOW()`,
    [platform, url || '', isVisible === undefined ? true : !!isVisible]
  );
  return { updated: true };
}

// ─── Footer settings ───────────────────────────────────────────

async function getSettings() {
  const [rows] = await db.execute(
    `SELECT footer_copyright, logo_url, footer_description, support_email, whatsapp_number, updated_at
       FROM hris_saas.cms_settings WHERE id = 1`
  );
  return { settings: rows[0] || { footer_copyright: null } };
}

async function updateSettings(data) {
  const { footerCopyright, logoUrl, footerDescription, supportEmail, whatsappNumber } = data;
  await db.execute(
    `INSERT INTO hris_saas.cms_settings (id, footer_copyright, logo_url, footer_description, support_email, whatsapp_number)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE
       SET footer_copyright = COALESCE(EXCLUDED.footer_copyright, cms_settings.footer_copyright),
           logo_url = COALESCE(EXCLUDED.logo_url, cms_settings.logo_url),
           footer_description = COALESCE(EXCLUDED.footer_description, cms_settings.footer_description),
           support_email = COALESCE(EXCLUDED.support_email, cms_settings.support_email),
           whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, cms_settings.whatsapp_number),
           updated_at = NOW()`,
    [footerCopyright || '', logoUrl || '', footerDescription || '', supportEmail || '', whatsappNumber || '']
  );
  return getSettings();
}

// ─── Public config for the website ─────────────────────────────

async function getPublicConfig() {
  const [header] = await db.execute(
    `SELECT label, link_type, page_slug, external_url
       FROM hris_saas.cms_header_menus
      WHERE is_visible = true
      ORDER BY sort_order, created_at`
  );

  const [categories] = await db.execute(
    `SELECT id, title
       FROM hris_saas.cms_footer_categories
      WHERE is_visible = true
      ORDER BY sort_order, created_at`
  );

  const [links] = await db.execute(
    `SELECT category_id, label, link_type, page_slug, external_url
       FROM hris_saas.cms_footer_links
      WHERE is_visible = true
      ORDER BY sort_order, created_at`
  );

  const footer = categories.map((c) => ({
    id: c.id,
    title: c.title,
    links: links.filter((l) => l.category_id === c.id).map(({ category_id, ...rest }) => rest),
  }));

  const [socialRows] = await db.execute(
    `SELECT platform, url FROM hris_saas.cms_social_links WHERE is_visible = true AND url IS NOT NULL AND url <> '' ORDER BY platform`
  );

  const [settings] = await db.execute(
    `SELECT footer_copyright, logo_url, footer_description, support_email, whatsapp_number
       FROM hris_saas.cms_settings WHERE id = 1`
  );

  const s = settings[0] || {};
  return {
    header,
    footer,
    social: socialRows,
    settings: {
      footerCopyright: s.footer_copyright || '',
      logoUrl: s.logo_url || '/logo.png',
      footerDescription: s.footer_description || '',
      supportEmail: s.support_email || 'support@bahi360.com',
      whatsappNumber: s.whatsapp_number || '',
    },
  };
}

// ─── Public help & support content ─────────────────────────────

async function getPublicHelp() {
  const [topics] = await db.execute(
    `SELECT key, label, subtitle, content, icon
       FROM hris_saas.cms_help_topics
      WHERE is_visible = true
      ORDER BY sort_order`
  );

  const [faqs] = await db.execute(
    `SELECT question, answer
       FROM hris_saas.cms_help_faqs
      WHERE is_visible = true
      ORDER BY sort_order`
  );

  const [settings] = await db.execute(
    `SELECT hero_title, hero_subtitle, tutorials_title, tutorials_subtitle,
            contact_whatsapp, contact_phone, contact_email
       FROM hris_saas.cms_help_settings WHERE id = 1`
  );
  const s = settings[0] || {};

  return {
    hero: {
      title: s.hero_title || 'How can we help?',
      subtitle: s.hero_subtitle || 'Find answers or contact our support team.',
    },
    topics,
    faqs,
    contact: {
      whatsapp: s.contact_whatsapp || '',
      phone: s.contact_phone || '',
      email: s.contact_email || 'support@bahi360.com',
    },
    tutorials: {
      title: s.tutorials_title || 'Learn Bahi360',
      subtitle: s.tutorials_subtitle || 'Watch tutorials and learn how to manage your business faster.',
    },
  };
}

// ─── Help content management (super admin) ────────────────────

async function listHelpTopics() {
  const [rows] = await db.execute(
    'SELECT * FROM hris_saas.cms_help_topics ORDER BY sort_order'
  );
  return { topics: rows };
}

async function createHelpTopic(data) {
  const { key, label, subtitle, content, icon } = data;
  if (!key || !label) throw new Error('Key and label are required.');
  const [maxRow] = await db.execute(
    'SELECT COALESCE(MAX(sort_order), 0) AS m FROM hris_saas.cms_help_topics'
  );
  const id = uuidv4();
  await db.execute(
    `INSERT INTO hris_saas.cms_help_topics (id, key, label, subtitle, content, icon, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, key, label, subtitle || null, content || '', icon || '📘', Number(maxRow[0]?.m || 0) + 1]
  );
  return { id };
}

async function updateHelpTopic(id, data) {
  const { label, subtitle, content, icon, isVisible } = data;
  const [rows] = await db.execute('SELECT id FROM hris_saas.cms_help_topics WHERE id = ?', [id]);
  if (rows.length === 0) throw new Error('Help topic not found.');
  await db.execute(
    `UPDATE hris_saas.cms_help_topics
        SET label = COALESCE(?, label), subtitle = COALESCE(?, subtitle),
            content = COALESCE(?, content), icon = COALESCE(?, icon),
            is_visible = COALESCE(?, is_visible), updated_at = NOW()
      WHERE id = ?`,
    [label || null, subtitle || null, content || null, icon || null,
     isVisible === undefined ? null : !!isVisible, id]
  );
  return { updated: true };
}

async function deleteHelpTopic(id) {
  await db.execute('DELETE FROM hris_saas.cms_help_topics WHERE id = ?', [id]);
  return { deleted: true };
}

async function reorderHelpTopics(orderedIds) {
  if (!Array.isArray(orderedIds)) throw new Error('orderedIds array required.');
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute('UPDATE hris_saas.cms_help_topics SET sort_order = ? WHERE id = ?', [i + 1, orderedIds[i]]);
  }
  return { reordered: true };
}

async function listHelpFaqs() {
  const [rows] = await db.execute(
    'SELECT * FROM hris_saas.cms_help_faqs ORDER BY sort_order'
  );
  return { faqs: rows };
}

async function createHelpFaq(data) {
  const { question, answer } = data;
  if (!question || !answer) throw new Error('Question and answer are required.');
  const [maxRow] = await db.execute(
    'SELECT COALESCE(MAX(sort_order), 0) AS m FROM hris_saas.cms_help_faqs'
  );
  const id = uuidv4();
  await db.execute(
    `INSERT INTO hris_saas.cms_help_faqs (id, question, answer, sort_order) VALUES (?, ?, ?, ?)`,
    [id, question, answer, Number(maxRow[0]?.m || 0) + 1]
  );
  return { id };
}

async function updateHelpFaq(id, data) {
  const { question, answer, isVisible } = data;
  const [rows] = await db.execute('SELECT id FROM hris_saas.cms_help_faqs WHERE id = ?', [id]);
  if (rows.length === 0) throw new Error('FAQ not found.');
  await db.execute(
    `UPDATE hris_saas.cms_help_faqs
        SET question = COALESCE(?, question), answer = COALESCE(?, answer),
            is_visible = COALESCE(?, is_visible), updated_at = NOW()
      WHERE id = ?`,
    [question || null, answer || null, isVisible === undefined ? null : !!isVisible, id]
  );
  return { updated: true };
}

async function deleteHelpFaq(id) {
  await db.execute('DELETE FROM hris_saas.cms_help_faqs WHERE id = ?', [id]);
  return { deleted: true };
}

async function reorderHelpFaqs(orderedIds) {
  if (!Array.isArray(orderedIds)) throw new Error('orderedIds array required.');
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute('UPDATE hris_saas.cms_help_faqs SET sort_order = ? WHERE id = ?', [i + 1, orderedIds[i]]);
  }
  return { reordered: true };
}

async function getHelpSettings() {
  const [rows] = await db.execute('SELECT * FROM hris_saas.cms_help_settings WHERE id = 1');
  return { settings: rows[0] || {} };
}

async function updateHelpSettings(data) {
  const { heroTitle, heroSubtitle, tutorialsTitle, tutorialsSubtitle, contactWhatsapp, contactPhone, contactEmail } = data;
  await db.execute(
    `INSERT INTO hris_saas.cms_help_settings
       (id, hero_title, hero_subtitle, tutorials_title, tutorials_subtitle, contact_whatsapp, contact_phone, contact_email)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE
       SET hero_title = COALESCE(EXCLUDED.hero_title, cms_help_settings.hero_title),
           hero_subtitle = COALESCE(EXCLUDED.hero_subtitle, cms_help_settings.hero_subtitle),
           tutorials_title = COALESCE(EXCLUDED.tutorials_title, cms_help_settings.tutorials_title),
           tutorials_subtitle = COALESCE(EXCLUDED.tutorials_subtitle, cms_help_settings.tutorials_subtitle),
           contact_whatsapp = COALESCE(EXCLUDED.contact_whatsapp, cms_help_settings.contact_whatsapp),
           contact_phone = COALESCE(EXCLUDED.contact_phone, cms_help_settings.contact_phone),
           contact_email = COALESCE(EXCLUDED.contact_email, cms_help_settings.contact_email),
           updated_at = NOW()`,
    [heroTitle || '', heroSubtitle || '', tutorialsTitle || '', tutorialsSubtitle || '',
     contactWhatsapp || '', contactPhone || '', contactEmail || '']
  );
  return getHelpSettings();
}

module.exports = {
  listPages,
  getPage,
  getPageBySlug,
  createPage,
  updatePage,
  deletePage,
  setPageStatus,
  listHeaderMenus,
  createHeaderMenu,
  updateHeaderMenu,
  deleteHeaderMenu,
  reorderHeaderMenus,
  listFooter,
  createFooterCategory,
  updateFooterCategory,
  deleteFooterCategory,
  reorderFooterCategories,
  createFooterLink,
  updateFooterLink,
  deleteFooterLink,
  reorderFooterLinks,
  getSocialLinks,
  updateSocialLink,
  getSettings,
  updateSettings,
  getPublicConfig,
  getPublicHelp,
  listHelpTopics,
  createHelpTopic,
  updateHelpTopic,
  deleteHelpTopic,
  reorderHelpTopics,
  listHelpFaqs,
  createHelpFaq,
  updateHelpFaq,
  deleteHelpFaq,
  reorderHelpFaqs,
  getHelpSettings,
  updateHelpSettings,
};