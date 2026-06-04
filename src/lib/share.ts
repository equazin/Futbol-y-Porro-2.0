import { toast } from "sonner";

export async function shareMatch(opts: { id: string; title: string; text: string }) {
  const url = `${window.location.origin}/partidos/${opts.id}`;
  const shareData = { title: opts.title, text: opts.text, url };
  try {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await navigator.share(shareData);
      return;
    }
  } catch {
    // fall through to copy
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado", { description: "Pegalo en el grupo de WhatsApp." });
  } catch {
    toast.error("No pudimos copiar el link", { description: url });
  }
}
