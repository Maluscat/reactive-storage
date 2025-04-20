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
    get target() {
        return this.config.target;
    }
    config;
    constructor(config = {}) {
        this.config = ReactiveStorage.#prepareConfig(config);
    }
    /** Check for existence of a registered property on {@link target}. */
    has(key) {
        return Object.prototype.hasOwnProperty.call(this.target, key);
    }
    /** Delete {@link target} and {@link endpoint} entry of a registered property. */
    delete(key) {
        if (this.has(key)) {
            if (this.endpoint instanceof Map) {
                this.endpoint.delete(key);
            }
            else {
                delete this.endpoint[key];
            }
            // @ts-ignore Checked for property existence above
            delete this.target[key];
            return true;
        }
        return false;
    }
    /**
     * Register a reactive property on {@link target} that points to
     * {@link endpoint}.
     *
     * @param key The property name to register on {@link target}.
     * @param initialValue The initial value that will be assigned after registering.
     *
     * @returns The current {@link ReactiveStorage} instance for easy chaining.
     *
     * @privateRemarks
     * There is currently no way to make the generics sound since they cannot be
     * optional without a default value.
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
     *
     * @privateRemarks
     * There is currently no way to make the generics sound since they cannot be
     * optional without a default value.
     */
    static register(key, initialValue, config = {}) {
        return this.#registerGeneric(key, initialValue, config);
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
        return this.#registerGeneric(key, initialValue, config, true);
    }
    // ---- Static helpers ----
    static #registerGeneric(key, initialValue, config = {}, recursive = false) {
        const opts = this.#prepareConfig(config);
        if (Array.isArray(key)) {
            for (const singleKey of key) {
                this.#register(singleKey, initialValue, opts, recursive);
            }
        }
        else {
            this.#register(key, initialValue, opts, recursive);
        }
        return {
            target: opts.target,
            endpoint: opts.endpoint,
        };
    }
    static #register(key, initialValue, config, recursive, path = [key]) {
        const target = config.target ?? {};
        const endpoint = config.endpoint ?? {};
        const depthFilter = config.depthFilter ?? Filter.objectLiteralOrArray;
        const customGetter = config.getter;
        const customSetter = config.setter;
        const customPostSetter = config.postSetter;
        let getter = ReactiveStorage.#makeGetter(endpoint, key);
        let setter = ReactiveStorage.#makeSetter(endpoint, key);
        let hasCustomDepthEndpoint = false;
        let initial = true;
        let depthOpts;
        if (config.depth || recursive) {
            if (typeof config.depth !== 'object') {
                depthOpts = {};
                if (recursive) {
                    depthOpts.depth = Infinity;
                }
                else if (typeof config.depth === 'number') {
                    depthOpts.depth = config.depth - 1;
                }
            }
            else {
                depthOpts = Object.assign({}, config.depth);
            }
            hasCustomDepthEndpoint = !!depthOpts.endpoint;
            depthOpts.setter ??= config.setter;
            depthOpts.getter ??= config.getter;
            depthOpts.postSetter ??= config.postSetter;
            depthOpts.enumerable ??= config.enumerable;
            depthOpts.depthFilter ??= config.depthFilter;
        }
        Object.defineProperty(target, key, {
            configurable: true,
            enumerable: config.enumerable ?? true,
            get: () => {
                return customGetter?.({ val: getter(), path }) ?? getter();
            },
            set: (val) => {
                const prevVal = getter();
                if (!customSetter?.({ val, prevVal, initial, path, set: setter })) {
                    setter(val);
                }
                if (!!depthOpts && typeof val === 'object' && depthFilter(val, path)) {
                    if (!hasCustomDepthEndpoint) {
                        // For the endpoint, use the object of the desired depth within the
                        // existing endpoint hierarchy instead of creating a new object.
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
                    getter = ReactiveStorage.#makeGetter(endpoint, key);
                }
                customPostSetter?.({ val, prevVal, initial, path });
            },
        });
        if (initialValue !== undefined) {
            // @ts-ignore ???
            target[key] = initialValue;
        }
        initial = false;
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
     * Add a default target and endpoint of a config if unspecified
     * and return a shallow copy.
     * @internal
     */
    static #prepareConfig(config) {
        return Object.assign({
            target: {},
            endpoint: {},
        }, config);
    }
}
