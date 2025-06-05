/**
 * Provides some useful filter functions for use in
 * {@link Options.depthFilter}.
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
/**
 * Reactivity helper to register, observe and intercept deeply reactive data
 * without proxies.
 *
 * Reactive properties are registered using either the instance methods
 * {@link ReactiveStorage#register} or {@link ReactiveStorage#registerFrom}
 * after passing a configuration to the constructor, or using the static methods
 * {@link ReactiveStorage.register}, {@link ReactiveStorage.registerFrom},
 * {@link ReactiveStorage.registerRecursive} or
 * {@link ReactiveStorage.registerRecursiveFrom}.
 */
export class ReactiveStorage {
    /** @see {@link Filter} */
    static Filter = Filter;
    shallowEndpoint;
    target;
    targets;
    config;
    constructor(config = {}) {
        this.config = ReactiveStorage.#prepareConfig(config);
        const data = ReactiveStorage.#getDataFromConfigs(this.config);
        this.shallowEndpoint = data.shallowEndpoint;
        this.target = data.target;
        this.targets = data.targets;
    }
    /** Check for existence of a registered property on {@link target}. */
    has(key) {
        return Object.prototype.hasOwnProperty.call(this.target, key);
    }
    /** Delete {@link target} and {@link shallowEndpoint} entry of a registered property. */
    delete(key) {
        if (this.has(key)) {
            delete this.shallowEndpoint[key];
            for (const target of this.targets) {
                delete target[key];
            }
            return true;
        }
        return false;
    }
    /**
     * Register one or multiple reactive properties according to the current
     * instance's configuration ({@link config}) and the given initial value,
     * if any.
     *
     * @param key The property name to register on {@link target}.
     * @param initialValue The initial value that will be assigned after registering.
     *
     * @return The current {@link ReactiveStorage} instance for easy chaining.
     */
    register(key, initialValue) {
        ReactiveStorage.#registerGeneric(key, initialValue, this.config);
        return this;
    }
    /**
     * Register all property keys and symbols of the given object with their
     * respective values according to the current instance's configuration
     * ({@link config}).
     *
     * @param object The object the keys and symbols of will be registered.
     *
     * @return The current {@link ReactiveStorage} instance for easy chaining.
     */
    registerFrom(object) {
        for (const key of Object.keys(object)) {
            ReactiveStorage.#registerGeneric(key, object[key], this.config);
        }
        for (const symbol of Object.getOwnPropertySymbols(object)) {
            ReactiveStorage.#registerGeneric(symbol, object[symbol], this.config);
        }
        return this;
    }
    // ---- Static methods ----
    /**
     * Register a reactive property on or multiple targets. If left unspecified,
     * target and/or shallow endpoint will be a new object that can be obtained
     * using the returned data.
     *
     * @param key The property name to register.
     * @param initialValue The initial value that will be assigned after registering.
     *
     * @remarks
     * There is currently no way to make the generics sound (bind value only to
     * the given keys of a given interface, instead of all values within KV)
     * since they cannot be optional without a default value.
     */
    static register(key, initialValue, config = {}) {
        const opts = this.#prepareConfig(config);
        this.#registerGeneric(key, initialValue, opts);
        return this.#getDataFromConfigs(opts);
    }
    /**
     * Register all property keys and symbols of the given object with their
     * respective values. If left unspecified, target and/or shallow endpoint
     * will be a new object that can be obtained using the returned data.
     *
     * @param object The object the keys and symbols of will be registered.
     */
    static registerFrom(object, config) {
        const opts = this.#prepareConfig(config);
        for (const key of Object.keys(object)) {
            this.#registerGeneric(key, object[key], opts);
        }
        for (const symbol of Object.getOwnPropertySymbols(object)) {
            this.#registerGeneric(symbol, object[symbol], opts);
        }
        return this.#getDataFromConfigs(opts);
    }
    /**
     * Same as {@link register} but register properties infinitely deep.
     * Values (both the initial value and values assigned at a later point in
     * time) will be recursively traversed and registered, limited by
     * {@link Options.deepFilter}.
     *
     * Shorthand for {@link register} with the the deepest configured
     * {@link Options.depth} set to `Infinity`.
     *
     * @param key The property name to register.
     * @param initialValue The initial value that will be assigned after registering.
     */
    static registerRecursive(key, initialValue, config = {}) {
        const opts = this.#prepareConfig(config);
        this.#registerGeneric(key, initialValue, opts, true);
        return this.#getDataFromConfigs(opts);
    }
    /**
     * Same as {@link registerFrom} but register all properties within the given
     * object infinitely deep.
     * Values (both the initial values and values assigned at a later point in
     * time) will be recursively traversed and registered, limited by
     * {@link Options.deepFilter}.
     *
     * @param object The object the keys and symbols of will be registered.
     */
    static registerRecursiveFrom(object, config) {
        const opts = this.#prepareConfig(config);
        for (const key of Object.keys(object)) {
            ReactiveStorage.#registerGeneric(key, object[key], opts, true);
        }
        for (const symbol of Object.getOwnPropertySymbols(object)) {
            ReactiveStorage.#registerGeneric(symbol, object[symbol], opts, true);
        }
        return this.#getDataFromConfigs(opts);
    }
    // ---- Static helpers ----
    static #registerGeneric(key, initialValue, config, recursive = false) {
        for (const opts of config) {
            if (Array.isArray(key)) {
                for (const singleKey of key) {
                    this.#register(singleKey, initialValue, opts, recursive);
                }
            }
            else {
                this.#register(key, initialValue, opts, recursive);
            }
        }
    }
    static #register(key, initialValue, config, recursive, path = [key]) {
        const target = config.target || {};
        const endpoint = config.shallowEndpoint || {};
        // These simply discard any potential 'inherit' values
        const depthFilter = (config.depthFilter !== 'inherit' && config.depthFilter) || Filter.objectLiteralOrArray;
        const customGetter = (config.getter !== 'inherit' && config.getter) || undefined;
        const customSetter = (config.setter !== 'inherit' && config.setter) || undefined;
        const customPostSetter = (config.postSetter !== 'inherit' && config.postSetter) || undefined;
        const enumerable = config.enumerable != null ? config.enumerable : true;
        let getter = () => endpoint[key];
        let setter = (val) => endpoint[key] = val;
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
                // Inherit properties when `config.depth` is set to a number
                depthOpts.setter ??= config.setter;
                depthOpts.getter ??= config.getter;
                depthOpts.postSetter ??= config.postSetter;
                depthOpts.depthFilter ??= config.depthFilter;
            }
            else {
                depthOpts = Object.assign({}, config.depth);
                if (depthOpts.target)
                    delete depthOpts.target;
                if (depthOpts.shallowEndpoint)
                    delete depthOpts.shallowEndpoint;
                if (depthOpts.setter === 'inherit')
                    depthOpts.setter = config.setter;
                if (depthOpts.getter === 'inherit')
                    depthOpts.getter = config.getter;
                if (depthOpts.postSetter === 'inherit')
                    depthOpts.postSetter = config.postSetter;
                if (depthOpts.depthFilter === 'inherit')
                    depthOpts.depthFilter = config.depthFilter;
            }
            // Always inherit `enumerable` unless configured explicitly
            depthOpts.enumerable ??= config.enumerable;
        }
        Object.defineProperty(target, key, {
            configurable: true,
            enumerable: enumerable,
            get: () => {
                // Request the value via the getter only exactly once!
                const val = getter();
                return customGetter?.({ val, path }) ?? val;
            },
            set: (val) => {
                const prevVal = getter();
                if (!customSetter?.({ val, prevVal, initial, path, set: setter })) {
                    setter(val);
                }
                if (!!depthOpts && typeof val === 'object' && depthFilter(val, path)) {
                    // We don't need to save the deep target anywhere
                    // because it is exposed via the updated getter below
                    // @ts-ignore
                    depthOpts.target = Array.isArray(val) ? [] : {};
                    depthOpts.shallowEndpoint = {};
                    for (const propKey of Object.keys(val)) {
                        this.#register(propKey, val[propKey], depthOpts, recursive, [...path, propKey]);
                    }
                    for (const symbol of Object.getOwnPropertySymbols(val)) {
                        this.#register(symbol, val[symbol], depthOpts, recursive, [...path, symbol]);
                    }
                    getter = () => depthOpts.target;
                }
                else {
                    getter = () => endpoint[key];
                }
                customPostSetter?.({ val, prevVal, initial, path });
            },
        });
        if (initialValue !== undefined) {
            target[key] = initialValue;
        }
        initial = false;
    }
    /**
     * Prepare a passed config such that missing endpoints and targets are filled
     * with an empty object and multiple configurations are sequentially linked
     * together into a definition chain by their targets and endpoints. Every
     * config is shallowly cloned.
     * @internal
     */
    static #prepareConfig(config) {
        if (Array.isArray(config)) {
            for (let i = config.length - 1; i >= 0; i--) {
                config[i] = Object.assign({ target: {} }, config[i]);
                if (i > 0) {
                    config[i - 1].shallowEndpoint = config[i].target;
                }
            }
            config[config.length - 1].shallowEndpoint ||= {};
            return config;
        }
        else {
            return [
                Object.assign({
                    target: {},
                    shallowEndpoint: {},
                }, config)
            ];
        }
    }
    static #getDataFromConfigs(config) {
        return {
            shallowEndpoint: config[config.length - 1].shallowEndpoint,
            target: config[0].target,
            targets: config.map(conf => conf.target),
        };
    }
}
