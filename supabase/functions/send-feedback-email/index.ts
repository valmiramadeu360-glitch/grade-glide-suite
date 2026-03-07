import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "eduflow.adm.academy@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category, message, is_anonymous, user_email } = await req.json();

    const senderInfo = is_anonymous ? "Anônimo" : (user_email || "Usuário não identificado");

    // Log the feedback for admin review
    // In production, integrate with an email API (Resend, SendGrid, etc.)
    // For now, we store and log
    console.log("=== NOVO FEEDBACK EDUFLOW ===");
    console.log(`Destinatário: ${ADMIN_EMAIL}`);
    console.log(`Categoria: ${category}`);
    console.log(`Remetente: ${senderInfo}`);
    console.log(`Mensagem: ${message}`);
    console.log("=============================");

    // TODO: Integrate with email service to send to ADMIN_EMAIL
    // Example with Resend:
    // const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    // await resend.emails.send({
    //   from: "EduFlow <noreply@eduflow.app>",
    //   to: [ADMIN_EMAIL],
    //   subject: `[EduFlow Feedback] ${category}`,
    //   html: `<h2>${category}</h2><p>${message}</p><p>De: ${senderInfo}</p>`,
    // });

    return new Response(
      JSON.stringify({ success: true, admin: ADMIN_EMAIL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
