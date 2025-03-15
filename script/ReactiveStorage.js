export class ReactiveStorageError extends Error {
    constructor(...args) {
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
    endpoint = new Map();
    data;
    constructor(data = {}) {
        this.data = data;
    }
    has(key) {
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
    register(key, initialValue, options = {}) {
        let endpoint;
        if (options.endpoint) {
            if (options.endpoint instanceof ReactiveStorage) {
                endpoint = options.endpoint.data;
                if (!options.endpoint.has(key)) {
                    options.endpoint.register(key, initialValue);
                }
            }
            else
                endpoint = options.endpoint;
        }
        else
            endpoint = this.endpoint;
        let depthOptions;
        if (options.depth) {
            if (typeof options.depth !== 'object') {
                depthOptions = {};
                if (typeof options.depth === 'number') {
                    depthOptions.depth = options.depth - 1;
                }
            }
            else {
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
                return (customGetter?.(getter()) ?? getter());
            },
            set: (val) => {
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
    registerRecursive(key, initialValue, options = {}) {
        options.depth = Infinity;
        this.register(key, initialValue, options);
    }
    // static register<V extends any>(
    //   target: object,
    //   key: ObjectKey,
    //   initialValue: V,
    //   options?: Partial<RegisterOptions<V>>
    // ) {
    // }
    static #makeGetter(endpoint, key) {
        if (endpoint instanceof Map) {
            return () => endpoint.get(key);
        }
        else {
            return () => endpoint[key];
        }
    }
    static #makeSetter(endpoint, key) {
        if (endpoint instanceof Map) {
            return (val) => endpoint.set(key, val);
        }
        else {
            return (val) => endpoint[key] = val;
        }
    }
}
