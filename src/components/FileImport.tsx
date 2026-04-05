import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface FileImportProps {
  onImport: (rows: Record<string, string>[]) => void;
  label?: string;
}

const FileImport = ({ onImport, label = "ייבוא מקובץ" }: FileImportProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
    return lines.slice(1).map(line => {
      const values = line.match(/(".*?"|[^,]*)/g) || [];
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = (values[i] || "").replace(/^"|"$/g, "").trim();
      });
      return row;
    }).filter(row => Object.values(row).some(v => v));
  };

  const parseTSV = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split("\t").map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split("\t");
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = (values[i] || "").trim();
      });
      return row;
    }).filter(row => Object.values(row).some(v => v));
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const text = await file.text();

      let rows: Record<string, string>[] = [];

      if (ext === "csv") {
        rows = parseCSV(text);
      } else if (ext === "tsv" || ext === "txt") {
        rows = text.includes("\t") ? parseTSV(text) : parseCSV(text);
      } else {
        toast.error("פורמט לא נתמך. יש לייבא קובץ CSV או TSV.");
        setLoading(false);
        return;
      }

      if (rows.length === 0) {
        toast.error("לא נמצאו שורות בקובץ");
        setLoading(false);
        return;
      }

      onImport(rows);
      toast.success(`יובאו ${rows.length} שורות בהצלחה ✅`);
    } catch (err) {
      toast.error("שגיאה בקריאת הקובץ");
    }
    setLoading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        <Upload className="h-3.5 w-3.5" />
        {loading ? "מייבא..." : label}
      </Button>
    </>
  );
};

export default FileImport;
