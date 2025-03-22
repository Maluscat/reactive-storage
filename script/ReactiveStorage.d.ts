export type ObjectKey = number | string | symbol;
export type Data = Record<ObjectKey, any> | Array<any>;
export type Endpoint = Record<ObjectKey, any> | Map<ObjectKey, any>;
export type FilterFunction = (obj: object, path: ObjectKey[]) => boolean;
export interface GetterArgs {
    /** Value to be set. */
    val: any;
    /**
     * Key path of the value in question, starting with the registered key.
     *
     * @example
     * ```js
     * const storage = new ReactiveStorage();
     * storage.register('value', { first: { second: 3 } }, {
     *   getter: ({ path }) => { console.log("GET:", path) },
     *   depth: Infinity
     * });
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
export interface SetterArgs {
    /** Value to be set. */
    val: any;
    /** Previous value. */
    prevVal: any;
    /**
     * Key path of the value in question, starting with the registered key.
     *
     * @example
     * ```js
     * const storage = new ReactiveStorage();
     * storage.register('value', { first: { second: 3 } }, {
     *   setter: ({ path }) => { console.log("SET:", path) },
     *   depth: Infinity
     * });
     *
     * // <Logs from the initial assignment...>
     *
     * storage.data.value.first.second = 4
     * // "SET: ['value', 'first', 'second']"
     * ```
     */
    path: ObjectKey[];
}
export type RegistrationOptions = Partial<RegistrationOptionsWhole>;
export interface RegistrationOptionsWhole {
    /**
     * Whether the value should be enumerable inside {@link ReactiveStorage.data}.
     * Corresponds to {@link PropertyDescriptor.enumerable}.
     * @default true
     */
    enumerable: boolean;
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
     * const storage = new ReactiveStorage();
     * storage.register('recursive', { first: { second: 3 } }, {
     *   setter: val => { console.log("First layer:", val) },
     *   depth: {
     *     setter: val => { console.log("Further layer:", val) },
     *     depth: Infinity
     *   }
     * });
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
     * Even though the initial hierarchy is temporarily deleted by assigning
     * a primitive value of "4", another reassigned value is simply re-registered
     * with the initial configuration (note that since the `depth` is set to 1,
     * any potential value inside `second2` will not be reactive).
     * ```js
     * const storage = new ReactiveStorage();
     * storage.register('value', { first: { second: 3 } }, {
     *   setter: val => { console.log("SET", val) },
     *   depth: 1
     * });
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
    depth: number | RegistrationOptions;
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
     * The first layer will accept any object, depth 1 and below accept
     * only object literals or arrays.
     * ```js
     * const storage = new ReactiveStorage();
     * storage.registerRecursive('value', 420, {
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
     * The endpoint that the registered getters and setters point to.
     *
     * If given *a {@link ReactiveStorage} object*, the given property is registered
     * onto it with the current configuration, if not already done.
     *
     * Register an endpoint's property yourself to control its options.
     *
     * @default The current {@link ReactiveStorage}'s {@link ReactiveStorage.endpoint}.
     */
    endpoint: Endpoint | ReactiveStorage[] | ReactiveStorage;
    /**
     * Called *after* a value has been set.
     */
    postSetter: (args: SetterArgs) => void;
    /**
     * Called *before* a value is set.
     *
     * Return `true` to stop the value from being set.
     * This can be useful to filter specific values or when setting them manually.
     */
    setter: (args: SetterArgs) => void | boolean;
    /**
     * Called anytime a value is fetched.
     *
     * @remarks
     * This is potentially called a lot since, as per the getter/setter hierarchy,
     * any deep value *set* needs to *get* the respective value from a layer above.
     *
     * @example
     * ```js
     * const storage = new ReactiveStorage();
     * storage.register('value', { first: { second: 3 } }, {
     *   getter: val => { console.log("GET", val) },
     *   depth: Infinity
     * });
     *
     * storage.data.value.first.second = 8
     * // "GET { first: { second: 3 } }"
     * // "GET { second: 8 }"
     * // "GET 8"
     * ```
     */
    getter: (args: GetterArgs) => any;
}
export declare class ReactiveStorageError extends Error {
    constructor(...args: any[]);
}
/**
 * Provides some useful filter functions for use in
 * {@link RegistrationOptions.depthFilter}.
 *
 * Also exposed via {@link ReactiveStorage.Filter}.
 */
export declare const Filter: {
    /** Matches only object literals and arrays. */
    readonly objectLiteralOrArray: (obj: object) => boolean;
    /** Matches everything (always returns true). */
    readonly any: () => true;
};
export declare class ReactiveStorage {
    #private;
    /** @see {@link Filter} */
    static readonly Filter: {
        /** Matches only object literals and arrays. */
        readonly objectLiteralOrArray: (obj: object) => boolean;
        /** Matches everything (always returns true). */
        readonly any: () => true;
    };
    /**
     * Endpoint holding the actual values of the registered properties.
     *
     * Values should not be overridden.
     */
    readonly endpoint: Endpoint;
    /**
     * Access point for registered properties.
     * Can be customized in the constructor.
     */
    readonly data: Data;
    /**
     * @param data The {@link ReactiveStorage.data} object that represents
     *             the access point for the registered properties.
     * @param endpoint The {@link ReactiveStorage.endpoint} that holds the
     *                 actual registered data.
     */
    constructor(data?: Data, endpoint?: Endpoint);
    /** Check for existence of a registered property on {@link data}. */
    has(key: ObjectKey): boolean;
    /** Delete {@link data} and {@link endpoint} entry of a registered property. */
    delete(key: ObjectKey): boolean;
    /**
     * Register a reactive property on {@link data} that points to
     * the given endpoint or {@link endpoint} if unspecified.
     *
     * @param key The property name to register on {@link data}.
     * @param initialValue The initial value that will be assigned after registering.
     *
     * @returns The {@link ReactiveStorage} instance for easy chaining.
     */
    register(key: ObjectKey, initialValue: any, options?: RegistrationOptions): this;
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
    registerRecursive(key: ObjectKey, initialValue: any, options?: RegistrationOptions): this;
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
    static register<K extends ObjectKey, V extends any>(target: V[] | Record<K, V>, key: K, initialValue: V, options?: RegistrationOptions): Endpoint;
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
    static registerRecursive<K extends ObjectKey, V extends any>(target: V[] | Record<K, V>, key: K, initialValue: V, options?: RegistrationOptions): Endpoint;
}
