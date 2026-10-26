import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/components/PlayerProfileModal/PlayerProfileModal.tsx', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.React,
    esModuleInterop: true,
  },
}).outputText;

const child = { id: 'child', name: 'Existing Child', relationship_type: 'guardian' };
const rosteredChild = { id: 'rostered-child', name: 'Already On Team', relationship_type: 'guardian' };
const self = { id: 'self', name: 'My Own Profile', relationship_type: 'owner' };
const response = (data, ok = true) => ({ ok, json: async () => data });

function createHarness({ currentTeamId = 'team', request } = {})
{
  const hooks = [];
  const calls = [];
  const timers = new Map();
  const errors = [];
  let cursor = 0;
  let dirty = true;
  let effects = [];
  let tree;
  let timerId = 0;
  let successes = 0;
  let closes = 0;
  const props = {
    isOpen: true,
    currentTeamId,
    onSuccess: () => successes++,
    onClose: () => closes++,
  };
  const react = {
    createElement(type, props, ...children)
    {
      return { type, props: { ...props, children } };
    },
    useState(initial)
    {
      const index = cursor++;
      hooks[index] ??= { value: initial };
      return [hooks[index].value, value =>
      {
        const next = typeof value === 'function' ? value(hooks[index].value) : value;
        if (!Object.is(hooks[index].value, next))
        {
          hooks[index].value = next;
          dirty = true;
        }
      }];
    },
    useEffect(effect, deps)
    {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous?.deps || !deps.every((value, i) => Object.is(value, previous.deps[i])))
      {
        hooks[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() =>
        {
          hooks[index].cleanup?.();
          hooks[index].cleanup = effect();
        });
      }
    },
  };
  const apiRequest = async (path, options = {}) =>
  {
    calls.push({ path, options });
    const custom = request?.(path, options);
    if (custom !== undefined) return custom;
    if (options.method === 'POST') return response({ message: 'Saved successfully' });
    if (path === '/api/teams')
    {
      return response(['coach', 'admin', 'guardian', 'player'].map(role => ({
        role,
        teams: { id: role, name: `${role} team` },
      })));
    }
    if (path === '/api/auth/guardian-players') return response([child, rosteredChild, self]);
    if (path.endsWith('/players')) return response([{ id: rosteredChild.id }]);
    throw new Error(`Unexpected request: ${path}`);
  };
  const context = {
    exports: {},
    AbortController,
    console: { error: (...args) => errors.push(args) },
    setTimeout(callback)
    {
      const id = ++timerId;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: id => timers.delete(id),
    require(name)
    {
      if (name === 'react') return react;
      if (name === '../../utils/api') return { apiRequest };
      if (name === '../Modal') return { Modal: 'Modal' };
      if (name === './PlayerProfileModal.css') return {};
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  runInNewContext(compiled, context);
  const render = () =>
  {
    cursor = 0;
    effects = [];
    dirty = false;
    tree = context.exports.PlayerProfileModal(props);
    effects.forEach(effect => effect());
  };
  const nodes = (node = tree) =>
  {
    if (Array.isArray(node)) return node.flatMap(item => nodes(item));
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children)];
  };
  const text = (node = tree) =>
  {
    if (Array.isArray(node)) return node.map(item => text(item)).join('');
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    return text(node.props.children);
  };
  const find = predicate =>
  {
    const node = nodes().find(predicate);
    assert.ok(node, 'Expected UI element was not rendered');
    return node;
  };
  const h = {
    calls,
    errors,
    props,
    text,
    find,
    get successes()
    {
      return successes;
    },
    get closes()
    {
      return closes;
    },
    get submitButton()
    {
      return find(node => node.type === 'button' && node.props.type === 'submit');
    },
    async flush()
    {
      for (let i = 0; i < 8; i++)
      {
        if (dirty) render();
        await new Promise(resolve => setImmediate(resolve));
      }
      assert.equal(dirty, false, 'Component state should settle');
    },
    async change(id, value)
    {
      find(node => node.props.id === id).props.onChange({ target: { value } });
      await h.flush();
    },
    async submit()
    {
      await find(node => node.type === 'form').props.onSubmit({
        preventDefault()
        {},
      });
      await h.flush();
    },
    async updateProps(next)
    {
      Object.assign(props, next);
      dirty = true;
      await h.flush();
    },
    finishSuccessDelay()
    {
      for (const [id, callback] of [...timers])
      {
        timers.delete(id);
        callback();
      }
    },
    dispose()
    {
      hooks.forEach(hook => hook.cleanup?.());
    },
  };
  render();
  return h;
}

test('existing-child picker excludes children already on the team and the user-owned player profile', async () =>
{
  const h = createHarness();
  await h.flush();
  assert.equal(h.find(node => node.props.id === 'player-profile-mode').props.value, 'new');
  await h.change('player-profile-mode', 'existing');
  const picker = h.find(node => node.props.id === 'player-profile-child');
  const options = picker.props.children.flat(Infinity).filter(node => node?.type === 'option');
  assert.deepEqual(options.map(option => option.props.value), ['', child.id]);
  assert.equal(h.submitButton.props.disabled, true);
  assert.match(h.text(), /Your team role will not change/);
  assert.ok(!h.text().includes("I am this player's guardian"));
  h.dispose();
});

test('adding an existing child posts only the existing ID and team-specific jersey, then refreshes the caller', async () =>
{
  const h = createHarness();
  await h.flush();
  await h.change('player-profile-mode', 'existing');
  await h.change('player-profile-child', child.id);
  await h.change('player-profile-jersey', ' 12 ');
  assert.equal(h.submitButton.props.disabled, false);
  await h.submit();
  const posts = h.calls.filter(call => call.options.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].path, '/api/teams/team/players');
  assert.deepEqual(JSON.parse(posts[0].options.body), { playerId: child.id, jerseyNumber: '12' });
  assert.equal(h.submitButton.props.disabled, true);
  assert.equal(h.successes, 0);
  h.finishSuccessDelay();
  assert.equal(h.successes, 1);
  assert.equal(h.closes, 1);
  h.dispose();
});

for (const isGuardian of [false, true])
{
  test(`new-profile creation remains available with guardian checkbox ${isGuardian}`, async () =>
  {
    const h = createHarness();
    await h.flush();
    await h.change('player-profile-name', ' New Child ');
    if (isGuardian)
    {
      h.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({
        target: { checked: true },
      });
      await h.flush();
    }
    await h.submit();
    const post = h.calls.find(call => call.options.method === 'POST');
    assert.equal(post.path, '/api/teams/team/player-profiles');
    assert.deepEqual(JSON.parse(post.options.body), {
      name: 'New Child',
      jerseyNumber: null,
      userRole: isGuardian ? 'guardian' : 'staff',
    });
    assert.ok(!h.calls.some(call => call.path === '/api/auth/guardian-players'));
    h.dispose();
  });
}

test('profile entry point lists only eligible teams and clears the chosen child when switching teams', async () =>
{
  const h = createHarness({ currentTeamId: '' });
  await h.flush();
  const teamPicker = h.find(node => node.props.id === 'player-profile-team');
  const teamOptions = teamPicker.props.children.flat(Infinity).filter(node => node?.type === 'option');
  assert.deepEqual(teamOptions.map(option => option.props.value), ['', 'coach', 'admin', 'guardian']);
  await h.change('player-profile-mode', 'existing');
  assert.equal(h.find(node => node.props.id === 'player-profile-child').props.disabled, true);
  await h.change('player-profile-team', 'admin');
  await h.change('player-profile-child', child.id);
  assert.equal(h.submitButton.props.disabled, false);
  await h.change('player-profile-team', 'guardian');
  assert.equal(h.find(node => node.props.id === 'player-profile-child').props.value, '');
  assert.equal(h.submitButton.props.disabled, true);
  assert.ok(h.calls.some(call => call.path === '/api/teams/guardian/players'));
  h.dispose();
});

test('empty eligible-child list explains the situation and prevents enrollment', async () =>
{
  const h = createHarness({
    request: path => path === '/api/auth/guardian-players' ? response([rosteredChild, self]) : undefined,
  });
  await h.flush();
  await h.change('player-profile-mode', 'existing');
  assert.match(h.text(), /No linked children are available to add/);
  assert.equal(h.submitButton.props.disabled, true);
  await h.submit();
  assert.match(h.text(), /Please select an existing child/);
  assert.ok(!h.calls.some(call => call.options.method === 'POST'));
  h.dispose();
});

for (const failedPath of ['/api/auth/guardian-players', '/api/teams/team/players'])
{
  test(`failed ${failedPath} load is explicit, blocks submission, and can be retried`, async () =>
  {
    let fail = true;
    const h = createHarness({
      request: path => path === failedPath && fail ? response({ error: 'Cannot load players' }, false) : undefined,
    });
    await h.flush();
    await h.change('player-profile-mode', 'existing');
    assert.match(h.text(), /Cannot load players/);
    assert.equal(h.submitButton.props.disabled, true);
    fail = false;
    h.find(node => node.type === 'button' && h.text(node) === 'Retry').props.onClick();
    await h.flush();
    assert.ok(!h.text().includes('Cannot load players'));
    await h.change('player-profile-child', child.id);
    assert.equal(h.submitButton.props.disabled, false);
    h.dispose();
  });
}

test('enrollment API failure is shown without closing or reporting success', async () =>
{
  const h = createHarness({
    request: (_path, options) =>
      options.method === 'POST' ? response({ error: 'This child is already on this team' }, false) : undefined,
  });
  await h.flush();
  await h.change('player-profile-mode', 'existing');
  await h.change('player-profile-child', child.id);
  await h.submit();
  assert.match(h.text(), /This child is already on this team/);
  assert.equal(h.successes, 0);
  assert.equal(h.closes, 0);
  h.dispose();
});

test('late roster responses from the previous team cannot replace the current team options', async () =>
{
  let finishPreviousRoster;
  const h = createHarness({
    currentTeamId: '',
    request: path =>
      path === '/api/teams/first/players' ?
        new Promise(resolve => finishPreviousRoster = resolve) :
        path === '/api/teams/second/players' ?
        response([{ id: child.id }]) :
        undefined,
  });
  await h.flush();
  await h.change('player-profile-mode', 'existing');
  await h.change('player-profile-team', 'first');
  assert.equal(h.submitButton.props.disabled, true);
  await h.change('player-profile-team', 'second');
  assert.ok(!h.text().includes(child.name));
  finishPreviousRoster(response([]));
  await h.flush();
  assert.ok(!h.text().includes(child.name), 'Aborted request must not overwrite the current team list');
  h.dispose();
});

test('closing before the success delay cancels refresh and reopening resets the modal', async () =>
{
  const h = createHarness();
  await h.flush();
  await h.change('player-profile-mode', 'existing');
  await h.change('player-profile-child', child.id);
  await h.submit();
  await h.updateProps({ isOpen: false });
  h.finishSuccessDelay();
  assert.equal(h.successes, 0);
  assert.equal(h.closes, 0);
  await h.updateProps({ isOpen: true });
  assert.equal(h.find(node => node.props.id === 'player-profile-mode').props.value, 'new');
  assert.equal(h.find(node => node.props.id === 'player-profile-name').props.value, '');
  assert.equal(h.submitButton.props.disabled, true);
  h.dispose();
});
