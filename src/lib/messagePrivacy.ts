import { supabase } from "@/integrations/supabase/client";

export type DMPrivacyStatus = 
  | "allowed"
  | "blocked_private"
  | "blocked_not_following"
  | "marketplace_allowed";

export interface DMPermissionCheck {
  allowed: boolean;
  status: DMPrivacyStatus;
  message?: string;
}

/**
 * Valida se o usuário atual pode enviar mensagens para o destinatário,
 * respeitando perfis privados e aplicando a exceção de anúncios do Marketplace.
 */
export async function checkCanMessageUser(
  currentUserId: string,
  targetUserId: string,
  isMarketplaceContext = false
): Promise<DMPermissionCheck> {
  if (!currentUserId || !targetUserId) {
    return { allowed: false, status: "blocked_private", message: "Usuário inválido." };
  }

  if (currentUserId === targetUserId) {
    return { allowed: true, status: "allowed" };
  }

  // Exceção de marketplace: sempre permitido negociar itens anunciados
  if (isMarketplaceContext) {
    return { 
      allowed: true, 
      status: "marketplace_allowed",
      message: "Contato iniciado através do Marketplace."
    };
  }

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("privacy_dm, display_name, full_name")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (error || !profile) {
      return { allowed: true, status: "allowed" };
    }

    const privacy = profile.privacy_dm || "public";
    const name = profile.display_name || profile.full_name || "Este usuário";

    if (privacy === "private") {
      return {
        allowed: false,
        status: "blocked_private",
        message: `${name} possui perfil privado e não aceita mensagens diretas.`
      };
    }

    if (privacy === "followers") {
      const { data: follow } = await supabase
        .from("follows")
        .select("id")
        .or(`and(follower_id.eq.${currentUserId},following_id.eq.${targetUserId}),and(follower_id.eq.${targetUserId},following_id.eq.${currentUserId})`)
        .maybeSingle();

      if (!follow) {
        return {
          allowed: false,
          status: "blocked_not_following",
          message: `${name} só aceita mensagens diretas de estudantes que segue ou que o seguem.`
        };
      }
    }

    return { allowed: true, status: "allowed" };
  } catch {
    return { allowed: true, status: "allowed" };
  }
}
