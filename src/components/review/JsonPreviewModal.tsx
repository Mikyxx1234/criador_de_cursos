import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";

interface JsonPreviewModalProps {
  open: boolean;
  onClose: () => void;
  data: unknown;
  title?: string;
}

export function JsonPreviewModal({
  open,
  onClose,
  data,
  title = "Visualizar JSON",
}: JsonPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const formatted = JSON.stringify(data, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      toast.success("JSON copiado para a área de transferência");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="Estrutura completa do curso no formato esperado pela API."
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button
            onClick={copy}
            icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          >
            {copied ? "Copiado!" : "Copiar JSON"}
          </Button>
        </>
      }
    >
      <pre className="text-xs font-mono bg-slate-900 text-slate-100 rounded-xl p-4 overflow-auto max-h-[60vh]">
        {formatted}
      </pre>
    </Modal>
  );
}
