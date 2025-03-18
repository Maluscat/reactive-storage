export type ObjectKey = number | string | symbol;
export type Data = Record<ObjectKey, any> | Array<any>;
export type Endpoint = Record<ObjectKey, any> | Map<ObjectKey, any>;

export type RegistrationOptions = Partial<RegistrationOptionsWhole>
export interface RegistrationOptionsWhole {
  /**
   * Whether the value should be enumerable inside {@link ReactiveStorage.data}.
   * Corresponds to {@link PropertyDescriptor.enumerable}.
   * @default true
   */
  enumerable: boolean;
  /**
   * Whether and how keys inside any object or array value
   * (both the given initial value and reassigned values) should be registered
   * such that they go through an additional layer of getters and setters.
   *
   * If given *registration options*, the registered key configuration will
   * assume these options in their layer. Can be nested infinitely deep.
   *
   * If given *a number*, keys will be registered recursively up until
   * the given depth, assuming the options present in the given scope.
   * Can be {@link Infinity}.
   * 
   * @example
   * ```ts
   * const storage = new ReactiveStorage();
   * storage.register('recursive', { first: { second: 3 } }, {
   *   setter: val => { console.log("First layer:", val) },
   *   depth: {
   *     setter: val => { console.log("Further layer:", val) },
   *     depth: Infinity
   *   }
   * });
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
   * @default 0
   */
  depth: number | RegistrationOptions;
  /**
   * The endpoint that the registered getters and setters point to.
   *
   * If given *a {@link ReactiveStorage} object*, the given property is registered
   * onto it via {@link ReactiveStorage.register}, if not already done, with the
   * default options. Register an endpoint's property yourself to control its options.
   *
   * @default The current {@link ReactiveStorage}'s {@link ReactiveStorage.endpoint}.
   */
  endpoint: Endpoint | ReactiveStorage;
  postSetter: (val: any, info: { prevVal: any, path: ObjectKey[] }) => void;
  setter: (val: any, info: { prevVal: any, path: ObjectKey[] }) => void | boolean;
  getter: (args: { val: any, path: ObjectKey[] }) => any;
}

export class ReactiveStorageError extends Error {
  constructor(...args: any[]) {
    super(...args);
    this.name = this.constructor.name;
  }
}

export class ReactiveStorage {
  /**
   * Endpoint holding the actual values of the registered properties.
   * 
   * Values should not be overridden.
   */
  readonly endpoint: Endpoint = {};
  readonly data;

  constructor(data: Data = {}) {
    this.data = data;
  }

  has(key: ObjectKey) {
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }
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
   * @param key The property key to register on {@link data}.
   * @param initialValue The initial value that will be assigned after registering.
   * @param options Options to configure registration properties, events, etc.
   *
   * @privateRemarks
   * TODO Better typing via generics?
   */
  register(key: ObjectKey, initialValue: any, options: RegistrationOptions = {}) {
    options.endpoint ??= this.endpoint;
    ReactiveStorage.register(this.data, key, initialValue, options);

    return this;
  }

  /**
   * Register a reactive property on {@link data} *recursively* by traversing
   * its initial value and registering any found arrays and object literals.
   *
   * Shorthand for {@link register} with {@link RegistrationOptions.depth} set to `Infinity`.
   *
   * @param key The property key to register on {@link data}.
   * @param initialValue The initial value that will be assigned after registering.
   * @param options Options to configure registration properties, events, etc.
   */
  registerRecursive(key: ObjectKey, initialValue: any, options: RegistrationOptions = {}) {
    ReactiveStorage.#addInfiniteDepth(options);
    this.register(key, initialValue, options as RegistrationOptions);

    return this;
  }


  // ---- Static methods ----
  static register<K extends ObjectKey, V extends any>(
    target: V[] | Record<K, V>,
    key: K,
    initialValue: V,
    options: RegistrationOptions = {}
  ) {
    return this.#register(target, key, initialValue, options);
  }

  static registerRecursive<K extends ObjectKey, V extends any>(
    target: V[] | Record<K, V>,
    key: K,
    initialValue: V,
    options: RegistrationOptions = {}
  ) {
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
    let endpoint: Endpoint;
    if (options.endpoint) {
      if (options.endpoint instanceof ReactiveStorage) {
        endpoint = options.endpoint.data; 
        if (!options.endpoint.has(key)) {
          options.endpoint.register(key, initialValue);
        }
      } else endpoint = options.endpoint;
    } else endpoint = {};

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
      // @ts-ignore
      depthOptions.setter ??= options.setter;
      // @ts-ignore
      depthOptions.getter ??= options.getter;
      // @ts-ignore
      depthOptions.postSetter ??= options.postSetter;
      depthOptions.enumerable ??= options.enumerable;
    }

    // Populate endpoint
    setter(initialValue);

    Object.defineProperty(target, key, {
      configurable: true, // TODO decide?
      enumerable: options.enumerable ?? true,
      get: () => {
        return (customGetter?.({ val: getter(), path }) ?? getter()) as V;
      },
      set: (val: any) => {
        const prevVal = getter();
        if (!customSetter?.(val, { prevVal, path })) {
          setter(val);
        }
        if (depthOptions && typeof val === 'object') {
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
        }
        customPostSetter?.(val, { prevVal, path });
      },
    });

    // @ts-ignore ???
    target[key] = initialValue;

    return endpoint;
  }

  static #makeGetter(endpoint: Endpoint, key: ObjectKey): () => any {
    if (endpoint instanceof Map) {
      return () => endpoint.get(key);
    } else {
      return () => endpoint[key];
    }
  }
  static #makeSetter(endpoint: Endpoint, key: ObjectKey): (val: any) => void {
    if (endpoint instanceof Map) {
      return (val: any) => endpoint.set(key, val);
    } else {
      return (val: any) => endpoint[key] = val;
    }
  }

  static #addInfiniteDepth(options: RegistrationOptions) {
    let deepOptions = options;
    while (deepOptions.depth != null && typeof options.depth === 'object' && deepOptions !== deepOptions.depth) {
      deepOptions = deepOptions.depth as RegistrationOptions;
    }
    deepOptions.depth = Infinity;
  }
}
