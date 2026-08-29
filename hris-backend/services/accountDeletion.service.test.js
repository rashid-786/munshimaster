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

const deletionService = require('./accountDeletion.service');

function mockDb({ requestRows = [] } = {}) {
  mockPool.query.mockImplementation((text) => {
    if (text.includes('FROM hris_saas.tenant_deletion_requests')) {
      return Promise.resolve({ rows: requestRows });
    }
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('accountDeletion.service — request', () => {
  test('rejects when a pending request already exists', async () => {
    mockDb({ requestRows: [{ id: 'r1', tenant_id: 't1', status: 'pending' }] });
    const promise = deletionService.requestDeletion({ tenantId: 't1', userId: 'u1', reason: 'test' });
    await expect(promise).rejects.toMatchObject({ code: 'DELETION_REQUEST_PENDING' });
  });

  test('creates a request when none is pending', async () => {
    mockDb({ requestRows: [] });
    const result = await deletionService.requestDeletion({ tenantId: 't1', userId: 'u1', reason: 'test' });
    expect(result).toEqual({ requestId: 'test-uuid', status: 'pending' });
  });
});

describe('accountDeletion.service — cancel', () => {
  test('rejects when there is no pending request', async () => {
    mockDb({ requestRows: [] });
    await expect(deletionService.cancelRequest('t1', 'u1')).rejects.toMatchObject({ code: 'NO_PENDING_REQUEST' });
  });

  test('cancels an existing pending request', async () => {
    mockDb({ requestRows: [{ id: 'r1', tenant_id: 't1', status: 'pending' }] });
    await expect(deletionService.cancelRequest('t1', 'u1')).resolves.toEqual({ cancelled: true });
  });
});

describe('accountDeletion.service — super admin review', () => {
  test('approve rejects a missing request', async () => {
    mockDb({ requestRows: [] });
    await expect(deletionService.approveRequest('nope', 'admin')).rejects.toThrow(/not found/);
  });

  test('approve rejects a non-pending request', async () => {
    mockDb({ requestRows: [{ id: 'r1', tenant_id: 't1', status: 'rejected' }] });
    await expect(deletionService.approveRequest('r1', 'admin')).rejects.toThrow(/already rejected/);
  });

  test('reject rejects a missing request', async () => {
    mockDb({ requestRows: [] });
    await expect(deletionService.rejectRequest('nope', 'admin')).rejects.toThrow(/not found/);
  });

  test('listRequests returns rows', async () => {
    mockDb({ requestRows: [{ id: 'r1', tenant_id: 't1', status: 'pending' }] });
    const result = await deletionService.listRequests({ status: 'pending' });
    expect(result.requests).toHaveLength(1);
  });
});