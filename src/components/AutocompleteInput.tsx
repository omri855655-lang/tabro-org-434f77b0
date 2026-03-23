import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useFieldHistory } from "@/hooks/useFieldHistory";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
  fieldName: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  dir?: "rtl" | "ltr";
  disabled?: boolean;
}

export default function AutocompleteInput({
  fieldName,
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  dir = "rtl",
  disabled,
}: AutocompleteInputProps) {
  const { getSuggestions, addToHistory } = useFieldHistory(fieldName);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSuggestions) {
      setSuggestions(getSuggestions(value));
      setSelectedIndex(-1);
    }
  }, [value, showSuggestions, getSuggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = (s: string) => {
    onChange(s);
    setShowSuggestions(false);
    addToHistory(s);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter") {
        if (value.trim()) addToHistory(value);
        setShowSuggestions(false);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0) {
        selectSuggestion(suggestions[selectedIndex]);
      } else {
        if (value.trim()) addToHistory(value);
        setShowSuggestions(false);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      if (value.trim()) addToHistory(value);
      setShowSuggestions(false);
      onBlur?.();
    }, 150);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        dir={dir}
        disabled={disabled}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={s}
              type="button"
              className={cn(
                "w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors",
                i === selectedIndex && "bg-accent"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
