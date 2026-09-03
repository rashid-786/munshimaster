const mockPool = {
  query: jest.fn().mockResolvedValue({ rows: [] }),
  on: jest.fn(),
};

jest.mock('pg', () => {
  const Pool = jest.fn(() => mockPool);
  return { Pool };
});

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

const cms = require('./cms.service');

function mockDb({ pageRows = [], headerRows = [], catRows = [], linkRows = [], socialRows = [], settingsRows = [] } = {}) {
  mockPool.query.mockImplementation((text) => {
    if (text.includes('FROM hris_saas.cms_pages')) return Promise.resolve({ rows: pageRows });
    if (text.includes('FROM hris_saas.cms_header_menus')) return Promise.resolve({ rows: headerRows });
    if (text.includes('FROM hris_saas.cms_footer_categories')) return Promise.resolve({ rows: catRows });
    if (text.includes('FROM hris_saas.cms_footer_links')) return Promise.resolve({ rows: linkRows });
    if (text.includes('FROM hris_saas.cms_social_links')) {
      const rows = socialRows.filter((r) => r.url && r.url !== '' && r.is_visible !== false);
      return Promise.resolve({ rows });
    }
    if (text.includes('FROM hris_saas.cms_settings')) return Promise.resolve({ rows: settingsRows });
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('cms.service — pages', () => {
  test('rejects an invalid slug', async () => {
    await expect(cms.createPage({ title: 'X', slug: 'Bad Slug!' })).rejects.toThrow(/Slug must contain/);
  });

  test('rejects a duplicate slug', async () => {
    mockDb({ pageRows: [{ id: 'p1', slug: 'pricing' }] });
    await expect(cms.createPage({ title: 'X', slug: 'pricing' })).rejects.toThrow(/already exists/);
  });

  test('deletePage rejects a missing page', async () => {
    mockDb({ pageRows: [] });
    await expect(cms.deletePage('nope')).rejects.toThrow(/not found/);
  });

  test('getPageBySlug returns null for a missing page', async () => {
    mockDb({ pageRows: [] });
    await expect(cms.getPageBySlug('missing')).resolves.toBeNull();
  });
});

describe('cms.service — public config', () => {
  test('builds header, footer, social and settings', async () => {
    mockDb({
      headerRows: [{ label: 'Home', link_type: 'page', page_slug: 'home', external_url: null }],
      catRows: [{ id: 'c1', title: 'Product' }],
      linkRows: [{ category_id: 'c1', label: 'BahiKhata', link_type: 'page', page_slug: 'services', external_url: null }],
      socialRows: [{ platform: 'linkedin', url: 'https://linkedin.com/x' }],
      settingsRows: [{ footer_copyright: '© 2026 Bahi360.' }],
    });
    const cfg = await cms.getPublicConfig();
    expect(cfg.header).toHaveLength(1);
    expect(cfg.header[0].label).toBe('Home');
    expect(cfg.footer[0].links).toHaveLength(1);
    expect(cfg.social[0].url).toContain('linkedin');
    expect(cfg.settings.footerCopyright).toBe('© 2026 Bahi360.');
  });

  test('drops empty social links', async () => {
    mockDb({ socialRows: [{ platform: 'x', url: '' }] });
    const cfg = await cms.getPublicConfig();
    expect(cfg.social).toEqual([]);
  });
});