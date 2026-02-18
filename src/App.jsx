import { useState } from 'react';
import axios from 'axios';
import { Play, Search, Maximize2, Music, Sparkles, Heart, Radio, Zap } from 'lucide-react';

const API_BASE = "https://vibestream-backend.calmbush-580b10ba.centralindia.azurecontainerapps.io/api";
console.log("🔥 HARDCODED URL ACTIVE:", API_BASE);

// Generate a session ID that persists per browser tab
const SESSION_ID = 'session_' + Math.random().toString(36).substring(2, 10);

function App() {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isVideoVisible, setIsVideoVisible] = useState(true);
  const [youtubeId, setYoutubeId] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [vibeQuery, setVibeQuery] = useState("");
  const [vibeResults, setVibeResults] = useState([]);
  const [similarResults, setSimilarResults] = useState([]);
  const [forYouResults, setForYouResults] = useState([]);
  const [activeTab, setActiveTab] = useState("search");

  // 1. SEARCH (iTunes via Backend)
  const search = async (e) => {
    e.preventDefault();
    if (!query) return;
    try {
      const res = await axios.get(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
      setSongs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // 2. VIBE SEARCH — Level 1+3 Hybrid (Qdrant + metadata + audio features)
  const vibeSearch = async (e) => {
    e.preventDefault();
    if (!vibeQuery) return;
    try {
      const res = await axios.get(`${API_BASE}/recommend?mood=${encodeURIComponent(vibeQuery)}`);
      setVibeResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // 3. PLAY — Resolve YouTube + track play for collaborative filtering
  const playSong = async (song) => {
    setCurrentSong(song);
    setYoutubeId(null);
    setLoadingVideo(true);

    // Track play event (Level 2: Collaborative Filtering + Level 4: Audio Analysis)
    try {
      const playParams = new URLSearchParams({
        title: song.title || '',
        artist: song.artist || '',
        session_id: SESSION_ID,
        preview_url: song.preview || '',
        song_id: String(song.id || ''),
      });
      await axios.post(`${API_BASE}/play?${playParams.toString()}`);
    } catch (err) {
      console.error("Play tracking failed:", err);
    }

    // Load similar songs (Level 1: Metadata-based)
    try {
      const simRes = await axios.get(`${API_BASE}/recommend/similar?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist || '')}`);
      setSimilarResults(simRes.data);
    } catch (err) {
      console.error("Similar songs failed:", err);
    }

    // Load For You (Level 2: Collaborative)
    try {
      const fyRes = await axios.get(`${API_BASE}/recommend/foryou?session_id=${SESSION_ID}`);
      setForYouResults(fyRes.data);
    } catch (err) {
      console.error("For You failed:", err);
    }

    // Resolve YouTube video
    try {
      const searchQuery = `${song.title} ${song.artist} Official Audio`;
      const res = await axios.get(`${API_BASE}/youtube-id?q=${encodeURIComponent(searchQuery)}`);
      if (res.data.videoId) {
        setYoutubeId(res.data.videoId);
      }
    } catch (err) {
      console.error("YouTube ID lookup failed:", err);
    } finally {
      setLoadingVideo(false);
    }
  };

  // Feature bar component
  const FeatureBar = ({ label, value, color }) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-20">{label}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-gray-500 w-8 text-right">{Math.round(value * 100)}%</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white pb-48 font-sans">

      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-purple-500/20">
        <div className="max-w-6xl mx-auto px-4 py-3">

          {/* Tab Switcher */}
          <div className="flex justify-center gap-2 mb-3 flex-wrap">
            {[
              { id: "search", label: "Search", icon: <Search size={14} /> },
              { id: "vibe", label: "Vibe Search", icon: <Sparkles size={14} /> },
              { id: "foryou", label: "For You", icon: <Heart size={14} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "foryou") {
                    axios.get(`${API_BASE}/recommend/foryou?session_id=${SESSION_ID}`)
                      .then(r => setForYouResults(r.data))
                      .catch(console.error);
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold tracking-wide transition-all ${activeTab === tab.id
                  ? tab.id === "vibe" ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-pink-600/30"
                    : tab.id === "foryou" ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30"
                      : "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "bg-gray-800/50 text-gray-400 hover:text-white"
                  }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          {activeTab === "search" && (
            <form onSubmit={search} className="relative max-w-lg mx-auto">
              <Search className="absolute left-4 top-3.5 text-gray-500" size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search songs, artists..."
                className="w-full bg-gray-900/80 border border-gray-700/50 rounded-full py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-sm"
              />
            </form>
          )}

          {/* Vibe Bar */}
          {activeTab === "vibe" && (
            <form onSubmit={vibeSearch} className="relative max-w-lg mx-auto">
              <Sparkles className="absolute left-4 top-3.5 text-pink-400" size={18} />
              <input
                value={vibeQuery}
                onChange={(e) => setVibeQuery(e.target.value)}
                placeholder='Describe a mood... "workout energy", "chill vibes", "heartbreak"'
                className="w-full bg-gray-900/80 border border-pink-500/30 rounded-full py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition text-sm"
              />
            </form>
          )}
        </div>
      </div>

      {/* SEARCH RESULTS GRID */}
      {activeTab === "search" && songs.length > 0 && (
        <div className="max-w-6xl mx-auto p-6">
          <h2 className="text-lg font-bold text-gray-300 mb-4">Search Results</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            {songs.map((song) => (
              <div
                key={song.id}
                onClick={() => playSong(song)}
                className="group cursor-pointer bg-gray-900/40 p-3 rounded-xl border border-gray-800/50 hover:border-purple-500/30 hover:bg-gray-800/60 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-purple-900/10"
              >
                <div className="relative aspect-square mb-3 overflow-hidden rounded-lg">
                  <img src={song.cover} alt={song.title} className="w-full h-full object-cover group-hover:opacity-80 transition duration-300" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                    <div className="bg-purple-600 rounded-full p-3 shadow-2xl shadow-purple-600/50 transform scale-90 group-hover:scale-100 transition">
                      <Play fill="white" className="ml-0.5" size={20} />
                    </div>
                  </div>
                </div>
                <h3 className="font-semibold text-sm truncate">{song.title}</h3>
                <p className="text-xs text-gray-500 truncate">{song.artist}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIBE RESULTS — Level 1+3: Hybrid scored */}
      {activeTab === "vibe" && vibeResults.length > 0 && (
        <div className="max-w-6xl mx-auto p-6">
          <h2 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">
            Songs matching your vibe
          </h2>
          <p className="text-xs text-gray-600 mb-4">Powered by AI + Genre + Audio Features</p>
          <div className="space-y-2">
            {vibeResults.map((song, idx) => (
              <div
                key={idx}
                onClick={() => playSong(song)}
                className="flex items-center gap-4 p-4 rounded-xl bg-gray-900/40 border border-gray-800/50 hover:border-pink-500/30 hover:bg-gray-800/60 cursor-pointer transition-all group"
              >
                <div className="w-8 text-center text-gray-600 font-mono text-sm">{idx + 1}</div>
                <Music size={18} className="text-pink-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate group-hover:text-purple-300 transition">{song.title}</h3>
                  <p className="text-xs text-gray-500">{song.artist}</p>
                </div>
                <div className="hidden md:flex gap-3 items-center">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{song.genre}</span>
                  <span className="text-xs text-gray-600">{song.year}</span>
                </div>
                <div className="hidden lg:flex flex-col gap-1 w-32">
                  <FeatureBar label="" value={song.energy || 0} color="bg-orange-500" />
                  <FeatureBar label="" value={song.danceability || 0} color="bg-green-500" />
                  <FeatureBar label="" value={song.valence || 0} color="bg-yellow-500" />
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 capitalize flex-shrink-0">{song.mood}</span>
                <span className="text-xs text-gray-600 font-mono w-10 text-right">{Math.round(song.score * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FOR YOU — Level 2: Collaborative Filtering */}
      {activeTab === "foryou" && (
        <div className="max-w-6xl mx-auto p-6">
          <h2 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-1">
            For You
          </h2>
          <p className="text-xs text-gray-600 mb-4">Based on your listening session • Play more songs to improve</p>
          {forYouResults.length > 0 ? (
            <div className="space-y-2">
              {forYouResults.map((song, idx) => (
                <div
                  key={idx}
                  onClick={() => playSong(song)}
                  className="flex items-center gap-4 p-4 rounded-xl bg-gray-900/40 border border-gray-800/50 hover:border-emerald-500/30 hover:bg-gray-800/60 cursor-pointer transition-all group"
                >
                  <div className="w-8 text-center text-gray-600 font-mono text-sm">{idx + 1}</div>
                  <Radio size={18} className="text-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate group-hover:text-emerald-300 transition">{song.title}</h3>
                    <p className="text-xs text-gray-500">{song.artist}</p>
                  </div>
                  {song.genre && <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{song.genre}</span>}
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 capitalize flex-shrink-0">
                    {song.reason === "users_also_played" ? "🔥 Trending" : song.reason === "similar_to_last_played" ? "Similar" : "Popular"}
                  </span>
                  <span className="text-xs text-gray-600 font-mono">{Math.round(song.score * 100)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[40vh] text-gray-600">
              <Heart size={48} className="mb-4 opacity-30" />
              <p className="text-lg">Play some songs to get personalized recommendations</p>
              <p className="text-sm text-gray-700 mt-2">Switch to Search and play a few tracks first</p>
            </div>
          )}
        </div>
      )}

      {/* SIMILAR SONGS PANEL (shows when playing a song) */}
      {currentSong && similarResults.length > 0 && activeTab === "search" && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
            <Zap size={14} className="text-amber-400" /> Similar to "{currentSong.title}"
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {similarResults.slice(0, 5).map((song, idx) => (
              <div
                key={idx}
                onClick={() => playSong(song)}
                className="group cursor-pointer bg-gray-900/30 p-3 rounded-lg border border-gray-800/40 hover:border-amber-500/30 hover:bg-gray-800/40 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Music size={12} className="text-amber-400" />
                  <h4 className="font-medium text-xs truncate group-hover:text-amber-300 transition">{song.title}</h4>
                </div>
                <p className="text-xs text-gray-600 truncate">{song.artist}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">{song.genre}</span>
                  <span className="text-[10px] text-gray-600">{Math.round(song.score * 100)}% match</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EMPTY STATES */}
      {activeTab === "search" && songs.length === 0 && !currentSong && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-600">
          <Search size={48} className="mb-4 opacity-30" />
          <p className="text-lg">Search for your favorite songs</p>
        </div>
      )}
      {activeTab === "vibe" && vibeResults.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-600">
          <Sparkles size={48} className="mb-4 opacity-30" />
          <p className="text-lg">Describe a mood to discover songs</p>
          <div className="flex gap-2 mt-4 flex-wrap justify-center">
            {["happy", "sad", "energetic", "chill", "romantic", "hype", "dance"].map(m => (
              <button key={m} onClick={() => { setVibeQuery(m); }} className="text-xs px-3 py-1.5 rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-purple-600/50 transition capitalize">{m}</button>
            ))}
          </div>
        </div>
      )}

      {/* THE PLAYER (Fixed Bottom) */}
      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-xl border-t border-purple-500/20 shadow-2xl shadow-black/50 transition-all duration-300">

          {/* Controls Bar */}
          <div className="flex items-center justify-between px-6 py-3 h-[80px] max-w-6xl mx-auto">
            <div className="flex items-center gap-4 min-w-0">
              {currentSong.cover && <img src={currentSong.cover} className="w-12 h-12 rounded-lg shadow-lg" />}
              <div className="min-w-0">
                <h4 className="font-bold text-sm truncate">{currentSong.title}</h4>
                <p className="text-xs text-gray-400 truncate">{currentSong.artist}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {loadingVideo && <span className="text-xs text-purple-400 animate-pulse">Finding video...</span>}
              <button
                onClick={() => setIsVideoVisible(!isVideoVisible)}
                className="text-gray-400 hover:text-white flex items-center gap-2 text-xs uppercase tracking-wider font-bold transition"
              >
                <Maximize2 size={14} />
                {isVideoVisible ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* THE VIDEO PLAYER */}
          <div className={`w-full bg-black flex justify-center overflow-hidden transition-all duration-500 ${isVideoVisible && youtubeId ? 'h-[50vh] opacity-100' : 'h-0 opacity-0'}`}>
            {youtubeId && (
              <iframe
                key={youtubeId}
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
                title="YouTube Player"
                frameBorder="0"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                className="max-w-4xl w-full"
              ></iframe>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
