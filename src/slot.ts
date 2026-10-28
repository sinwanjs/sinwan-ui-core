import type { SinwanElement, SinwanNode } from "sinwan/component";
import { isComputed, isSignal, resolve } from "sinwan/reactivity";
import { flattenChildren, isSinwanElement } from "./types";

type AnyProps = Record<string, unknown>;

function isClassSource(value: unknown): boolean {
  return (
    typeof value === "string" ||
    isSignal(value) ||
    isComputed(value) ||
    (typeof value === "function" && value.length === 0)
  );
}

function classText(value: unknown): string {
  if (value == null) return "";
  if (!isClassSource(value)) return "";
  const resolved = resolve(value as string | (() => string));
  return typeof resolved === "string" ? resolved : "";
}

function mergeClass(a: unknown, b: unknown): unknown {
  const aReactive = isClassSource(a) && typeof a !== "string";
  const bReactive = isClassSource(b) && typeof b !== "string";
  if (aReactive || bReactive || typeof a === "function" || typeof b === "function") {
    return () => {
      const parts = [classText(a), classText(b)].filter(
        (part) => part.length > 0,
      );
      return parts.length === 0 ? undefined : parts.join(" ");
    };
  }
  const parts = [a, b].filter((v) => typeof v === "string" && v.length > 0);
  if (parts.length === 0) return undefined;
  return parts.join(" ");
}

function mergeProps(slotProps: AnyProps, childProps: AnyProps): AnyProps {
  const merged: AnyProps = { ...childProps, ...slotProps };
  const className = mergeClass(childProps.class, slotProps.class);
  if (className !== undefined) merged.class = className;
  else {
    delete merged.class;
  }

  for (const key of Object.keys(slotProps)) {
    if (!key.startsWith("on")) continue;
    const slotHandler = slotProps[key];
    const childHandler = childProps[key];
    if (typeof slotHandler === "function" && typeof childHandler === "function") {
      merged[key] = (...args: unknown[]) => {
        (childHandler as (...a: unknown[]) => void)(...args);
        (slotHandler as (...a: unknown[]) => void)(...args);
      };
    }
  }

  return merged;
}

/**
 * Merge Slot props onto a single Sinwan element child (asChild pattern).
 */
export function Slot(props: {
  children?: unknown;
  [key: string]: unknown;
}): SinwanNode {
  const { children, ...slotProps } = props;
  const flat = flattenChildren(children as SinwanNode | undefined).filter(
    (c) => c != null && c !== false && c !== true,
  );
  if (flat.length !== 1 || !isSinwanElement(flat[0])) {
    throw new Error("Slot expects exactly one Sinwan element child");
  }
  const child = flat[0] as SinwanElement;
  return {
    tag: child.tag,
    props: mergeProps(slotProps as AnyProps, child.props as AnyProps),
    children: child.children,
  };
}
