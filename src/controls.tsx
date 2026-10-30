import { cc, getRawProps, inject, provide, type InjectionKey, type SinwanNode } from "sinwan/component";
import { For, Show } from "sinwan/control-flow";
import { computed, signal, type Computed, type Signal } from "sinwan/reactivity";
import { Slot } from "./slot";
import { Presence } from "./core";

function toValueList(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : v ? [v] : [];
}

// ─── Tabs ───────────────────────────────────────────────────

export const TabsKey: InjectionKey<{
  value: Signal<string> | Computed<string>;
  setValue: (v: string) => void;
}> = Symbol("sinwan-ui.tabs");

export const TabsRoot = cc<{
  children?: SinwanNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  class?: string;
  orientation?: "horizontal" | "vertical";
}>((props) => {
  const valueLocal = signal(props.defaultValue ?? "");
  const value =
    "value" in props ? computed(() => props.value ?? "") : valueLocal;
  const set = (next: string) => {
    if (!("value" in props)) valueLocal.value = next;
  };
  provide(TabsKey, {
    value,
    setValue: (v: string) => {
      set(v);
      props.onValueChange?.(v);
    },
  });
  return (
    <div
      data-slot="tabs"
      data-orientation={props.orientation ?? "horizontal"}
      data-horizontal={(props.orientation ?? "horizontal") === "horizontal" ? "" : undefined}
      data-vertical={props.orientation === "vertical" ? "" : undefined}
      class={props.class}
    >
      {props.children}
    </div>
  );
});

export const TabsList = cc<{
  children?: SinwanNode;
  class?: string;
  "data-variant"?: string;
}>(({ children, class: className, "data-variant": dataVariant }) => (
  <div
    role="tablist"
    data-slot="tabs-list"
    data-variant={dataVariant}
    class={className}
  >
    {children}
  </div>
));

export const TabsTrigger = cc<{
  children?: SinwanNode;
  class?: string;
  value: string;
  disabled?: boolean;
}>(({ children, class: className, value, disabled }) => {
  const api = inject(TabsKey)!;
  return (
    <button
      type="button"
      role="tab"
      data-slot="tabs-trigger"
      data-state={api.value.value === value ? "active" : "inactive"
      }
      aria-selected={api.value.value === value}
      disabled={disabled}
      class={className}
      onclick={() => {
        if (!disabled) api.setValue(value);
      }}
    >
      {children}
    </button>
  );
});

export const TabsContent = cc<{
  children?: SinwanNode;
  class?: string;
  value: string;
}>(({ children, class: className, value }) => {
  const api = inject(TabsKey)!;
  return (
    <Show when={api.value.value === value}>
      <div
        role="tabpanel"
        data-slot="tabs-content"
        data-state="active"
        class={className}
      >
        {children}
      </div>
    </Show>
  );
});

// ─── Accordion ──────────────────────────────────────────────

export const AccordionKey: InjectionKey<{
  type: "single" | "multiple";
  value: Signal<string[]> | Computed<string[]>;
  toggle: (item: string) => void;
}> = Symbol("sinwan-ui.accordion");

export const AccordionItemKey: InjectionKey<{ value: string }> = Symbol(
  "sinwan-ui.accordion-item",
);

export const AccordionRoot = cc<{
  children?: SinwanNode;
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (v: string | string[]) => void;
  class?: string;
  collapsible?: boolean;
}>((props) => {
  const type = props.type ?? "single";
  const collapsible = props.collapsible ?? true;
  const valueLocal = signal(toValueList(props.defaultValue));
  const value =
    "value" in props ? computed(() => toValueList(props.value)) : valueLocal;
  const set = (next: string[]) => {
    if (!("value" in props)) valueLocal.value = next;
  };

  provide(AccordionKey, {
    type,
    value,
    toggle: (item: string) => {
      let next: string[];
      if (type === "single") {
        const open = value.value.includes(item);
        next = open && collapsible ? [] : [item];
      } else {
        next = value.value.includes(item)
          ? value.value.filter((v) => v !== item)
          : [...value.value, item];
      }
      set(next);
      props.onValueChange?.(type === "single" ? (next[0] ?? "") : next);
    },
  });

  return (
    <div data-slot="accordion" class={props.class}>
      {props.children}
    </div>
  );
});

export const AccordionItem = cc<{
  children?: SinwanNode;
  class?: string;
  value: string;
}>(({ children, class: className, value }) => {
  provide(AccordionItemKey, { value });
  const api = inject(AccordionKey)!;
  return (
    <div
      data-slot="accordion-item"
      data-state={api.value.value.includes(value) ? "open" : "closed"
      }
      class={className}
    >
      {children}
    </div>
  );
});

export const AccordionTrigger = cc<{
  children?: SinwanNode;
  class?: string;
}>(({ children, class: className }) => {
  const root = inject(AccordionKey)!;
  const item = inject(AccordionItemKey)!;
  return (
    <button
      type="button"
      data-slot="accordion-trigger"
      aria-expanded={root.value.value.includes(item.value) ? "true" : "false"
      }
      class={className}
      onclick={() => root.toggle(item.value)}
    >
      {children}
    </button>
  );
});

export const AccordionContent = cc<{
  children?: SinwanNode;
  class?: string;
}>(({ children, class: className }) => {
  const root = inject(AccordionKey)!;
  const item = inject(AccordionItemKey)!;
  function open() {
    return root.value.value.includes(item.value);
  }
  function stateAttr() {
    return open() ? "open" : "closed";
  }
  function bindContent(el: HTMLElement | null) {
    if (el == null) return;
    const node = el;
    function measure() {
      const inner = node.firstElementChild;
      const height =
        inner instanceof HTMLElement ? inner.scrollHeight : node.scrollHeight;
      node.style.setProperty("--radix-accordion-content-height", `${height}px`);
    }
    measure();
    requestAnimationFrame(measure);
  }
  return (
    <Presence
      present={open()}
    >
      <div
        data-slot="accordion-content"
        data-state={stateAttr}
        class={className}
        ref={bindContent}
      >
        {children}
      </div>
    </Presence>
  );
});

// ─── Checkbox / Switch / Radio / Toggle ─────────────────────

export const CheckboxRoot = cc<{
  checked?: boolean;
  indeterminate?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  class?: string;
  id?: string;
  name?: string;
  value?: string;
  "aria-label"?: string;
  children?: SinwanNode;
}>((props) => {
  const checkedLocal = signal(props.defaultChecked ?? false);
  const checked =
    "checked" in props ? computed(() => Boolean(props.checked)) : checkedLocal;
  const setChecked = (next: boolean) => {
    if (!("checked" in props)) checkedLocal.value = next;
  };
  const mixedLocal = signal(false);
  const mixed =
    "indeterminate" in props
      ? computed(() => Boolean(props.indeterminate))
      : mixedLocal;
  const setMixed = (next: boolean) => {
    if (!("indeterminate" in props)) mixedLocal.value = next;
  };
  return (
    <button
      type="button"
      role="checkbox"
      id={props.id}
      data-slot="checkbox"
      data-state={mixed.value ? "indeterminate" : checked.value ? "checked" : "unchecked"
      }
      aria-checked={(mixed.value ? "mixed" : checked.value)}
      aria-label={props["aria-label"]}
      disabled={props.disabled}
      class={props.class}
      name={props.name}
      value={props.value}
      onclick={() => {
        if (props.disabled) return;
        const next = mixed.value ? true : !checked.value;
        setChecked(next);
        setMixed(false);
        props.onCheckedChange?.(next);
      }}
    >
      {props.children}
    </button>
  );
});

export const SwitchRoot = cc<{
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  class?: string;
  id?: string;
  children?: SinwanNode;
  "data-size"?: string;
}>((props) => {
  const checkedLocal = signal(props.defaultChecked ?? false);
  const checked =
    "checked" in props ? computed(() => Boolean(props.checked)) : checkedLocal;
  const set = (next: boolean) => {
    if (!("checked" in props)) checkedLocal.value = next;
  };
  return (
    <button
      type="button"
      role="switch"
      id={props.id}
      data-slot="switch"
      data-size={props["data-size"]}
      data-state={(checked.value ? "checked" : "unchecked")}
      aria-checked={checked.value}
      disabled={props.disabled}
      class={props.class}
      onclick={() => {
        if (props.disabled) return;
        const next = !checked.value;
        set(next);
        props.onCheckedChange?.(next);
      }}
    >
      {props.children}
    </button>
  );
});

export const RadioGroupKey: InjectionKey<{
  value: Signal<string> | Computed<string>;
  setValue: (v: string) => void;
  name?: string;
}> = Symbol("sinwan-ui.radio-group");

export const RadioGroupRoot = cc<{
  children?: SinwanNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  class?: string;
  name?: string;
}>((props) => {
  const valueLocal = signal(props.defaultValue ?? "");
  const value =
    "value" in props ? computed(() => props.value ?? "") : valueLocal;
  const set = (next: string) => {
    if (!("value" in props)) valueLocal.value = next;
  };
  provide(RadioGroupKey, {
    value,
    name: props.name,
    setValue: (v: string) => {
      set(v);
      props.onValueChange?.(v);
    },
  });
  return (
    <div role="radiogroup" data-slot="radio-group" class={props.class}>
      {props.children}
    </div>
  );
});

export const RadioGroupItem = cc<{
  value: string;
  class?: string;
  disabled?: boolean;
  id?: string;
  children?: SinwanNode;
}>(({ value, class: className, disabled, id, children }) => {
  const api = inject(RadioGroupKey)!;
  return (
    <button
      type="button"
      role="radio"
      id={id}
      data-slot="radio-group-item"
      data-state={api.value.value === value ? "checked" : "unchecked"
      }
      aria-checked={api.value.value === value}
      disabled={disabled}
      class={className}
      onclick={() => {
        if (!disabled) api.setValue(value);
      }}
    >
      {children}
    </button>
  );
});

export const ToggleRoot = cc<{
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  disabled?: boolean;
  class?: string;
  children?: SinwanNode;
}>((props) => {
  const pressedLocal = signal(props.defaultPressed ?? false);
  const pressed =
    "pressed" in props
      ? computed(() => Boolean(props.pressed))
      : pressedLocal;
  const set = (next: boolean) => {
    if (!("pressed" in props)) pressedLocal.value = next;
  };
  return (
    <button
      type="button"
      data-slot="toggle"
      data-state={(pressed.value ? "on" : "off")}
      aria-pressed={pressed.value}
      disabled={props.disabled}
      class={props.class}
      onclick={() => {
        if (props.disabled) return;
        const next = !pressed.value;
        set(next);
        props.onPressedChange?.(next);
      }}
    >
      {props.children}
    </button>
  );
});

export const ToggleGroupKey: InjectionKey<{
  type: "single" | "multiple";
  value: Signal<string[]> | Computed<string[]>;
  toggle: (v: string) => void;
}> = Symbol("sinwan-ui.toggle-group");

export const ToggleGroupRoot = cc<{
  children?: SinwanNode;
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (v: string | string[]) => void;
  class?: string;
  style?: Record<string, string> | string;
  "data-variant"?: string;
  "data-size"?: string;
  "data-spacing"?: string | number;
  "data-orientation"?: string;
  [key: `aria-${string}`]: string | boolean | undefined;
}>((props) => {
  const type = props.type ?? "single";
  // Raw values keep getters, so a signal-driven aria-label stays live.
  const ariaProps = Object.fromEntries(
    Object.entries(getRawProps(props)).filter(([key]) => key.startsWith("aria-")),
  );
  const valueLocal = signal(toValueList(props.defaultValue));
  const value =
    "value" in props ? computed(() => toValueList(props.value)) : valueLocal;
  const set = (next: string[]) => {
    if (!("value" in props)) valueLocal.value = next;
  };
  provide(ToggleGroupKey, {
    type,
    value,
    toggle: (item: string) => {
      let next: string[];
      if (type === "single") {
        next = value.value.includes(item) ? [] : [item];
      } else {
        next = value.value.includes(item)
          ? value.value.filter((x) => x !== item)
          : [...value.value, item];
      }
      set(next);
      props.onValueChange?.(type === "single" ? (next[0] ?? "") : next);
    },
  });
  return (
    <div
      data-slot="toggle-group"
      role="group"
      class={props.class}
      style={props.style}
      data-variant={props["data-variant"]}
      data-size={props["data-size"]}
      data-spacing={props["data-spacing"]}
      data-orientation={props["data-orientation"]}
      {...ariaProps}
    >
      {props.children}
    </div>
  );
});

export const ToggleGroupItem = cc<{
  children?: SinwanNode;
  class?: string;
  value: string;
  disabled?: boolean;
  "data-variant"?: string;
  "data-size"?: string;
  "data-spacing"?: string | number;
}>(({
  children,
  class: className,
  value,
  disabled,
  "data-variant": dataVariant,
  "data-size": dataSize,
  "data-spacing": dataSpacing,
}) => {
  const api = inject(ToggleGroupKey)!;
  return (
    <button
      type="button"
      data-slot="toggle-group-item"
      data-variant={dataVariant}
      data-size={dataSize}
      data-spacing={dataSpacing}
      data-state={api.value.value.includes(value) ? "on" : "off"
      }
      disabled={disabled}
      class={className}
      onclick={() => {
        if (!disabled) api.toggle(value);
      }}
    >
      {children}
    </button>
  );
});

export { For, Show, Slot };
