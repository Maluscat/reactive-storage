# ReactiveStorage
Register, observe and intercept deeply reactive data on any object without the
need for
[proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)!


```js
const storage = new ReactiveStorage({
  depth: Infinity,
  setter: ({ val, path }) => { console.log(`SET ${path.join('.')}:`, val) }
});
storage.register('foo');

storage.data.foo = {
  bar: 3,
  baz: [ 'a', 'b' ]
};
// SET foo: { ... }
// SET foo.bar: 3
// SET foo.baz: [ ... ]
// SET foo.baz.0: "a"
// SET foo.baz.1: "a"

storage.data.foo.bar++;
// SET foo.bar: 4

storage.data.foo.baz[1] = 'lor';
// SET foo.baz.1: "lor"
```


## Rationale
[Proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
are dope and allow for full reactivity, but they come with a significant
performance overhead. Even though JS is very fast nowadays, property accesses
add up quickly as they are used constantly and everywhere. Sure,
`ReactiveStorage` is somewhat limited when compared to proxies, but it can be
very powerful when used in the right spots!

I've also seen some sources claim deep reactivity to be impossible without using
proxies. Even Vue
[didn't support it](https://v2.vuejs.org/v2/guide/reactivity.html#For-Arrays)
before making the switch to proxies. Take that!


## Limitations
ReactiveStorage is explicitly not a catch-all solution for reactivity. Since it
purely relies on
[Object.defineProperty](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty),
it inherits all of its limitations too. These largely amount to:
- No dynamic approach; Data must be explicitly registered in order to become
  reactive.
- Only getters and setters; The data cannot be modified in-place using methods
  like `array.push(...)` or `array.splice(...)`.


## Installation
Since this library is completely runtime agnostic, it can be used inside any
JavaScript environment, including the web. The work on the library is mostly
finished, so there won't be many more updates in the future.

### Download
The only required file is `ReactiveStorage.js` inside the [`script`](./script)
folder. If you want type checking, fetch `ReactiveStorage.d.ts` as well!

### npm
Available on npm under `@maluscat/reactive-storage`. Use your favorite package
manager (or use it with Deno):
```sh
yarn add @maluscat/reactive-storage
bun install @maluscat/reactive-storage
npm install @maluscat/reactive-storage
```


## Concepts
A reactive property is defined via `Object.defineProperty` with attached
getters/setters. Properties are defined on a target object and store their
actual values at an arbitrary place, the endpoint.  In this library, the
endpoint is always an object, and a property's values are stored under the
property name within that endpoint (see below).

> [!note]
> In most of this document, "object" refers to *any* JavaScript object,
> be it an object literal, an array, a class instance, etc.

Let's say we register a reactive property "foo". The data flows like this:
```1c
# "foo" on target = {}

target.foo <-[GET]-- endpoint.foo
target.foo --[SET]-> endpoint.foo
```

Arrays work analogously since they are just objects with special syntax:
```1c
# "0" on target = []

target[0] <-[GET]-- endpoint[0]
target[0] --[SET]-> endpoint[0]
```

Deep reactivity is a recursive registration of object values to make their
children reactive as well. The properties of each distinct object are registered
into a new target object which their respective parents point to:
```1c
# "foo = { bar: 3, baz: 4 }" on target = {}
# implicit: target1 = {} with { GET/SET bar, GET/SET baz }

target.foo <-[GET]-- target1
target.foo --[SET]-> endpoint.foo

target1.bar <-[GET]-- endpoint.foo.bar
target1.bar --[SET]-> endpoint.foo.bar

target1.baz <-[GET]-- endpoint.foo.baz
target1.baz --[SET]-> endpoint.foo.baz
```

Looking only at the getters makes it a bit clearer:
```1c
# "foo = { bar: 3, baz: { lor: 10 } }" on target = {}
# implicit: target1 = {} with { GET/SET bar, GET/SET baz }
# implicit: target2 = {} with { GET/SET lor }

target.foo <-[GET]-- target1
target1.bar <-[GET]-- endpoint.foo.bar
target1.baz <-[GET]-- target2
target2.lor <-[GET]-- endpoint.foo.baz.lor
```


## Usage
The only non-typing exports are `ReactiveStorage`, `Filter` (also exposed via
`ReactiveStorage.Filter`) and, if needed, `ReactiveStorageError`:
```js
import { ReactiveStorage, Filter, ReactiveStorageError } from '@maluscat/reactive-storage';
```
See the [docs](#docs) for an overview of all additional typing related exports
for use in TypeScript.

ReactiveStorage can make objects deeply reactive such that any change within
arbitrarily deeply nested properties can be caught and intercepted. *Any* object
can be registered – though by default this is only the case for arrays and
object literals to avoid infinite recursion and unwanted overhead
(can be controlled with the `depthFilter` config option).

### Instanced vs. static approach
There are two ways to use this library: Using a `ReactiveStorage` instance or
using static methods.

An instance always holds a single immutable configuration which is passed in the
constructor and used every time a property is registered. The static methods
take the configuration on a per-registration basis as an additional argument.

A shallow copy of the used configuration with default values is stored in the
`config` instance property which can be used to access several implicit values,
such as the target if not explicitly passed. The target and endpoint are
additionally exposed via the `data` and `endpoint` properties respectively for
convenience.

```js
import { ReactiveStorage, Filter } from './ReactiveStorage.js';

const storage = new ReactiveStorage({
  target: {},
  endpoint: {},
  enumerable: true,
  depth: 0,
  depthFilter: Filter.objectLiteralOrArray,
  getter: undefined,
  setter: undefined,
  postSetter: undefined,
});
```

### Registering properties
The `register(...)` method is used to register one or multiple properties,
optionally with an initial value. When using a `depth` configuration, any value,
so either the initial value or values assigned at any later point in time, will
be recursively traversed and registered until the given depth as long as it
matches the `depthFilter` (only object literals and arrays by default).

#### Instance
The instance method uses the instance's configuration and returns itself, to
allow for chaining.
```ts
register(
  key: number | string | symbol,
  initialValue?: any
): ReactiveStorage
```

#### Static
The static method optionally takes a configuration and returns a shallow copy of
the final configuration with default and implicit values.
```ts
register(
  key: number | string | symbol,
  initialValue?: any,
  options: RegistrationOptions = {}
): TODO
```

`registerRecursive(...)` is a helper function that extends `register` with
infinitely deep recursion (same as `depth: Infinity` in the deepest `depth`).
```ts
registerRecursive(
  key: number | string | symbol,
  initialValue?: any,
  options?: RegistrationOptions = {}
): TODO
```

### Configuring deep values
The `depth` config option accepts either a number or a configuration. If given a
*number*, this will be the max depth until which assigned values will be made
reactive. In this case, each layer's configuration will be inherited from the
parent configuration, with the exception of the `target` and `endpoint` options.

A given *configuration* will define the options for that specific layer, which
is useful to specify individual getters/setters for each layer of depth. Missing
options will be inherited from its parent as described above. This setup can be
nested infinitely deep. To mitigate needing to do this extensively, you can also
make use of the getter/setter `path` argument (specifically, its length). [TODO link]

In this example, we define three explicit reactivity layers, each of which
defining an individual setter while inheriting the topmost getter. Layer 2
defines one additional implicit layer that will inherit its setter. Any layers
below that won't be reactive. Note how the `path` argument of the first two
setters always has the same length since they are not inherited downwards:
```ts
const storage = new ReactiveStorage({
  depth: {
    depth: {
      setter: ({ val, path }) => { console.log(`Layer 2 or 3 SET ${path.join('.')}:`, val) },
      depth: 1
    }
    setter: ({ val, path }) => { console.log(`Layer 1 SET ${path.join('.')}:`, val) },
  },
  setter: ({ val, path }) => { console.log(`Layer 0 SET ${path.join('.')}:`, val) },
  getter: ({ val, path }) => { console.log(`GET ${path.join('.')}:`, val) },
});

storage.register('foo', { bar: 3 });
// Layer 0 SET foo: { bar: 3 }
// Layer 1 SET foo.bar: 3

storage.data.foo = { bar: { baz: { lor: { val: 9 } } } }
// Layer 0      SET foo: { bar: ... }
// Layer 1      SET foo.bar: { baz: ... }
// Layer 2 or 3 SET foo.bar.baz: { lor: ... }
// Layer 2 or 3 SET foo.bar.baz.lor: { val: 9 }
/// <Layer 4 is not reactive>
```


### Initial assignment
The initial assignment will already call the specified `setter` and
`postSetter`. This can be filtered using the callbacks functions' `initial`
parameter.
```js
const storage = new ReactiveStorage({
  depth: Infinity,
  setter: ({ val, initial, path }) => {
    console.log(`${initial ? 'initial' : ''} SET ${path.join('.')}:`, val)
  },
  postSetter: ({ val, initial, path }) => {
    console.log(`${initial ? 'initial' : ''} POST-SET ${path.join('.')}:`, val)
  }
});

storage.register('foo', {
  bar: [ 10, 20 ],
  baz: {
    lor: 'my-string'
  }
});
// initial      SET foo: { bar: ..., baz: ... }
// initial      SET foo.bar: [ 10 ]
// initial      SET foo.bar.0: 10
// initial POST-SET foo.bar.0: 10
// initial POST-SET foo.bar: [ 10 ]
// initial      SET foo.baz: { lor: ... }
// initial      SET foo.baz.lor: "my-string"
// initial POST-SET foo.baz.lor: "my-string"
// initial POST-SET foo.baz: { lor: ... }
// initial POST-SET foo: { bar: ..., baz: ... }

storage.data.foo = 3;
//      SET foo: 3
// POST-SET foo: 3
```

### Reactivity is kept alive
The initial registration configuration is always kept alive, meaning that
reassigning a value will register it with the configuration used in its initial
registration. This also means that providing an initial value is optional – If
omitted, an initial setter call will not be invoked (same with explicitly
passing `undefined`).
```js
const storage = new ReactiveStorage({
  depth: Infinity,
  setter: ({ val, path }) => { console.log(`SET ${path.join('.')}:`, val) },
});

storage.register('foo');

storage.data.foo = 3;
// SET foo: 3

storage.data.foo = [ { lor: 69 }, 'bar', 'baz' ];
// SET foo: [ ... ]
// SET foo.0: { foo: 69 }
// SET foo.0.lor: 69
// SET foo.1: "bar"
// SET foo.2: "baz"
```

### Intercepting values
By default, a configured setter is a passive observer, so after being called,
the passed value will automatically be set to the property's respective
endpoint. However, a setter may return `true` to prevent the value from being
set. In addition to just dropping a value like this, a modified/custom value
can be assigned instead using the passed default setter `set`.

In this example, any value that isn't a number will be discarded, while numbers
will always be clamped to the range [0, 100]:
```ts
const storage = new ReactiveStorage({
  depth: Infinity,
  setter: ({ val, set }) => {
    if (typeof val !== 'number') return true;
    if (val > 100) {
      set(100);
      return true;
    } else if (val < 0) {
      set(0);
      return true;
    }
  },
});
storage.register('foo', 40);
console.log(storage.data.foo) // 40

storage.data.foo = -6;
console.log(storage.data.foo) // 0

storage.data.foo = 55;
console.log(storage.data.foo) // 55

storage.data.foo = 'bar'
console.log(storage.data.foo) // 55
```

### Instance helper functions
The `has(...)` instance method returns true if the given property key exists on
the instance's `data` and has thus been registered, false otherwise.
```ts
has(key: number | string | symbol): boolean
```

The `delete(...)` instance method deletes a registered property from the
instance's `data` and `endpoint`. Returns true if a property was successfully
deleted (speak, if the property had been registered), false otherwise.

TODO:
Although deep properties are not explicitly deleted, they will be garbage
collected since their target is referenced only by its endpoint and in the
getter and setter of its parent.
```ts
delete(key: number | string | symbol): boolean
```


## Configuration
### `getter`, `setter`, `postSetter`
Reactive properties are pretty useless without a way to react to changes.

`getter()`


### depth


### Endpoint




## Examples


## Docs
See the generated [docs](https://docs.malus.zone/reactive-storage/) for a more
in-depth overview of the library.
