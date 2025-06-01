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
function assertIsEnumerable(obj, prop) {
  assert.property(obj, prop);
  assert.isTrue(Object.getOwnPropertyDescriptor(obj, prop).enumerable);
}
function assertIsNotEnumerable(obj, prop) {
  assert.property(obj, prop);
  assert.isFalse(Object.getOwnPropertyDescriptor(obj, prop).enumerable);
}

describe('register(...)/registerRecursive(...)', () => {
  it('Shallow', () => {
    const c = ReactiveStorage.register('foo', 3);

    assert.equal(c.target.foo, 3);
    assert.equal(c.shallowEndpoint.foo, 3);

    c.target.foo = 'bar';
    assert.equal(c.target.foo, 'bar');
    assert.equal(c.shallowEndpoint.foo, 'bar');
  });
  it('Shallow with infinite depth', () => {
    const c = ReactiveStorage.register('foo', 3, { depth: Infinity });

    assert.equal(c.target.foo, 3);
    assert.equal(c.shallowEndpoint.foo, 3);

    c.target.foo = 'bar';
    assert.equal(c.target.foo, 'bar');
    assert.equal(c.shallowEndpoint.foo, 'bar');
  });
  it('Deep with infinite depth', () => {
    const c = ReactiveStorage.register('foo', { bar: { baz: 5 } }, { depth: Infinity });

    assert.deepEqual(c.target.foo, { bar: { baz: 5 } });
    assert.deepEqual(c.shallowEndpoint.foo, { bar: { baz: 5 } });

    c.target.foo = 'bar';
    assert.deepEqual(c.target.foo, 'bar');
    assert.deepEqual(c.shallowEndpoint.foo, 'bar');
  });
  it('Deep with `registerRecursive(...)`', () => {
    const c = ReactiveStorage.registerRecursive('foo', { bar: { baz: 5 } });

    assert.deepEqual(c.target.foo, { bar: { baz: 5 } });
    assert.deepEqual(c.shallowEndpoint.foo, { bar: { baz: 5 } });

    c.target.foo = 'bar';
    assert.deepEqual(c.target.foo, 'bar');
    assert.deepEqual(c.shallowEndpoint.foo, 'bar');
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
      it('register(...)', () => {
        const target = {};
        const shallowEndpoint = {};
        const c = ReactiveStorage.register([ 'foo', 'bar', 'baz' ], undefined, { target, shallowEndpoint });
        assert.hasAllKeys(c, [ 'target', 'targets', 'shallowEndpoint' ]);
        assert.equal(c.target, target);
        assert.equal(c.targets[0], target);
        assert.equal(c.shallowEndpoint, shallowEndpoint);
      });
      it('registerRecursive(...)', () => {
        const target = {};
        const shallowEndpoint = {};
        const c0 = ReactiveStorage.register([ 'foo', 'bar', 'baz' ], undefined, { target, shallowEndpoint });
        const c1 = ReactiveStorage.registerRecursive([ 'foo', 'bar', 'baz' ], undefined, { target, shallowEndpoint });
        assert.equal(c0.target, c1.target);
        assert.equal(c0.shallowEndpoint, c1.shallowEndpoint);
        assert.deepEqual(c0.targets, c1.targets);
      });
      it('register(...) with multiple targets', () => {
        const target0 = {};
        const target1 = {};
        const target2 = {};
        const shallowEndpoint = {};
        const c = ReactiveStorage.register([ 'foo', 'bar', 'baz' ], undefined, [
          { target: target0 },
          { target: target1 },
          { target: target2, shallowEndpoint },
        ]);
        assert.equal(c.target, target0);
        assert.lengthOf(c.targets, 3);
        assert.equal(c.targets[0], c.target);
        assert.equal(c.targets[1], target1);
        assert.equal(c.targets[2], target2);
      });
    });
    describe('Instance', () => {
      it('Base', () => {
        const target = {};
        const shallowEndpoint = {};
        const s = create({ target, shallowEndpoint });
        const c = s.register('foo');
        assert.equal(c, s);
      });
    });
  });
});

describe('registerFrom(...)/registerRecursiveFrom(...)', () => {
  it('Base', () => {
    const obj = {
      foo: 3,
      bar: 4,
      baz: 'lor'
    };
    const c = ReactiveStorage.registerFrom(obj);
    assert.hasAllKeys(c.target, Object.keys(obj));
    assert.hasAllKeys(c.shallowEndpoint, Object.keys(obj));
    Object.entries(obj).forEach(([key, val]) => {
      assert.equal(c.target[key], val);
      assert.equal(c.shallowEndpoint[key], val);
    });
  });
  it('With Symbols', () => {
    const obj = {
      foo: 3,
      bar: 4,
      [Symbol.for('baz')]: 'lor'
    };
    const c = ReactiveStorage.registerFrom(obj);
    assert.equal(c.target[Symbol.for('baz')], 'lor');
    assert.equal(c.shallowEndpoint[Symbol.for('baz')], 'lor');
  });
  it('With multiple targets', () => {
    const obj = {
      foo: 3,
      bar: 4,
      [Symbol.for('baz')]: 'lor'
    };
    const c = ReactiveStorage.registerFrom(obj, [{}, {}, {}]);
    c.targets.forEach(target => {
      assert.hasAllKeys(target, [ ...Object.getOwnPropertySymbols(obj), ...Object.keys(obj) ]);
      assert.equal(target[Symbol.for('baz')], 'lor');
      Object.entries(obj).forEach(([key, val]) => {
        assert.equal(target[key], val);
      });
    });
    assert.hasAllKeys(c.shallowEndpoint, [ ...Object.getOwnPropertySymbols(obj), ...Object.keys(obj) ]);
  });
});

describe('delete(...)', () => {
  it('Correctly deletes from both `target` and `endpoint`', () => {
    const s = create();
    s.register([ 'foo', 'bar', 'baz' ], 3);
    assert.hasAllKeys(s.target, ['foo', 'bar', 'baz']);
    assert.hasAllKeys(s.shallowEndpoint, ['foo', 'bar', 'baz']);

    s.delete('foo');
    assert.hasAllKeys(s.target, ['bar', 'baz']);
    assert.hasAllKeys(s.shallowEndpoint, ['bar', 'baz']);
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
    assert.hasAllKeys(s.shallowEndpoint, ['foo', 'bar', 'baz']);

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
    assert.deepEqual(s.shallowEndpoint, {}, "Endpoint");
  });
  it('Store `endpoint` and `target` as instance properties', () => {
    const shallowEndpoint = [];
    const target = [];
    const s = create({ target, shallowEndpoint });
    assert.equal(s.shallowEndpoint, shallowEndpoint);
    assert.equal(s.target, target);
  });
  it('Instance `target` and `endpoint` point to config', () => {
    const s = create();
    assert.equal(s.target, s.config[0].target);
    assert.equal(s.shallowEndpoint, s.config.at(-1).shallowEndpoint);
  });
  describe('Config', () => {
    it('Store a shallow copy of a passed config as instance property', () => {
      const config = {
        shallowEndpoint: [],
        target: [],
      }
      const s = create(config);
      assert.isArray(s.config);
      assert.deepEqual(s.config, [ config ]);
      assert.equal(s.target, config.target);
      assert.equal(s.shallowEndpoint, config.shallowEndpoint);
    });
    it('Store a shallow copy of a passed definiton chain as instance property', () => {
      const config0 = {
        shallowEndpoint: [],
        target: [],
      };
      const config1 = {
        shallowEndpoint: {}
      };
      const config2 = {
        shallowEndpoint: {}
      };
      const s = create([ config0, config1, config2 ]);
      assert.lengthOf(s.config, 3);
      assert.deepEqual(s.config[0], config0);
      assert.hasAllKeys(s.config[0], [ 'shallowEndpoint', 'target' ]);
      assert.hasAllKeys(s.config[1], [ 'shallowEndpoint', 'target' ]);
      assert.hasAllKeys(s.config[2], [ 'shallowEndpoint', 'target' ]);
    });
  });
});

describe('Definition chains', () => {
  it('Correct instance properties', () => {
    const s = create([ {}, {}, {} ]);
    assert.lengthOf(s.config, 3);
    assert.lengthOf(s.targets, 3);
    assert.exists(s.shallowEndpoint);
    assert.equal(s.shallowEndpoint, s.config.at(-1).shallowEndpoint);
  });
  it('Correct calls', () => {
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
  it('Correct default chaining', () => {
    const s = create([ {}, {}, {} ]);
    assert.equal(s.config[0].shallowEndpoint, s.config[1].target);
    assert.equal(s.config[1].shallowEndpoint, s.config[2].target);
  });
  it('Correct chaining with passed values', () => {
    const target0 = [];
    const target1 = [];
    const target2 = [];
    const shallowEndpoint = {};
    const s = create([
      { target: target0 },
      { target: target1 },
      { target: target2, shallowEndpoint }
    ]);
    assert.equal(s.config[0].target, target0);
    assert.equal(s.config[1].target, target1);
    assert.equal(s.config[2].target, target2);
    assert.equal(s.config[0].shallowEndpoint, s.config[1].target);
    assert.equal(s.config[1].shallowEndpoint, s.config[2].target);
    assert.equal(s.config[2].shallowEndpoint, shallowEndpoint);
  });
  it('All defined `endpoints` except the last will be dropped', () => {
    const endpoint0 = {};
    const endpoint1 = [];
    const endpoint2 = {};
    const s = new ReactiveStorage([
      { shallowEndpoint: endpoint0 },
      { shallowEndpoint: endpoint1 },
      { shallowEndpoint: endpoint2 }
    ]);
    assert.notEqual(s.config[0].shallowEndpoint, endpoint0);
    assert.notEqual(s.config[1].shallowEndpoint, endpoint1);
    assert.deepEqual(s.config[0].shallowEndpoint, {});
    assert.deepEqual(s.config[1].shallowEndpoint, {});
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
      it('Base', () => {
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
      it('Deep', () => {
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
    describe('`set`', () => {
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
        assert.equal(c.shallowEndpoint.foo, 'lor');

        c.target.foo = 3;
        assert.equal(c.target.foo, 'lor');

        c.target.foo = -6;
        assert.equal(c.target.foo, -6);

        c.target.foo += 7;
        assert.equal(c.target.foo, 'lor');
      })
    });
    it('prevVal', () => {
      let start = false;
      const val = [10, 20];
      let { target } = ReactiveStorage.registerRecursive('foo', val, {
        setter: ({ val, prevVal }) => {
          if (start) {
            assert.deepEqual(val, [ [ 30, 40 ], 50 ]);
            assert.deepEqual(prevVal, [ 10, 20 ]);
          } else {
            assert.deepEqual(val, [10, 20]);
            assert.isUndefined(prevVal);
          }
        },
        depth: {
          setter: false
        }
      });

      start = true;
      target.foo = [ [ 30, 40 ], 50 ];
    });
  });
})

describe('PostSetter', () => {
  describe('Parameters', () => {
    describe('`prevVal`', () => {
      it('Should be the previous value when using default endpoints', () => {
        let start = false;
        let { target } = ReactiveStorage.registerRecursive('foo', [ 10, 20 ], {
          postSetter: ({ val, prevVal }) => {
            if (start) {
              assert.deepEqual(val, [ [ 30, 40 ], 50 ]);
              assert.deepEqual(prevVal, [ 10, 20 ]);
            } else {
              assert.deepEqual(val, [10, 20]);
              assert.isUndefined(prevVal);
            }
          },
          depth: {}
        });

        start = true;
        target.foo = [ [ 30, 40 ], 50 ];
      });
      it('Should be the previous value with custom endpoints', () => {
        let start = false;
        let { target } = ReactiveStorage.registerRecursive('foo', [ 10, 20 ], {
          shallowEndpoint: {},
          postSetter: ({ val, prevVal }) => {
            if (start) {
              assert.deepEqual(val, [ [ 30, 40 ], 50 ]);
              assert.deepEqual(prevVal, [ 10, 20 ]);
            } else {
              assert.deepEqual(val, [10, 20]);
              assert.isUndefined(prevVal);
            }
          },
          depth: {}
        });

        start = true;
        target.foo = [ [ 30, 40 ], 50 ];
      });
      it('Should be the previous value in the second target with custom endpoints', () => {
        let start = false;
        let { target } = ReactiveStorage.registerRecursive('foo', [ 10, 20 ], [
          {
            target: {},
          }, {
            shallowEndpoint: {},
            postSetter: ({ val, prevVal }) => {
              if (start) {
                assert.deepEqual(val, [ [ 30, 40 ], 50 ]);
                assert.deepEqual(prevVal, [ 10, 20 ]);
              } else {
                assert.deepEqual(val, [10, 20]);
                assert.isUndefined(prevVal);
              }
            },
            depth: {}
          }
        ]);

        start = true;
        target.foo = [ [ 30, 40 ], 50 ];
      });
    });
  })
});

describe('Configuration', () => {
  describe('Enumerability', () => {
    it('Should be enumerable by default', () => {
      const { target } = ReactiveStorage.register('foo', 3);
      assertIsEnumerable(target, 'foo');
    });
    it('Should be deeply enumerable by default', () => {
      const { target } = ReactiveStorage.registerRecursive('foo', { a: { b: 3 } });
      assertIsEnumerable(target, 'foo');
      assertIsEnumerable(target.foo, 'a');
      assertIsEnumerable(target.foo.a, 'b');
    });
    it('Should not be deeply enumerable as per the config', () => {
      const { target } = ReactiveStorage.registerRecursive('foo', { a: { b: 3 } }, {
        enumerable: false
      });
      assertIsNotEnumerable(target, 'foo');
      assertIsNotEnumerable(target.foo, 'a');
      assertIsNotEnumerable(target.foo.a, 'b');
    });
  });
  describe("Depth inheritance", () => {
    it('Should not inherit config with an explicit depth config (except `enumerable`)', () => {
      let post = 0;
      let set = 0;
      let get = 0;
      const config = {
        enumerable: false,
        postSetter: () => {
          post++;
        },
        setter: () => {
          set++;
        },
        getter: ({ val }) => {
          get++;
        },
        depth: {},
      };
      const c = ReactiveStorage.registerRecursive('foo', { a: { b: 3 } }, config);
      assert.equal(post, 1);
      assert.equal(set, 1);
      assert.equal(get, 0);

      c.target.foo;
      assert.equal(get, 1);

      assertIsNotEnumerable(c.target, 'foo');
      assertIsNotEnumerable(c.target.foo, 'a');
    });
    it('Should inherit config with a depth set to a number', () => {
      let post = 0;
      let set = 0;
      let get = 0;
      const config = {
        enumerable: false,
        postSetter: () => {
          post++;
        },
        setter: () => {
          set++;
        },
        getter: () => {
          get++;
        },
        depth: Infinity,
      };
      const c = ReactiveStorage.registerRecursive('foo', { a: { b: 3 } }, config);
      assert.equal(post, 3);
      assert.equal(set, 3);
      assert.equal(get, 0);

      c.target.foo.a.b;
      assert.equal(get, 3);

      assertIsNotEnumerable(c.target, 'foo');
      assertIsNotEnumerable(c.target.foo, 'a');
    });
  });
});

describe('Endpoint', () => {
  it('Base', () => {
    const c = ReactiveStorage.register('foo', 3);

    assertHasGetter(c.target, 'foo');
    assertHasValue(c.shallowEndpoint, 'foo');
  });
  it('Endpoint = {}', () => {
    const shallowEndpoint = {};
    const c = ReactiveStorage.register('foo', 3, { shallowEndpoint });

    assertHasGetter(c.target, 'foo');
    assertHasValue(shallowEndpoint, 'foo');

    c.target.foo = 'bar';
    assert.equal(shallowEndpoint.foo, 'bar');
  });
});
