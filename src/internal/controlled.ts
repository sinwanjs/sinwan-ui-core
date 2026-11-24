import { devWarn } from "sinwan/dev";

/** A zero-argument function is a getter (live props, `useControllableState` options). */
function currentValue(props: object, key: string): unknown {
  const value: unknown = Reflect.get(props, key);
  return typeof value === "function" && value.length === 0 ? value() : value;
}

/**
 * Whether a control is controlled through `key`: the prop is present, even
 * when its value is `undefined`. In development, a present prop that is
 * `undefined` warns (SW202): the control would ignore input.
 *
 * sinwan-ui-core ships one bundle, so the check is guarded by
 * `process.env.NODE_ENV`, which `build.ts` leaves as is in `dist/`. The app's
 * bundler replaces it (Bun by default, Vite for dependencies): a production
 * build drops the check and its message; a development build keeps them.
 */
export function isControlledProp(
  props: object,
  key: string,
  component: string,
): boolean {
  if (!(key in props)) return false;
  if (
    process.env.NODE_ENV !== "production" &&
    currentValue(props, key) === undefined
  ) {
    devWarn(
      "SW202",
      `<${component}> ${key} is undefined: the control is controlled with no value and ignores input. Omit ${key}, or pass null or "" for an empty controlled value.`,
    );
  }
  return true;
}
