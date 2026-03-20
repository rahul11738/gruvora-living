import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { chatAPI } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  MessageCircle,
  X,
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  Sparkles,
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  Loader2,
  ExternalLink,
  Phone,
  Globe,
  MapPin,
  Search,
} from 'lucide-react';

const quickPrompts = [
  { icon: Home, text: '2 BHK flat Surat', category: 'home' },
  { icon: Building2, text: 'Office rent Adajan', category: 'business' },
  { icon: Hotel, text: 'Hotel Dumas Beach', category: 'stay' },
  { icon: PartyPopper, text: 'Marriage hall booking', category: 'event' },
  { icon: Wrench, text: 'Plumber contact', category: 'services' },
];

const suggestedActions = [
  { icon: Search, text: 'Browse Properties', link: '/category/home' },
  { icon: Hotel, text: 'Book Hotel', link: '/category/stay' },
  { icon: Wrench, text: 'Find Services', link: '/category/services' },
];

export const ChatBot = () => {
  const { isAuthenticated, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      text: 'નમસ્તે! 🙏 હું GharSetu AI છું.\n\nહું તમને મદદ કરી શકું:\n• ઘર/ફ્લેટ શોધવામાં\n• હોટેલ બુક કરવામાં\n• સર્વિસ (Plumber, AC) બુક કરવામાં\n• Event venue શોધવામાં\n\nબોલો, શું જોઈએ છે?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text = input) => {
    if (!text.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: text.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatAPI.send(text.trim());
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: response.data.response || 'માફ કરશો, ફરી પ્રયાસ કરો.',
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      // Provide helpful fallback response
      const fallbackMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: `તમારી query "${text}" માટે:\n\n🏠 Properties: /category/home\n🏨 Hotels: /category/stay\n🔧 Services: /category/services\n\nઅથવા Contact: vaanix.in`,
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice not supported. Use Chrome.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'gu-IN';
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setTimeout(() => handleSend(transcript), 500);
    };

    recognition.start();
  };

  return (
    <>
      {/* Floating Button - Mobile Responsive */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-primary to-emerald-600 rounded-full shadow-2xl flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0 }}
        animate={{ scale: isOpen ? 0 : 1 }}
        data-testid="chatbot-trigger"
      >
        <MessageCircle className="w-7 h-7 md:w-8 md:h-8 text-white" />
        <motion.span 
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-red-500 rounded-full flex items-center justify-center"
        >
          <span className="text-[10px] text-white font-bold">AI</span>
        </motion.span>
      </motion.button>

      {/* Chat Window - Mobile Responsive */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-4 md:inset-auto md:bottom-6 md:right-6 z-50 md:w-[380px] md:h-[550px] bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            data-testid="chatbot-window"
          >
            {/* Header with Vaanix Branding */}
            <div className="bg-gradient-to-r from-primary to-emerald-600 p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-10 h-10 md:w-11 md:h-11 bg-white/20 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm md:text-base">GharSetu AI</h3>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-emerald-100 text-xs">Online</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 md:w-9 md:h-9 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </button>
              </div>
              
              {/* Vaanix.in Branding */}
              <a 
                href="https://www.vaanix.in" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5 hover:bg-white/20 transition-colors"
              >
                <Globe className="w-3 h-3 text-white" />
                <span className="text-xs text-white/90">Powered by Vaanix.in</span>
                <ExternalLink className="w-3 h-3 text-white/70 ml-auto" />
              </a>
            </div>

            {/* Messages - Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-stone-50">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl ${
                      message.type === 'user'
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'bg-white shadow-sm rounded-bl-sm border border-stone-100'
                    }`}
                  >
                    {message.type === 'bot' && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Bot className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-primary">GharSetu AI</span>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white shadow-sm rounded-2xl rounded-bl-sm p-3 border border-stone-100">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-primary" />
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            {messages.length <= 2 && (
              <div className="px-3 py-2 bg-white border-t border-stone-100">
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                  {quickPrompts.map((prompt, index) => {
                    const Icon = prompt.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => handleSend(prompt.text)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary/5 border border-primary/20 rounded-full text-xs font-medium text-primary hover:bg-primary hover:text-white transition-all"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {prompt.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 bg-white border-t border-stone-100">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <div className="flex-1 relative">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type message..."
                    className="pr-10 h-10 md:h-11 rounded-full bg-stone-50 text-sm"
                    disabled={isLoading}
                    data-testid="chatbot-input"
                  />
                  <button
                    type="button"
                    onClick={handleVoiceInput}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                      isListening ? 'bg-red-500 text-white' : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                    }`}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 md:w-11 md:h-11 rounded-full p-0 bg-primary hover:bg-primary/90"
                  data-testid="chatbot-send"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 md:w-5 md:h-5" />
                  )}
                </Button>
              </form>
              
              {/* Footer Links */}
              <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-muted-foreground">
                <a href="https://www.vaanix.in" target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  vaanix.in
                </a>
                <span>•</span>
                <a href="/contact" className="hover:text-primary">Contact</a>
                <span>•</span>
                <a href="/about" className="hover:text-primary">About</a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatBot;
