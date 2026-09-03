const cms = require('../services/cms.service');

const actor = (req) => req.user?.name || req.user?.id;

// ─── Pages ─────────────────────────────────────────────────────

exports.listPages = async (req, res) => {
  try {
    res.json(await cms.listPages({ status: req.query.status }));
  } catch (error) {
    res.status(500).json({ error: 'Failed to list pages.' });
  }
};

exports.getPage = async (req, res) => {
  try {
    const page = await cms.getPage(req.params.id);
    if (!page) return res.status(404).json({ error: 'Page not found.' });
    res.json({ page });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch page.' });
  }
};

exports.createPage = async (req, res) => {
  try {
    const page = await cms.createPage(req.body, actor(req));
    res.status(201).json({ message: 'Page created.', page });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updatePage = async (req, res) => {
  try {
    const page = await cms.updatePage(req.params.id, req.body, actor(req));
    res.json({ message: 'Page updated.', page });
  } catch (error) {
    const status = error.message === 'Page not found.' ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

exports.deletePage = async (req, res) => {
  try {
    res.json(await cms.deletePage(req.params.id));
  } catch (error) {
    const status = error.message === 'Page not found.' ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

exports.setPageStatus = async (req, res) => {
  try {
    const page = await cms.setPageStatus(req.params.id, req.body.status, actor(req));
    res.json({ message: `Page ${req.body.status === 'published' ? 'published' : 'unpublished'}.`, page });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── Header menus ──────────────────────────────────────────────

exports.listHeaderMenus = async (req, res) => {
  try { res.json(await cms.listHeaderMenus()); }
  catch (error) { res.status(500).json({ error: 'Failed to list menus.' }); }
};

exports.createHeaderMenu = async (req, res) => {
  try { res.status(201).json(await cms.createHeaderMenu(req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.updateHeaderMenu = async (req, res) => {
  try { res.json(await cms.updateHeaderMenu(req.params.id, req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.deleteHeaderMenu = async (req, res) => {
  try { res.json(await cms.deleteHeaderMenu(req.params.id)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.reorderHeaderMenus = async (req, res) => {
  try { res.json(await cms.reorderHeaderMenus(req.body.orderedIds)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

// ─── Footer ────────────────────────────────────────────────────

exports.listFooter = async (req, res) => {
  try { res.json(await cms.listFooter()); }
  catch (error) { res.status(500).json({ error: 'Failed to list footer.' }); }
};

exports.createFooterCategory = async (req, res) => {
  try { res.status(201).json(await cms.createFooterCategory(req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.updateFooterCategory = async (req, res) => {
  try { res.json(await cms.updateFooterCategory(req.params.id, req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.deleteFooterCategory = async (req, res) => {
  try { res.json(await cms.deleteFooterCategory(req.params.id)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.reorderFooterCategories = async (req, res) => {
  try { res.json(await cms.reorderFooterCategories(req.body.orderedIds)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.createFooterLink = async (req, res) => {
  try { res.status(201).json(await cms.createFooterLink(req.params.categoryId, req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.updateFooterLink = async (req, res) => {
  try { res.json(await cms.updateFooterLink(req.params.id, req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.deleteFooterLink = async (req, res) => {
  try { res.json(await cms.deleteFooterLink(req.params.id)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.reorderFooterLinks = async (req, res) => {
  try { res.json(await cms.reorderFooterLinks(req.body.orderedIds)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

// ─── Social ────────────────────────────────────────────────────

exports.getSocialLinks = async (req, res) => {
  try { res.json(await cms.getSocialLinks()); }
  catch (error) { res.status(500).json({ error: 'Failed to fetch social links.' }); }
};

exports.updateSocialLink = async (req, res) => {
  try { res.json(await cms.updateSocialLink(req.params.platform, req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

// ─── Settings ──────────────────────────────────────────────────

exports.getSettings = async (req, res) => {
  try { res.json(await cms.getSettings()); }
  catch (error) { res.status(500).json({ error: 'Failed to fetch settings.' }); }
};

exports.updateSettings = async (req, res) => {
  try { res.json(await cms.updateSettings(req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

// ─── Public ────────────────────────────────────────────────────

exports.getPublicConfig = async (req, res) => {
  try { res.json(await cms.getPublicConfig()); }
  catch (error) {
    console.error('getPublicConfig error:', error);
    res.status(500).json({ error: 'Failed to fetch site configuration.' });
  }
};

exports.getPublicPage = async (req, res) => {
  try {
    const page = await cms.getPageBySlug(req.params.slug);
    if (!page || page.status !== 'published') {
      return res.status(404).json({ error: 'Page not found.' });
    }
    res.json({
      page: {
        slug: page.slug,
        title: page.title,
        seoTitle: page.seo_title,
        seoDescription: page.seo_description,
        content: page.content,
        featuredImage: page.featured_image,
        updatedAt: page.updated_at,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch page.' });
  }
};

exports.getPublicHelp = async (req, res) => {
  try { res.json(await cms.getPublicHelp()); }
  catch (error) {
    console.error('getPublicHelp error:', error);
    res.status(500).json({ error: 'Failed to fetch help content.' });
  }
};

// ─── Help content management (super admin) ────────────────────

exports.listHelpTopics = async (req, res) => {
  try { res.json(await cms.listHelpTopics()); }
  catch (error) { res.status(500).json({ error: 'Failed to list help topics.' }); }
};

exports.createHelpTopic = async (req, res) => {
  try { res.status(201).json(await cms.createHelpTopic(req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.updateHelpTopic = async (req, res) => {
  try { res.json(await cms.updateHelpTopic(req.params.id, req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.deleteHelpTopic = async (req, res) => {
  try { res.json(await cms.deleteHelpTopic(req.params.id)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.reorderHelpTopics = async (req, res) => {
  try { res.json(await cms.reorderHelpTopics(req.body.orderedIds)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.listHelpFaqs = async (req, res) => {
  try { res.json(await cms.listHelpFaqs()); }
  catch (error) { res.status(500).json({ error: 'Failed to list FAQs.' }); }
};

exports.createHelpFaq = async (req, res) => {
  try { res.status(201).json(await cms.createHelpFaq(req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.updateHelpFaq = async (req, res) => {
  try { res.json(await cms.updateHelpFaq(req.params.id, req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.deleteHelpFaq = async (req, res) => {
  try { res.json(await cms.deleteHelpFaq(req.params.id)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.reorderHelpFaqs = async (req, res) => {
  try { res.json(await cms.reorderHelpFaqs(req.body.orderedIds)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.getHelpSettings = async (req, res) => {
  try { res.json(await cms.getHelpSettings()); }
  catch (error) { res.status(500).json({ error: 'Failed to fetch help settings.' }); }
};

exports.updateHelpSettings = async (req, res) => {
  try { res.json(await cms.updateHelpSettings(req.body)); }
  catch (error) { res.status(400).json({ error: error.message }); }
};