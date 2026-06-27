import { describe, it, expect } from 'vitest';

describe('Loading component smoke test', () => {
  it('can import Loading', async () => {
    const mod = await import('../components/Loading.jsx');
    expect(mod.default).toBeDefined();
  });
});

describe('App entry smoke test', () => {
  it('can import App', async () => {
    // Just verify the module exports something (no render — too many deps)
    const mod = await import('../App.jsx');
    expect(mod.default).toBeDefined();
  });
});

describe('API service smoke test', () => {
  it('can import api service', async () => {
    const mod = await import('../services/api.js');
    expect(mod.default).toBeDefined();
  });
});
