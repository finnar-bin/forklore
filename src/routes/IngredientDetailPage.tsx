import Box from "@mui/material/Box";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { IngredientDetail } from "../features/pantry/IngredientDetail";
import { useSyncedActiveGroupId } from "../store/useAppStore";

export function IngredientDetailPage() {
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>();
  const groupId = useSyncedActiveGroupId(routeGroupId);
  const navigate = useNavigate();
  const location = useLocation();
  // /community-pantry/:ingredientId reuses this same component (no
  // route-level groupId) — see docs/pending-deviations.md ("Community
  // pantry"). IngredientDetail itself derives edit/delete permission from
  // the loaded row's own is_community/created_by, not from this backPath.
  const backPath = location.pathname.startsWith("/community-pantry")
    ? "/community-pantry"
    : groupId
      ? `/groups/${groupId}/pantry`
      : "/pantry";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader title="Ingredient" onBack={() => navigate(backPath)} />
      <IngredientDetail groupId={groupId} backPath={backPath} />
    </Box>
  );
}
