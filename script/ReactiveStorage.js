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
    endpoint = {};
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
    registerRecursive(key, initialValue, options = {}) {
        ReactiveStorage.#addInfiniteDepth(options);
        this.register(key, initialValue, options);
        return this;
    }
    // ---- Static methods ----
    static register(target, key, initialValue, options = {}) {
        return this.#register(target, key, initialValue, options);
    }
    static registerRecursive(target, key, initialValue, options = {}) {
        this.#addInfiniteDepth(options);
        return this.register(target, key, initialValue, options);
    }
    // ---- Static helpers ----
    static #register(target, key, initialValue, options = {}, path = [key]) {
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
            endpoint = {};
        let getter = ReactiveStorage.#makeGetter(endpoint, key);
        let setter = ReactiveStorage.#makeSetter(endpoint, key);
        let hasCustomDepthEndpoint = false;
        const customGetter = options.getter;
        const customSetter = options.setter;
        const customPostSetter = options.postSetter;
        // TODO: Limit (infinite) recursion to object literals and arrays instead of any object!
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
                return (customGetter?.({ val: getter(), path }) ?? getter());
            },
            set: (val) => {
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
                        this.#register(deepTarget, propKey, val[propKey], depthOptions, [...path, propKey]);
                    }
                    getter = () => deepTarget;
                }
                customPostSetter?.(val, { prevVal, path });
            },
        });
        target[key] = initialValue;
        return endpoint;
    }
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
    static #addInfiniteDepth(options) {
        let deepOptions = options;
        while (deepOptions.depth != null && typeof options.depth === 'object' && deepOptions !== deepOptions.depth) {
            deepOptions = deepOptions.depth;
        }
        deepOptions.depth = Infinity;
    }
}
