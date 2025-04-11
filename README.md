# ReactiveStorage
Register, observe and intercept deeply reactive data without the need for
[proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)!


```js
const storage = new ReactiveStorage({
  getter: ({ path }) => { console.log(`GET ${path.join('.')}`) },
  setter: ({ val, path }) => { console.log(`SET ${path.join('.')}:`, val) }
});
storage.registerRecursive('foo', {
  bar: 3,
  baz: [ 'a', 'b', 'c' ]
});

// <Logs from initial assignments...>

storage.data.foo.bar++;
// GET foo
// GET foo.bar
// SET foo.bar: 4

storage.data.foo.baz[1] = 'lor';
// GET foo
// GET foo.baz
// SET foo.baz.1: lor
```


## Rationale
[Proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
are dope and allow for full reactivity, but they come with a significant
performance overhead. Even though JS is very fast nowadays, property accesses
add up quickly as they are used constantly and everywhere. Sure,
`ReactiveStorage` is somewhat limited when compared to proxies, but it can be
very powerful when used in the right spots.

I've also seen some sources claim deep reactivity to be impossible without using
proxies. Even Vue
[didn't support it](https://v2.vuejs.org/v2/guide/reactivity.html#For-Arrays)
before switching to proxies. Take that!


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


## Usage
The only non-typing-related exports are `ReactiveStorage`, `Filter` (also
exposed via `ReactiveStorage.Filter`) and, if needed, `ReactiveStorageError`:
```js
import { ReactiveStorage, Filter, ReactiveStorageError } from '@maluscat/reactive-storage';
```
See the [docs](#docs) for an overview of all additional typing related exports
for use in TypeScript.


### Basics
ReactiveStorage can make objects deeply reactive such that any change within
arbitrarily deeply nested properties can be caught and intercepted. *Any* object
can be traversed like this – though by default this is only the case for arrays
and object literals (see the `depthFilter` config option).

The initial assignment will already call the specified `setter` and
`postSetter`. This can be filtered using their `initial` parameter.
```js
const storage = new ReactiveStorage({
  getter: ({ path }) => {
    console.log(`GET ${path.join('.')}`)
  },
  setter: ({ val, initial, path }) => {
    console.log(`${initial ? 'initial' : ''} SET ${path.join('.')}:`, val)
  },
  postSetter: ({ val, initial, path }) => {
    console.log(`${initial ? 'initial' : ''} POST-SET ${path.join('.')}:`, val)
  }
});
storage.registerRecursive('foo', {
  bar: [ 10, 20, 30 ],
  baz: {
    lor: 'my-string'
  }
});

// <Initial SETs with `initial = true`>
```

#### Reactivity is kept alive
The initial registration configuration is always kept alive, meaning that
reassigning a value will register it with the configuration used in its initial
registration. This also means that providing an initial value is optional and
omitting it will not invoke an initial setter call (same with explicitly passing
`undefined`).
```js
const storage = new ReactiveStorage({
  setter: ({ val, initial, path }) => {
    console.log(`SET ${path.join('.')}:`, val)
  },
});
storage.registerRecursive('foo');

storage.data.foo = 3;
// SET foo: 3

storage.data.foo = [ { lor: 69 }, 'bar', 'baz' ];
// SET foo: [ ... ]
// SET foo.0: { foo: 69 }
// SET foo.0.lor: 69
// SET foo.1: "bar"
// SET foo.2: "baz"
```


### Instanced approach
An instance always holds a single immutable configuration which is passed in the
constructor and that is applied every time a property is registered. This makes
an instance a convenient way to register multiple properties with the same
configuration.

A shallow copy of the used configuration with default values is stored in the
`config` property. The target and endpoint are additionally exposed via the
`data` and `endpoint` properties respectively.

#### Constructor
The constructor optionally takes the configuration that will be used by the
`ReactiveStorage` instance. Every property is optional and some will assume a
default value if unspecified, as shown here:
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

#### `register(...)`
Register a property key with an initial value. When using a `depth`
configuration, the initial value will be recursively traversed and registered
until the given depth.

Returns the current instance to allow for chaining.
```ts
register(
  key: number | string | symbol,
  initialValue?: any
): ReactiveStorage
```

#### `registerRecursive(...)`
This method is the same as [`register(...)`](#register-method) but every
property is registered with infinitely deep reactivity.
Calling this method is equivalent to a `depth` configuration of `Infinity`
within the deepest nested `depth`.

Returns the current instance to allow for chaining.
```ts
registerRecursive(
  key: number | string | symbol,
  initialValue?: any
): ReactiveStorage
```


#### `has(...)`
Returns true if the given property key exists on the instance's
`data` and has thus been registered, false otherwise.
```ts
has(key: number | string | symbol): boolean
```

#### `delete(...)`
Deletes a registered property from the instance's `data` and `endpoint`. Returns
true if a property was successfully deleted (speak, if the property had been
registered), false otherwise.

Although deep properties are not explicitly deleted, they will be garbage
collected since their target is referenced only by its endpoint and in the
getter and setter of its parent.
```ts
delete(key: number | string | symbol): boolean
```


### Static approach
This approach is useful when needing to register one-off data without the need
for keeping state of data and endpoint.

#### `register(...)`
Register a property key with an initial value using the specified configuration.

Returns a deep copy of the used configuration (with default values where
previously unspecified).
```ts
register(
  key: number | string | symbol,
  initialValue?: any,
  options: RegistrationOptions = {}
): TODO
```

#### `registerRecursive(...)`
This method is the same as [`register(...)`](#register-method) but every
property is registered with infinitely deep reactivity.

Returns a deep copy of the used configuration (with default values where
previously unspecified).
```ts
registerRecursive(
  key: number | string | symbol,
  initialValue?: any,
  options?: RegistrationOptions = {}
): TODO
```



## Configuration
### `getter`, `setter`, `postSetter`
Reactive properties are pretty useless without a way to react to changes.

`getter()`


### depth


### Endpoint


## Concepts
A reactive property is a property defined via `Object.defineProperty` with
attached getters/setters. Properties are defined on a target object and store
their actual values at an arbitrary place, the endpoint.
In this library, the endpoint is always an object, and definite values are
stored under the property name within that endpoint (see below).

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
children reactive as well. The properties of each distinct object within a
hierarchy are registered into a new target object (only the topmost target is
exposed). 
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

Since the setters never traverse any hierarchy, looking only at the getters
makes it a bit clearer:
```1c
# "foo = { bar: 3, baz: { lor: 10 } }" on target = {}
# implicit: target1 = {} with { GET/SET bar, GET/SET baz }
# implicit: target2 = {} with { GET/SET lor }

target.foo <-[GET]-- target1
target1.bar <-[GET]-- endpoint.foo.bar
target1.baz <-[GET]-- target2
target2.lor <-[GET]-- endpoint.foo.baz.lor
```


## Examples


## Docs
See the generated [docs](https://docs.malus.zone/reactive-storage/) for a more
in-depth overview of the library.
