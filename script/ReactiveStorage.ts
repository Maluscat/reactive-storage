export type ObjectKey = number | string | symbol;
export type Data = Record<ObjectKey, any> | Array<any>;
export type Endpoint = Record<ObjectKey, any> | Map<ObjectKey, any> | ReactiveStorage;

export type RegistrationOptions<V> = Partial<RegistrationOptionsWhole<V>>
export interface RegistrationOptionsWhole<V> {
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
  depth: number | RegistrationOptions<any>;
  /**
   * The endpoint that the registered getters and setters point to.
   *
   * If given *a {@link ReactiveStorage} object*, the given property is registered
   * onto it via {@link ReactiveStorage.register}, if not already done, with the
   * default options. Register an endpoint's property yourself to control its options.
   *
   * @default The current {@link ReactiveStorage}'s {@link ReactiveStorage.endpoint}.
   */
  endpoint: Endpoint;
  postSetter: (val: V, info: { prevVal: V, path: ObjectKey[] }) => void;
  setter: (val: V, info: { prevVal: V, path: ObjectKey[] }) => void | boolean;
  getter: (args: { val: V, path: ObjectKey[] }) => V;
}

export class ReactiveStorageError extends Error {
  constructor(...args: any[]) {
    super(...args);
    this.name = this.constructor.name;
  }
}

export class ReactiveStorage {
  /**
   * Endpoint holding the definitive values of the registered properties.
   * 
   * Values MUST NOT be overriden!
   */
  readonly endpoint: Endpoint = {};
  readonly data;

  constructor(data: Data = {}) {
    this.data = data;
  }

  has(key: ObjectKey) {
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }
  // delete(key: ObjectKey) {
  //   if (this.has(key)) {
  //     this.endpoint.delete(key);

  //     return true;
  //   }
  //   return false;
  // }

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
  register<V extends any>(key: any, initialValue: V, options: RegistrationOptions<V> = {}) {
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
  registerRecursive<V extends object>(key: any, initialValue: V, options: RegistrationOptions<V> = {}) {
    ReactiveStorage.#addInfiniteDepth(options);
    this.register(key, initialValue, options as RegistrationOptions<V>);

    return this;
  }


  // ---- Static methods ----
  static register<V extends any>(
    target: Data,
    key: any,
    initialValue: V,
    options: RegistrationOptions<V> = {}
  ) {
    return this.#register(target, key, initialValue, options);
  }

  static registerRecursive<V extends any>(
    target: Data,
    key: any,
    initialValue: V,
    options: RegistrationOptions<V> = {}
  ) {
    this.#addInfiniteDepth(options);
    return this.register(target, key, initialValue, options);
  }


  // ---- Static helpers ----
  static #register<V extends any>(
    target: Data,
    key: any,
    initialValue: V,
    options: RegistrationOptions<V> = {},
    path: ObjectKey[] = [key]
  ) {
    let endpoint: Exclude<Endpoint, ReactiveStorage>;
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
    let depthOptions: undefined | RegistrationOptions<V[keyof V]>;
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
      set: (val: V) => {
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

    target[key] = initialValue;

    return endpoint;
  }

  static #makeGetter(endpoint: Exclude<Endpoint, ReactiveStorage>, key: ObjectKey): () => any {
    if (endpoint instanceof Map) {
      return () => endpoint.get(key);
    } else {
      return () => endpoint[key];
    }
  }
  static #makeSetter(endpoint: Exclude<Endpoint, ReactiveStorage>, key: ObjectKey): (val: any) => void {
    if (endpoint instanceof Map) {
      return (val: any) => endpoint.set(key, val);
    } else {
      return (val: any) => endpoint[key] = val;
    }
  }

  static #addInfiniteDepth(options: RegistrationOptions<any>) {
    let deepOptions = options;
    while (deepOptions.depth != null && typeof options.depth === 'object' && deepOptions !== deepOptions.depth) {
      deepOptions = deepOptions.depth as RegistrationOptions<any>;
    }
    deepOptions.depth = Infinity;
  }
}
