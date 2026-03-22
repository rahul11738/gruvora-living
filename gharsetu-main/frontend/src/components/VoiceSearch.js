import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { chatAPI } from '../lib/api';
import { Button } from './ui/button';
import { toast } from 'sonner';
import {
  Mic,
  MicOff,
  X,
  Search,
  Volume2,
  Loader2,
  Sparkles,
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
} from 'lucide-react';

const categoryKeywords = {
  home: ['flat', 'apartment', 'house', 'villa', 'bungalow', 'bhk', 'pg', 'hostel', 'penthouse', 'duplex', 'ઘર', 'ફ્લેટ'],
  business: ['shop', 'office', 'warehouse', 'godown', 'showroom', 'restaurant', 'cafe', 'દુકાન', 'ઓફિસ'],
  stay: ['hotel', 'room', 'guest house', 'resort', 'pg', 'homestay', 'હોટેલ', 'રૂમ'],
  event: ['party plot', 'marriage hall', 'banquet', 'venue', 'wedding', 'પાર્ટી પ્લોટ', 'લગ્ન'],
  services: ['plumber', 'electrician', 'painter', 'cleaner', 'ac repair', 'pest control', 'પ્લમ્બર', 'ઇલેક્ટ્રિશિયન'],
};

const cities = ['surat', 'ahmedabad', 'vadodara', 'rajkot', 'gandhinagar', 'bharuch', 'anand', 'nadiad', 'સુરત', 'અમદાવાદ'];

export const VoiceSearchModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      startListening();
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isOpen]);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setError('Voice search not supported in this browser. Try Chrome or Edge.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    // en-IN generally captures mixed Gujarati/Hindi-English terms better for downstream normalization.
    recognitionRef.current.lang = 'en-IN';
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setError(null);
      setTranscript('');
    };

    recognitionRef.current.onresult = (event) => {
      const current = event.results[event.results.length - 1];
      const text = current[0].transcript;
      setTranscript(text);

      if (current.isFinal) {
        processVoiceQuery(text);
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        setError('No speech detected. Try again.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.');
      }
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const processVoiceQuery = async (query) => {
    setProcessing(true);
    try {
      const response = await chatAPI.voiceSearch(query);
      const data = response?.data || {};

      setResults({
        query,
        normalizedQuery: data.normalized_query || query,
        category: data?.parsed?.category || null,
        city: data?.parsed?.location || null,
        didYouMean: data.did_you_mean || '',
      });
    } catch (error) {
      console.error('Voice processing failed:', error);
      // Fallback to basic local detection.
      const lowerQuery = query.toLowerCase();
      let detectedCategory = null;
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => lowerQuery.includes(keyword))) {
          detectedCategory = category;
          break;
        }
      }
      const detectedCity = cities.find(city => lowerQuery.includes(city.toLowerCase())) || null;

      setResults({
        query,
        normalizedQuery: query,
        category: detectedCategory,
        city: detectedCity,
        didYouMean: '',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSearch = () => {
    if (!results) return;

    const params = new URLSearchParams();
    if (results.normalizedQuery || results.query) params.set('q', results.normalizedQuery || results.query);
    if (results.city) params.set('city', results.city);

    if (results.category) {
      navigate(`/category/${results.category}?${params.toString()}`);
    } else {
      navigate(`/search?${params.toString()}`);
    }
    onClose();
  };

  const getCategoryIcon = (category) => {
    const icons = {
      home: Home,
      business: Building2,
      stay: Hotel,
      event: PartyPopper,
      services: Wrench,
    };
    return icons[category] || Search;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-lg text-center"
          onClick={(e) => e.stopPropagation()}
          data-testid="voice-search-modal"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Microphone Animation */}
          <div className="mb-8">
            <motion.div
              animate={isListening ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="relative inline-block"
            >
              {/* Ripple Effect */}
              {isListening && (
                <>
                  <motion.div
                    animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 bg-primary rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 2.5], opacity: [0.3, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
                    className="absolute inset-0 bg-primary rounded-full"
                  />
                </>
              )}
              
              <button
                onClick={isListening ? stopListening : startListening}
                className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-colors ${
                  isListening 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-12 h-12 text-white" />
                ) : (
                  <Mic className="w-12 h-12 text-white" />
                )}
              </button>
            </motion.div>
          </div>

          {/* Status Text */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            {isListening && !transcript && (
              <p className="text-white text-xl font-medium">Listening...</p>
            )}
            {transcript && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 inline-block">
                <p className="text-white text-lg flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  "{transcript}"
                </p>
              </div>
            )}
            {error && (
              <p className="text-red-400 text-lg">{error}</p>
            )}
            {!isListening && !transcript && !error && (
              <p className="text-white/60 text-lg">
                Tap the mic and say what you're looking for
              </p>
            )}
          </motion.div>

          {/* Processing */}
          {processing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-3 text-white"
            >
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Understanding your request...</span>
            </motion.div>
          )}

          {/* Results */}
          {results && !processing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-2xl p-6 text-left">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">Search Query</p>
                    <p className="text-sm text-muted-foreground">"{results.query}"</p>
                  </div>
                </div>

                {results.category && (
                  <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl mb-3">
                    {React.createElement(getCategoryIcon(results.category), {
                      className: 'w-5 h-5 text-primary'
                    })}
                    <span className="capitalize font-medium">{results.category}</span>
                    <span className="text-sm text-muted-foreground">category detected</span>
                  </div>
                )}

                {results.city && (
                  <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl mb-3">
                    <Search className="w-5 h-5 text-primary" />
                    <span className="capitalize font-medium">{results.city}</span>
                    <span className="text-sm text-muted-foreground">location detected</span>
                  </div>
                )}

                {results.didYouMean && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl mb-3 border border-amber-200">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    <span className="text-sm text-amber-800">
                      Did you mean: <strong>{results.didYouMean}</strong>
                    </span>
                  </div>
                )}

                <Button
                  onClick={handleSearch}
                  className="w-full btn-primary mt-4"
                  data-testid="voice-search-btn"
                >
                  <Search className="w-5 h-5 mr-2" />
                  Search Now
                </Button>
              </div>

              <button
                onClick={startListening}
                className="text-white/60 hover:text-white transition-colors"
              >
                Try again
              </button>
            </motion.div>
          )}

          {/* Example Queries */}
          {!results && !processing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-8"
            >
              <p className="text-white/40 text-sm mb-3">Try saying:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  '2 BHK flat in Surat',
                  'Office space for rent',
                  'Hotels near Dumas',
                  'Plumber in Adajan',
                ].map((example, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-white/10 rounded-full text-white/60 text-sm"
                  >
                    "{example}"
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Voice Search Button Component
export const VoiceSearchButton = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = (e) => {
    // Prevent all default behaviors and propagation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent?.stopImmediatePropagation();
    }
    setIsOpen(true);
  };

  return (
    <>
      <motion.button
        type="button"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={`w-10 h-10 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors z-20 relative ${className}`}
        data-testid="voice-search-trigger"
        aria-label="Voice Search"
      >
        <Mic className="w-5 h-5 text-white" />
      </motion.button>

      <VoiceSearchModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
};

export default VoiceSearchModal;
