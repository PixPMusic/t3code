import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { Link, useParams } from "@tanstack/react-router";
import { HouseIcon } from "lucide-react";

import { useHomes } from "../../state/home";
import { buildThreadRouteParams } from "../../threadRoutes";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";

export function SidebarHomeLinks() {
  const homes = useHomes();
  const params = useParams({ strict: false });
  const { isMobile, setOpenMobile } = useSidebar();
  if (homes.length === 0) return null;
  return (
    <SidebarGroup>
      <SidebarMenu>
        {homes.map((home) => (
          <SidebarMenuItem key={home.environmentId}>
            <SidebarMenuButton
              isActive={
                params.environmentId === home.environmentId && params.threadId === home.threadId
              }
              render={
                <Link
                  to="/$environmentId/$threadId"
                  params={buildThreadRouteParams(scopeThreadRef(home.environmentId, home.threadId))}
                />
              }
              onClick={() => {
                if (isMobile) setOpenMobile(false);
              }}
            >
              <HouseIcon />
              <span>{homes.length > 1 ? `Home · ${home.label}` : "Home"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
