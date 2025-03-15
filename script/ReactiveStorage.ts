export type ObjectKey = number | string | symbol;
export type Data = Record<ObjectKey, any> | Array<any>;
export type Endpoint = Record<ObjectKey, any> | Map<ObjectKey, any> | ReactiveStorage;

export interface RegistrationOptions<V> {
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
   * *If given registration options*, the registered key configuration will
   * assume these options in their layer. Can be nested infinitely deep.
   *
   * *If given a number*, keys will be registered recursively up until
   * the given depth, assuming the default options. Can be {@link Infinity}.
   * Since this is rather nonsensical without access to the present getters
   * and setters, {@link deepSetter} or {@link deepGetter} can be used.
   * 
   * @example
   * ```ts
   * const reaction = new ReactiveStorage();
   * reaction.register('recursive', { first: { second: 3 } }, {
   *   setter: val => { console.log(`First layer: ${val}`) },
   *   deep: {
   *     setter: val => { console.log(`Second layer: ${val}`) },
   *     deep: Infinity
   *   }
   * });
   *
   * reaction.storage.recursive = { first2: { second2: 69 } };
   * // "First layer: { first2: { second2: 69 } }"
   * // "Second layer: { second2: 69 }"
   *
   * reaction.storage.recursive.first2 = 70;
   * // "Second layer: 70"
   * ```
   *
   * @default 0
   */
  depth: number | RegistrationOptions<any>;
  /**
   * The endpoint that the registered getters and setters point to.
   *
   * *If given a {@link ReactiveStorage} object*, the given property is registered
   * onto it via {@link ReactiveStorage.register}, if not already done, with the
   * default options. Register an endpoint's property yourself to control its options.
   *
   * @default The current {@link ReactiveStorage}'s {@link ReactiveStorage.endpoint}.
   */
  endpoint: Endpoint;
  deepSetter: (value: any, prevVal: any, depth: number, path: ObjectKey[]) => void | boolean;
  deepGetter: (value: any, depth: number, path: ObjectKey[]) => any;
  postSetter: (value: V, prevVal: V) => void;
  setter: (value: V, prevVal: V) => void | boolean;
  getter: (value: V) => V;
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
  readonly endpoint: Endpoint = new Map();
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
  register<V extends any>(key: any, initialValue: V, options: Partial<RegistrationOptions<V>> = {}) {
    let endpoint: Exclude<Endpoint, ReactiveStorage>;
    if (options.endpoint) {
      if (options.endpoint instanceof ReactiveStorage) {
        endpoint = options.endpoint.data; 
        if (!options.endpoint.has(key)) {
          options.endpoint.register(key, initialValue);
        }
      } else endpoint = options.endpoint;
    } else endpoint = this.endpoint;

    let depthOptions: undefined | Partial<RegistrationOptions<V[keyof V]>>;
    if (options.depth) {
      if (typeof options.depth !== 'object') {
        depthOptions = {};
        if (typeof options.depth === 'number') {
          depthOptions.depth = options.depth - 1;
        }
      } else {
        depthOptions = options.depth;
      }
      // NOTE: Did this have any special purpose?
      // depthOptions.endpoint = ReactiveStorage.#makeGetter(endpoint, key)();
    }

    let getter = ReactiveStorage.#makeGetter(endpoint, key);
    let setter = ReactiveStorage.#makeSetter(endpoint, key);
    const customGetter = options.getter;
    const customSetter = options.setter;
    const customPostSetter = options.postSetter;

    Object.defineProperty(this.data, key, {
      configurable: true, // TODO decide?
      enumerable: options.enumerable ?? true,
      get: () => {
        return (customGetter?.(getter()) ?? getter()) as V;
      },
      set: (val: V) => {
        const prevVal = getter();
        if (!customSetter?.(val, prevVal)) {
          setter(val);
        }
        if (depthOptions) {
          const deepStorage = new ReactiveStorage(Array.isArray(val) ? [] : {});
          for (const propKey in val) {
            deepStorage.register(propKey, val[propKey], depthOptions);
          }
          getter = () => deepStorage.data;
        }
        customPostSetter?.(val, prevVal);
      },
    });

    this.data[key] = initialValue;

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
  registerRecursive<V extends object>(key: any, initialValue: V, options: Partial<Omit<RegistrationOptions<V>, 'deep'>> = {}) {
    (options as Partial<RegistrationOptions<V>>).depth = Infinity;
    this.register(key, initialValue, options as Partial<RegistrationOptions<V>>);
  }

  // static register<V extends any>(
  //   target: object,
  //   key: ObjectKey,
  //   initialValue: V,
  //   options?: Partial<RegisterOptions<V>>
  // ) {

  // }

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
}
