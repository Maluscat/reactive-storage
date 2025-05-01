export type ObjectKey = number | string | symbol;
export type FilterFunction = (obj: object, path: ObjectKey[]) => boolean;
export type Endpoint = Record<ObjectKey, any> | Map<ObjectKey, any>;
export type Data<KV> = {
    [Key in keyof KV]: KV[Key];
};
export type RegistrationData<KV extends Record<ObjectKey, any>> = Pick<RegistrationOptionsWhole<KV>, 'target' | 'endpoint'>;
/** {@link RegistrationOptions.getter} event argument. */
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
/** {@link RegistrationOptions.postSetter} event argument. */
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
/** {@link RegistrationOptions.setter} event argument. */
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
export type RegistrationOptions<KV extends Record<ObjectKey, any> = Record<ObjectKey, any>> = {
    [Prop in keyof RegistrationOptionsWhole<KV>]?: Prop extends 'depth' ? number | RegistrationOptions<KV> : RegistrationOptionsWhole<KV>[Prop];
};
export interface RegistrationOptionsWhole<KV extends Record<ObjectKey, any> = Record<ObjectKey, any>> {
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
    target: Data<KV>;
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
    depth?: number | Omit<RegistrationOptionsWhole, 'target'>;
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
export declare class ReactiveStorage<KV extends Record<ObjectKey, any>> {
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
     * @see {@link RegistrationOptions.endpoint}
     */
    get endpoint(): Endpoint;
    /**
     * Access point for registered properties.
     * @see {@link RegistrationOptions.target}
     */
    get target(): Data<KV>;
    readonly config: RegistrationOptionsWhole<KV>;
    constructor(config?: RegistrationOptions<KV>);
    /** Check for existence of a registered property on {@link target}. */
    has(key: ObjectKey): boolean;
    /** Delete {@link target} and {@link endpoint} entry of a registered property. */
    delete(key: ObjectKey): boolean;
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
    register<K extends keyof KV>(key: K | K[], initialValue?: KV[K]): this;
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
    static register<KV extends Record<K, V>, K extends ObjectKey = keyof KV, V extends any = KV[K]>(key: K | K[], initialValue?: V, config?: RegistrationOptions<KV>): RegistrationData<KV>;
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
    static registerRecursive<KV extends Record<K, V>, K extends ObjectKey = keyof KV, V extends any = KV[K]>(key: K | K[], initialValue?: V, config?: RegistrationOptions<KV>): RegistrationData<KV>;
}
