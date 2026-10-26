import express from 'express';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const teamId = '11111111-1111-4111-8111-111111111111';
const otherTeamId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const childId = '44444444-4444-4444-8444-444444444444';
const otherChildId = '55555555-5555-4555-8555-555555555555';

function compile(path)
{
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const databaseSource = compile('../src/types/database.ts');
const roleAuthSource = compile('../src/utils/roleAuth.ts');
const teamsSource = compile('../src/routes/teams.ts');

function load(source, imports, errors)
{
  const context = {
    exports: {},
    console: { error: (...args) => errors.push(args) },
    require(name)
    {
      assert.ok(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    },
  };
  runInNewContext(source, context);
  return context.exports;
}

async function createHarness(t, { role = 'guardian', linked = true, authenticated = true, failure } = {})
{
  const state = {
    team_memberships: role ? [{ id: 'membership', team_id: teamId, user_id: userId, role }] : [],
    guardian_player_relationships: linked ?
      [{ id: 'relationship', guardian_id: userId, player_profile_id: childId }] :
      [],
    team_players: [{ id: 'original-roster-entry', team_id: otherTeamId, player_id: childId, jersey_number: '7' }],
  };
  const originalState = structuredClone(state);
  const queries = [];
  const errors = [];
  const supabase = {
    from(table)
    {
      assert.ok(table in state, `Unexpected table access: ${table}`);
      const query = { table, action: 'select', filters: [], values: null, single: false, optional: false };
      const builder = {
        select()
        {
          return builder;
        },
        eq(column, value)
        {
          query.filters.push([column, value]);
          return builder;
        },
        single()
        {
          query.single = true;
          return builder;
        },
        maybeSingle()
        {
          query.single = true;
          query.optional = true;
          return builder;
        },
        insert(values)
        {
          query.action = 'insert';
          query.values = values;
          return builder;
        },
        then(resolve, reject)
        {
          return Promise.resolve().then(() =>
          {
            queries.push(query);
            const error = failure?.(query);
            if (error) return { data: null, error };
            if (query.action === 'insert')
            {
              const row = { id: 'new-roster-entry', created_at: '2026-10-26T00:00:00Z', ...query.values };
              state[table].push(row);
              return { data: row, error: null };
            }
            const rows = state[table].filter(row => query.filters.every(([column, value]) => row[column] === value));
            return {
              data: query.single ? rows[0] || null : rows,
              error: query.single && !query.optional && rows.length === 0 ? { code: 'PGRST116' } : null,
            };
          }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  const database = load(databaseSource, {}, errors);
  const roleAuth = load(roleAuthSource, {
    '../types/database.js': database,
    './supabase.js': { supabase },
  }, errors);
  const routes = load(teamsSource, {
    express: require('express'),
    '../middleware/auth.js': {
      authenticateUser(req, res, next)
      {
        if (!req.user) return res.status(401).json({ error: 'User not authenticated' });
        next();
      },
    },
    '../types/database.js': database,
    '../utils/roleAuth.js': roleAuth,
    '../utils/supabase.js': { supabase },
  }, errors);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) =>
  {
    if (authenticated) req.user = { id: userId };
    next();
  });
  app.use('/api/teams', routes.default);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() =>
    new Promise((resolve, reject) =>
    {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    })
  );

  return {
    state,
    originalState,
    queries,
    errors,
    async add(body = { playerId: childId })
    {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/teams/${teamId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
  };
}

for (const role of ['guardian', 'admin', 'coach'])
{
  test(`${role} can add their existing child without changing roles, relationships, or other teams`, async t =>
  {
    const h = await createHarness(t, { role });
    const response = await h.add({ playerId: childId, jerseyNumber: ' 7 ' });
    assert.equal(response.status, 201);
    assert.equal(response.body.message, 'Child added to team successfully');
    assert.equal(response.body.team_player.team_id, teamId);
    assert.equal(response.body.team_player.player_id, childId);
    assert.equal(response.body.team_player.jersey_number, '7');
    assert.deepEqual(h.state.team_memberships, h.originalState.team_memberships);
    assert.deepEqual(h.state.guardian_player_relationships, h.originalState.guardian_player_relationships);
    assert.deepEqual(h.state.team_players[0], h.originalState.team_players[0]);
    assert.equal(h.state.team_players.length, 2);
    assert.deepEqual(h.queries.filter(query => query.action !== 'select').map(query => query.table), ['team_players']);
    const relationshipQuery = h.queries.find(query => query.table === 'guardian_player_relationships');
    assert.deepEqual(relationshipQuery.filters, [['guardian_id', userId], ['player_profile_id', childId]]);
    assert.equal(h.errors.length, 0);
  });

  test(`${role} cannot add an unrelated child`, async t =>
  {
    const h = await createHarness(t, { role, linked: false });
    const response = await h.add();
    assert.equal(response.status, 403);
    assert.match(response.body.error, /only add children already linked/);
    assert.deepEqual(h.state, h.originalState);
    assert.ok(h.queries.every(query => query.action === 'select'));
  });
}

for (const role of ['player', null])
{
  test(`${role || 'non-member'} cannot add a child even with a guardian relationship`, async t =>
  {
    const h = await createHarness(t, { role });
    assert.equal((await h.add()).status, 403);
    assert.equal(h.queries.length, 1);
    assert.deepEqual(h.state, h.originalState);
  });
}

test('unauthenticated requests are rejected before querying the database', async t =>
{
  const h = await createHarness(t, { authenticated: false });
  assert.equal((await h.add()).status, 401);
  assert.equal(h.queries.length, 0);
});

for (const jerseyNumber of [undefined, null, '', '  '])
{
  test(`optional jersey number ${JSON.stringify(jerseyNumber)} is stored as null`, async t =>
  {
    const h = await createHarness(t);
    const response = await h.add({ playerId: childId, jerseyNumber });
    assert.equal(response.status, 201);
    assert.equal(response.body.team_player.jersey_number, null);
  });
}

for (
  const body of [
    {},
    { playerId: 123 },
    { playerId: 'not-a-uuid' },
    { playerId: childId, jerseyNumber: 7 },
    { playerId: childId, jerseyNumber: {} },
    { playerId: childId, jerseyNumber: '123' },
    { playerId: childId, jerseyNumber: '-1' },
    { playerId: childId, jerseyNumber: 'A' },
  ]
)
{
  test(`rejects invalid enrollment input ${JSON.stringify(body)}`, async t =>
  {
    const h = await createHarness(t);
    assert.equal((await h.add(body)).status, 400);
    assert.equal(h.queries.length, 1, 'only the team membership authorization query should run');
    assert.deepEqual(h.state, h.originalState);
  });
}

test('an already-rostered child is rejected without modifying their jersey number', async t =>
{
  const h = await createHarness(t);
  h.state.team_players.push({ id: 'existing', team_id: teamId, player_id: childId, jersey_number: '9' });
  const before = structuredClone(h.state);
  const response = await h.add({ playerId: childId, jerseyNumber: '7' });
  assert.equal(response.status, 409);
  assert.match(response.body.error, /already on this team/);
  assert.deepEqual(h.state, before);
});

test('a jersey number already used on the destination team is rejected', async t =>
{
  const h = await createHarness(t);
  h.state.team_players.push({ id: 'other-child', team_id: teamId, player_id: otherChildId, jersey_number: '7' });
  const before = structuredClone(h.state);
  const response = await h.add({ playerId: childId, jerseyNumber: '7' });
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'Jersey number is already taken');
  assert.deepEqual(h.state, before);
});

test('a concurrent duplicate insert returns a conflict, not success', async t =>
{
  const h = await createHarness(t, {
    failure: query => query.action === 'insert' ? { code: '23505', message: 'duplicate key' } : null,
  });
  assert.equal((await h.add()).status, 409);
  assert.deepEqual(h.state, h.originalState);
});

for (const stage of ['relationship', 'roster', 'jersey', 'insert'])
{
  test(`${stage} database errors are surfaced and never reported as successful enrollment`, async t =>
  {
    const h = await createHarness(t, {
      failure(query)
      {
        const matches = {
          relationship: query.table === 'guardian_player_relationships',
          roster: query.table === 'team_players' && query.filters.some(([column]) => column === 'player_id'),
          jersey: query.table === 'team_players' && query.filters.some(([column]) => column === 'jersey_number'),
          insert: query.action === 'insert',
        };
        return matches[stage] ? { code: 'XX000', message: 'Database unavailable' } : null;
      },
    });
    const response = await h.add({ playerId: childId, jerseyNumber: '7' });
    assert.equal(response.status, 500);
    assert.equal(typeof response.body.error, 'string');
    assert.equal(h.errors.length, 1);
    assert.deepEqual(h.state, h.originalState);
  });
}
