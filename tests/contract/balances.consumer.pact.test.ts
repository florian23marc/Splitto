import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { describe, it, expect } from 'vitest';
import path from 'node:path';

const { like, eachLike } = MatchersV3;

describe('Balances consumer pact', () => {
  const provider = new PactV3({
    consumer: 'splitto-frontend',
    provider: 'splitto-api',
    dir: path.resolve(__dirname, '../../pacts'),
    log: path.resolve(__dirname, '../../pacts/pact.log'),
    logLevel: 'INFO',
  });

  it('should create a pact for balances endpoint', async () => {
    await provider.addInteraction({
      states: [{ description: 'group-1 a 3 membres et 2 dépenses' }],
      uponReceiving: 'a request for group balances with expenses',
      withRequest: {
        method: 'GET',
        path: '/api/groups/group-1/balances',
      },
      willRespondWith: {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          groupId: like('group-1'),
          balances: {
            alice: like(20),
            bob: like(-10),
            charlie: like(-10),
          },
          settlements: eachLike({
            from: like('bob'),
            to: like('alice'),
            amount: like(10),
          }),
        },
      },
    });

    await provider.addInteraction({
      states: [{ description: 'aucun groupe inexistant' }],
      uponReceiving: 'a request for balances of a non-existent group',
      withRequest: {
        method: 'GET',
        path: '/api/groups/inexistant/balances',
      },
      willRespondWith: {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          error: like('Group not found'),
        },
      },
    });

    await provider.executeTest(async (mockService) => {
      const url = mockService.url;

      const response1 = await fetch(`${url}/api/groups/group-1/balances`);
      expect(response1.status).toBe(200);
      const body1 = await response1.json();
      expect(body1).toHaveProperty('groupId', 'group-1');
      expect(body1).toHaveProperty('balances');
      expect(body1.balances).toHaveProperty('alice');

      const response2 = await fetch(`${url}/api/groups/inexistant/balances`);
      expect(response2.status).toBe(404);
      const body2 = await response2.json();
      expect(body2).toHaveProperty('error');
    });
  });
});