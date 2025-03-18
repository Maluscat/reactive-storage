export type ObjectKey = number | string | symbol;
export type Data = Record<ObjectKey, any> | Array<any>;
export type Endpoint = Record<ObjectKey, any> | Map<ObjectKey, any>;
export type RegistrationOptions = Partial<RegistrationOptionsWhole>;
export interface RegistrationOptionsWhole {
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
     * If given *registration options*, the registered key configuration will
     * assume these options in their layer. Can be nested infinitely deep.
     *
     * If given *a number*, keys will be registered recursively up until
     * the given depth, assuming the options present in the given scope.
     * Can be {@link Infinity}.
     *
     * @example
     * ```ts
     * const storage = new ReactiveStorage();
     * storage.register('recursive', { first: { second: 3 } }, {
     *   setter: val => { console.log("First layer:", val) },
     *   depth: {
     *     setter: val => { console.log("Further layer:", val) },
     *     depth: Infinity
     *   }
     * });
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
     * @default 0
     */
    depth: number | RegistrationOptions;
    /**
     * The endpoint that the registered getters and setters point to.
     *
     * If given *a {@link ReactiveStorage} object*, the given property is registered
     * onto it via {@link ReactiveStorage.register}, if not already done, with the
     * default options. Register an endpoint's property yourself to control its options.
     *
     * @default The current {@link ReactiveStorage}'s {@link ReactiveStorage.endpoint}.
     */
    endpoint: Endpoint | ReactiveStorage;
    postSetter: (val: any, info: {
        prevVal: any;
        path: ObjectKey[];
    }) => void;
    setter: (val: any, info: {
        prevVal: any;
        path: ObjectKey[];
    }) => void | boolean;
    getter: (args: {
        val: any;
        path: ObjectKey[];
    }) => any;
}
export declare class ReactiveStorageError extends Error {
    constructor(...args: any[]);
}
export declare class ReactiveStorage {
    #private;
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
    constructor(data?: Data);
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
