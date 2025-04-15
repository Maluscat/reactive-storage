export type ObjectKey = number | string | symbol;
export type Endpoint = Record<ObjectKey, any> | Map<ObjectKey, any>;
export type FilterFunction = (obj: object, path: ObjectKey[]) => boolean;
export type Data<K extends ObjectKey, V> = K extends number ? V[] | Record<K, V> : Record<K, V>;

/** {@link RegistrationOptions.getter} event argument. */
export interface GetterData {
  /** Value to be set. */
  val: any;
  /**
   * Key path of the value in question, starting with the registered key.
   *
   * @example
   * ```js
   * const storage = new ReactiveStorage({
   *   getter: ({ path }) => { console.log("GET:", path) },
   * });
   * storage.registerRecursive('value', { first: { second: 3 } });
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
/**
 * {@link RegistrationOptions.setter} and {@link RegistrationOptions.postSetter}
 * event argument.
 */
export interface SetterData {
  /** Value to be set. */
  val: any;
  /** Whether this call is propagated by the initial registration action. */
  initial: boolean;
  /** Previous value. */
  prevVal: any;
  /**
   * Key path of the value in question, starting with the registered key.
   *
   * @example
   * ```js
   * const storage = new ReactiveStorage({
   *   setter: ({ path }) => { console.log("SET:", path) }
   * });
   * storage.registerRecursive('value', { first: { second: 3 } });
   *
   * // <Logs from the initial assignment...>
   *
   * storage.data.value.first.second = 4
   * // "SET: ['value', 'first', 'second']"
   * ```
   */
  path: ObjectKey[];
}

export type RegistrationOptions<K extends ObjectKey = ObjectKey, V = any> = Partial<RegistrationOptionsWhole<K, V>>
export interface RegistrationOptionsWhole<K extends ObjectKey, V> {
  /**
   * The endpoint that the registered property points to which holds the actual
   * data, so an object that the configured setter and getter will deposit the
   * value to and fetch the value from, respectively.
   *
   * @default {}
   */
  endpoint: Endpoint;
  /**
   * An object that represents the access point for the registered properties.
   * Values are deposited at the specified {@link endpoint}.
   * @default {}
   */
  target: Data<K, V>;
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
   * The first layer will deeply register *any* object, depth 1 and below
   * accept only object literals or arrays.
   * ```js
   * ReactiveStorage.registerRecursive('value', 420, {
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
   * Whether the value should be enumerable inside {@link target}.
   * Corresponds to {@link PropertyDescriptor.enumerable}.
   * @default true
   */
  enumerable?: boolean;
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
   * const storage = new ReactiveStorage({
   *   setter: val => { console.log("First layer:", val) },
   *   depth: {
   *     setter: val => { console.log("Further layer:", val) },
   *     depth: Infinity
   *   }
   * });
   * storage.register('recursive', { first: { second: 3 } });
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
   * const storage = new ReactiveStorage({
   *   setter: val => { console.log("SET", val) },
   *   depth: 1
   * });
   * storage.register('value', { first: { second: 3 } });
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
  depth?: number | RegistrationOptions<any, any>;
  /**
   * Called *after* a value has been set.
   */
  postSetter?: (args: SetterData) => void;
  /**
   * Called *before* a value is set.
   *
   * Return `true` to stop the value from being set.
   * This can be useful to filter specific values or when setting them manually
   * in the setter.
   */
  setter?: (args: SetterData) => void | boolean;
  /**
   * Called anytime a value is fetched.
   *
   * @remarks
   * This is potentially called a lot since, as per the getter/setter hierarchy,
   * any deep value *set* needs to *get* the respective value from a layer above.
   *
   * @example
   * ```js
   * const storage = new ReactiveStorage({
   *   getter: val => { console.log("GET", val) },
   *   depth: Infinity
   * });
   * storage.register('value', { first: { second: 3 } });
   *
   * storage.data.value.first.second = 8
   * // "GET { first: { second: 3 } }"
   * // "GET { second: 8 }"
   * // "GET 8"
   * ```
   */
  getter?: (args: GetterData) => any;
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

export class ReactiveStorage<K extends ObjectKey = ObjectKey, V = any> {
  /** @see {@link Filter} */
  static readonly Filter = Filter;

  /**
   * Endpoint holding the actual values of the registered properties.
   * @see {@link RegistrationOptions.endpoint}
   */
  get endpoint() {
    return this.config.endpoint;
  }
  /**
   * Access point for registered properties.
   * @see {@link RegistrationOptions.target}
   */
  get data() {
    return this.config.target;
  }

  readonly config: Readonly<RegistrationOptionsWhole<K, V>>;

  constructor(config: RegistrationOptions<K, V> = {}) {
    this.config = ReactiveStorage.#prepareConfig(config);
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
   * {@link endpoint}.
   *
   * @param key The property name to register on {@link data}.
   * @param initialValue The initial value that will be assigned after registering.
   *
   * @returns The current {@link ReactiveStorage} instance for easy chaining.
   */
  register(key: K, initialValue?: V) {
    ReactiveStorage.#register(key, initialValue, this.config);
    return this;
  }


  // ---- Static methods ----
  /**
   * Register a reactive property on a target that points to an endpoint.
   * If left unspecified, target and/or endpoint will be a new object that can
   * be obtained using the returned final configuration.
   *
   * @param key The property name to register.
   * @param initialValue The initial value that will be assigned after registering.
   *
   * @return The final configuration with default values.
   */
  static register<K extends ObjectKey, V extends any>(
    key: K,
    initialValue?: V,
    config: RegistrationOptions<K, V> = {}
  ) {
    return this.#register(key, initialValue, config);
  }

  /**
   * Register a reactive property on a target recursively deep by traversing
   * its initial value and registering all properties within any found array or
   * object literal (limited by {@link RegistrationOptions.deepFilter}, if any).
   *
   * Shorthand for {@link register} with the deepest
   * {@link RegistrationOptions.depth} set to `Infinity`.
   *
   * @param key The property name to register.
   * @param initialValue The initial value that will be assigned after registering.
   *
   * @return The final configuration with default values.
   */
  static registerRecursive<K extends ObjectKey, V extends any>(
    key: K,
    initialValue?: V,
    config: RegistrationOptions<K, V> = {}
  ) {
    return this.#register(key, initialValue, config, true);
  }


  // ---- Static helpers ----
  static #register<K extends ObjectKey, V extends any>(
    key: K,
    initialValue?: V,
    config: RegistrationOptions<K, V> = {},
    recursive = false,
    path: ObjectKey[] = [key]
  ) {
    const opts = this.#prepareConfig(config);
    let getter = ReactiveStorage.#makeGetter(opts.endpoint, key);
    let setter = ReactiveStorage.#makeSetter(opts.endpoint, key);
    let hasCustomDepthEndpoint = false;
    let initial = true;
    const customGetter = opts.getter;
    const customSetter = opts.setter;
    const customPostSetter = opts.postSetter;

    let depthOpts: undefined | RegistrationOptions;
    if (opts.depth || recursive) {
      if (typeof opts.depth !== 'object') {
        depthOpts = {};
        if (recursive) {
          depthOpts.depth = Infinity;
        } else if (typeof opts.depth === 'number') {
          depthOpts.depth = opts.depth - 1;
        }
      } else {
        depthOpts = Object.assign({}, opts.depth);
      }
      hasCustomDepthEndpoint = !!depthOpts.depth;

      depthOpts.setter ??= opts.setter;
      depthOpts.getter ??= opts.getter;
      depthOpts.postSetter ??= opts.postSetter;
      depthOpts.enumerable ??= opts.enumerable;
      depthOpts.depthFilter ??= opts.depthFilter;
    }

    // TODO: This should probably be fenced by `customSetter` as well!
    // Populate endpoint
    setter(initialValue);

    Object.defineProperty(opts.target, key, {
      configurable: true, // TODO decide?
      enumerable: opts.enumerable ?? true,
      get: () => {
        return customGetter?.({ val: getter(), path }) ?? getter();
      },
      set: (val: any) => {
        const prevVal = getter();
        if (!customSetter?.({ val, prevVal, initial, path })) {
          setter(val);
        }
        if (!!depthOpts && typeof val === 'object' && opts.depthFilter?.(val, path)) {
          if (!hasCustomDepthEndpoint) {
            // Instead of creating a new endpoint for every depth, use the objects
            // from the existing endpoint hierarchy. For example for `foo: { bar: 1 }`
            // SET foo -> endpoint `foo: { bar: 1 }`
            // SET bar -> endpoint `bar: 1` (same object { bar: 1 } within the endpoint above)
            // TODO check this
            depthOpts.endpoint = getter();
          }
          // We don't need to save the deep target anywhere
          // because it is exposed via the updated getter below
          depthOpts.target = Array.isArray(val) ? [] : {};
          for (const propKey in val) {
            this.#register(propKey, val[propKey], depthOpts, recursive, [ ...path, propKey ]);
          }
          getter = () => depthOpts.target;
        } else {
          getter = ReactiveStorage.#makeGetter(opts.endpoint!, key);
        }
        customPostSetter?.({ val, prevVal, initial, path });
      },
    });

    if (initialValue !== undefined) {
      // @ts-ignore ???
      opts.target[key] = initialValue;
    }
    initial = false;

    return opts;
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
   * Add default values to specific fields of a config if unspecified
   * and return a shallow copy.
   * @internal
   */
  static #prepareConfig<K extends ObjectKey, V>(
    config: RegistrationOptions<K, V>
  ) {
    config.depthFilter ||= Filter.objectLiteralOrArray;
    config.target ||= {} as Data<K, V>;
    config.endpoint ||= {} as Endpoint;
    config.depth ??= 0;
    config.enumerable ??= true;
    return Object.assign({}, config) as RegistrationOptionsWhole<K, V>;
  }
}
