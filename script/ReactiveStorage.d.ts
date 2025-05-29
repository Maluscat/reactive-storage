export type ObjectKey = number | string | symbol;
export type FilterFunction = (obj: object, path: ObjectKey[]) => boolean;
export type Endpoint = Record<ObjectKey, any> | Map<ObjectKey, any>;
export type Target<KV> = {
    [Key in keyof KV]: KV[Key];
};
/**
 * Central configuration for registering properties.
 *
 * If given an array, properties will be registered separately for each
 * configuration, each pointing to the next by linking their endpoints and
 * targets. This results in multiple intermediate sequential data storages,
 * propagated from last to first.
 *
 * @example
 * ```js
 * const storage = new ReactiveStorage([
 *   { getter: ({ val }) => Math.round(val / 50) * 50 },
 *   { getter: ({ val }) => Math.round(val / 5) * 5 },
 * ]);
 * storage.registerRecursive('value', 62);
 *
 * console.log(storage.targets[1].value) // 60
 * // Second getter turns 62 into 60
 * console.log(storage.targets[0].value) // 50
 * // Second getter turns 62 into 60
 * ```
 *
 * @see {@link OptionsWhole}
 */
export type Configuration<KV extends Record<ObjectKey, any> = Record<ObjectKey, any>> = Options<KV> | [
    ...Omit<Options<KV>, 'endpoint'>[],
    Options<KV>
];
export interface RegistrationData<KV extends Record<ObjectKey, any>> {
    /**
     * The endpoint holding the actual data of the registered properties.
     *
     * @see {@link OptionsWhole.endpoint}
     */
    endpoint: Endpoint;
    /**
     * The first access point for registered properties.
     * Always the first element of {@link targets}.
     *
     * @see {@link OptionsWhole.target}
     */
    target: Target<KV>;
    /**
     * All access points for registered properties in sequential order.
     * This is only relevant if having defined multiple configurations, and such,
     * multiple intermediate storage points. Otherwise {@link target} can be used
     * as well.
     *
     * @see {@link OptionsWhole.targets}
     */
    targets: Target<KV>[];
}
/** {@link Options.getter} event argument. */
export interface GetterEvent {
    /** Value that was fetched, from the underlying endpoint. */
    val: any;
    /**
     * Key path of the property in question, starting with the registered key.
     *
     * @example
     * ```js
     * const storage = new ReactiveStorage({
     *   getter: ({ path }) => { console.log("GET:", path) },
     * });
     * storage.registerRecursive('value', { first: { second: 3 } });
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
/** {@link Options.postSetter} event argument. */
export interface PostSetterEvent {
    /** Value that was set. */
    val: any;
    /** Whether this call is propagated by the initial registration action. */
    initial: boolean;
    /** Previous value. */
    prevVal: any;
    /**
     * Key path of the property in question, starting with the registered key.
     *
     * @example
     * ```js
     * const storage = new ReactiveStorage({
     *   setter: ({ path }) => { console.log("SET:", path) }
     * });
     * storage.registerRecursive('value', { first: { second: 3 } });
     *
     * // <Logs from the initial assignment...>
     *
     * storage.data.value.first.second = 4
     * // "SET: ['value', 'first', 'second']"
     * ```
     */
    path: ObjectKey[];
}
/** {@link Options.setter} event argument. */
export interface SetterEvent extends PostSetterEvent {
    /** Value to be set. */
    val: any;
    /**
     * Default setter that can be used to set a value different from the passed
     * one to the expected endpoint. When using it, you should prevent the
     * default value from being set by returning `true`.
     */
    set: (val: any) => void;
}
export type Options<KV extends Record<ObjectKey, any> = Record<ObjectKey, any>> = {
    [Prop in keyof OptionsWhole<KV>]?: Prop extends 'depth' ? number | Options<KV> : OptionsWhole<KV>[Prop];
};
export interface OptionsWhole<KV extends Record<ObjectKey, any> = Record<ObjectKey, any>> {
    /**
     * The endpoint that the registered property points to which holds the actual
     * data, so an object that the configured setter and getter will deposit the
     * value to and fetch the value from, respectively.
     *
     * @default {}
     */
    endpoint: Endpoint;
    /**
     * An object that represents the access point for the registered properties.
     * Values are deposited at the specified {@link endpoint}.
     * @default {}
     */
    target: Target<KV>;
    /**
     * Decide whether to deeply register an object covered by {@link depth}.
     * This is useful to mitigate registering properties within *any* object
     * (class instances, DOM nodes, etc.) in favor of simpler objects –
     * especially when making use of an infinite depth.
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
     * The first layer will deeply register *any* object, depth 1 and below
     * accept only object literals or arrays.
     * ```js
     * ReactiveStorage.registerRecursive('value', 420, {
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
    depthFilter?: FilterFunction;
    /**
     * Whether registered properties should be enumerable inside {@link target}.
     * Corresponds to {@link PropertyDescriptor.enumerable}.
     * @default true
     */
    enumerable?: boolean;
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
     * const storage = new ReactiveStorage({
     *   setter: val => { console.log("First layer:", val) },
     *   depth: {
     *     setter: val => { console.log("Further layer:", val) },
     *     depth: Infinity
     *   }
     * });
     * storage.register('recursive', { first: { second: 3 } });
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
     * Even though the initial hierarchy is temporarily deleted by assigning a
     * primitive value of "4", another reassigned value is simply re-registered
     * with the initial configuration (note that since the `depth` is merely set
     * to 1, any potential value inside `second2` will not be reactive).
     * ```js
     * const storage = new ReactiveStorage({
     *   setter: val => { console.log("SET", val) },
     *   depth: 1
     * });
     * storage.register('value', { first: { second: 3 } });
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
    depth?: number | Omit<OptionsWhole, 'target'>;
    /**
     * Called *after* a value has been set.
     */
    postSetter?: (event: PostSetterEvent) => void;
    /**
     * Called *before* a value is set.
     *
     * Return `true` to prevent the value from being set to the default endpoint.
     * This can be useful to filter specific values or when setting them manually,
     * in which case the passed {@link SetterEvent.set} is useful.
     */
    setter?: (event: SetterEvent) => void | boolean;
    /**
     * Called anytime a value is fetched.
     *
     * @remarks
     * This is potentially called a lot since, as per the getter/setter hierarchy,
     * any deep value *set* needs to *get* the respective value from a layer above.
     *
     * @example
     * ```js
     * const storage = new ReactiveStorage({
     *   getter: val => { console.log("GET", val) },
     *   depth: Infinity
     * });
     * storage.register('value', { first: { second: 3 } });
     *
     * storage.data.value.first.second = 8
     * // "GET { first: { second: 3 } }"
     * // "GET { second: 8 }"
     * // "GET 8"
     * ```
     */
    getter?: (event: GetterEvent) => any;
}
/**
 * Provides some useful filter functions for use in
 * {@link Options.depthFilter}.
 *
 * Also exposed via {@link ReactiveStorage.Filter}.
 */
export declare const Filter: {
    /** Matches only object literals and arrays. */
    readonly objectLiteralOrArray: (obj: object) => boolean;
    /** Matches everything (always returns true). */
    readonly any: () => true;
};
export declare class ReactiveStorage<KV extends Record<ObjectKey, any>> implements RegistrationData<KV> {
    #private;
    /** @see {@link Filter} */
    static readonly Filter: {
        /** Matches only object literals and arrays. */
        readonly objectLiteralOrArray: (obj: object) => boolean;
        /** Matches everything (always returns true). */
        readonly any: () => true;
    };
    readonly endpoint: Endpoint;
    readonly target: Target<KV>;
    readonly targets: Target<KV>[];
    readonly config: OptionsWhole<KV>[];
    constructor(config?: Configuration<KV>);
    /** Check for existence of a registered property on {@link target}. */
    has(key: ObjectKey): boolean;
    /** Delete {@link target} and {@link endpoint} entry of a registered property. */
    delete(key: ObjectKey): boolean;
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
    register<K extends keyof KV>(key: K | K[], initialValue?: KV[K]): this;
    /**
     * Register all property keys and symbols of the given object with their
     * respective values according to the current instance's configuration
     * ({@link config}).
     *
     * @param object The object the keys and symbols of will be registered.
     *
     * @return The current {@link ReactiveStorage} instance for easy chaining.
     */
    registerFrom(object: Partial<KV>): this;
    /**
     * Register a reactive property one or multiple targets that point to an
     * endpoint. If left unspecified, target and/or endpoint will be a new object
     * that can be obtained using the returned data.
     *
     * @param key The property name to register.
     * @param initialValue The initial value that will be assigned after registering.
     *
     * @privateRemarks
     * There is currently no way to make the generics sound since they cannot be
     * optional without a default value.
     */
    static register<KV extends Record<K, V>, K extends ObjectKey = keyof KV, V extends any = KV[K]>(key: K | K[], initialValue?: V, config?: Configuration<KV>): RegistrationData<KV>;
    /**
     * Register all property keys and symbols of the given object with their
     * respective values. If left unspecified, target and/or endpoint will be a
     * new object that can be obtained using the returned data.
     *
     * @param object The object the keys and symbols of will be registered.
     */
    static registerFrom<KV extends Record<ObjectKey, any>>(object: KV, config: Configuration<KV>): RegistrationData<KV>;
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
    static registerRecursive<KV extends Record<K, V>, K extends ObjectKey = keyof KV, V extends any = KV[K]>(key: K | K[], initialValue?: V, config?: Configuration<KV>): RegistrationData<KV>;
    /**
     * Same as {@link registerFrom} but register all properties within the given
     * object infinitely deep.
     * Values (both the initial values and values assigned at a later point in
     * time) will be recursively traversed and registered, limited by
     * {@link Options.deepFilter}.
     *
     * @param object The object the keys and symbols of will be registered.
     */
    static registerRecursiveFrom<KV extends Record<ObjectKey, any>>(object: KV, config: Configuration<KV>): RegistrationData<KV>;
}
