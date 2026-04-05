import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { chatAPI } from '../lib/api';
import { Button } from './ui/button';
import {
  Mic,
  MicOff,
  X,
  Search,
  Loader2,
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  ChevronRight,
  Globe,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const CATEGORY_KEYWORDS = {
  home: ['flat','apartment','house','villa','bungalow','bhk','pg','hostel','penthouse','duplex','plot','farmhouse','rowhouse','ઘર','ફ્લેટ','ઘર','मकान','घर'],
  business: ['shop','office','warehouse','godown','showroom','restaurant','cafe','cowork','commercial','ઓફિસ','દુકાન','ऑफिस'],
  stay: ['hotel','room','guest house','resort','homestay','accommodation','stay','inn','lodge','હોટેલ','रूम','होटल'],
  event: ['party plot','marriage hall','banquet','venue','wedding','conference','function','celebration','partyplot','marriagehall','banquethall','ઇવેન્ટ','पार्टी'],
  services: ['plumber','electrician','painter','cleaner','ac repair','pest control','carpenter','cctv','cleaning','painting','repair','service','પ્લમ્બર','प्लंबर'],
};

const CITIES = ['surat','ahmedabad','vadodara','rajkot','gandhinagar','bharuch','anand','nadiad','jamnagar','bhavnagar','સુરત','અમદાવાદ','सूरत','अहमदाबाद'];

const CATEGORY_ICONS = { home: Home, business: Building2, stay: Hotel, event: PartyPopper, services: Wrench };
const CATEGORY_COLORS = { home: 'bg-emerald-500', business: 'bg-blue-500', stay: 'bg-purple-500', event: 'bg-pink-500', services: 'bg-orange-500' };

const LANG_OPTIONS = [
  { code: 'en-IN', label: 'EN', full: 'English' },
  { code: 'gu-IN', label: 'ગુ', full: 'Gujarati' },
  { code: 'hi-IN', label: 'हि', full: 'Hindi' },
];

const SUGGESTIONS = [
  { text: '2 BHK flat Surat', category: 'home' },
  { text: 'Office space Adajan', category: 'business' },
  { text: 'Hotel near Dumas', category: 'stay' },
  { text: 'Party plot Vesu', category: 'event' },
  { text: 'Plumber Katargam', category: 'services' },
];

// ─────────────────────────────────────────────
// Smart Query Parser (frontend)
// ─────────────────────────────────────────────
function parseVoiceQuery(rawText) {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Detect category from keyword hints
  let detectedCategory = null;
  let matchedKeyword = '';
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        detectedCategory = cat;
        matchedKeyword = kw;
        break;
      }
    }
    if (detectedCategory) break;
  }

  // 2. Detect city
  let detectedCity = null;
  for (const city of CITIES) {
    if (lower.includes(city)) {
      detectedCity = city.charAt(0).toUpperCase() + city.slice(1);
      break;
    }
  }

  // 3. Extract PROPER NAME = remove category keywords + city from query
  //    This preserves "rahul raj" from "hotel rahul raj surat"
  let cleanQuery = text;
  
  // Remove city from query (it's a filter, not a search term)
  if (detectedCity) {
    cleanQuery = cleanQuery.replace(new RegExp(detectedCity, 'gi'), '').trim();
  }

  // Remove only the matched category keyword, keep rest as title search
  if (matchedKeyword) {
    cleanQuery = cleanQuery.replace(new RegExp(`\\b${matchedKeyword}\\b`, 'gi'), '').trim();
  }

  // Clean up extra spaces
  cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim();

  // 4. If cleanQuery is empty, use normalized full text
  if (!cleanQuery) cleanQuery = text;

  return {
    rawText: text,
    searchQuery: cleanQuery,       // "rahul raj" — for title search
    fullQuery: text,               // "hotel rahul raj" — fallback
    detectedCategory,
    detectedCity,
  };
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export const VoiceSearchModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const [phase, setPhase] = useState('idle'); // idle | listening | processing | result | error
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [lang, setLang] = useState('en-IN');
  const [volume, setVolume] = useState(0); // 0-1 for animation

  const recognitionRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const navTimerRef = useRef(null);
  const streamRef = useRef(null);

  // ── Audio volume analyser for wave animation ──
  const startVolumeAnalyser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(avg / 128);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (_) { /* mic permission handled in recognition error */ }
  }, []);

  const stopVolumeAnalyser = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    setVolume(0);
  }, []);

  // ── Navigate to results ──
  const navigateToResults = useCallback((parsed) => {
    if (!parsed) return;
    const params = new URLSearchParams();

    // Use the proper-noun-cleaned query for title search
    if (parsed.searchQuery) params.set('q', parsed.searchQuery);
    if (parsed.detectedCity) params.set('city', parsed.detectedCity);

    const path = parsed.detectedCategory
      ? `/category/${parsed.detectedCategory}`
      : '/search';

    navigate(`${path}?${params.toString()}`);
    onClose();
  }, [navigate, onClose]);

  // ── Process voice result ──
  const processVoice = useCallback(async (text) => {
    setPhase('processing');
    const parsed = parseVoiceQuery(text);

    try {
      // Hit backend for city/category confirmation (if available)
      const resp = await chatAPI.voiceSearch(text);
      const data = resp?.data || {};
      if (data?.parsed?.location) parsed.detectedCity = data.parsed.location;
      if (data?.parsed?.category && !parsed.detectedCategory) parsed.detectedCategory = data.parsed.category;
    } catch (_) { /* use frontend parsed */ }

    setParsedResult(parsed);
    setPhase('result');

    // Auto-navigate after 1.2 s if confidence is high
    const hasName = parsed.searchQuery && parsed.searchQuery.trim().length > 1;
    if (hasName) {
      navTimerRef.current = setTimeout(() => navigateToResults(parsed), 1200);
    }
  }, [navigateToResults]);

  // ── Start recognition ──
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setErrorMsg('Voice search is not supported in this browser. Use Chrome.');
      setPhase('error');
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    recognitionRef.current = rec;

    rec.onstart = () => {
      setPhase('listening');
      setTranscript('');
      setInterimTranscript('');
      setErrorMsg('');
      setParsedResult(null);
      startVolumeAnalyser();
    };

    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += txt;
        else interim += txt;
      }
      if (final) setTranscript(final.trim());
      setInterimTranscript(interim);
    };

    rec.onerror = (e) => {
      stopVolumeAnalyser();
      if (e.error === 'no-speech') { setErrorMsg('No speech detected. Tap mic and try again.'); setPhase('error'); }
      else if (e.error === 'not-allowed') { setErrorMsg('Microphone permission denied. Allow it in browser settings.'); setPhase('error'); }
      else { setErrorMsg(`Error: ${e.error}`); setPhase('error'); }
    };

    rec.onend = () => {
      stopVolumeAnalyser();
      setInterimTranscript('');
      // Use the best transcript
      setTranscript(prev => {
        if (prev.trim()) { processVoice(prev.trim()); return prev; }
        setPhase('idle');
        return prev;
      });
    };

    rec.start();
  }, [lang, startVolumeAnalyser, stopVolumeAnalyser, processVoice]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    stopVolumeAnalyser();
  }, [stopVolumeAnalyser]);

  // ── Cleanup on unmount / close ──
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      stopVolumeAnalyser();
      clearTimeout(navTimerRef.current);
    };
  }, [stopVolumeAnalyser]);

  // Auto-start on open
  useEffect(() => {
    if (isOpen) {
      setPhase('idle');
      setTranscript('');
      setInterimTranscript('');
      setParsedResult(null);
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isListening = phase === 'listening';
  const isProcessing = phase === 'processing';
  const CategoryIcon = parsedResult?.detectedCategory ? CATEGORY_ICONS[parsedResult.detectedCategory] : Search;
  const categoryColor = parsedResult?.detectedCategory ? CATEGORY_COLORS[parsedResult.detectedCategory] : 'bg-stone-500';

  // Dynamic mic scale based on volume
  const micScale = isListening ? 1 + volume * 0.18 : 1;

  return (
    <AnimatePresence>
      <motion.div
        key="voice-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
        style={{ background: 'rgba(10,10,12,0.82)', backdropFilter: 'blur(18px)' }}
        onClick={onClose}
      >
        <motion.div
          key="voice-panel"
          initial={{ y: 60, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          onClick={e => e.stopPropagation()}
          className="relative w-full sm:max-w-lg mx-auto rounded-t-3xl sm:rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(145deg,#16181c,#0f1012)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              {/* Language switcher */}
              <div className="flex items-center gap-1 bg-white/5 rounded-full p-1">
                {LANG_OPTIONS.map(l => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); if (isListening) { stopListening(); } }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${lang === l.code ? 'bg-white text-black' : 'text-white/50 hover:text-white/80'}`}
                    title={l.full}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <Globe className="w-3.5 h-3.5 text-white/25" />
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main content */}
          <div className="px-6 pb-8 flex flex-col items-center">

            {/* Status text */}
            <motion.p
              key={phase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-white/60 text-sm font-medium mb-8 tracking-wide"
            >
              {phase === 'idle' && 'Tap the mic to search'}
              {phase === 'listening' && 'Listening…'}
              {phase === 'processing' && 'Understanding your query…'}
              {phase === 'result' && 'Found! Redirecting…'}
              {phase === 'error' && errorMsg}
            </motion.p>

            {/* ── Mic Button with animated rings ── */}
            <div className="relative flex items-center justify-center mb-8">
              {/* Animated rings — only when listening */}
              {isListening && (
                <>
                  {[1, 2, 3].map(i => (
                    <motion.div
                      key={i}
                      className="absolute rounded-full"
                      style={{
                        width: 96 + i * 28 + volume * 20,
                        height: 96 + i * 28 + volume * 20,
                        border: `${2 - i * 0.4}px solid rgba(16,185,129,${0.35 - i * 0.1})`,
                      }}
                      animate={{ scale: [1, 1 + 0.06 * i, 1], opacity: [0.6, 0.2, 0.6] }}
                      transition={{ duration: 1.4 + i * 0.3, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </>
              )}

              <motion.button
                animate={{ scale: micScale }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                whileTap={{ scale: 0.93 }}
                onClick={isListening ? stopListening : startListening}
                disabled={isProcessing}
                className="relative w-24 h-24 rounded-full flex items-center justify-center cursor-pointer z-10 transition-shadow"
                style={{
                  background: isListening
                    ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                    : 'linear-gradient(135deg,#10b981,#059669)',
                  boxShadow: isListening
                    ? '0 0 0 0 rgba(239,68,68,0), 0 12px 40px rgba(239,68,68,0.4)'
                    : '0 12px 40px rgba(16,185,129,0.35)',
                }}
              >
                {isProcessing
                  ? <Loader2 className="w-10 h-10 text-white animate-spin" />
                  : isListening
                    ? <MicOff className="w-10 h-10 text-white" />
                    : <Mic className="w-10 h-10 text-white" />
                }
              </motion.button>
            </div>

            {/* ── Transcript display ── */}
            <div className="w-full min-h-[56px] flex items-center justify-center mb-6">
              <AnimatePresence mode="wait">
                {(transcript || interimTranscript) ? (
                  <motion.p
                    key="transcript"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-xl sm:text-2xl font-semibold tracking-tight"
                    style={{ color: '#fff' }}
                  >
                    {transcript || (
                      <span className="text-white/40 italic">{interimTranscript}</span>
                    )}
                  </motion.p>
                ) : phase === 'idle' ? (
                  <motion.div
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <p className="text-white/20 text-sm">Your spoken query will appear here</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* ── Parsed result card ── */}
            <AnimatePresence>
              {parsedResult && phase === 'result' && (
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full rounded-2xl p-4 mb-5"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 ${categoryColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <CategoryIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{parsedResult.searchQuery || parsedResult.rawText}</p>
                      <p className="text-white/40 text-xs mt-0.5">
                        {[parsedResult.detectedCategory, parsedResult.detectedCity].filter(Boolean).join(' · ') || 'All categories'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/30 mt-1" />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => { clearTimeout(navTimerRef.current); navigateToResults(parsedResult); }}
                      className="flex-1 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm"
                    >
                      <Search className="w-4 h-4 mr-1.5" />
                      Search Now
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => { clearTimeout(navTimerRef.current); setPhase('idle'); setTranscript(''); setParsedResult(null); startListening(); }}
                      className="h-10 px-4 rounded-xl text-white/60 hover:text-white hover:bg-white/10 text-sm"
                    >
                      Retry
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Error retry ── */}
            <AnimatePresence>
              {phase === 'error' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full mb-4">
                  <Button
                    onClick={() => { setPhase('idle'); startListening(); }}
                    variant="outline"
                    className="w-full h-10 rounded-xl border-white/10 text-white hover:bg-white/10"
                  >
                    Try Again
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Voice bar animation (listening state) ── */}
            {isListening && (
              <div className="flex items-center gap-1 mb-5 h-8">
                {[...Array(7)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 rounded-full bg-emerald-400"
                    animate={{
                      height: [8, 8 + Math.random() * 24 * (1 + volume), 8],
                    }}
                    transition={{
                      duration: 0.5 + Math.random() * 0.4,
                      repeat: Infinity,
                      delay: i * 0.08,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            )}

            {/* ── Example suggestions (idle only) ── */}
            {phase === 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="w-full"
              >
                <p className="text-white/25 text-xs text-center mb-3 tracking-widest uppercase">Try saying</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s, i) => {
                    const Icon = CATEGORY_ICONS[s.category];
                    return (
                      <button
                        key={i}
                        onClick={() => { setTranscript(s.text); processVoice(s.text); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/60 text-xs hover:text-white hover:bg-white/10 transition-all"
                        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <Icon className="w-3 h-3 opacity-60" />
                        {s.text}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────
// Trigger Button
// ─────────────────────────────────────────────
export const VoiceSearchButton = ({ className = '' }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <motion.button
        type="button"
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.94 }}
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        className={`relative z-20 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200/30 bg-gradient-to-br from-emerald-500 to-teal-600 shadow-[0_8px_24px_rgba(16,185,129,0.3)] ${className}`}
        data-testid="voice-search-trigger"
        aria-label="Voice Search"
      >
        <Mic className="w-5 h-5 text-white" />
      </motion.button>
      <VoiceSearchModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default VoiceSearchModal;