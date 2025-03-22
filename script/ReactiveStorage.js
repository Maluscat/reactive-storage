export class ReactiveStorageError extends Error {
    constructor(...args) {
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
};
export class ReactiveStorage {
    /** @see {@link Filter} */
    static Filter = Filter;
    /**
     * Endpoint holding the actual values of the registered properties.
     *
     * Values should not be overridden.
     */
    endpoint;
    /**
     * Access point for registered properties.
     * Can be customized in the constructor.
     */
    data;
    /**
     * @param data The {@link ReactiveStorage.data} object that represents
     *             the access point for the registered properties.
     * @param endpoint The {@link ReactiveStorage.endpoint} that holds the
     *                 actual registered data.
     */
    constructor(data = {}, endpoint = {}) {
        this.data = data || {};
        this.endpoint = endpoint || {};
    }
    /** Check for existence of a registered property on {@link data}. */
    has(key) {
        return Object.prototype.hasOwnProperty.call(this.data, key);
    }
    /** Delete {@link data} and {@link endpoint} entry of a registered property. */
    delete(key) {
        if (this.has(key)) {
            if (this.endpoint instanceof Map) {
                this.endpoint.delete(key);
            }
            else {
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
    register(key, initialValue, options = {}) {
        if (typeof key !== 'string' && typeof key !== 'number' && typeof key !== 'symbol') {
            throw new ReactiveStorageError(`The first argument must be a valid object key (string, number or symbol).`);
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
    registerRecursive(key, initialValue, options = {}) {
        if (typeof key !== 'string' && typeof key !== 'number' && typeof key !== 'symbol') {
            throw new ReactiveStorageError(`The first argument must be a valid object key (string, number or symbol).`);
        }
        ReactiveStorage.#addInfiniteDepth(options);
        this.register(key, initialValue, options);
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
    static register(target, key, initialValue, options = {}) {
        if (typeof target !== 'object') {
            throw new ReactiveStorageError(`The first argument must be a data object or array.`);
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
    static registerRecursive(target, key, initialValue, options = {}) {
        if (typeof target !== 'object') {
            throw new ReactiveStorageError(`The first argument must be a data object or array.`);
        }
        this.#addInfiniteDepth(options);
        return this.register(target, key, initialValue, options);
    }
    // ---- Static helpers ----
    static #register(target, key, initialValue, options = {}, path = [key]) {
        options.depthFilter ??= Filter.objectLiteralOrArray;
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
            set: (val) => {
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
                        this.#register(deepTarget, propKey, val[propKey], depthOptions, [...path, propKey]);
                    }
                    getter = () => deepTarget;
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
    static #makeGetter(endpoint, key) {
        if (endpoint instanceof Map) {
            return () => endpoint.get(key);
        }
        else {
            return () => endpoint[key];
        }
    }
    /**
     * Return a function that sets a value at the given endpoint
     * keyed by the given key.
     * @internal
     */
    static #makeSetter(endpoint, key) {
        if (endpoint instanceof Map) {
            return (val) => endpoint.set(key, val);
        }
        else {
            return (val) => endpoint[key] = val;
        }
    }
    /**
     * Add a depth of {@link Infinity} at the deepest possible depth
     * configuration of {@link RegistrationOptions}.
     * @internal
     */
    static #addInfiniteDepth(options) {
        let deepOptions = options;
        while (deepOptions.depth != null && typeof options.depth === 'object' && deepOptions !== deepOptions.depth) {
            deepOptions = deepOptions.depth;
        }
        deepOptions.depth = Infinity;
    }
}
