export type ObjectKey = number | string | symbol;
export type Data = Record<ObjectKey, any> | Array<any>;
export type Endpoint = Record<ObjectKey, any> | Map<ObjectKey, any>;
export type FilterFunction = (obj: object, path: ObjectKey[]) => boolean;

export interface GetterArgs {
  /** Value to be set. */
  val: any;
  /**
   * Key path of the value in question, starting with the registered key.
   *
   * @example
   * ```js
   * const storage = new ReactiveStorage();
   * storage.register('value', { first: { second: 3 } }, {
   *   getter: ({ path }) => { console.log("GET:", path) },
   *   depth: Infinity
   * });
   *
   * // <Logs from the initial assignment...>
   *
   * storage.data.value.first.second;
   * // "GET: ['value']"
   * // "GET: ['value', 'first']"
   * // "GET: ['value', 'first', 'second']"
   * ```
   */
  path: ObjectKey[];
}
export interface SetterArgs {
  /** Value to be set. */
  val: any;
  /** Previous value. */
  prevVal: any;
  /**
   * Key path of the value in question, starting with the registered key.
   *
   * @example
   * ```js
   * const storage = new ReactiveStorage();
   * storage.register('value', { first: { second: 3 } }, {
   *   setter: ({ path }) => { console.log("SET:", path) },
   *   depth: Infinity
   * });
   *
   * // <Logs from the initial assignment...>
   *
   * storage.data.value.first.second = 4
   * // "SET: ['value', 'first', 'second']"
   * ```
   */
  path: ObjectKey[];
}

export type RegistrationOptions = Partial<RegistrationOptionsWhole>
export interface RegistrationOptionsWhole {
  /**
   * Whether the value should be enumerable inside {@link ReactiveStorage.data}.
   * Corresponds to {@link PropertyDescriptor.enumerable}.
   * @default true
   */
  enumerable: boolean;
  /**
   * Whether and how keys inside any object or array value should be registered
   * such that they go through additional layers of getters and setters.
   * If a value is reassigned, it is re-registered with the same configuration
   * until the given depth. The immediate registered value is depth 0.
   *
   * If given *registration options*, the registered key configuration will
   * assume these options in their layer. Can be nested infinitely deep.
   *
   * If given *a number*, keys will be registered recursively up until
   * the given depth, assuming the options present in the given scope.
   * Can be {@link Infinity}.
   * 
   * @example Different options from layer 2 onwards
   * ```js
   * const storage = new ReactiveStorage();
   * storage.register('recursive', { first: { second: 3 } }, {
   *   setter: val => { console.log("First layer:", val) },
   *   depth: {
   *     setter: val => { console.log("Further layer:", val) },
   *     depth: Infinity
   *   }
   * });
   *
   * // <Logs from the initial assignment...>
   *
   * storage.data.recursive = { first2: { second2: 69 } };
   * // "First layer: { first2: { second2: 69 } }"
   * // "Further layer: { second2: 69 }"
   * // "Further layer: 69"
   *
   * storage.data.recursive.first2 = 70;
   * // "Further layer: 70"
   * ```
   *
   * @example Re-register a deep value
   * Even though the initial hierarchy is temporarily deleted by assigning a
   * primitive value of "4", another reassigned value is simply re-registered
   * with the initial configuration (note that since the `depth` is merely set
   * to 1, any potential value inside `second2` will not be reactive).
   * ```js
   * const storage = new ReactiveStorage();
   * storage.register('value', { first: { second: 3 } }, {
   *   setter: val => { console.log("SET", val) },
   *   depth: 1
   * });
   *
   * // "SET { first: { second: 3 } }"
   * // "SET { second: 3 }"
   *
   * storage.data.value = 4
   * // "SET 4"
   *
   * storage.data.value = { first2: { second2: { third2: 'foobar' } } }
   * // "SET { first2: { second2: { third2: 'foobar' } } }"
   * // "SET second2: { third2: 'foobar' } }"
   * ```
   *
   * @default 0
   */
  depth: number | RegistrationOptions;
  /**
   * Decide whether to deeply register an object covered by {@link depth}.
   * This is useful to mitigate registering properties within *any* object
   * (class instances, DOM nodes, etc.) in favor of, for example, only object
   * literals or arrays – especially when making use of an infinite depth.
   *
   * Be careful when changing this, especially when there is user input
   * involved! Unrestricted recursion may lead to a significant overload
   * or even an infinite loop when (accidentally) assigning huge objects
   * like a DOM node.
   *
   * Just like all other configuration options, this will be passed down
   * into any depth unless overridden.
   *
   * @remarks
   * {@link Filter} provides some useful filter functions.
   *
   * @example
   * The first layer will accept any object, depth 1 and below accept
   * only object literals or arrays.
   * ```js
   * const storage = new ReactiveStorage();
   * storage.registerRecursive('value', 420, {
   *   setter: val => { console.log("SET", val) },
   *   depthFilter: Filter.any,
   *   depth: {
   *     depthFilter: Filter.objectLiteralOrArray
   *   }
   * });
   * ```
   *
   * @default {@link Filter.objectLiteralOrArray}
   */
  depthFilter: FilterFunction;
  /**
   * The endpoint that the registered property points to, so an object that the
   * configured setter and getter will deposit the value to and fetch the value
   * from, respectively.
   *
   * @default The current {@link ReactiveStorage}'s {@link ReactiveStorage.endpoint}
   *          or a new object if called statically.
   */
  endpoint: Endpoint;
  /**
   * Called *after* a value has been set.
   */
  postSetter: (args: SetterArgs) => void;
  /**
   * Called *before* a value is set.
   *
   * Return `true` to stop the value from being set.
   * This can be useful to filter specific values or when setting them manually
   * in the setter.
   */
  setter: (args: SetterArgs) => void | boolean;
  /**
   * Called anytime a value is fetched.
   *
   * @remarks
   * This is potentially called a lot since, as per the getter/setter hierarchy,
   * any deep value *set* needs to *get* the respective value from a layer above.
   *
   * @example
   * ```js
   * const storage = new ReactiveStorage();
   * storage.register('value', { first: { second: 3 } }, {
   *   getter: val => { console.log("GET", val) },
   *   depth: Infinity
   * });
   *
   * storage.data.value.first.second = 8
   * // "GET { first: { second: 3 } }"
   * // "GET { second: 8 }"
   * // "GET 8"
   * ```
   */
  getter: (args: GetterArgs) => any;
}

export class ReactiveStorageError extends Error {
  constructor(...args: any[]) {
    super(...args);
    this.name = this.constructor.name;
  }
}

/**
 * Provides some useful filter functions for use in
 * {@link RegistrationOptions.depthFilter}.
 *
 * Also exposed via {@link ReactiveStorage.Filter}.
 */
export const Filter = {
  /** Matches only object literals and arrays. */
  objectLiteralOrArray: obj => {
    return obj != null && (Array.isArray(obj) || Object.getPrototypeOf(obj) === Object.prototype);
  },
  /** Matches everything (always returns true). */
  any: () => true,
} as const satisfies Record<string, FilterFunction>;

export class ReactiveStorage {
  /** @see {@link Filter} */
  static readonly Filter = Filter;
  /**
   * Endpoint holding the actual values of the registered properties.
   * 
   * Values should not be overridden.
   */
  readonly endpoint;
  /**
   * Access point for registered properties.
   * Can be customized in the constructor.
   */
  readonly data;

  /**
   * @param data The {@link ReactiveStorage.data} object that represents
   *             the access point for the registered properties.
   * @param endpoint The {@link ReactiveStorage.endpoint} that holds the
   *                 actual registered data.
   */
  constructor(data: Data = {}, endpoint: Endpoint = {}) {
    this.data = data || {};
    this.endpoint = endpoint || {};
  }

  /** Check for existence of a registered property on {@link data}. */
  has(key: ObjectKey) {
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }
  /** Delete {@link data} and {@link endpoint} entry of a registered property. */
  delete(key: ObjectKey) {
    if (this.has(key)) {
      if (this.endpoint instanceof Map) {
        this.endpoint.delete(key);
      } else {
        delete this.endpoint[key];
      }
      // @ts-ignore Checked for property existence above
      delete this.data[key];
      return true;
    }
    return false;
  }

  /**
   * Register a reactive property on {@link data} that points to
   * the given endpoint or {@link endpoint} if unspecified.
   *
   * @param key The property name to register on {@link data}.
   * @param initialValue The initial value that will be assigned after registering.
   *
   * @returns The {@link ReactiveStorage} instance for easy chaining.
   */
  register(key: ObjectKey, initialValue: any, options: RegistrationOptions = {}) {
    if (typeof key !== 'string' && typeof key !== 'number' && typeof key !== 'symbol') {
      throw new ReactiveStorageError(
        `The first argument must be a valid object key (string, number or symbol).`);
    }
    options.endpoint ??= this.endpoint;
    ReactiveStorage.#register(this.data, key, initialValue, options);

    return this;
  }

  /**
   * Register a reactive property on {@link data} recursively deep
   * by traversing its initial value and registering all properties
   * within any found array or object literal.
   *
   * Shorthand for {@link ReactiveStorage#register} with the deepest
   * {@link RegistrationOptions.depth} set to `Infinity`.
   *
   * @param key The property name to register on {@link data}.
   * @param initialValue The initial value that will be assigned after registering.
   *
   * @returns The {@link ReactiveStorage} instance for easy chaining.
   */
  registerRecursive(key: ObjectKey, initialValue: any, options: RegistrationOptions = {}) {
    if (typeof key !== 'string' && typeof key !== 'number' && typeof key !== 'symbol') {
      throw new ReactiveStorageError(
        `The first argument must be a valid object key (string, number or symbol).`);
    }
    ReactiveStorage.#addInfiniteDepth(options);
    this.register(key, initialValue, options as RegistrationOptions);

    return this;
  }


  // ---- Static methods ----
  /**
   * Register a reactive property on the given data that points to
   * the given endpoint or a new object if unspecified.
   *
   * @param data The object or array to register the property on.
   * @param key The property name to register.
   * @param initialValue The initial value that will be assigned after registering.
   *
   * @return The endpoint the registered property points to.
   */
  static register<K extends ObjectKey, V extends any>(
    target: V[] | Record<K, V>,
    key: K,
    initialValue: V,
    options: RegistrationOptions = {}
  ) {
    if (typeof target !== 'object') {
      throw new ReactiveStorageError(
        `The first argument must be a data object or array.`);
    }
    return this.#register(target, key, initialValue, options);
  }

  /**
   * Register a reactive property on the given data that points to
   * the given endpoint or a new object if unspecified.
   *
   * Shorthand for {@link register} with the deepest
   * {@link RegistrationOptions.depth} set to `Infinity`.
   *
   * @param data The object or array to register the property on.
   * @param key The property name to register.
   * @param initialValue The initial value that will be assigned after registering.
   *
   * @return The endpoint the registered property points to.
   */
  static registerRecursive<K extends ObjectKey, V extends any>(
    target: V[] | Record<K, V>,
    key: K,
    initialValue: V,
    options: RegistrationOptions = {}
  ) {
    if (typeof target !== 'object') {
      throw new ReactiveStorageError(
        `The first argument must be a data object or array.`);
    }
    this.#addInfiniteDepth(options);
    return this.register(target, key, initialValue, options);
  }


  // ---- Static helpers ----
  static #register<K extends ObjectKey, V extends any>(
    target: V[] | Record<K, V>,
    key: K,
    initialValue: V,
    options: RegistrationOptions = {},
    path: ObjectKey[] = [key]
  ) {
    options.depthFilter ??= Filter.objectLiteralOrArray;

    const endpoint = options.endpoint || {};
    let getter = ReactiveStorage.#makeGetter(endpoint, key);
    let setter = ReactiveStorage.#makeSetter(endpoint, key);
    let hasCustomDepthEndpoint = false;
    const customGetter = options.getter;
    const customSetter = options.setter;
    const customPostSetter = options.postSetter;

    // TODO: Limit (infinite) recursion to object literals and arrays instead of any object!
    let depthOptions: undefined | RegistrationOptions;
    if (options.depth) {
      if (typeof options.depth !== 'object') {
        depthOptions = {};
        if (typeof options.depth === 'number') {
          depthOptions.depth = options.depth - 1;
        }
      } else {
        depthOptions = options.depth;
      }
      hasCustomDepthEndpoint = !!depthOptions.depth;
      depthOptions.setter ??= options.setter;
      depthOptions.getter ??= options.getter;
      depthOptions.postSetter ??= options.postSetter;
      depthOptions.enumerable ??= options.enumerable;
      depthOptions.depthFilter ??= options.depthFilter;
    }

    // Populate endpoint
    setter(initialValue);

    Object.defineProperty(target, key, {
      configurable: true, // TODO decide?
      enumerable: options.enumerable ?? true,
      get: () => {
        return customGetter?.({ val: getter(), path }) ?? getter();
      },
      set: (val: any) => {
        const prevVal = getter();
        if (!customSetter?.({ val, prevVal, path })) {
          setter(val);
        }
        if (!!depthOptions && typeof val === 'object' && options.depthFilter?.(val, path)) {
          if (!hasCustomDepthEndpoint) {
            // Instead of creating a new endpoint for every depth, use the objects
            // from the existing endpoint hierarchy. For example for `foo: { bar: 1 }`
            // SET foo -> endpoint `foo: { bar: 1 }`
            // SET bar -> endpoint `bar: 1` (same object { bar: 1 } within the endpoint above)
            depthOptions.endpoint = getter();
          }
          // We don't need to save the deep target anywhere
          // because it is exposed via the updated getter below
          const deepTarget = Array.isArray(val) ? [] : {};
          for (const propKey in val) {
            this.#register(deepTarget, propKey, val[propKey], depthOptions, [ ...path, propKey ]);
          }
          getter = () => deepTarget;
        } else {
          getter = ReactiveStorage.#makeGetter(endpoint, key);
        }
        customPostSetter?.({ val, prevVal, path });
      },
    });

    // @ts-ignore ???
    target[key] = initialValue;

    return endpoint;
  }

  /**
   * Return a function that gets the given key from the given endpoint.
   * @internal
   */
  static #makeGetter(endpoint: Endpoint, key: ObjectKey): () => any {
    if (endpoint instanceof Map) {
      return () => endpoint.get(key);
    } else {
      return () => endpoint[key];
    }
  }
  /**
   * Return a function that sets a value at the given endpoint
   * keyed by the given key.
   * @internal
   */
  static #makeSetter(endpoint: Endpoint, key: ObjectKey): (val: any) => void {
    if (endpoint instanceof Map) {
      return (val: any) => endpoint.set(key, val);
    } else {
      return (val: any) => endpoint[key] = val;
    }
  }

  /**
   * Add a depth of {@link Infinity} at the deepest possible depth
   * configuration of {@link RegistrationOptions}.
   * @internal
   */
  static #addInfiniteDepth(options: RegistrationOptions) {
    let deepOptions = options;
    while (deepOptions.depth != null && typeof options.depth === 'object' && deepOptions !== deepOptions.depth) {
      deepOptions = deepOptions.depth as RegistrationOptions;
    }
    deepOptions.depth = Infinity;
  }
}
