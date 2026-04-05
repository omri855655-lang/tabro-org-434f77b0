import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, MessageCircle, Trash2, History, ChevronRight, Search, X } from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  role: string;
  content: string;
}

interface ArchivedConversation {
  id: string;
  date: string;
  preview: string;
  messages: ChatMessage[];
}

interface AiChatPanelProps {
  title: string;
  messages: ChatMessage[];
  loaded?: boolean;
  aiLoading: boolean;
  archive: ArchivedConversation[];
  onSend: (message: string) => void;
  onClearAndArchive: () => void;
  onLoadConversation: (entry: ArchivedConversation) => void;
  placeholder?: string;
  emptyText?: string;
  quickPrompts?: string[];
  extraActions?: React.ReactNode;
}

const AiChatPanel = ({
  title,
  messages,
  loaded = true,
  aiLoading,
  archive,
  onSend,
  onClearAndArchive,
  onLoadConversation,
  placeholder = "שאל שאלה...",
  emptyText = "שאל שאלה כדי להתחיל",
  quickPrompts,
  extraActions,
}: AiChatPanelProps) => {
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || aiLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleClear = () => {
    if (messages.length === 0) return;
    onClearAndArchive();
    toast.success("השיחה נוקתה ונשמרה בהיסטוריה");
  };

  const filteredArchive = searchQuery.trim()
    ? archive.filter(e =>
        e.preview.includes(searchQuery) ||
        e.messages.some(m => m.content.includes(searchQuery))
      )
    : archive;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {title}
          </div>
          <div className="flex gap-1">
            {extraActions}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowHistory(!showHistory)}
              title="היסטוריית שיחות"
            >
              <History className="h-4 w-4" />
            </Button>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={handleClear}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                נקה
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* History panel */}
        {showHistory && (
          <div className="border rounded-lg bg-muted/30 max-h-[200px] overflow-auto">
            <div className="p-2 space-y-1">
              <div className="flex items-center gap-1 mb-1">
                <Search className="h-3 w-3 text-muted-foreground" />
                <input
                  className="text-xs bg-transparent border-none outline-none flex-1 placeholder:text-muted-foreground"
                  placeholder="חיפוש בהיסטוריה..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")}>
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground px-1">שיחות קודמות</p>
              {filteredArchive.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  {searchQuery ? "אין תוצאות" : "אין היסטוריה"}
                </p>
              ) : (
                filteredArchive.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => {
                      onLoadConversation(entry);
                      setShowHistory(false);
                    }}
                    className="w-full text-right px-2 py-1.5 rounded-md hover:bg-accent text-xs flex items-center gap-2 transition-colors"
                  >
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate">{entry.preview}</span>
                      <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Quick prompts */}
        {quickPrompts && quickPrompts.length > 0 && messages.length === 0 && (
          <div className="flex gap-2 flex-wrap">
            {quickPrompts.map(prompt => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setInput(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="border rounded-lg p-3 min-h-[200px] max-h-[400px] overflow-y-auto space-y-3"
        >
          {!loaded ? (
            <p className="text-sm text-muted-foreground text-center py-8">טוען שיחה...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{emptyText}</p>
          ) : null}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="text-sm text-muted-foreground animate-pulse">חושב...</div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder={placeholder}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
          />
          <Button onClick={handleSend} disabled={aiLoading || !input.trim()}>
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AiChatPanel;
