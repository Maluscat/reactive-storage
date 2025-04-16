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
});

describe('setter/getter', () => {
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
  describe('param: initial', () => {
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
})

describe('Configuration', () => {
  describe('Default values', () => {
    it('endpoint', () => {
      const { config } = create();
      assert.isNotNull(config.endpoint);
      assert.equal(Object.getPrototypeOf(config.endpoint), Object.prototype);
    });
    it('target', () => {
      const { config } = create();
      assert.isNotNull(config.target);
      assert.equal(Object.getPrototypeOf(config.endpoint), Object.prototype);
    });
    it('enumerable', () => {
      const { config } = create();
      assert.isTrue(config.enumerable);
    });
    it('depthFilter', () => {
      const { config } = create();
      assert.equal(config.depthFilter, ReactiveStorage.Filter.objectLiteralOrArray);
    });
    it('depth', () => {
      const { config } = create();
      assert.equal(config.depth, 0);
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

    c.endpoint.foo.bar = 5;
    assert.equal(c.target.foo.bar, c.endpoint.foo.bar);
  });
});
