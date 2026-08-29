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

const legalService = require('./legalDocument.service');

function mockDb({ docRows = [], versionRows = [], maxVersion = '0' } = {}) {
  mockPool.query.mockImplementation((text, values) => {
    if (text.includes('FROM hris_saas.legal_document_versions')) {
      if (text.includes('COALESCE(MAX(version)')) {
        return Promise.resolve({ rows: [{ m: maxVersion }] });
      }
      return Promise.resolve({ rows: versionRows });
    }
    if (text.includes('FROM hris_saas.legal_documents')) {
      return Promise.resolve({ rows: docRows });
    }
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('legalDocument.service — validation', () => {
  test('rejects an invalid slug', async () => {
    await expect(legalService.createDocument({ title: 'X', slug: 'Bad Slug!' }))
      .rejects.toThrow(/Slug must contain/);
  });

  test('rejects a duplicate slug', async () => {
    mockDb({ docRows: [{ id: 'existing', slug: 'privacy-policy' }] });
    await expect(legalService.createDocument({ title: 'X', slug: 'privacy-policy', category: 'privacy' }))
      .rejects.toThrow(/already exists/);
  });

  test('rejects an invalid category', async () => {
    mockDb({ docRows: [] });
    await expect(legalService.createDocument({ title: 'X', slug: 'foo-bar', category: 'nonsense' }))
      .rejects.toThrow(/Invalid category/);
  });
});

describe('legalDocument.service — publish/archive', () => {
  test('publishVersion rejects a missing version', async () => {
    mockDb({ versionRows: [] });
    await expect(legalService.publishVersion('doc-1', 'missing-version'))
      .rejects.toThrow(/Version not found/);
  });

  test('publishVersion rejects when version belongs to another document', async () => {
    mockDb({ versionRows: [{ id: 'v1', document_id: 'doc-2', status: 'draft' }] });
    await expect(legalService.publishVersion('doc-1', 'v1'))
      .rejects.toThrow(/does not belong/);
  });

  test('archiveDocument rejects a missing document', async () => {
    mockDb({ docRows: [] });
    await expect(legalService.archiveDocument('doc-1'))
      .rejects.toThrow(/Document not found/);
  });

  test('deleteDocument rejects a missing document', async () => {
    mockDb({ docRows: [] });
    await expect(legalService.deleteDocument('doc-1'))
      .rejects.toThrow(/Document not found/);
  });

  test('deleteDocument removes the document row', async () => {
    mockDb({ docRows: [{ id: 'doc-1', slug: 'privacy-policy', status: 'published' }] });
    const result = await legalService.deleteDocument('doc-1');
    expect(result).toEqual({ deleted: true, id: 'doc-1' });
  });
});

describe('legalDocument.service — public lookup', () => {
  test('returns null for a draft-only document', async () => {
    mockDb({ docRows: [{ id: 'd1', slug: 'privacy-policy', status: 'draft' }], versionRows: [] });
    const result = await legalService.getLatestPublishedBySlug('privacy-policy');
    expect(result).toBeNull();
  });

  test('returns the latest published version for a published document', async () => {
    mockDb({
      docRows: [{ id: 'd1', slug: 'privacy-policy', title: 'Privacy', category: 'privacy', status: 'published' }],
      versionRows: [{
        id: 'v2', document_id: 'd1', version: 2, title: 'Privacy v2', body: '<p>hi</p>',
        effective_date: '2026-08-28', published_at: '2026-08-28T10:00:00Z', updated_at: '2026-08-28T10:00:00Z', status: 'published',
      }],
    });
    const result = await legalService.getLatestPublishedBySlug('privacy-policy');
    expect(result.version).toBe(2);
    expect(result.title).toBe('Privacy v2');
    expect(result.effectiveDate).toBe('2026-08-28');
  });
});

describe('legalDocument.service — version numbering', () => {
  test('createVersion increments the version number', async () => {
    mockDb({
      docRows: [{ id: 'd1', title: 'Privacy', status: 'published' }],
      versionRows: [],
      maxVersion: '3',
    });
    const result = await legalService.createVersion('d1', { title: 'Privacy v4', body: '<p>x</p>' });
    expect(result.version).toBe(4);
  });
});