import { ReactiveStorage } from '../script/ReactiveStorage.js';
import { assert } from 'chai';

function create(...args) {
  return new ReactiveStorage(...args);
}

function assertHasGetter(obj, prop) {
  assert.property(obj, prop);
  assert.property(Object.getOwnPropertyDescriptor(obj, prop), 'get');
}
function assertHasValue(obj, prop) {
  assert.property(obj, prop);
  assert.property(Object.getOwnPropertyDescriptor(obj, prop), 'value');
}

describe('Register', () => {
  it('Shallow', () => {
    const c = ReactiveStorage.register('foo', 3);

    assert.equal(c.target.foo, 3);
    assert.equal(c.endpoint.foo, 3);

    c.target.foo = 'bar';
    assert.equal(c.target.foo, 'bar');
    assert.equal(c.endpoint.foo, 'bar');
  });
  it('Shallow with infinite depth', () => {
    const c = ReactiveStorage.register('foo', 3, { depth: Infinity });

    assert.equal(c.target.foo, 3);
    assert.equal(c.endpoint.foo, 3);

    c.target.foo = 'bar';
    assert.equal(c.target.foo, 'bar');
    assert.equal(c.endpoint.foo, 'bar');
  });
  it('Deep with infinite depth', () => {
    const c = ReactiveStorage.register('foo', { bar: { baz: 5 } }, { depth: Infinity });

    assert.deepEqual(c.target.foo, { bar: { baz: 5 } });
    assert.deepEqual(c.endpoint.foo, { bar: { baz: 5 } });

    c.target.foo = 'bar';
    assert.deepEqual(c.target.foo, 'bar');
    assert.deepEqual(c.endpoint.foo, 'bar');
  });
  it('Infinite depth: setter', () => {
    let i = 0;
    let o = 0;
    const c = ReactiveStorage.register('recursive', { first: { second: 3 } }, {
      setter: val => { i++ },
      depth: {
        setter: val => { o++ },
        depth: Infinity
      }
    });

    c.target.recursive = { first2: { second2: 69 } };
    // "First layer: { first2: { second2: 69 } }"
    // "Further layer: { second2: 69 }"
    // "Further layer: 69"

    c.target.recursive.first2 = 70;
    // "Further layer: 70"
  });
  describe('Multiple properties', () => {
    it('Without config, without initial value', () => {
      const c = ReactiveStorage.register([ 'foo', 'bar', 'baz' ]);
      assertHasGetter(c.target, 'foo');
      assertHasGetter(c.target, 'bar');
      assertHasGetter(c.target, 'baz');
      assert.isUndefined(c.target.foo);

      c.target.foo = 3;
      assert.equal(c.target.foo, 3);
      assert.isUndefined(c.target.bar);
      assert.isUndefined(c.target.baz);
    });
    it('Deep, without initial value', () => {
      const c = ReactiveStorage.register([ 'foo', 'bar', 'baz' ], undefined, { depth: Infinity });
      c.target.bar = [ { lor: 1 }, 2, 3 ];
      assertHasGetter(c.target.bar, 0);
      assertHasGetter(c.target.bar[0], 'lor');
      assert.equal(c.target.bar[0].lor, 1);
    });
    it('Deep, with initial value', () => {
      const c = ReactiveStorage.register([ 'foo', 'bar', 'baz' ], 420, { depth: Infinity });
      assert.equal(c.target.foo, 420);
      assert.equal(c.target.bar, 420);
      assert.equal(c.target.baz, 420);
    });
  });
  describe('Return values', () => {
    describe('Static methods', () => {
      it('Base: register(...)', () => {
        const target = {};
        const endpoint = {};
        const c = ReactiveStorage.register([ 'foo', 'bar', 'baz' ], undefined, { target, endpoint });
        assert.hasAllKeys(c, [ 'target', 'targets', 'endpoint' ]);
        assert.equal(c.target, target);
        assert.equal(c.targets[0], target);
        assert.equal(c.endpoint, endpoint);
      });
      it('Base: registerRecursive(...)', () => {
        const target = {};
        const endpoint = {};
        const c = ReactiveStorage.registerRecursive([ 'foo', 'bar', 'baz' ], undefined, { target, endpoint });
        assert.hasAllKeys(c, [ 'target', 'targets', 'endpoint' ]);
        assert.equal(c.target, target);
        assert.equal(c.targets[0], target);
        assert.equal(c.endpoint, endpoint);
      });
      it('register(...) with definition chain', () => {
        const target0 = {};
        const target1 = {};
        const target2 = {};
        const endpoint = {};
        const c = ReactiveStorage.register([ 'foo', 'bar', 'baz' ], undefined, [
          { target: target0 },
          { target: target1 },
          { target: target2, endpoint },
        ]);
        assert.equal(c.target, target0);
        assert.lengthOf(c.targets, 3);
        assert.equal(c.targets[0], c.target);
        assert.equal(c.targets[1], target1);
        assert.equal(c.targets[2], target2);
      });
    });
    describe('Instance', () => {
      it('register(...)', () => {
        const target = {};
        const endpoint = {};
        const s = create({ target, endpoint });
        const c = s.register('foo');
        assert.equal(c, s);
      });
    });
  });
});

describe('delete(...)', () => {
  it('Correctly deletes from both `target` and `endpoint`', () => {
    const s = create();
    s.register([ 'foo', 'bar', 'baz' ], 3);
    assert.hasAllKeys(s.target, ['foo', 'bar', 'baz']);
    assert.hasAllKeys(s.endpoint, ['foo', 'bar', 'baz']);

    s.delete('foo');
    assert.hasAllKeys(s.target, ['bar', 'baz']);
    assert.hasAllKeys(s.endpoint, ['bar', 'baz']);
  });
  it('Returns `true` on a successful delete', () => {
    const s = create();
    s.register('lor');
    assert.isTrue(s.delete('lor'));
    assert.isFalse(s.delete('none'));
  });
  it('Correctly deletes from all `targets`', () => {
    const s = create([{}, {}, {}]);
    s.register([ 'foo', 'bar', 'baz' ]);
    s.delete('foo');
    s.targets.forEach(target => {
      assert.hasAllKeys(target, ['bar', 'baz']);
    });
  });
});

describe('has(...)', () => {
  it('Correctly detects registered properties', () => {
    const s = create();
    s.register([ 'foo', 'bar', 'baz' ], 3);
    assert.hasAllKeys(s.target, ['foo', 'bar', 'baz']);
    assert.hasAllKeys(s.endpoint, ['foo', 'bar', 'baz']);

    assert.isTrue(s.has('foo'));
    assert.isTrue(s.has('bar'));
    assert.isTrue(s.has('baz'));

    s.delete('foo');
    assert.isFalse(s.has('foo'));
    assert.isTrue(s.has('bar'));
    assert.isTrue(s.has('baz'));
  });
});

describe('Constructor', () => {
  it('Default `endpoint` and `target` if not passed', () => {
    const s = create();
    assert.deepEqual(s.target, {}, "Target");
    assert.deepEqual(s.endpoint, {}, "Endpoint");
  });
  it('Store `endpoint` and `target` as instance properties', () => {
    const endpoint = [];
    const target = [];
    const s = create({ target, endpoint });
    assert.equal(s.endpoint, endpoint);
    assert.equal(s.target, target);
  });
  it('Instance `target` and `endpoint` point to config', () => {
    const s = create();
    assert.equal(s.target, s.config[0].target);
    assert.equal(s.endpoint, s.config.at(-1).endpoint);
  });
  describe('Config', () => {
    it('Store a shallow copy of a passed config as instance property', () => {
      const config = {
        endpoint: [],
        target: [],
      }
      const s = create(config);
      assert.isArray(s.config);
      assert.deepEqual(s.config, [ config ]);
      assert.equal(s.target, config.target);
      assert.equal(s.endpoint, config.endpoint);
    });
    it('Store a shallow copy of a passed definiton chain as instance property', () => {
      const config0 = {
        endpoint: [],
        target: [],
      };
      const config1 = {
        endpoint: {}
      };
      const config2 = {
        endpoint: {}
      };
      const s = create([ config0, config1, config2 ]);
      assert.lengthOf(s.config, 3);
      assert.deepEqual(s.config[0], config0);
      assert.hasAllKeys(s.config[0], [ 'endpoint', 'target' ]);
      assert.hasAllKeys(s.config[1], [ 'endpoint', 'target' ]);
      assert.hasAllKeys(s.config[2], [ 'endpoint', 'target' ]);
    });
  });
});

describe('Definition chains', () => {
  it('Correct instance properties', () => {
    const s = create([ {}, {}, {} ]);
    assert.lengthOf(s.config, 3);
    assert.lengthOf(s.targets, 3);
    assert.exists(s.endpoint);
    assert.equal(s.endpoint, s.config.at(-1).endpoint);
  });
  it('Correct default chaining', () => {
    const s = create([ {}, {}, {} ]);
    assert.equal(s.config[0].endpoint, s.config[1].target);
    assert.equal(s.config[1].endpoint, s.config[2].target);
  });
  it('Correct chaining with passed values', () => {
    const target0 = [];
    const target1 = [];
    const target2 = [];
    const endpoint = {};
    const s = create([
      { target: target0 },
      { target: target1 },
      { target: target2, endpoint }
    ]);
    assert.equal(s.config[0].target, target0);
    assert.equal(s.config[1].target, target1);
    assert.equal(s.config[2].target, target2);
    assert.equal(s.config[0].endpoint, s.config[1].target);
    assert.equal(s.config[1].endpoint, s.config[2].target);
    assert.equal(s.config[2].endpoint, endpoint);
  });
  it('All defined `endpoints` except the last will be dropped', () => {
    const endpoint0 = {};
    const endpoint1 = [];
    const endpoint2 = {};
    const s = new ReactiveStorage([
      { endpoint: endpoint0 },
      { endpoint: endpoint1 },
      { endpoint: endpoint2 }
    ]);
    assert.notEqual(s.config[0].endpoint, endpoint0);
    assert.notEqual(s.config[1].endpoint, endpoint1);
    assert.deepEqual(s.config[0].endpoint, {});
    assert.deepEqual(s.config[1].endpoint, {});
  });
});

describe('Setter', () => {
  describe('Should not be called with an initial value of `undefined`', () => {
    it('Instance', () => {
      const c = create({
        setter: () => {
          assert.fail("Should not be called.");
        }
      });
      c.register('foo');
    });
    it('Instance: Multiple properties', () => {
      const c = create({
        setter: () => {
          assert.fail("Should not be called.");
        }
      });
      c.register([ 'foo', 'bar', 'baz' ]);
    });
    it('Static with explicit undefined', () => {
      const c = ReactiveStorage.register('foo', undefined, {
        setter: () => {
          assert.fail("Should not be called.");
        }
      });
    });
  });
  describe('Parameters', () => {
    describe('`initial`', () => {
      it('setter', () => {
        let i = 0;
        let expected = true;
        const c = ReactiveStorage.register('foo', 6, {
          setter: ({ initial }) => {
            i++;
            assert.equal(initial, expected);
          }
        });
        expected = false;

        c.target.foo = 3;

        assert.equal(i, 2, "Setter hasn't been called the expected amount of times");
      });
      it('setter: deep', () => {
        let i = 0;
        let expected = true;
        const c = ReactiveStorage.registerRecursive('foo', { bar: { baz: 4 }, balt: 'a' }, {
          setter: ({ initial }) => {
            i++;
            assert.equal(initial, expected);
          }
        });
        // foo = { ... }
        // foo.bar = { ... }
        // foo.bar.baz = 4
        // foo.balt = 'a'
        expected = false;

        c.target.foo.bar.baz = 3;
        c.target.foo = [];

        assert.equal(i, 6, "Setter hasn't been called the expected amount of times");
      });
    });
    describe('`setter`', () => {
      it('Base', () => {
        const c = ReactiveStorage.register('foo', 6, {
          setter: ({ val, set }) => {
            if (val > 20) {
              set(20);
              return true;
            }
          }
        });
        assert.equal(c.target.foo, 6);

        c.target.foo = 3;
        assert.equal(c.target.foo, 3);

        c.target.foo = 420;
        assert.equal(c.target.foo, 20);
      })
      it('Initial value should be fenced as well', () => {
        const c = ReactiveStorage.register('foo', 6, {
          setter: ({ val, set }) => {
            if (val > 0) {
              set('lor');
              return true;
            }
          }
        });
        assert.equal(c.target.foo, 'lor');
        assert.equal(c.endpoint.foo, 'lor');

        c.target.foo = 3;
        assert.equal(c.target.foo, 'lor');

        c.target.foo = -6;
        assert.equal(c.target.foo, -6);

        c.target.foo += 7;
        assert.equal(c.target.foo, 'lor');
      })
    });
  });
})

describe('Configuration', () => {
  describe('Default values', () => {
    it('endpoint', () => {
      const { config } = create();
      assert.isNotNull(config[0].endpoint);
      assert.equal(Object.getPrototypeOf(config[0].endpoint), Object.prototype);
    });
    it('target', () => {
      const { config } = create();
      assert.isNotNull(config[0].target);
      assert.equal(Object.getPrototypeOf(config[0].endpoint), Object.prototype);
    });
    it('enumerable', () => {
      const { config } = create();
      assert.isUndefined(config.enumerable);
    });
    it('depthFilter', () => {
      const { config } = create();
      assert.isUndefined(config.depthFilter);
    });
    it('depth', () => {
      const { config } = create();
      assert.isUndefined(config.depth);
    });
    it('setter', () => {
      const { config } = create();
      assert.isUndefined(config.setter, 'setter');
    });
    it('getter', () => {
      const { config } = create();
      assert.isUndefined(config.getter, 'getter');
    });
    it('postSetter', () => {
      const { config } = create();
      assert.isUndefined(config.postSetter, 'postSetter');
    });
  })
});

describe('Definition chaining', () => {
  it('Base', () => {
    let g0 = 0;
    let g1 = 0;
    const c = ReactiveStorage.registerRecursive('value', 62, [
      {
        getter: ({ val }) => {
          g0++;
          return Math.round(val / 50) * 50
        }
      }, {
        getter: ({ val }) => {
          g1++;
          return Math.round(val / 5) * 5
        }
      },
    ]);

    assert.equal(c.targets[1].value, 60);
    assert.equal(g1, 1);

    g0 = g1 = 0;
    assert.equal(c.targets[0].value, 50);
    assert.equal(g1, 1);
    assert.equal(g0, 1);
  });
});

describe('Endpoint', () => {
  it('Base', () => {
    const c = ReactiveStorage.register('foo', 3);

    assertHasGetter(c.target, 'foo');
    assertHasValue(c.endpoint, 'foo');
  });
  it('Endpoint = {}', () => {
    const endpoint = {};
    const c = ReactiveStorage.register('foo', 3, { endpoint });

    assertHasGetter(c.target, 'foo');
    assertHasValue(endpoint, 'foo');

    c.target.foo = 'bar';
    assert.equal(endpoint.foo, 'bar');
  });
  it('Deep values are stored within the same object', () => {
    const c = ReactiveStorage.registerRecursive('foo', { bar: 3 });
    assert.equal(c.target.foo.bar, c.endpoint.foo.bar);

    c.target.foo.bar = 4;
    assert.equal(c.target.foo.bar, c.endpoint.foo.bar);

    c.endpoint.foo.bar = { lor: 40 };
    assert.equal(c.target.foo.bar, c.endpoint.foo.bar);
    assert.equal(c.target.foo.bar.lor, c.endpoint.foo.bar.lor);
  });
});
