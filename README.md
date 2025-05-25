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

storage.target.foo = {
  bar: 3,
  baz: [ 'a', 'b' ]
};
// SET foo: { ... }
// SET foo.bar: 3
// SET foo.baz: [ ... ]
// SET foo.baz.0: "a"
// SET foo.baz.1: "a"

storage.target.foo.bar++;
// SET foo.bar: 4

storage.target.foo.baz[1] = 'lor';
// SET foo.baz.1: "lor"
```


## Contents
- [Rationale](#rationale)
- [Limitations](#limitations)
- [Installation](#installation)
- [Concepts](#concepts)
- [Usage](#usage)
  - [Instanced vs. static](#instanced-vs-static-approach)
  - [Registering properties](#registering-properties)
  - [Configuring deep values](#configuring-deep-values)
  - [Reactivity is kept alive](#reactivity-is-kept-alive)
  - [Initial assignment](#initial-assignment)
  - [Intercepting values](#intercepting-values)
  - [Multiple sequential targets](#multiple-sequential-targets)
  - [Instance helper functions](#instance-helper-functions)
  - [Using with types](#using-with-types)
- [Configuration](#configuration)
- [Examples](#examples)
- [Docs](#docs)


## Rationale
[Proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
are dope and allow for full reactivity, but they come with a significant
performance overhead. Even though JS is very fast nowadays, property accesses
add up quickly as they are used constantly and everywhere. Sure,
ReactiveStorage is somewhat limited when compared to proxies, but it can be
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

Instead of only having a single target that points to an endpoint, we can
scale horizontally by sequentially routing a value through
[multiple targets](#multiple-sequential-targets):
```1c
# "foo" on:
# 1. target0 = {}
# 2. target1 = {}

target0.foo <-[GET]-- target1.foo <-[GET]-- endpoint.foo
target0.foo --[SET]-> target1.foo --[SET]-> endpoint.foo
```

[Deep reactivity](#configuring-deep-values) is a recursive registration of
object values to make their children reactive as well (vertical scaling). The
properties of each distinct object are registered into a new storage object
which their respective parents point to:
```1c
# "foo = { bar: 3, baz: 4 }" on target = {}
# implicit: storage1 = {} with { GET/SET bar, GET/SET baz }

target.foo <-[GET]-- storage1
target.foo --[SET]-> endpoint.foo

storage1.bar <-[GET]-- endpoint.foo.bar
storage1.bar --[SET]-> endpoint.foo.bar

storage1.baz <-[GET]-- endpoint.foo.baz
storage1.baz --[SET]-> endpoint.foo.baz
```

Looking only at the getters makes it a bit clearer:
```1c
# "foo = { bar: 3, baz: { lor: 10 } }" on target = {}
# implicit: storage1 = {} with { GET/SET bar, GET/SET baz }
# implicit: storage2 = {} with { GET/SET lor }

target.foo <-[GET]-- storage1
storage1.bar <-[GET]-- endpoint.foo.bar
storage1.baz <-[GET]-- storage2
storage2.lor <-[GET]-- endpoint.foo.baz.lor
```


## Usage
The only non-typing exports are `ReactiveStorage`, `Filter` (also exposed via
`ReactiveStorage.Filter`) and, if needed, `ReactiveStorageError`:
```js
import { ReactiveStorage, Filter, ReactiveStorageError } from '@maluscat/reactive-storage';
```
See the [docs](#docs) for an overview of all additional typing related exports
for use in TypeScript.

ReactiveStorage can make properties reactive such that they invoke callbacks
whenever they are accessed or assigned to. In addition, object values can be
made [deeply reactive](#configuring-deep-values) – This allows any change within
arbitrarily deeply nested properties to be caught and intercepted. *Any* object
can be deeply registered, though by default only arrays and object literals will
propagate to avoid infinite recursion and unwanted overhead (can be controlled
with the [`depthFilter`](#depthfilter) config option). In addition, properties
can be sequentially routed through
[multiple targets](#multiple-sequential-targets), each with their own
configuration.

### Instanced vs. static approach
There are two ways to use this library: Using a `ReactiveStorage` instance or
using static methods.

An instance always holds a single immutable [configuration](#configuration)
which is passed in the constructor and used every time a property is registered.
The static methods take the configuration on a per-registration basis as an
additional argument.

The used configuration is stored in the `config` instance property. The
target(s) and endpoint are additionally exposed via the `targets`, `target` and
`endpoint` properties respectively. `target` always points to the first item of
`targets`, so unless you're using
[multiple targets](#multiple-sequential-targets), you can always use that one.

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
The `register(...)` and `registerFrom(...)` methods are used to register one or
multiple properties. When using a `depth` configuration, any value, so either
the initial value or values assigned at any later point in time, will be
recursively traversed and registered until the given depth as long as it matches
the `depthFilter` (only object literals and arrays by default). See the
[examples](#examples) for more info.

#### Instance
The instance method `register(...)` uses the instance's
[configuration](#configuration) and returns the instance to allow for chaining.
The initial value is optional.
```ts
register(
  key: number | string | symbol | (number | string | symbol)[],
  initialValue?: any
): ReactiveStorage
```

`registerFrom(...)` can be used to register all properties (including symbols)
of a given object on the instance's target.
```ts
registerFrom(data: object): ReactiveStorage
```

#### Static
The static methods optionally take a [configuration](#configuration) and return
an object containing the used targets and endpoint, in which `target` points to
the first item in `targets`.
```ts
register(
  key: number | string | symbol | (number | string | symbol)[],
  initialValue?: any,
  options: RegistrationOptions = {}
): { targets: object[], target: object, endpoint: object }
```
```ts
registerFrom(
  data: object,
  options: RegistrationOptions = {}
): { targets: object[], target: object, endpoint: object }
```

There are helper functions to extend each of the above defined functions with
infinitely deep recursion (same as `depth: Infinity` in the deepest `depth`).
```ts
registerRecursive(
  key: number | string | symbol | (number | string | symbol)[],
  initialValue?: any,
  options?: RegistrationOptions = {}
): { targets: object[], target: object, endpoint: object }
```
```ts
registerRecursiveFrom(
  data: object,
  options: RegistrationOptions = {}
): { targets: object[], target: object, endpoint: object }
```

### Configuring deep values
To register a property deeply, you can use the `depth` config option which
accepts either a number or a configuration. A deep configuration will again
register any properties (including symbols) of an assigned object, provided that
it matches the [`depthFilter`](#depthfilter) config option.

If given a *number*, this will be the max depth until which assigned values will
be made reactive. In this case, a layer's configuration will be inherited from
the parent config, with the exception of the `target` and `endpoint` options.

A given *configuration* will define options for that specific layer, which is
useful to specify individual getters/setters for each layer of depth. The
`target` option may not be specified since it will change with each new
assignment. Missing options except `endpoint` and `target` will be inherited
from its parent unless explicitly set to `false`. This setup can be nested
infinitely deep. To mitigate needing to extensively nest depth configurations,
you can also make use of the [getter/setter](#setter) `path` argument
(specifically, its length).

In this example, three explicit reactivity layers are defined, each of which
defining an individual setter while inheriting the topmost getter. Layer 2
defines one additional implicit layer. Any layers below that won't be reactive.
Note how the `path` argument of the first two setters always has the same length
since they are not inherited downwards:
```js
const storage = new ReactiveStorage({
  depth: {
    depth: {
      setter: ({ val, path }) => { console.log(`Layer 2 or 3 SET ${path.join('.')}:`, val) },
      depth: 1
    },
    setter: ({ val, path }) => { console.log(`Layer 1 SET ${path.join('.')}:`, val) },
  },
  setter: ({ val, path }) => { console.log(`Layer 0 SET ${path.join('.')}:`, val) },
  getter: ({ val, path }) => { console.log(`GET ${path.join('.')}:`, val) },
});

storage.register('foo', { bar: 3 });
// Layer 0 SET foo: { bar: 3 }
// Layer 1 SET foo.bar: 3

storage.target.foo = { bar: { baz: { lor: { val: 9 } } } }
// Layer 0      SET foo: { bar: ... }
// Layer 1      SET foo.bar: { baz: ... }
// Layer 2 or 3 SET foo.bar.baz: { lor: ... }
// Layer 2 or 3 SET foo.bar.baz.lor: { val: 9 }
/// <Layer 4 and downwards is not reactive>
```

### Reactivity is kept alive
The initial registration [configuration](#configuration) is always kept alive,
meaning that reassigning a value will register it with the configuration used in
its initial registration. This also means that providing an initial value is
optional – If omitted, an initial setter call will not be invoked (same with
explicitly passing `undefined`).
```js
const storage = new ReactiveStorage({
  depth: Infinity,
  setter: ({ val, path }) => { console.log(`SET ${path.join('.')}:`, val) },
});

storage.register('foo');

storage.target.foo = 3;
// SET foo: 3

storage.target.foo = [ { lor: 69 }, 'bar', 'baz' ];
// SET foo: [ ... ]
// SET foo.0: { foo: 69 }
// SET foo.0.lor: 69
// SET foo.1: "bar"
// SET foo.2: "baz"
```

### Initial assignment
The initial assignment will already call the specified `setter` and `postSetter`
(unless the initial value is omitted or `undefined`). This can be filtered using
the callback functions' `initial` parameter.
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

storage.target.foo = 3;
//      SET foo: 3
// POST-SET foo: 3
```

### Intercepting values
By default, a configured **setter** is a passive observer, so after being called,
the passed value will automatically be set to the property's respective
endpoint. However, a setter may return `true` to prevent the value from being
set. In addition to just dropping a value like this, a modified/custom value
can be assigned instead using the passed default setter `set`.

A **getter** analogously only observes the fetched values passively by default,
being given the value of the underlying endpoint when a property is fetched.
Any return value other than a nullish value (`null` or `undefined`) will yield
this value to the caller.

In this example, any assigned value that isn't a number will be discarded, while
numbers will always be clamped to the range [0, 100]. When fetched, they will be
rounded to the nearest 5:
```js
const storage = new ReactiveStorage({
  depth: Infinity,
  getter: ({ val }) => {
    return Math.round(val / 5) * 5;
  },
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
storage.register('foo', 38);
console.log(storage.endpoint.foo) // 38
console.log(storage.target.foo) // 40

storage.target.foo = -6;
console.log(storage.endpoint.foo) // 0
console.log(storage.target.foo) // 0

storage.target.foo = 52;
console.log(storage.endpoint.foo) // 52
console.log(storage.target.foo) // 50

storage.target.foo = 'bar'
console.log(storage.endpoint.foo) // 52
console.log(storage.target.foo) // 50
```

### Multiple sequential targets
By passing not just one but multiple configuration objects, it's easy to setup
multiple target points, each with their own configuration, that a value is
sequentially routed through until it reaches the endpoint. This is also
explained in [Concepts](#concepts) as horizontal scaling. Only the last
configuration may define the `endpoint` property – In all others, it will be
overridden.

All defined targets (one for each passed configuration) are stored in the
`targets` property of either the returned data when using the static methods or
of the created instance. The `target` property always points to the first
element in `targets` and can be conveniently used when only one target has been
defined.

Here, two layers are defined. The first does high-level work such as validating
its values while the second does some mandatory operations. In one possible
scenario, the first target could be exposed to the user as a high-level
interface while the second is used for internal purposes where the validity of
an assigned value is already ensured:
```js
const storage = new ReactiveStorage([
  {
    setter: ({ val }) => {
      return !inputIsValid(val);
    },
  }, {
    setter: ({ val, path }) => {
      propertyHasNewValue(path, val);
    },
  }
]);

storage.register('foo');

storage.targets[0].foo = 3;
// First go through `inputIsValid`, then `propertyHasNewValue`

storage.targets[1].foo = 4;
// Only `propertyHasNewValue` is called
```

### Instance helper functions
The `has(...)` instance method returns true if the given property key exists on
the instance's `target` and has thus been registered, false otherwise.
```ts
has(key: number | string | symbol): boolean
```

The `delete(...)` instance method deletes a registered property from the
instance's `target` and `endpoint`. Returns true if a property was successfully
deleted (speak, if the property had been registered), false otherwise.

Deep properties will not be deleted because the class does not hold a reference
to them. As such, they will be garbage collected instead.
```ts
delete(key: number | string | symbol): boolean
```

### Using with types
Since TypeScript is an entirely static language, there is no way to propagate
type information from an instance method to an instance property. This is why,
without additional information, only the `target`/`targets` returned by the two
static methods `ReactiveStorage.register(...)` and
`ReactiveStorage.registerRecursive(...)` knows about the registered properties.

To supply additional type information, a property-value interface can be passed
as a generic to the `ReactiveStorage` class or the static methods mentioned
above. This is the best I can do since Typescript generics are quite limited
(I'd be happy to be convinced of the contrary!).

```ts
interface Properties {
  foo: number
  bar: string[]
  baz: Array<number> | number
}

const storage = new ReactiveStorage<Properties>();
storage.register('lor');     // ERROR: Not a known property!
storage.register('bar', {}); // ERROR: Type for 'bar' does not match!
storage.register('foo', 4);

// `storage.target` is typed to contain the properties
// 'foo', 'bar', 'baz' and their respective types

// Analogously:
ReactiveStorage.register<Properties>('foo', 4);
```


## Configuration
The configuration can either be passed to the constructor or to the static
methods. See here a summarized version of its interface with the full one
available at the [docs](#docs) (along with more examples). All fields are
optional.

### `target`
- Type: `object`
- Default: `{}`

The access point for the registered property/properties. Values are deposited at
the [endpoint](#endpoint). Can be *any* object, so it may also be an array, a
class instance, etc.

This property may only be defined in the topmost level of a configuration and
not within [`depth`](#depth) since these change on each assignment.

### `endpoint`
- Type: `object`
- Default: `{}`

The object that holds the actual data of registered properties.
The configured setter and getter will deposit the value to and fetch the
value from this endpoint respectively.

Can be accessed directly to bypass all specified setters and getters. In a
classic use case, it can be a good idea to use the endpoint for internal use,
while the setters/getters on the target do some extra work when accessed by a
user.

### `enumerable`
- Type: `boolean`
- Default: `true`

Whether registered properties should be enumerable inside the [target](#target).
Corresponds to the
[`Object.defineProperty` option](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty#enumerable)
of the same name.

### `depth`
- See also [Configuring deep values](#configuring-deep-values)
- Type: `Configuration | number`
- Default: `0`

Whether and how keys inside object values should be registered such that they go
through additional layers of getters and setters. If a value is reassigned, it
is re-registered with the same configuration until the configured depth.

**If given a configuration**, the registered property will assume these options
in its layer and inherit missing ones unless set to `false`. Can be nested
infinitely deep.

**If given a number**, keys will be registered recursively up until the given
depth, inheriting the parent options. Can be `Infinity`.

### `depthFilter`
- Type: `(obj: object, path: Array<string | symbol>) => boolean`
- Default: `Filter.objectLiteralOrArray`

Decide whether to deeply register an object covered by [`depth`](#depth).
This is useful to mitigate registering properties within *any* object (class
instances, DOM nodes, etc.) in favor of simpler objects.

Be careful when changing this, especially when there is user input involved!
Unrestricted recursion may lead to a significant overload or even an infinite
loop when (accidentally) assigning complex objects like a DOM node.

### `postSetter`
- Type: `(event: PostSetterEvent) => void`

Called *after* a value has been set.

The passed event object has the following properties:
- `val`: The value that was set
- `prevVal`: The previous value
- `initial` (`boolean`): Whether this call is propagated by the initial
    registration
- `path` (`Array<string | symbol>`): Key path of the property that was set

### `setter`
- See also [Intercepting values](#intercepting-values)
- Type: `(event: SetterEvent) => void | boolean`

Called *before* a value is set. Return `true` to discard the value, i.e. to stop
the default action of setting the value to the underlying endpoint.

The passed event object has the following properties:
- `val`: The value that will be set (unless discarded)
- `prevVal`: The previous value
- `initial` (`boolean`): Whether this call is propagated by the initial
    registration
- `path` (`Array<string | symbol>`): Key path of the property that was set
- `set` (`(val) => void`): Default setter that sets a given value to the
    underlying endpoint. When using it, you should prevent the default value
    from being set by returning `true`.

### `getter`
- See also [Intercepting values](#intercepting-values)
- Type: `(event: GetterEvent) => void | any`

Called anytime a value is fetched. Return `null` or `undefined` to propagate the
default value. Any other return value will be the property's value.

As inferred in [Concepts](#concepts), deep properties require a lot of `getter`
calls, so when using depth extensively, you should probably keep inherited
getter functions lightweight.

The passed event object has the following properties:
- `val`: The value from the underlying endpoint
- `path` (`Array<string | symbol>`): Key path of the property that was set


## Examples
### Basic example using `registerFrom`
Using `registerFrom` to register every property of a predefined object. Notice
how `"bar"` does not invoke an initial setter call since its initial value is
undefined.
```js
const data = {
  foo: 3,
  bar: undefined,
  [Symbol.for('baz')]: 'unique Symbol!'
};

// We just extract `target` because we only have a single target
// and don't care about `endpoint`
const { target } = ReactiveStorage.registerFrom(data, {
  setter: ({ val, path }) => { console.log(`${path}: ${val}`) }
});
// ['foo']: 3
// Symbol: 'unique Symbol!'
```

### Deep arrays with `registerFrom` and multiple targets
Arrays work analogously. Here we use a nested depth configuration and multiple
targets. We assume that we only ever work with arrays in this scenario, so we
set each target to an empty array as opposed to an empty object literal (even
though both are functionally equivalent).

The first target simply reports the values it gets. The second caps any received
number to 100 and the third discards any strings set *in the first vertical layer*
since it does not configure any depth. Keep in mind that getters and setters
propagate in contrary directions, so a setter trickles down: `target[0] ->
target[1] -> target[2] -> endpoint` while a getter bubbles up: `target[0] <-
target[1] <- target[2] <- endpoint`.
```js
const data = ReactiveStorage.registerFrom([ 0, 1, 2, 3 ], [
  {
    target: [],
    depth: {
      getter: false
    },
    getter: ({ val }) => {
      console.log("Layer 0:", val);
    }
  }, {
    target: [],
    depth: 1,
    getter: ({ val }) => {
      if (typeof val === 'number') {
        return Math.min(val, 100);
      }
    }
  }, {
    target: [],
    setter: ({ val }) => {
      if (typeof val === 'string') {
        console.log("Dropping string!");
        return true;
      }
    },
    getter: ({ val }) => {
      console.log("Layer 2:", val);
    }
  }
]);

/* Getters invoked by setting a value have been omitted */
console.log(data.targets[0][0]); // 0
// Layer 2: 0
// Layer 0: 0
data.targets[0][0] = 120;
console.log(data.targets[0][0]); // 100
// Layer 2: 120
// Layer 0: 100
console.log(data.targets[2][0]); // 120
// Layer 2: 120

data.targets[0][1] = [ 200 ];
console.log(data.targets[0][1][0]); // 100
// Layer 0: 100

data.targets[0][2] = -3;
data.targets[0][2] = 'foobar';
// Dropping string!
console.log(data.targets[0][2]); // -3
// Layer 2: -3
// Layer 0: -3
```

### Register deep properties using an instance
This example makes use of a `ReactiveStorage` instance instead of calling a
static registration method directly. This gives us the ability to register
multiple properties as well as delete them again at any time.

Here, the setters of the first two depth layers are configured manually while
changes in layer 2 and below invoke a catch-all setter. Property paths (and with
that, also their depth) can be determined by the `path` argument. If the
respective depth was set to, say, `2` instead of `Infinity`, only layers 2, 3
and 4 would be made reactive (the defined depth layer + 2).
```js
const storage = new ReactiveStorage({
  depth: {
    depth: {
      depth: Infinity,
      setter: ({ val, path }) => {
        console.log(`Catch-all layer ${path.length - 1}:`, val);
      }
    },
    setter: ({ val }) => {
      console.log("Layer 1:", val);
    }
  },
  setter: ({ val }) => {
    console.log("Layer 0:", val);
  }
});

storage
  .register(['foo', 'bar', 'baz'])
  .register('lor', 3);
// Layer 0: 3

storage.target.foo = {
  foo1: {
    foo2: {
      foo3: [ 10, 20, 30 ]
    }
  }
};
// Layer 0: { foo1: ... }
// Layer 1: { foo2: ... }
// Catch-all layer 2: { foo3: ... }
// Catch-all layer 3: [ 10, 20, 30 ]
// Catch-all layer 4: 10
// Catch-all layer 4: 20
// Catch-all layer 4: 30
```


## Docs
See the generated [docs](https://docs.malus.zone/reactive-storage/) for a more
in-depth overview of the library.
