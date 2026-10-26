import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/hooks/useYouTubePlayer.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

// Exercise the real hook with deterministic React lifecycle, player, and timer mocks.
function createHarness()
{
  const hooks = [];
  const timers = new Map();
  const warnings = [];
  const errors = [];
  const calls = [];
  let cursor = 0;
  let now = 0;
  let timerId = 0;
  let pendingEffects = [];
  let config;
  let controller;
  let track = { languageCode: 'en' };
  let modules = ['captions'];
  let state = 2;
  let emitUnloadEvent = false;
  let unloadError = false;
  let destroyed = false;

  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useRef(initial)
    {
      const i = cursor++;
      hooks[i] ??= { current: initial };
      return hooks[i];
    },
    useState(initial)
    {
      const i = cursor++;
      hooks[i] ??= { value: initial };
      return [hooks[i].value, value =>
      {
        hooks[i].value = value;
      }];
    },
    useCallback(callback, deps)
    {
      const i = cursor++;
      if (!sameDeps(hooks[i]?.deps, deps)) hooks[i] = { callback, deps };
      return hooks[i].callback;
    },
    useEffect(effect, deps)
    {
      const i = cursor++;
      if (!sameDeps(hooks[i]?.deps, deps))
      {
        pendingEffects.push(() =>
        {
          hooks[i]?.cleanup?.();
          hooks[i] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const schedule = (callback, delay, repeat = false) =>
  {
    const id = ++timerId;
    timers.set(id, { callback, delay, repeat, due: now + delay });
    return id;
  };
  const player = {
    getOptions: () => modules,
    getOption: () => track,
    unloadModule(module)
    {
      assert.equal(destroyed, false, 'must not call a destroyed player');
      assert.equal(module, 'captions');
      calls.push(['unload', now]);
      if (unloadError) throw new Error('YouTube API failure');
      track = {};
      // YouTube may keep reporting the module after an unload.
      if (emitUnloadEvent) config.events.onApiChange({ target: player });
    },
    playVideo: () =>
    {
      calls.push(['play']);
    },
    pauseVideo: () =>
    {
      calls.push(['pause']);
    },
    seekTo: (time, allowSeekAhead) =>
    {
      calls.push(['seek', time, allowSeekAhead]);
    },
    setPlaybackRate: rate =>
    {
      calls.push(['rate', rate]);
    },
    getPlaybackRate: () => 1,
    getCurrentTime: () => 20,
    getDuration: () => 100,
    getPlayerState: () => state,
    destroy: () =>
    {
      destroyed = true;
    },
  };
  const context = {
    exports: {},
    URLSearchParams,
    performance: { now: () => now },
    setTimeout: (callback, delay) => schedule(callback, delay),
    setInterval: (callback, delay) => schedule(callback, delay, true),
    clearTimeout: id => timers.delete(id),
    clearInterval: id => timers.delete(id),
    console: {
      warn: (...args) => warnings.push(args),
      error: (...args) => errors.push(args),
    },
    document: { getElementById: () => null },
    window: {
      location: { search: '' },
      addEventListener()
      {},
      removeEventListener()
      {},
      YT: {
        Player: function(_id, options)
        {
          config = options;
          return player;
        },
        PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
      },
    },
    require(name)
    {
      if (name === 'react') return react;
      if (name === '../types/config') return { CONFIG: { video: { defaultVideoId: 'test-video' } } };
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  runInNewContext(compiled, context);
  const render = () =>
  {
    cursor = 0;
    pendingEffects = [];
    controller = context.exports.useYouTubePlayer('test-video');
    pendingEffects.forEach(effect => effect());
  };
  render();

  return {
    player,
    config,
    calls,
    warnings,
    errors,
    get controller()
    {
      return controller;
    },
    get unloads()
    {
      return calls.filter(call => call[0] === 'unload').length;
    },
    get retryCount()
    {
      return [...timers.values()].filter(timer => timer.delay === 300).length;
    },
    get watchdogCount()
    {
      return [...timers.values()].filter(timer => timer.delay === 1000).length;
    },
    setTrack(value)
    {
      track = value;
    },
    setModules(value)
    {
      modules = value;
    },
    failUnload()
    {
      unloadError = true;
    },
    emitOnUnload()
    {
      emitUnloadEvent = true;
    },
    ready()
    {
      config.events.onReady({ target: player });
      render();
    },
    state(value)
    {
      state = value;
      config.events.onStateChange({ target: player, data: value });
      render();
    },
    advance(ms)
    {
      const end = now + ms;
      let steps = 0;
      while (true)
      {
        const next = [...timers.entries()].filter(([, timer]) => timer.due <= end)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        assert.ok(++steps < 10000, 'timer loop must terminate');
        const [id, timer] = next;
        now = timer.due;
        if (timer.repeat) timer.due += timer.delay;
        else timers.delete(id);
        timer.callback();
      }
      now = end;
    },
    unmount()
    {
      hooks.forEach(hook => hook.cleanup?.());
    },
  };
}

test('readiness and state events suppress captions without changing playback settings', () =>
{
  const h = createHarness();
  assert.equal(h.watchdogCount, 0);
  h.ready();
  assert.equal(h.unloads, 1);
  assert.equal(h.watchdogCount, 1);
  assert.ok(h.calls.some(call => call[0] === 'play'));
  assert.equal(h.config.playerVars.controls, 0);
  assert.equal(h.config.playerVars.disablekb, 1);
  assert.equal(h.config.playerVars.mute, 1);
  for (const state of [1, 2, 5])
  {
    h.advance(300);
    h.setTrack({ languageCode: 'en' });
    const before = h.unloads;
    h.state(state);
    assert.equal(h.unloads, before + 1);
    assert.equal(h.controller.isPlaying, state === 1);
    assert.equal(h.watchdogCount, 1);
  }
  assert.deepEqual(h.errors, []);
  h.unmount();
});

for (const state of [1, 2])
{
  for (
    const [method, args, expected] of [
      ['seekToTime', [150], ['seek', 100, true]],
      ['seekVideo', [-30], ['seek', 0, true]],
      ['seekTo', [45, false], ['seek', 45, false]],
      ['playVideo', [], ['play']],
      ['pauseVideo', [], ['pause']],
      ['togglePlayPause', [], [state === 1 ? 'pause' : 'play']],
      ['setPlaybackRate', [0.5], ['rate', 0.5]],
    ]
  )
  {
    test(`${method} retries after transport while ${state === 1 ? 'playing' : 'paused'}`, () =>
    {
      const h = createHarness();
      h.ready();
      h.state(state);
      h.advance(300);
      h.controller[method](...args);
      assert.ok(h.calls.some(call => JSON.stringify(call) === JSON.stringify(expected)));
      const before = h.unloads;
      h.advance(100);
      h.setTrack({ languageCode: 'en' });
      h.advance(199);
      assert.equal(h.unloads, before);
      h.advance(1);
      assert.equal(h.unloads, before + 1);
      h.unmount();
    });
  }
}

test('watchdog checks once per second and unloads only for an active track', () =>
{
  const h = createHarness();
  h.ready();
  h.advance(1000);
  assert.equal(h.unloads, 1, 'empty track must not trigger another unload');
  h.setTrack({ languageCode: 'en' });
  h.advance(999);
  assert.equal(h.unloads, 1);
  h.advance(1);
  assert.equal(h.unloads, 2);
  for (const track of [undefined, null, {}, { languageCode: '' }])
  {
    h.setTrack(track);
    h.advance(1000);
    assert.equal(h.unloads, 2);
  }
  h.setModules([]);
  h.setTrack({ languageCode: 'en' });
  h.advance(1000);
  assert.equal(h.unloads, 2);
  h.unmount();
});

test('rapid seeks debounce retries and unmount cancels caption timers and stale events', () =>
{
  const h = createHarness();
  h.ready();
  h.advance(300);
  h.controller.seekTo(10);
  h.advance(100);
  h.controller.seekTo(30);
  assert.equal(h.retryCount, 1);
  const before = h.unloads;
  h.advance(200);
  assert.equal(h.unloads, before, 'first seek retry must have been cancelled');
  h.advance(100);
  assert.equal(h.unloads, before + 1);
  h.controller.seekTo(50);
  h.unmount();
  assert.equal(h.retryCount, 0);
  assert.equal(h.watchdogCount, 0);
  const after = h.unloads;
  h.setTrack({ languageCode: 'en' });
  h.advance(2000);
  h.config.events.onApiChange({ target: h.player });
  assert.equal(h.unloads, after);
});

test('reentrant and closely spaced asynchronous module events are throttled', () =>
{
  const h = createHarness();
  h.emitOnUnload();
  h.ready();
  assert.equal(h.unloads, 1);
  h.advance(100);
  h.config.events.onApiChange({ target: h.player });
  assert.equal(h.unloads, 1);
  h.advance(200);
  h.setTrack({ languageCode: 'en' });
  h.config.events.onApiChange({ target: h.player });
  assert.equal(h.unloads, 2);
  h.unmount();
});

for (const failure of ['missing-unload', 'throwing-unload', 'missing-track-inspection'])
{
  test(`${failure} logs once and does not block transport`, () =>
  {
    const h = createHarness();
    if (failure === 'missing-unload') h.player.unloadModule = undefined;
    if (failure === 'throwing-unload') h.failUnload();
    if (failure === 'missing-track-inspection') h.player.getOption = undefined;
    h.ready();
    h.controller.seekTo(40);
    h.controller.pauseVideo();
    h.controller.playVideo();
    h.advance(3000);
    assert.equal(h.warnings.length, 1);
    assert.deepEqual(h.errors, []);
    assert.ok(h.calls.some(call => call[0] === 'seek'));
    assert.ok(h.calls.some(call => call[0] === 'pause'));
    assert.ok(h.calls.filter(call => call[0] === 'play').length >= 2);
    h.unmount();
  });
}
