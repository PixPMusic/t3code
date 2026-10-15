import type { MenuAction } from "@react-native-menu/menu";
import {
  createContext,
  use,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Platform } from "react-native";

type FilterTab = "pullRequests";
type Filters = {
  readonly actions: readonly MenuAction[];
  readonly onSelect: (id: string) => void;
  readonly customized: boolean;
};
type WorkspaceFilters = Partial<Record<FilterTab, Filters>>;
const FiltersContext = createContext<WorkspaceFilters>({});
const RegisterFiltersContext = createContext<Dispatch<SetStateAction<WorkspaceFilters>> | null>(
  null,
);

/** PR filters render in the list body; they publish their menu to the header without re-rendering it. */
export function AndroidWorkspaceFiltersProvider(props: { readonly children: ReactNode }) {
  const [filters, setFilters] = useState<WorkspaceFilters>({});
  return (
    <RegisterFiltersContext value={setFilters}>
      <FiltersContext value={filters}>{props.children}</FiltersContext>
    </RegisterFiltersContext>
  );
}

export function useAndroidWorkspaceFilters() {
  return use(FiltersContext);
}

export function useRegisterAndroidWorkspaceFilters(
  tab: FilterTab,
  actions: readonly MenuAction[],
  onSelect: (id: string) => void,
  customized: boolean,
) {
  const register = use(RegisterFiltersContext);
  useEffect(() => {
    if (Platform.OS !== "android" || !register) return;
    const filters = { actions, onSelect, customized };
    register((current) => ({ ...current, [tab]: filters }));
    return () =>
      register((current) =>
        current[tab] === filters ? { ...current, [tab]: undefined } : current,
      );
  }, [register, tab, actions, onSelect, customized]);
}
