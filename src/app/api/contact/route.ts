import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/mail";
import { z } from "zod";

const schema = z.object({
  name:    z.string().min(1).max(100),
  email:   z.string().email(),
  message: z.string().min(10).max(2000),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const { name, email, message } = parsed.data;
  const adminEmail = process.env["BREVO_ADMIN_EMAIL"] ?? "hello@msadhesif.fr";

  try {
    await sendEmail({
      to: adminEmail,
      subject: `[Contact] Message de ${name}`,
      html: `
        <h2>Nouveau message de contact</h2>
        <p><strong>Nom :</strong> ${name}</p>
        <p><strong>Email :</strong> <a href="mailto:${email}">${email}</a></p>
        <hr/>
        <p>${message.replace(/\n/g, "<br/>")}</p>
      `,
    });

    // Confirmation to sender
    await sendEmail({
      to: email,
      toName: name,
      subject: "Votre message a bien été reçu — MS Adhésif",
      html: `
        <p>Bonjour ${name},</p>
        <p>Nous avons bien reçu votre message et vous répondrons dans les plus brefs délais.</p>
        <p>— L'équipe MS Adhésif</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] email error:", err);
    return NextResponse.json({ error: "Erreur envoi email" }, { status: 500 });
  }
}
