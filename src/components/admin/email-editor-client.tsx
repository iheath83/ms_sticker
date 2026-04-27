"use client";

import { useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { EmailTemplateType } from "@/db/schema";
import { saveEmailTemplate, resetEmailTemplate } from "@/lib/email-template-actions";
import type { EmailBlock } from "@/lib/email-blocks";
import { TEMPLATE_VAR_TOKENS } from "@/lib/email-blocks";
import { UNLAYER_DESIGNS } from "@/lib/unlayer-designs";

// Unlayer must be loaded client-side only (uses window)
const EmailEditor = dynamic(
  () => import("react-email-editor").then((m) => m.default),
  { ssr: false, loading: () => <EditorSkeleton /> },
);

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function EditorSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-100">
      <div className="text-center text-gray-400">
        <div className="text-5xl mb-4 animate-pulse">📧</div>
        <p className="text-sm font-semibold">Chargement de l&apos;éditeur…</p>
        <p className="text-xs mt-1">Unlayer se prépare</p>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  template: {
    type: EmailTemplateType;
    name: string;
    subject: string;
    blocks: EmailBlock[];
    designJson: Record<string, unknown> | null;
  };
}

type EditorRef = {
  editor: {
    exportHtml: (cb: (data: { html: string; design: Record<string, unknown> }) => void) => void;
    loadDesign: (design: Record<string, unknown>) => void;
  };
} | null;

// ─── Editor ───────────────────────────────────────────────────────────────────

export default function EmailEditorClient({ template }: Props) {
  const router = useRouter();
  const emailEditorRef = useRef<EditorRef>(null);
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState(template.subject);
  const [saveOk, setSaveOk] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [showVarRef, setShowVarRef] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // ─── Load design on ready ─────────────────────────────────────────────────

  const onReady = useCallback(() => {
    setIsEditorReady(true);

    const editor = emailEditorRef.current?.editor;
    if (!editor) return;

    // Priority: saved design from DB > default Unlayer design
    const designToLoad = template.designJson ?? UNLAYER_DESIGNS[template.type];
    if (designToLoad) {
      editor.loadDesign(designToLoad as never);
    }
  }, [template.designJson, template.type]);

  // ─── Save ─────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const editor = emailEditorRef.current?.editor;
    if (!editor) return;

    editor.exportHtml((data) => {
      startTransition(async () => {
        const res = await saveEmailTemplate(
          template.type,
          subject,
          template.blocks,
          data.design,
          data.html,
        );
        if (res.ok) {
          setSaveOk(true);
          setTimeout(() => setSaveOk(false), 2500);
        }
      });
    });
  };

  // ─── Reset to MS Adhésif default ─────────────────────────────────────────

  const handleReset = () => {
    if (!confirm("Réinitialiser ce template au design MS Adhésif par défaut ?")) return;
    const editor = emailEditorRef.current?.editor;
    const defaultDesign = UNLAYER_DESIGNS[template.type];
    if (editor && defaultDesign) {
      editor.loadDesign(defaultDesign as never);
    }
    startTransition(async () => {
      await resetEmailTemplate(template.type);
    });
  };

  // ─── Copy token ───────────────────────────────────────────────────────────

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-2.5 bg-[#0A0E27] border-b border-white/10 sticky top-0 z-20 shrink-0">

        <button
          onClick={() => router.push("/admin/emails")}
          className="text-sm text-white/50 hover:text-white transition-colors whitespace-nowrap"
        >
          ← Emails
        </button>

        <span className="text-white/20 hidden sm:block">|</span>

        {/* Subject input */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-white/40 text-xs hidden lg:block shrink-0">Objet :</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 min-w-0 bg-white/10 text-white text-sm rounded-lg px-3 py-1.5 border border-white/10 focus:border-red-500 focus:outline-none placeholder:text-white/30"
            placeholder="Objet de l'email…"
          />
        </div>

        {/* Variables dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowVarRef(!showVarRef)}
            className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-mono"
          >
            {"{ }"} Variables
          </button>

          {showVarRef && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowVarRef(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-30">
                <p className="text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Variables disponibles</p>
                <p className="text-xs text-gray-400 mb-3">Cliquer pour copier, puis coller dans l&apos;éditeur</p>
                <div className="space-y-1">
                  {Object.entries(TEMPLATE_VAR_TOKENS).map(([token, label]) => (
                    <button
                      key={token}
                      onClick={() => copyToken(token)}
                      className="w-full flex items-center justify-between text-xs rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors group"
                    >
                      <code className="text-blue-600 font-mono text-[11px]">{token}</code>
                      <span className="text-gray-400 text-[11px]">
                        {copied === token ? "✓ Copié !" : label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!isEditorReady && (
            <span className="text-xs text-white/40 animate-pulse hidden sm:block">Chargement…</span>
          )}

          <button
            onClick={handleReset}
            disabled={isPending || !isEditorReady}
            className="text-xs px-3 py-1.5 border border-white/20 text-white/60 hover:text-white hover:border-white/40 rounded-lg transition-colors disabled:opacity-40"
          >
            Réinitialiser
          </button>

          <button
            onClick={handleSave}
            disabled={isPending || !isEditorReady}
            className={`text-sm px-5 py-1.5 rounded-lg font-semibold transition-all disabled:opacity-40 ${
              saveOk
                ? "bg-green-500 text-white"
                : "bg-[#DC2626] hover:bg-red-700 text-white"
            }`}
          >
            {saveOk ? "✓ Sauvegardé" : isPending ? "…" : "Sauvegarder"}
          </button>
        </div>
      </div>

      {/* ── Unlayer ───────────────────────────────────────────────────────── */}
      <div style={{ height: "calc(100vh - 52px)", width: "100%", display: "flex", flexDirection: "column" }}>
        <EmailEditor
          ref={emailEditorRef as never}
          onReady={onReady}
          minHeight="100%"
          options={{
            displayMode: "email",
            locale: "fr-FR",
            features: {
              preview: true,
              imageEditor: true,
              undoRedo: true,
            },
            appearance: { theme: "light" },
          } as never}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  );
}
