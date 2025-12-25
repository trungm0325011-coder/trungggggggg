/**********************
 * MEDIA PLAYER PRO
 * - Random 100 US/UK VEVO >= 1B views
 * - Random 100 VN >= 100M views
 * - Search + scroll playlist + lyrics EN/VI (manual) + lyrics link
 **********************/

// ✅ 1) DÁN API KEY CỦA ANH Ở ĐÂY
const YT_API_KEY = "PASTE_YOUR_API_KEY_HERE";

// ✅ 2) PLAYLIST NGUỒN (càng lớn càng tốt)
// US/UK: playlist "1B views club" (mix nhiều bài) -> ta lọc VEVO + 1B
const SOURCE_PLAYLIST_USUK = "PLbpi6ZahtOH4OmcA-BD2hn0L082oLvvgV"; // YouTube 1B Views Club
// VN: playlist nhạc Việt lớn (anh thay playlist nào cũng được) -> ta lọc 100M
const SOURCE_PLAYLIST_VN   = "PL9dppUWWRkOfdciwdVkEBioMRixdqgjPz"; // (ví dụ) Top MV 100M

// ✅ Điều kiện lọc
const USUK_MIN_VIEWS = 1_000_000_000;
const VN_MIN_VIEWS   = 100_000_000;

// VEVO filter (kênh có chữ VEVO)
const REQUIRE_VEVO = true;

// ============= DOM
const $ = (id)=>document.getElementById(id);

const ytPlayer = $("ytPlayer");
const playlistEl = $("playlist");
const nowTypeEl = $("nowType");
const nowTitleEl = $("nowTitle");

const tabUSUK = $("tabUSUK");
const tabVN = $("tabVN");

const searchEl = $("search");
const btnReload = $("btnReload");

const btnShuffle = $("btnShuffle");
const btnLoop = $("btnLoop");
const btnAutoplay = $("btnAutoplay");
const btnOpenYT = $("btnOpenYT");

const lyricsBox = $("lyricsBox");
const btnLyricsLink = $("btnLyricsLink");

let activeTab = "USUK";
let autoplay = true;
let loopMode = "off"; // off | one | all
let shuffle = true;

// data đang hiển thị
let list = [];
let filtered = [];
let currentIndex = -1;
let currentItem = null;
let currentLang = "en";

// ========= Helpers
function ytEmbed(id){ return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`; }
function ytWatch(id){ return `https://www.youtube.com/watch?v=${id}`; }
function thumb(id){ return `https://img.youtube.com/vi/${id}/mqdefault.jpg`; }

function fmtViews(n){
  if(n >= 1e9) return (n/1e9).toFixed(1).replace(/\.0$/,"") + "B";
  if(n >= 1e6) return (n/1e6).toFixed(0) + "M";
  return String(n);
}

function pickRandom(arr, k){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a.slice(0, k);
}

// ========= YouTube API
async function ytFetch(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error("YouTube API error: " + r.status);
  return r.json();
}

// Lấy tất cả videoId từ playlist (tối đa nhiều page)
async function getPlaylistVideoIds(playlistId, max=600){
  let pageToken = "";
  let ids = [];
  while(ids.length < max){
    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50` +
      `&playlistId=${encodeURIComponent(playlistId)}` +
      `&key=${encodeURIComponent(YT_API_KEY)}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const data = await ytFetch(url);
    const items = data.items || [];
    for(const it of items){
      const vid = it.contentDetails?.videoId;
      if(vid) ids.push(vid);
    }
    pageToken = data.nextPageToken || "";
    if(!pageToken) break;
  }
  return ids;
}

// Lấy info + viewCount theo lô 50 video/lần
async function getVideosDetails(videoIds){
  const out = [];
  for(let i=0;i<videoIds.length;i+=50){
    const batch = videoIds.slice(i,i+50);
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails` +
      `&id=${batch.map(encodeURIComponent).join(",")}` +
      `&key=${encodeURIComponent(YT_API_KEY)}`;
    const data = await ytFetch(url);
    for(const it of (data.items||[])){
      const id = it.id;
      const title = it.snippet?.title || "";
      const channelTitle = it.snippet?.channelTitle || "";
      const views = Number(it.statistics?.viewCount || 0);
      out.push({
        id,
        title,
        channelTitle,
        views,
        // Có thể thêm duration nếu muốn parse ISO8601, ở đây để đơn giản:
        durationISO: it.contentDetails?.duration || ""
      });
    }
  }
  return out;
}

// Parse duration ISO8601 -> mm:ss (basic)
function isoToTime(iso){
  // PT#H#M#S
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if(!m) return "";
  const h = Number(m[1]||0), mi = Number(m[2]||0), s = Number(m[3]||0);
  const total = h*3600 + mi*60 + s;
  const mm = Math.floor(total/60);
  const ss = total%60;
  return mm + ":" + String(ss).padStart(2,"0");
}

// ========= Build list by rules
async function buildUSUK_100(){
  const ids = await getPlaylistVideoIds(SOURCE_PLAYLIST_USUK, 800);
  const det = await getVideosDetails(ids);

  // Filter: >=1B and (VEVO optional)
  let ok = det.filter(v => v.views >= USUK_MIN_VIEWS);
  if(REQUIRE_VEVO){
    ok = ok.filter(v => (v.channelTitle || "").toUpperCase().includes("VEVO"));
  }

  // Random 100
  const picked = pickRandom(ok, 100).map(v => ({
    id: v.id,
    title: v.title,
    artist: v.channelTitle,
    tag: "VEVO • 1B+",
    views: fmtViews(v.views),
    duration: isoToTime(v.durationISO),
    // lyrics manual (bản quyền) - để trống
    lyrics: { en:"", vi:"" },
    lyricsUrl: ""
  }));

  if(picked.length < 100){
    console.warn("USUK not enough after filter:", ok.length);
  }
  return picked;
}

async function buildVN_100(){
  const ids = await getPlaylistVideoIds(SOURCE_PLAYLIST_VN, 800);
  const det = await getVideosDetails(ids);

  let ok = det.filter(v => v.views >= VN_MIN_VIEWS);

  const picked = pickRandom(ok, 100).map(v => ({
    id: v.id,
    title: v.title,
    artist: v.channelTitle,
    tag: "VN • 100M+",
    views: fmtViews(v.views),
    duration: isoToTime(v.durationISO),
    lyrics: { en:"", vi:"" },
    lyricsUrl: ""
  }));

  if(picked.length < 100){
    console.warn("VN not enough after filter:", ok.length);
  }
  return picked;
}

// ========= UI
function render(){
  playlistEl.innerHTML = "";
  filtered.forEach((s, idx)=>{
    const div = document.createElement("div");
    div.className = "item" + (currentItem && s.id === currentItem.id ? " active" : "");
    div.innerHTML = `
      <div class="thumb"><img src="${thumb(s.id)}" alt=""></div>
      <div class="meta">
        <b title="${s.title}">${s.title}</b>
        <small title="${s.artist}">${s.artist} • ${s.views}</small>
      </div>
      <div class="tag">${s.tag}${s.duration ? " • " + s.duration : ""}</div>
    `;
    div.onclick = ()=>play(idx);
    playlistEl.appendChild(div);
  });
}

function play(idx){
  if(filtered.length === 0) return;
  currentIndex = idx;
  currentItem = filtered[currentIndex];
  ytPlayer.src = ytEmbed(currentItem.id);
  nowTitleEl.textContent = `${currentItem.title} — ${currentItem.artist}`;
  nowTypeEl.textContent = (activeTab === "USUK") ? "US/UK" : "VIETNAM";
  applyLyrics(currentLang);
  render();
}

function applyLyrics(lang){
  currentLang = lang;
  if(!currentItem){
    lyricsBox.textContent = "Lyrics: (bản quyền) anh tự nhập tay hoặc để link Genius/Musixmatch.";
    return;
  }
  const txt = (currentItem.lyrics && currentItem.lyrics[lang]) ? currentItem.lyrics[lang].trim() : "";
  lyricsBox.textContent = txt || "Chưa có lyrics (bản quyền). Anh nhập tay trong list hoặc để link ở Lyrics ↗";
}

function applySearch(){
  const q = (searchEl.value || "").trim().toLowerCase();
  if(!q){
    filtered = [...list];
  }else{
    filtered = list.filter(s =>
      (s.title||"").toLowerCase().includes(q) ||
      (s.artist||"").toLowerCase().includes(q) ||
      (s.tag||"").toLowerCase().includes(q)
    );
  }
  // giữ currentIndex nếu còn
  if(currentItem){
    const ni = filtered.findIndex(x=>x.id===currentItem.id);
    currentIndex = ni;
  }
  render();
}

function updateButtons(){
  btnAutoplay.textContent = "Autoplay: " + (autoplay ? "ON":"OFF");
  btnLoop.textContent = "Loop: " + loopMode.toUpperCase();
  btnShuffle.textContent = "Shuffle: " + (shuffle ? "ON":"OFF");
}

function next(){
  if(!currentItem){
    if(filtered.length) return play(0);
    return;
  }
  if(loopMode === "one") return play(currentIndex);

  if(shuffle){
    const r = Math.floor(Math.random()*filtered.length);
    return play(r);
  }

  const n = currentIndex + 1;
  if(n < filtered.length) return play(n);

  if(loopMode === "all") return play(0);
}

function prev(){
  if(!currentItem){
    if(filtered.length) return play(0);
    return;
  }
  const p = currentIndex - 1;
  if(p >= 0) return play(p);
  return play(0);
}

// ========= Events
tabUSUK.onclick = async ()=>{
  activeTab = "USUK";
  tabUSUK.classList.add("active");
  tabVN.classList.remove("active");
  nowTypeEl.textContent = "US/UK";
  await reloadRandom();
};

tabVN.onclick = async ()=>{
  activeTab = "VN";
  tabVN.classList.add("active");
  tabUSUK.classList.remove("active");
  nowTypeEl.textContent = "VIETNAM";
  await reloadRandom();
};

searchEl.addEventListener("input", applySearch);

btnReload.onclick = reloadRandom;

btnShuffle.onclick = ()=>{ shuffle = !shuffle; updateButtons(); };
btnLoop.onclick = ()=>{
  loopMode = (loopMode==="off") ? "one" : (loopMode==="one" ? "all" : "off");
  updateButtons();
};
btnAutoplay.onclick = ()=>{ autoplay = !autoplay; updateButtons(); };

btnOpenYT.onclick = ()=>{
  if(!currentItem) return;
  window.open(ytWatch(currentItem.id), "_blank", "noopener");
};

btnLyricsLink.onclick = ()=>{
  if(!currentItem) return;
  if(currentItem.lyricsUrl) window.open(currentItem.lyricsUrl, "_blank", "noopener");
  else alert("Bài này chưa có lyricsUrl. Anh thêm lyricsUrl trong list nhé.");
};

document.addEventListener("click",(e)=>{
  const b = e.target.closest(".lyLang");
  if(!b) return;
  document.querySelectorAll(".lyLang").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  applyLyrics(b.dataset.lang);
});

// ========= Load random 100 each time
async function reloadRandom(){
  if(!YT_API_KEY || YT_API_KEY.includes("PASTE_YOUR_API_KEY")){
    alert("Anh dán YT_API_KEY vào media-pro.js trước nhé (YouTube Data API v3).");
    return;
  }

  nowTitleEl.textContent = "Loading random list...";
  ytPlayer.src = "";
  currentItem = null;
  currentIndex = -1;
  lyricsBox.textContent = "Loading...";

  try{
    if(activeTab === "USUK"){
      list = await buildUSUK_100();
    }else{
      list = await buildVN_100();
    }
    filtered = [...list];
    applySearch();
    if(filtered.length) play(0);
    else{
      nowTitleEl.textContent = "Không đủ bài sau khi lọc (hãy đổi playlist nguồn).";
      lyricsBox.textContent = "Gợi ý: đổi SOURCE_PLAYLIST_* sang playlist lớn hơn.";
    }
  }catch(err){
    console.error(err);
    nowTitleEl.textContent = "Load failed (check API key / quota).";
    lyricsBox.textContent = String(err?.message || err);
  }
  updateButtons();
}

// INIT
updateButtons();
reloadRandom();
