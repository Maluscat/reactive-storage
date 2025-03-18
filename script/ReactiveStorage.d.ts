export type ObjectKey = number | string | symbol;
export type Data = Record<ObjectKey, any> | Array<any>;
export type Endpoint = Record<ObjectKey, any> | Map<ObjectKey, any> | ReactiveStorage;
export interface RegistrationOptions<V> {
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
    depth: number | Partial<RegistrationOptions<any>>;
    /**
     * The endpoint that the registered getters and setters point to.
     *
     * If given *a {@link ReactiveStorage} object*, the given property is registered
     * onto it via {@link ReactiveStorage.register}, if not already done, with the
     * default options. Register an endpoint's property yourself to control its options.
     *
     * @default The current {@link ReactiveStorage}'s {@link ReactiveStorage.endpoint}.
     */
    endpoint: Endpoint;
    postSetter: (val: V, info: {
        prevVal: V;
        path: ObjectKey[];
    }) => void;
    setter: (val: V, info: {
        prevVal: V;
        path: ObjectKey[];
    }) => void | boolean;
    getter: (args: {
        val: V;
        path: ObjectKey[];
    }) => V;
}
export declare class ReactiveStorageError extends Error {
    constructor(...args: any[]);
}
export declare class ReactiveStorage {
    #private;
    /**
     * Endpoint holding the definitive values of the registered properties.
     *
     * Values MUST NOT be overriden!
     */
    readonly endpoint: Endpoint;
    readonly data: Data;
    constructor(data?: Data);
    has(key: ObjectKey): boolean;
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
    register<V extends any>(key: any, initialValue: V, options?: Partial<RegistrationOptions<V>>): this;
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
    registerRecursive<V extends object>(key: any, initialValue: V, options?: Partial<Omit<RegistrationOptions<V>, 'deep'>>): this;
    static register<V extends any>(target: Data, key: any, initialValue: V, options?: Partial<RegistrationOptions<V>>): Record<ObjectKey, any> | Map<ObjectKey, any>;
    static registerRecursive<V extends any>(target: Data, key: any, initialValue: V, options?: Partial<RegistrationOptions<V>>): Record<ObjectKey, any> | Map<ObjectKey, any>;
}
