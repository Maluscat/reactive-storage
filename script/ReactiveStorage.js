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
    config;
    constructor(config = {}) {
        this.config = ReactiveStorage.#prepareConfig(config);
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
     * {@link endpoint}.
     *
     * @param key The property name to register on {@link data}.
     * @param initialValue The initial value that will be assigned after registering.
     *
     * @returns The current {@link ReactiveStorage} instance for easy chaining.
     */
    register(key, initialValue) {
        ReactiveStorage.#registerGeneric(key, initialValue, this.config);
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
    static register(key, initialValue, config = {}) {
        const opts = this.#prepareConfig(config);
        this.#registerGeneric(key, initialValue, opts);
        return opts;
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
    static registerRecursive(key, initialValue, config = {}) {
        const opts = this.#prepareConfig(config);
        this.#registerGeneric(key, initialValue, opts, true);
        return opts;
    }
    // ---- Static helpers ----
    static #registerGeneric(key, initialValue, opts, recursive = false) {
        if (Array.isArray(key)) {
            for (const singleKey of key) {
                this.#register(singleKey, initialValue, opts, recursive);
            }
        }
        else {
            this.#register(key, initialValue, opts, recursive);
        }
    }
    static #register(key, initialValue, config, recursive, path = [key]) {
        const opts = this.#prepareConfig(config);
        let getter = ReactiveStorage.#makeGetter(opts.endpoint, key);
        let setter = ReactiveStorage.#makeSetter(opts.endpoint, key);
        let hasCustomDepthEndpoint = false;
        let initial = true;
        const customGetter = opts.getter;
        const customSetter = opts.setter;
        const customPostSetter = opts.postSetter;
        let depthOpts;
        if (opts.depth || recursive) {
            if (typeof opts.depth !== 'object') {
                depthOpts = {};
                if (recursive) {
                    depthOpts.depth = Infinity;
                }
                else if (typeof opts.depth === 'number') {
                    depthOpts.depth = opts.depth - 1;
                }
            }
            else {
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
            set: (val) => {
                const prevVal = getter();
                if (!customSetter?.({ val, prevVal, initial, path, set: setter })) {
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
                        this.#register(propKey, val[propKey], depthOpts, recursive, [...path, propKey]);
                    }
                    getter = () => depthOpts.target;
                }
                else {
                    getter = ReactiveStorage.#makeGetter(opts.endpoint, key);
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
     * Add default values to specific fields of a config if unspecified
     * and return a shallow copy.
     * @internal
     */
    static #prepareConfig(config) {
        config.depthFilter ||= Filter.objectLiteralOrArray;
        config.target ||= {};
        config.endpoint ||= {};
        config.depth ??= 0;
        config.enumerable ??= true;
        return Object.assign({}, config);
    }
}
