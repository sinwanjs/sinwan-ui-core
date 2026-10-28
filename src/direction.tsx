import { cc, inject, provide, type InjectionKey, type SinwanNode } from "sinwan/component";
import { computed, signal } from "sinwan/reactivity";

export type Direction = "ltr" | "rtl";

export type DirectionApi = {
  dir: { readonly value: Direction };
  setDir: (dir: Direction) => void;
};

export const DirectionKey: InjectionKey<DirectionApi> = Symbol(
  "sinwan-ui.direction",
);

export type DirectionProviderProps = {
  children?: SinwanNode;
  dir?: Direction;
};

export const DirectionProvider = cc<DirectionProviderProps>((props) => {
  const dirLocal = signal<Direction>("ltr");
  const dir = "dir" in props ? computed(() => props.dir ?? "ltr") : dirLocal;
  const setDir = (next: Direction) => {
    if (!("dir" in props)) dirLocal.value = next;
  };
  provide(DirectionKey, {
    dir,
    setDir,
  });
  return (
    <div
      dir={dir.value}
      data-slot="direction-provider"
    >
      {props.children}
    </div>
  );
});

export function useDirection(): Direction {
  const api = inject(DirectionKey);
  return api?.dir.value ?? "ltr";
}
