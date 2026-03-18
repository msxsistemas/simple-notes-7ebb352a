import { Video, Phone, FileText, Image } from "lucide-react";
import { sampleDataMap } from "@/utils/message-variables";

interface WhatsAppPhonePreviewProps {
  message: string;
  templateLabel?: string;
  contactName?: string;
  time?: string;
  carrier?: string;
  battery?: string;
  mediaPreview?: string | null;
  mediaType?: 'imagem' | 'video' | 'documento';
}

export function WhatsAppPhonePreview({ 
  message, 
  templateLabel,
  contactName = "Gestor MSX",
  time = "09:00",
  carrier = "Vivo",
  battery = "100%",
  mediaPreview,
  mediaType
}: WhatsAppPhonePreviewProps) {
  
  // Process message with sample data
  const renderPreview = () => {
    if (!message) return "";
    
    let preview = message;
    
    // Replace variables with sample data
    Object.entries(sampleDataMap).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    
    // Replace {br} with actual line breaks
    preview = preview.replace(/{br}/g, '\n');
    
    return preview;
  };

  const previewText = renderPreview();

  const renderMediaPreview = () => {
    if (!mediaPreview) return null;

    if (mediaType === 'imagem') {
      return (
        <div className="mb-2 rounded-lg overflow-hidden">
          <img 
            src={mediaPreview} 
            alt="Preview" 
            className="w-full max-h-48 object-cover rounded-lg"
          />
        </div>
      );
    }

    if (mediaType === 'video') {
      return (
        <div className="mb-2 rounded-lg overflow-hidden relative">
          <video 
            src={mediaPreview} 
            className="w-full max-h-48 object-cover rounded-lg"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-[#075e54] ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        </div>
      );
    }

    if (mediaType === 'documento') {
      return (
        <div className="mb-2 bg-[#025144] rounded-lg p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00a884] rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-medium">Documento</p>
            <p className="text-[#8696a0] text-xs">PDF, DOC, XLS...</p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex justify-center lg:sticky lg:top-6 self-start h-fit">
      <div className="w-[320px] md:w-[380px] bg-[#111b21] rounded-[2.5rem] overflow-hidden shadow-2xl border border-[#2a3942]">
        {/* Phone Notch */}
        <div className="bg-black h-7 flex items-center justify-center">
          <div className="w-24 h-5 bg-black rounded-b-2xl"></div>
        </div>
        
        {/* Phone Status Bar */}
        <div className="bg-[#1f2c34] px-5 py-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-white text-[11px] font-semibold">{carrier}</span>
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 17h2v4H2v-4zm4-5h2v9H6v-9zm4-4h2v13h-2V8zm4-4h2v17h-2V4zm4-2h2v19h-2V2z"/>
            </svg>
          </div>
          <span className="text-white text-[11px] font-semibold">{time}</span>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.95 3 3 5.95 3 9c0 2.13 1.5 4 3.68 5.03L5 21l4.22-2.63C10.13 18.45 11.05 18.5 12 18.5c5.05 0 9-2.45 9-5.5S17.05 3 12 3z"/>
            </svg>
            <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
              <rect x="2" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <rect x="4" y="8" width="14" height="8" rx="1" fill="currentColor"/>
              <rect x="20" y="9" width="2" height="6" rx="1" fill="currentColor"/>
            </svg>
            <span className="text-white text-[11px] font-semibold">{battery}</span>
          </div>
        </div>
        
        {/* WhatsApp Header */}
        <div className="bg-[#1f2c34] px-4 py-2.5 flex items-center gap-3">
          <svg className="w-5 h-5 text-[#8696a0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          <div className="w-10 h-10 bg-[#25d366] rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-[15px]">{contactName}</p>
            <p className="text-[#8696a0] text-xs">online</p>
          </div>
          <div className="flex items-center gap-5 text-[#8696a0]">
            <Video className="w-5 h-5" />
            <Phone className="w-5 h-5" />
          </div>
        </div>

        {/* Template indicator */}
        {templateLabel && (
          <div className="bg-[#182229] px-3 py-1.5 text-center border-b border-[#2a3942]">
            <span className="text-xs text-[#8696a0]">Preview: <span className="text-purple-400 font-medium">{templateLabel}</span></span>
          </div>
        )}

        {/* Chat Area */}
        <div 
          className="h-[380px] md:h-[420px] bg-[#0b141a] p-4 overflow-y-auto" 
          style={{ 
            backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23182229\" fill-opacity=\"0.4\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" 
          }}
        >
          {(previewText || mediaPreview) ? (
            <div className="bg-[#005c4b] rounded-lg p-3 max-w-[90%] ml-auto shadow-lg relative">
              <div className="absolute -right-1 top-0 w-3 h-3 bg-[#005c4b]" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
              
              {/* Media Preview */}
              {renderMediaPreview()}
              
              {/* Text Content */}
              {previewText && (
                <p className="text-white text-[13px] whitespace-pre-wrap leading-relaxed">
                  {previewText.split('\n').map((line, index) => {
                    // Process bold text
                    const processedLine = line.split(/\*([^*]+)\*/g).map((part, i) => 
                      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                    );
                    
                    return (
                      <span key={index}>
                        {processedLine}
                        {index < previewText.split('\n').length - 1 && <br />}
                      </span>
                    );
                  })}
                </p>
              )}
              
              <div className="flex justify-end items-center gap-1 mt-1">
                <span className="text-[10px] text-[#ffffff99]">{time}</span>
                <svg className="w-4 h-4 text-[#53bdeb]" viewBox="0 0 16 15" fill="currentColor">
                  <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
                </svg>
              </div>
            </div>
          ) : (
            <div className="text-center text-[#8696a0] text-sm mt-20">
              Digite uma mensagem para visualizar o preview
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-[#1f2c34] px-3 py-2 flex items-center gap-2">
          <div className="w-10 h-10 bg-[#2a3942] rounded-full flex items-center justify-center">
            <span className="text-[#8696a0] text-xl">+</span>
          </div>
          <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-2.5 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#8696a0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
            <span className="text-[#8696a0] text-sm flex-1">Mensagem</span>
          </div>
          <div className="flex items-center gap-3 text-[#8696a0]">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3.2"/>
              <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
            </svg>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
