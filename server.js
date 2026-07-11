/*
NEURAAI SERVER V2 - HTML 7 ÖZELLİK UYUMLU

Gerekli Render ortam değişkenleri:
- OPENROUTER_API_KEY
- POLLINATIONS_API_KEY (görsel üretim kullanılıyorsa)
- ELEVENLABS_API_KEY (ElevenLabs ses kullanılıyorsa)
- NEURA_DATA_DIR veya RENDER_DISK_PATH (kalıcı veri için)

Web araması:
- Ek bir arama API anahtarı istemez.
- Mevcut OPENROUTER_API_KEY üzerinden OpenRouter web_search kullanır.
- Kullanıcı "internette ara", "webde araştır", "güncel olarak bak" gibi bir ifade yazınca otomatik çalışır.
- /api/web-search endpointi de ayrıca kullanılabilir.
*/

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.set("trust proxy", true);

/* =========================
   NeuraAI Server.js - V2 HTML 7 Özellik Uyumlu
   Eklenenler:
   - path.join hatası düzeltildi
   - Canlı kullanıcı sayacı
   - Kurucu çevrimiçi durumu
   - Profil Codex kullanımı
   - Codex Chat güçlü analiz
   - Akıllı hafıza
   - Çok dilli zeka
   - Kendini kontrol eden cevap sistemi
========================= */

const DATA_DIR =
  process.env.NEURA_DATA_DIR ||
  process.env.RENDER_DISK_PATH ||
  __dirname;

const DATA_FILE = path.join(DATA_DIR, "neura-data.json");
const PORT = process.env.PORT || 3000;

const FOUNDER_KEY = process.env.FOUNDER_KEY || "ffgok-kurucu";
const FOUNDER_NAME = "NeuraAI";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_VOICE_ID = "i9eiTMiCnVBQnQk0lBUU";
/* =========================
   Veri
========================= */

function guvenliDizi(v){
  return Array.isArray(v) ? v : [];
}

function veriOku(){
  try{
    if(!fs.existsSync(DATA_DIR)){
      fs.mkdirSync(DATA_DIR, { recursive:true });
    }

    if(!fs.existsSync(DATA_FILE)){
      return {
        memories: {},
        neuraMemory: {},
        worldStats: {},
        profileStats: {},
        codexMemories: {},
        folders: {},
        chatFolders: {},
        founderLastSeen: 0
      };
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw || "{}");

    return {
      memories: data.memories && typeof data.memories === "object" ? data.memories : {},
      neuraMemory: data.neuraMemory && typeof data.neuraMemory === "object" ? data.neuraMemory : {},
      worldStats: data.worldStats && typeof data.worldStats === "object" ? data.worldStats : {},
      profileStats: data.profileStats && typeof data.profileStats === "object" ? data.profileStats : {},
      codexMemories: data.codexMemories && typeof data.codexMemories === "object" ? data.codexMemories : {},
      folders: data.folders && typeof data.folders === "object" ? data.folders : {},
      chatFolders: data.chatFolders && typeof data.chatFolders === "object" ? data.chatFolders : {},
      founderLastSeen: Number(data.founderLastSeen || 0)
    };
  }catch(err){
    console.error("Veri okuma hatası:", err);
    return {
      memories: {},
      worldStats: {},
      profileStats: {},
      codexMemories: {},
      folders: {},
      chatFolders: {},
      founderLastSeen: 0
    };
  }
}

const neuraData = veriOku();

function veriKaydet(){
  try{
    if(!fs.existsSync(DATA_DIR)){
      fs.mkdirSync(DATA_DIR, { recursive:true });
    }

    const tmpFile = DATA_FILE + ".tmp";
    fs.writeFileSync(tmpFile, JSON.stringify(neuraData, null, 2), "utf8");
    fs.renameSync(tmpFile, DATA_FILE);
  }catch(err){
    console.error("Veri kaydetme hatası:", err);
  }
}

/* =========================
   Yardımcılar
========================= */

function temizMesaj(m, limit = 6000){
  return String(m || "").slice(0, limit);
}

function ipAl(req){
  const forwarded = req.headers["x-forwarded-for"];
  if(forwarded) return forwarded.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "bilinmiyor";
}

function temizKey(v){
  return String(v || "bilinmiyor").replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 140);
}

function kullaniciKey(req){
  const bodyKey = req.body?.userKey || req.body?.profileId || req.body?.nick;
  const headerKey = req.headers["x-neura-user"];
  return temizKey(bodyKey || headerKey || ipAl(req));
}

function profilHazirla(key){
  if(!neuraData.profileStats[key]){
    neuraData.profileStats[key] = {
      chat: 0,
      imageAnalysis: 0,
      imageCreate: 0,
      codex: 0,
      lastSeen: Date.now()
    };
  }
  return neuraData.profileStats[key];
}

function statsArtir(req, alan){
  const key = kullaniciKey(req);
  const stats = profilHazirla(key);
  stats[alan] = Number(stats[alan] || 0) + 1;
  stats.lastSeen = Date.now();
  neuraData.profileStats[key] = stats;
}


/* =========================
   Sohbet Klasörleri
   - Klasör oluşturma
   - Klasör listeleme
   - Yeniden adlandırma
   - Silme
   - Sohbeti klasöre taşıma
========================= */

function klasorUserKey(req){
  return kullaniciKey(req);
}

function klasorListesiAl(key){
  if(!neuraData.folders || typeof neuraData.folders !== "object"){
    neuraData.folders = {};
  }

  if(!Array.isArray(neuraData.folders[key])){
    neuraData.folders[key] = [];
  }

  return neuraData.folders[key];
}

function sohbetKlasorMapAl(key){
  if(!neuraData.chatFolders || typeof neuraData.chatFolders !== "object"){
    neuraData.chatFolders = {};
  }

  if(!neuraData.chatFolders[key] || typeof neuraData.chatFolders[key] !== "object"){
    neuraData.chatFolders[key] = {};
  }

  return neuraData.chatFolders[key];
}

function klasorIdUret(){
  return "kl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function klasorTemizAd(name){
  return temizMesaj(name || "Yeni Klasör", 40).replace(/\s+/g, " ").trim() || "Yeni Klasör";
}

function klasorCevabi(key){
  const folders = klasorListesiAl(key);
  const chatFolders = sohbetKlasorMapAl(key);

  return {
    ok:true,
    folders,
    chatFolders
  };
}

app.get("/api/folders", (req,res) => {
  try{
    const key = klasorUserKey(req);
    res.json(klasorCevabi(key));
  }catch(err){
    console.error("folders liste hata:", err);
    res.json({ ok:false, reply:"Klasörler alınamadı." });
  }
});

app.post("/api/folders", (req,res) => {
  try{
    const key = klasorUserKey(req);
    res.json(klasorCevabi(key));
  }catch(err){
    console.error("folders post liste hata:", err);
    res.json({ ok:false, reply:"Klasörler alınamadı." });
  }
});

app.post("/api/folders/create", (req,res) => {
  try{
    const key = klasorUserKey(req);
    const name = klasorTemizAd(req.body?.name || req.body?.folderName);
    const folders = klasorListesiAl(key);

    const ayniAdVar = folders.some(f => String(f.name || "").toLowerCase() === name.toLowerCase());
    if(ayniAdVar){
      return res.json({ ok:false, reply:"Bu isimde bir klasör zaten var." });
    }

    const folder = {
      id: klasorIdUret(),
      name,
      color: temizMesaj(req.body?.color || "purple", 30),
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    folders.push(folder);
    neuraData.folders[key] = folders;
    veriKaydet();

    res.json({ ...klasorCevabi(key), folder, reply:"Klasör oluşturuldu." });
  }catch(err){
    console.error("folder create hata:", err);
    res.json({ ok:false, reply:"Klasör oluşturulamadı." });
  }
});

app.post("/api/folders/rename", (req,res) => {
  try{
    const key = klasorUserKey(req);
    const folderId = temizMesaj(req.body?.folderId || req.body?.id, 120);
    const newName = klasorTemizAd(req.body?.name || req.body?.newName);
    const folders = klasorListesiAl(key);
    const folder = folders.find(f => f.id === folderId);

    if(!folder){
      return res.json({ ok:false, reply:"Klasör bulunamadı." });
    }

    folder.name = newName;
    folder.updatedAt = Date.now();
    veriKaydet();

    res.json({ ...klasorCevabi(key), folder, reply:"Klasör adı değiştirildi." });
  }catch(err){
    console.error("folder rename hata:", err);
    res.json({ ok:false, reply:"Klasör adı değiştirilemedi." });
  }
});

app.post("/api/folders/delete", (req,res) => {
  try{
    const key = klasorUserKey(req);
    const folderId = temizMesaj(req.body?.folderId || req.body?.id, 120);
    let folders = klasorListesiAl(key);
    const chatFolders = sohbetKlasorMapAl(key);

    folders = folders.filter(f => f.id !== folderId);
    neuraData.folders[key] = folders;

    for(const chatId of Object.keys(chatFolders)){
      if(chatFolders[chatId] === folderId){
        delete chatFolders[chatId];
      }
    }

    neuraData.chatFolders[key] = chatFolders;
    veriKaydet();

    res.json({ ...klasorCevabi(key), reply:"Klasör silindi. İçindeki sohbetler silinmedi." });
  }catch(err){
    console.error("folder delete hata:", err);
    res.json({ ok:false, reply:"Klasör silinemedi." });
  }
});

app.post("/api/folders/move-chat", (req,res) => {
  try{
    const key = klasorUserKey(req);
    const chatId = temizMesaj(req.body?.chatId || req.body?.sohbetId || req.body?.id, 160);
    const folderId = temizMesaj(req.body?.folderId || req.body?.klasorId || "", 120);

    if(!chatId){
      return res.json({ ok:false, reply:"Taşınacak sohbet bulunamadı." });
    }

    const folders = klasorListesiAl(key);
    const chatFolders = sohbetKlasorMapAl(key);

    if(folderId){
      const folderExists = folders.some(f => f.id === folderId);
      if(!folderExists){
        return res.json({ ok:false, reply:"Klasör bulunamadı." });
      }
      chatFolders[chatId] = folderId;
    }else{
      delete chatFolders[chatId];
    }

    neuraData.chatFolders[key] = chatFolders;
    veriKaydet();

    res.json({ ...klasorCevabi(key), reply: folderId ? "Sohbet klasöre taşındı." : "Sohbet klasörden çıkarıldı." });
  }catch(err){
    console.error("move chat hata:", err);
    res.json({ ok:false, reply:"Sohbet klasöre taşınamadı." });
  }
});

app.post("/api/folders/pin", (req,res) => {
  try{
    const key = klasorUserKey(req);
    const folderId = temizMesaj(req.body?.folderId || req.body?.id, 120);
    const folders = klasorListesiAl(key);
    const folder = folders.find(f => f.id === folderId);

    if(!folder){
      return res.json({ ok:false, reply:"Klasör bulunamadı." });
    }

    folder.pinned = !folder.pinned;
    folder.updatedAt = Date.now();
    veriKaydet();

    res.json({ ...klasorCevabi(key), folder, reply: folder.pinned ? "Klasör sabitlendi." : "Klasör sabitlemesi kaldırıldı." });
  }catch(err){
    console.error("folder pin hata:", err);
    res.json({ ok:false, reply:"Klasör sabitlenemedi." });
  }
});

// Eski veya farklı frontend isimleriyle uyumluluk
app.post("/folders/create", (req,res) => app._router.handle(Object.assign(req, { url:"/api/folders/create" }), res));
app.post("/folders/rename", (req,res) => app._router.handle(Object.assign(req, { url:"/api/folders/rename" }), res));
app.post("/folders/delete", (req,res) => app._router.handle(Object.assign(req, { url:"/api/folders/delete" }), res));
app.post("/folders/move-chat", (req,res) => app._router.handle(Object.assign(req, { url:"/api/folders/move-chat" }), res));

/* =========================
   Online + Kurucu + Dünya
========================= */

let onlineUsers = {};

function onlineTemizle(){
  const now = Date.now();
  const timeout = 45000;

  for(const key of Object.keys(onlineUsers)){
    if(now - onlineUsers[key].lastSeen > timeout){
      delete onlineUsers[key];
    }
  }
}

function onlineSayisi(){
  onlineTemizle();
  return Object.keys(onlineUsers).length;
}

function founderOnlineMi(){
  return Date.now() - Number(neuraData.founderLastSeen || 0) < 45000;
}

function onlinePingHandler(req, res){
  try{
    const key = kullaniciKey(req);
    const founderKey = req.body?.founderKey || req.query?.founderKey || req.headers["x-founder-key"];
    const nick = String(req.body?.nick || req.query?.nick || "").toLowerCase();
    const isFounder = founderKey === FOUNDER_KEY || nick === "neurai" || nick === "neuraai";

    onlineUsers[key] = {
      lastSeen: Date.now(),
      founder: !!isFounder
    };

    if(isFounder){
      neuraData.founderLastSeen = Date.now();
    }

    veriKaydet();

    res.json({
      ok:true,
      online: onlineSayisi(),
      onlineCount: onlineSayisi(),
      founderOnline: founderOnlineMi(),
      founderName: FOUNDER_NAME
    });
  }catch(err){
    console.error("online ping hata:", err);
    res.json({
      ok:false,
      online: onlineSayisi(),
      onlineCount: onlineSayisi(),
      founderOnline: founderOnlineMi(),
      founderName: FOUNDER_NAME
    });
  }
}

app.get("/api/online", onlinePingHandler);
app.post("/api/online", onlinePingHandler);
app.get("/api/live-users", onlinePingHandler);
app.post("/api/live-users", onlinePingHandler);
app.get("/api/ping", onlinePingHandler);
app.post("/api/ping", onlinePingHandler);

// Eski frontend uyumluluğu
app.post("/online-ping", onlinePingHandler);
app.get("/online-count", (req, res) => {
  res.json({
    ok:true,
    online: onlineSayisi(),
    onlineCount: onlineSayisi(),
    founderOnline: founderOnlineMi(),
    founderName: FOUNDER_NAME
  });
});


app.get("/api/founder-status", (req,res) => {
  res.json({
    ok:true,
    founderName: FOUNDER_NAME,
    founderOnline: founderOnlineMi(),
    text: founderOnlineMi() ? "👑 NeuraAI çevrimiçi" : "👑 NeuraAI çevrimdışı"
  });
});


/* =========================
   Akıllı Hafıza
========================= */

function akilliHafizaAl(key){
  if(!Array.isArray(neuraData.memories[key])){
    neuraData.memories[key] = [];
  }
  return neuraData.memories[key];
}

function hafizaAdayiMi(mesaj){
  const m = temizMesaj(mesaj).toLowerCase();

  const anahtarlar = [
    "seviyorum", "sevmiyorum", "hoşuma gidiyor", "hosuma gidiyor",
    "tercihim", "tercih ederim", "benim projem", "projem",
    "neurai", "codex", "adım", "adim", "yaşım", "yasim",
    "ben ", "bana ", "bundan sonra", "hep ", "genelde "
  ];

  return anahtarlar.some(k => m.includes(k));
}

function hafizaKaydet(key, mesaj){
  const temiz = temizMesaj(mesaj, 500).replace(/\s+/g, " ").trim();
  if(!temiz || temiz.length < 8) return;
  if(!hafizaAdayiMi(temiz)) return;

  const list = akilliHafizaAl(key);
  const exists = list.some(x => String(x.text || "").toLowerCase() === temiz.toLowerCase());
  if(exists) return;

  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
    text: temiz.slice(0,220),
    time: Date.now()
  });

  neuraData.memories[key] = list.slice(-25);
  veriKaydet();
}

function hafizaPromptu(key){
  const list = akilliHafizaAl(key).filter(x => x && x.text).slice(-12);
  if(list.length === 0) return "";

  return (
    "Kullanıcı hakkında güvenli akıllı hafıza notları: " +
    list.map((m,i) => `${i + 1}) ${m.text}`).join(" | ") +
    ". Bu notları sadece cevap kalitesini artırmak için kullan. "
  );
}
/* =========================
   NeuraAI Hafızası V2.1
========================= */

function neuraHafizaListeAl(key){
  if(!neuraData.neuraMemory || typeof neuraData.neuraMemory !== "object"){
    neuraData.neuraMemory = {};
  }

  if(!Array.isArray(neuraData.neuraMemory[key])){
    neuraData.neuraMemory[key] = [];
  }

  return neuraData.neuraMemory[key];
}

function neuraHafizaMetinTemizle(text){
  return temizMesaj(text || "", 500)
    .replace(/bunu\s+(hatırla|hatirla|kaydet|unutma)/gi, "")
    .replace(/belleğe\s+kaydet/gi, "")
    .replace(/hafızaya\s+kaydet/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function neuraHafizaKaydet(key, text){
  const temiz = neuraHafizaMetinTemizle(text);

  if(!temiz || temiz.length < 3){
    return { ok:false, reply:"Kaydedilecek net bir bilgi bulamadım." };
  }

  const list = neuraHafizaListeAl(key);
  const ayniVar = list.some(x => String(x.text || "").toLowerCase() === temiz.toLowerCase());

  if(ayniVar){
    return { ok:true, reply:"Bu bilgi zaten NeuraAI Hafızası'nda kayıtlı.", memory:list };
  }

  const item = {
    id:"mem_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8),
    text:temiz.slice(0, 500),
    time:Date.now()
  };

  list.push(item);
  neuraData.neuraMemory[key] = list.slice(-60);
  veriKaydet();

  return { ok:true, reply:"NeuraAI Hafızası'na kaydedildi.", item, memory:neuraData.neuraMemory[key] };
}

function neuraHafizaPromptu(key){
  const list = neuraHafizaListeAl(key).filter(x => x && x.text).slice(-30);
  if(list.length === 0) return "";

  return (
    "NeuraAI Hafızası kayıtları: " +
    list.map((m,i) => `${i + 1}) ${m.text}`).join(" | ") +
    ". Kullanıcı hatırlama sorusu sorarsa önce bu kayıtları dikkate al. "
  );
}
/* =========================
   NeuraAI Hafızası API
========================= */

app.post("/api/memory/list", (req, res) => {
  try{
    const key = kullaniciKey(req);

    res.json({
      ok: true,
      memory: neuraHafizaListeAl(key)
    });
  }catch(err){
    console.error(err);
    res.json({
      ok:false,
      reply:"Bellek alınamadı."
    });
  }
});

app.post("/api/memory/save", (req, res) => {
  try{
    const key = kullaniciKey(req);
    const text = req.body?.text || req.body?.message || "";

    const result = neuraHafizaKaydet(key, text);

    res.json(result);
  }catch(err){
    console.error(err);
    res.json({
      ok:false,
      reply:"Bellek kaydedilemedi."
    });
  }
});

app.post("/api/memory/delete", (req, res) => {
  try{
    const key = kullaniciKey(req);
    const id = String(req.body?.id || "");

    const list = neuraHafizaListeAl(key).filter(x => x.id !== id);

    neuraData.neuraMemory[key] = list;
    veriKaydet();

    res.json({
      ok:true,
      reply:"Bilgi unutuldu.",
      memory:list
    });
  }catch(err){
    console.error(err);
    res.json({
      ok:false,
      reply:"Silinemedi."
    });
  }
});

app.post("/api/memory/clear", (req, res) => {
  try{
    const key = kullaniciKey(req);

    neuraData.neuraMemory[key] = [];

    veriKaydet();

    res.json({
      ok:true,
      reply:"NeuraAI Hafızası temizlendi."
    });
  }catch(err){
    console.error(err);
    res.json({
      ok:false,
      reply:"Temizlenemedi."
    });
  }
});
/* =========================
   Model / Prompt
========================= */

function modelProfili(tip){
  const t = String(tip || "akilli").toLowerCase();

  if(t === "hizli"){
    return {
      ad:"Hızlı",
      model: process.env.OPENROUTER_FAST_MODEL || "openai/gpt-4o-mini",
      maxKisa:650,
      maxUzun:1600,
      prompt:"Hızlı, kısa, net ve pratik cevap ver."
    };
  }

  if(t === "yaratici"){
    return {
      ad:"Yaratıcı",
      model: process.env.OPENROUTER_CREATIVE_MODEL || "openai/gpt-4o-mini",
      maxKisa:1200,
      maxUzun:2600,
      prompt:"Yaratıcı, özgün ve fikir odaklı cevap ver."
    };
  }

  if(t === "kod"){
    return {
      ad:"Kod",
      model: process.env.OPENROUTER_CODE_MODEL || "openai/gpt-4o-mini",
      maxKisa:1800,
      maxUzun:4200,
      prompt:"Kod ve hata çözümüne odaklan. Uygulanabilir, net ve dosya konumlarını belirten cevap ver."
    };
  }

  return {
    ad:"Akıllı",
    model: process.env.OPENROUTER_SMART_MODEL || "openai/gpt-4o-mini",
    maxKisa:1200,
    maxUzun:3200,
    prompt:"Dengeli, akıllı, bağlamı takip eden ve kaliteli cevap ver."
  };
}

function cokDilliZekaKurallari(){
  return (
    "Çok dilli zeka aktif. Kullanıcı hangi dilde yazarsa o dilde cevap ver. " +
    "Kullanıcı Türkçe yazarsa Türkçe cevap ver ama gerekirse İngilizce ve diğer dillerdeki genel bilgileri zihinsel olarak karşılaştırıp daha kaliteli cevap üret. " +
    "Kullanıcı farklı diller karıştırırsa anlamı koru. "
  );
}

function baglamsalEmojiKurallari(){
  return (
    "Emoji ve random yazıları bağlama göre yorumla. 😭 her zaman üzülmek değildir; gülme, şaşırma veya heyecan olabilir. " +
    "Random harfleri önceki bağlama göre değerlendir. Kullanıcı açıkça üzgün demedikçe sadece emojiye bakıp üzgün varsayma. "
  );
}

function ozelAiPrompt(customAi){
  if(!customAi || typeof customAi !== "object") return "";
  const name = temizMesaj(customAi.name || "", 60).trim();
  if(!name) return "";

  return (
    "Kullanıcı özel AI karakteri ile konuşuyor. " +
    "Karakter adı: " + name + ". " +
    "Rol/tür: " + temizMesaj(customAi.type || "Genel yardımcı", 100) + ". " +
    "Tarz: " + temizMesaj(customAi.style || "Samimi", 80) + ". " +
    "Uzmanlık: " + temizMesaj(customAi.expertise || "Genel konular", 220) + ". " +
    "Açıklama: " + temizMesaj(customAi.description || "", 500) + ". "
  );
}

function sistemPrompt({ modeName, aiModelTipi, customAi, userKey }){
  const profil = modelProfili(aiModelTipi);

  let temel =
    "Sen NeuraAI adında net, yardımcı ve güvenli bir yapay zekasın. " +
"Kullanıcı sana 'Kimsin?', 'Seni kim yaptı?', 'Seni kim geliştirdi?' gibi sorular sorarsa şu anlama gelen bir cevap ver: 'Ben NeuraAI'yım. Geliştiricim Göktürk Arslan. Amacım hızlı, akıllı ve doğal bir yapay zekâ deneyimi sunmak.' Kendini ChatGPT veya başka bir isimle tanıtma. " +
cokDilliZekaKurallari() +
hafizaPromptu(userKey) +
neuraHafizaPromptu(userKey) +
baglamsalEmojiKurallari() +
    "Önceki konuşmaları güçlü şekilde dikkate al. Kullanıcıya teknik sistem açıklaması yapma. " +
    "Seçili model modu: " + profil.ad + ". " + profil.prompt + " " +
    ozelAiPrompt(customAi);

  if(modeName === "resmi"){
    temel += "Resmi moddasın. Profesyonel ve düzenli cevap ver. ";
  }else if(modeName === "profesor"){
    temel += "Profesör modu Pro gerektirir; kullanıcı isterse kibarca Pro gerektiğini söyle. ";
  }else{
    temel += "Samimi moddasın. Sıcak, doğal, arkadaş gibi ama net konuş. ";
  }

  return temel;
}

async function openrouterChat({ model, max_tokens, messages }){
  if(!process.env.OPENROUTER_API_KEY){
    throw new Error("OPENROUTER_API_KEY yok.");
  }

  const r = await fetch(OPENROUTER_API_URL, {
    method:"POST",
    headers:{
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      model,
      max_tokens,
      messages
    })
  });

  const data = await r.json().catch(() => ({}));

  if(!r.ok){
    console.error("OpenRouter hata:", data);
    throw new Error("OpenRouter hata: " + r.status);
  }

  return data.choices?.[0]?.message?.content || "";
}


/* =========================
   Gerçek İnternet Araması
   - Mevcut OPENROUTER_API_KEY ile çalışır
   - OpenRouter web_search server tool kullanır
   - Gerekirse eski web plugin yöntemine düşer
   - Kaynakları hem JSON hem de cevap sonunda döndürür
========================= */

function internetAramaIstegiMi(message, body = {}){
  if(body.webSearch === true || body.internetSearch === true || body.searchWeb === true){
    return true;
  }

  const m = temizMesaj(message, 4000).toLowerCase();

  const kaliplar = [
    /internette\s+(ara|arama|araştır|arastir|bak)/i,
    /web(?:'de|de|den)?\s+(ara|arama|araştır|arastir|bak)/i,
    /internet(?:ten|te|de)?\s+(ara|araştır|arastir|bak)/i,
    /güncel\s+(olarak\s+)?(ara|araştır|arastir|bak)/i,
    /kaynak(?:ları|lari)?\s+(bul|göster|goster)/i,
    /arama\s+yap/i
  ];

  return kaliplar.some(k => k.test(m));
}

function webAramaSorgusuTemizle(message){
  let q = temizMesaj(message, 1200)
    .replace(/internette\s+(ara|arama|araştır|arastir|bak)/gi, " ")
    .replace(/web(?:'de|de|den)?\s+(ara|arama|araştır|arastir|bak)/gi, " ")
    .replace(/internet(?:ten|te|de)?\s+(ara|araştır|arastir|bak)/gi, " ")
    .replace(/güncel\s+(olarak\s+)?(ara|araştır|arastir|bak)/gi, " ")
    .replace(/kaynak(?:ları|lari)?\s+(bul|göster|goster)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return q || temizMesaj(message, 1200).trim();
}

function webKaynaklariniAyikla(message){
  const annotations = Array.isArray(message?.annotations) ? message.annotations : [];
  const seen = new Set();
  const sources = [];

  for(const ann of annotations){
    const c = ann?.url_citation || ann?.citation || {};
    const url = temizMesaj(c.url || ann?.url || "", 1500).trim();
    if(!url || seen.has(url)) continue;

    seen.add(url);
    sources.push({
      title: temizMesaj(c.title || ann?.title || "Kaynak", 240).trim() || "Kaynak",
      url,
      content: temizMesaj(c.content || ann?.content || "", 700).trim()
    });

    if(sources.length >= 8) break;
  }

  return sources;
}

function kaynaklariCevabaEkle(reply, sources){
  const temizReply = temizMesaj(reply, 12000).trim();
  if(!Array.isArray(sources) || sources.length === 0){
    return temizReply;
  }

  const satirlar = sources.map((s, i) => {
    const baslik = temizMesaj(s.title || "Kaynak", 180).replace(/\n/g, " ").trim();
    const url = temizMesaj(s.url || "", 1500).trim();
    return `${i + 1}. ${baslik}\n${url}`;
  });

  return `${temizReply}\n\nKaynaklar\n\n${satirlar.join("\n\n")}`;
}

async function openrouterWebSearch({ model, max_tokens, messages }){
  if(!process.env.OPENROUTER_API_KEY){
    throw new Error("OPENROUTER_API_KEY yok.");
  }

  const ortak = {
    model,
    max_tokens,
    messages
  };

  async function istek(body){
    const r = await fetch(OPENROUTER_API_URL, {
      method:"POST",
      headers:{
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type":"application/json",
        "HTTP-Referer": process.env.APP_URL || "https://neuraai.com",
        "X-OpenRouter-Title": "NeuraAI"
      },
      body:JSON.stringify(body)
    });

    const data = await r.json().catch(() => ({}));

    if(!r.ok){
      const hata = new Error("OpenRouter web arama hatası: " + r.status);
      hata.data = data;
      throw hata;
    }

    return data;
  }

  let data;

  try{
    data = await istek({
      ...ortak,
      tools:[
        {
          type:"openrouter:web_search",
          parameters:{
            max_results:5,
            max_total_results:8,
            search_context_size:"medium"
          }
        }
      ],
      tool_choice:"auto"
    });
  }catch(toolErr){
    console.error("OpenRouter server tool başarısız, plugin deneniyor:", toolErr.message);

    data = await istek({
      ...ortak,
      plugins:[
        {
          id:"web",
          max_results:5
        }
      ]
    });
  }

  const message = data.choices?.[0]?.message || {};
  const reply = typeof message.content === "string"
    ? message.content
    : Array.isArray(message.content)
      ? message.content.map(x => x?.text || "").join("\n")
      : "";

  return {
    reply: temizMesaj(reply, 12000).trim(),
    sources: webKaynaklariniAyikla(message),
    rawMessage: message
  };
}

async function webAramaliCevapUret({ query, userKey, selectedMode, aiModelTipi, customAi, mode, messages }){
  const profil = modelProfili(aiModelTipi);
  const hafiza = Array.isArray(messages) && messages.length > 0
    ? messages.slice(-40)
    : [];

  const sistem =
    sistemPrompt({
      modeName:selectedMode,
      aiModelTipi,
      customAi,
      userKey
    }) +
    " Kullanıcı gerçek internet araması istiyor. Güncel bilgiyi web aramasıyla doğrula. " +
    "Kaynaklara dayanmayan güncel iddiaları kesinmiş gibi yazma. " +
    "Cevabı doğrudan ver; 'internette aranıyor' gibi süreç anlatımı ekleme. " +
    "Kaynak bağlantıları ayrıca sistem tarafından cevabın sonunda gösterilecek. ";

  const sonuc = await openrouterWebSearch({
    model: profil.model,
    max_tokens: mode === "uzun" ? profil.maxUzun : Math.max(profil.maxKisa, 1200),
    messages:[
      { role:"system", content:sistem },
      ...hafiza,
      {
        role:"user",
        content:
          "Web üzerinde araştır ve güncel kaynaklara göre cevapla.\n\n" +
          "Arama konusu: " + temizMesaj(query, 1200)
      }
    ]
  });

  return sonuc;
}

async function kendiniKontrolEt({ soru, cevap, model, mode }){
  try{
    const ilk = temizMesaj(cevap, 8000).trim();
    if(!ilk || ilk.length < 30) return ilk;

    const final = await openrouterChat({
      model: process.env.OPENROUTER_FAST_MODEL || model || "openai/gpt-4o-mini",
      max_tokens: mode === "uzun" ? 1800 : 850,
      messages:[
        {
          role:"system",
          content:
            "Sen NeuraAI gizli kalite kontrol sistemisin. " +
            "İlk cevabı kontrol et ve sadece kullanıcıya gidecek nihai cevabı yaz. " +
            "Kontrol ettim, puanladım gibi meta sözler yazma. " +
            "Yanlış kesinlik, eksik cevap, konu dışına çıkma, gereksiz uzatma ve çelişki varsa düzelt. " +
            "Kullanıcının dili neyse o dilde cevap ver."
        },
        {
          role:"user",
          content:"Kullanıcı mesajı:\n" + temizMesaj(soru, 3000) + "\n\nİlk cevap:\n" + ilk
        }
      ]
    });

    return temizMesaj(final || ilk, 8000).trim() || ilk;
  }catch(err){
    console.error("Kendini kontrol hata:", err.message);
    return cevap;
  }
}

/* =========================
   Chat
========================= */

let kullaniciLimit = {};
let sonMesaj = {};

app.post("/chat", async (req,res) => {
  try{
    const {
      message,
      messages,
      mode,
      konusmaModu,
      aiModelTipi,
      customAi,
      webSearch,
      internetSearch,
      searchWeb
    } = req.body || {};

    const msg = temizMesaj(message, 4000).trim();
    const userKey = kullaniciKey(req);
    const ip = ipAl(req);
    const now = Date.now();
const lowerMsg = msg.toLowerCase();

if (
  lowerMsg.includes("bunu hatırla") ||
  lowerMsg.includes("bunu kaydet") ||
  lowerMsg.includes("bunu unutma")
){
  const result = neuraHafizaKaydet(userKey, msg);

  return res.json({
    ok: true,
    reply: result.reply
  });
}
if (
  lowerMsg.includes("belleği göster") ||
  lowerMsg.includes("hafızamı göster") ||
  lowerMsg.includes("ben sana ne demiştim")
){
  const memory = neuraHafizaListeAl(userKey);

  return res.json({
    ok: true,
    memory,
    reply: "NeuraAI Hafızası gönderildi."
  });
}

    if(!msg) return res.json({ reply:"Boş mesaj gönderme." });

    if(!process.env.OPENROUTER_API_KEY){
      return res.json({ reply:"AI API key ayarlanmamış." });
    }

    if(!kullaniciLimit[ip]) kullaniciLimit[ip] = [];
    kullaniciLimit[ip].push(now);
    kullaniciLimit[ip] = kullaniciLimit[ip].filter(t => now - t < 60000);

    if(kullaniciLimit[ip].length > 12){
      return res.json({ reply:"Çok hızlı gidiyorsun. 1 dakika sonra tekrar dene." });
    }

    if(sonMesaj[ip] && now - sonMesaj[ip].time < 2500){
      return res.json({ reply:"Biraz yavaş. 2-3 saniye bekle." });
    }

    sonMesaj[ip] = { time:now, text:msg };

    statsArtir(req, "chat");
    hafizaKaydet(userKey, msg);

    const selectedMode = ["samimi","resmi","profesor"].includes(konusmaModu)
      ? konusmaModu
      : "samimi";

    const profil = modelProfili(aiModelTipi);

    const webIstegi = internetAramaIstegiMi(msg, {
      webSearch,
      internetSearch,
      searchWeb
    });

    if(webIstegi){
      const query = webAramaSorgusuTemizle(msg);

      const webSonuc = await webAramaliCevapUret({
        query,
        userKey,
        selectedMode,
        aiModelTipi,
        customAi,
        mode,
        messages
      });

      const kaynakliCevap = kaynaklariCevabaEkle(
        webSonuc.reply || "Arama sonucunda cevap üretilemedi.",
        webSonuc.sources
      );

      return res.json({
        ok:true,
        reply:kaynakliCevap,
        searchedWeb:true,
        webSearch:true,
        query,
        sources:webSonuc.sources,
        kalanMesaj:999
      });
    }

    const hafiza = Array.isArray(messages) && messages.length > 0
      ? messages.slice(-80)
      : [{ role:"user", content: msg }];

    const ilkCevap = await openrouterChat({
      model: profil.model,
      max_tokens: mode === "uzun" ? profil.maxUzun : profil.maxKisa,
      messages:[
        {
          role:"system",
          content:sistemPrompt({
            modeName:selectedMode,
            aiModelTipi,
            customAi,
            userKey
          })
        },
        ...hafiza
      ]
    });



    const finalCevap = await kendiniKontrolEt({
      soru: msg,
      cevap: ilkCevap,
      model: profil.model,
      mode
    });

    res.json({
      ok:true,
      reply: finalCevap,
      kalanMesaj: 999
    });
  }catch(err){
    console.error("/chat hata:", err);
    res.json({ ok:false, reply:"Hata oluştu. Biraz sonra tekrar dene." });
  }
});


/* =========================
   Web Arama API
   Yeni HTML veya ilerideki arama sayfası doğrudan bunu çağırabilir.
========================= */

app.get("/api/web-search/status", (req,res) => {
  res.json({
    ok:true,
    available:!!process.env.OPENROUTER_API_KEY,
    provider:"OpenRouter web_search",
    message:process.env.OPENROUTER_API_KEY
      ? "İnternet araması hazır."
      : "OPENROUTER_API_KEY ayarlanmamış."
  });
});

app.post("/api/web-search", async (req,res) => {
  try{
    const message = temizMesaj(
      req.body?.query || req.body?.message || req.body?.prompt || "",
      1200
    ).trim();

    if(!message){
      return res.json({
        ok:false,
        reply:"Aranacak bir konu yaz."
      });
    }

    if(!process.env.OPENROUTER_API_KEY){
      return res.json({
        ok:false,
        reply:"İnternet araması için OPENROUTER_API_KEY ayarlanmamış."
      });
    }

    const userKey = kullaniciKey(req);
    const selectedMode = ["samimi","resmi","profesor"].includes(req.body?.konusmaModu)
      ? req.body.konusmaModu
      : "samimi";

    const sonuc = await webAramaliCevapUret({
      query:webAramaSorgusuTemizle(message),
      userKey,
      selectedMode,
      aiModelTipi:req.body?.aiModelTipi || "akilli",
      customAi:req.body?.customAi,
      mode:req.body?.mode || "kisa",
      messages:req.body?.messages
    });

    res.json({
      ok:true,
      searchedWeb:true,
      webSearch:true,
      query:webAramaSorgusuTemizle(message),
      sources:sonuc.sources,
      reply:kaynaklariCevabaEkle(sonuc.reply, sonuc.sources)
    });
  }catch(err){
    console.error("/api/web-search hata:", err);
    res.json({
      ok:false,
      searchedWeb:false,
      sources:[],
      reply:"İnternet araması şu anda tamamlanamadı. Biraz sonra tekrar dene."
    });
  }
});

app.post("/web-search", (req,res) => {
  req.url = "/api/web-search";
  app._router.handle(req,res);
});

/* =========================
   Smart Title
========================= */

app.post("/smart-title", async (req,res) => {
  try{
    const message = temizMesaj(req.body?.message || "", 500).trim();
    const reply = temizMesaj(req.body?.reply || "", 500).trim();

    if(!message) return res.json({ ok:false, title:"" });

    if(!process.env.OPENROUTER_API_KEY){
      return res.json({
        ok:true,
        title: message.split(/\s+/).slice(0,4).join(" ") || "Yeni Sohbet"
      });
    }

    const title = await openrouterChat({
      model: process.env.OPENROUTER_FAST_MODEL || "openai/gpt-4o-mini",
      max_tokens: 30,
      messages:[
        {
          role:"system",
          content:"Sadece kısa ve resmi Türkçe sohbet başlığı üret. En fazla 4 kelime. Emoji, sembol, tırnak, nokta veya açıklama yazma."
        },
        {
          role:"user",
          content:"Kullanıcı: " + message + "\nAI: " + reply
        }
      ]
    });

    res.json({
      ok:true,
      title: temizMesaj(title, 40).replace(/["'`]/g, "").replace(/\n/g, " ").trim() || "Yeni Sohbet"
    });
  }catch(err){
    console.error("smart-title hata:", err);
    res.json({ ok:false, title:"Yeni Sohbet" });
  }
});

/* =========================
   Codex Chat
========================= */

function kodVarMi(text){
  const t = String(text || "");
  const codeSignals = [
    "function ", "const ", "let ", "var ", "app.", "require(", "import ",
    "<html", "<div", "</", "{", "}", "=>", "console.log",
    "server.js", "html", "css", "javascript", "node", "express",
    "hata", "bug", "analiz", "optimize", "düzelt", "duzelt", "kod"
  ];
  return codeSignals.some(s => t.toLowerCase().includes(s.toLowerCase())) || t.length > 250;
}

function codexMemoryKey(req){
  return kullaniciKey(req);
}

function codexMemoryAl(key){
  if(!Array.isArray(neuraData.codexMemories[key])){
    neuraData.codexMemories[key] = [];
  }
  return neuraData.codexMemories[key];
}

function codexMemoryPrompt(key){
  const list = codexMemoryAl(key).slice(-8);
  if(list.length === 0) return "";
  return "Codex proje hafızası:\n" + list.map((m,i) => `${i + 1}) ${m.title}: ${m.summary}`).join("\n");
}

app.post("/api/codex-memory", (req,res) => {
  try{
    const key = codexMemoryKey(req);
    const title = temizMesaj(req.body?.title || "Kod Notu", 80);
    const code = temizMesaj(req.body?.code || req.body?.content || "", 5000);

    if(!code.trim()){
      return res.json({ ok:false, reply:"Kaydedilecek kod yok." });
    }

    const list = codexMemoryAl(key);
    list.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
      title,
      summary: code.replace(/\s+/g, " ").slice(0, 500),
      time: Date.now()
    });

    neuraData.codexMemories[key] = list.slice(-30);
    veriKaydet();

    res.json({ ok:true, reply:"Kod proje hafızasına kaydedildi." });
  }catch(err){
    console.error("codex memory hata:", err);
    res.json({ ok:false, reply:"Hafıza kaydedilemedi." });
  }
});

async function codexChatHandler(req,res){
  try{
    const userKey = codexMemoryKey(req);
    const prompt = temizMesaj(req.body?.message || req.body?.prompt || "", 5000);
    const code = temizMesaj(req.body?.code || req.body?.kod || "", 16000);
    const eskiKod = temizMesaj(req.body?.oldCode || req.body?.eskiKod || "", 12000);
    const yeniKod = temizMesaj(req.body?.newCode || req.body?.yeniKod || "", 12000);

    const fullText = [prompt, code, eskiKod, yeniKod].filter(Boolean).join("\n\n");

    if(!fullText.trim()){
      return res.json({
        ok:true,
        reply:"Merhaba, ben Codex. Kodunu gönder, ne yapmak istediğini yaz; güçlü şekilde inceleyeyim."
      });
    }

    if(!kodVarMi(fullText)){
      return res.json({
        ok:true,
        reply:"Merhaba, ben Codex. Ben kod analizi, hata bulma, optimizasyon, güvenlik ve proje geliştirme için buradayım. Bana kodunu gönder; ne yapmamı istediğini yaz."
      });
    }

    statsArtir(req, "codex");

    const profil = modelProfili("kod");

    const codexSystem =
      "Sen NeuraAI içindeki Codex adlı güçlü kod asistanısın. " +
      "Sadece kod, yazılım, hata ayıklama, güvenlik, optimizasyon, dosya yapısı ve proje geliştirme konularında yardım et. " +
      "Kullanıcı kod dışı gündelik konu açarsa kibarca kod göndermesini iste. " +
      "Kullanıcı kod gönderirse asla sadece 'Merhaba ben Codex' deme; mutlaka kodu analiz et. " +
      "Cevabın güçlü olsun: önce kısa teşhis, sonra sorunlar, sonra çözüm, sonra gerekiyorsa düzeltilmiş kod parçası. " +
      "Uzun dosyanın tamamını gereksiz tekrar yazma; değişecek bölümü net ver. " +
      "Hangi dosyaya ekleneceğini açıkça söyle. " +
      "Emin olmadığın yerde kesin konuşma. " +
      "Kullanıcı Türkçe yazıyorsa Türkçe cevap ver. " +
      codexMemoryPrompt(userKey);

    let userContent = "";
    if(prompt) userContent += "Kullanıcının isteği:\n" + prompt + "\n\n";
    if(code) userContent += "Kod:\n```text\n" + code + "\n```\n\n";
    if(eskiKod || yeniKod){
      userContent += "Eski kod:\n```text\n" + eskiKod + "\n```\n\nYeni kod:\n```text\n" + yeniKod + "\n```\n\n";
    }

    const reply = await openrouterChat({
      model: profil.model,
      max_tokens: 4200,
      messages:[
        { role:"system", content:codexSystem },
        { role:"user", content:userContent }
      ]
    });

    res.json({
      ok:true,
      reply: temizMesaj(reply, 12000) || "Codex cevap üretemedi."
    });
  }catch(err){
    console.error("codex chat hata:", err);
    res.json({
      ok:false,
      reply:"Codex tarafında hata oluştu. API key veya model ayarlarını kontrol et."
    });
  }
}

app.post("/api/codex-chat", codexChatHandler);
app.post("/codex-chat", codexChatHandler);
app.post("/codex", codexChatHandler);

/* Eski butonlar bozulmasın diye */
app.post("/api/codex", codexChatHandler);

/* =========================
   Görsel Analiz
========================= */

app.post("/chat-image", async (req,res) => {
  try{
    const { message, image } = req.body || {};

    if(!image){
      return res.json({ reply:"Fotoğraf gelmedi." });
    }

    if(!process.env.OPENROUTER_API_KEY){
      return res.json({ reply:"AI API key ayarlanmamış." });
    }

    statsArtir(req, "imageAnalysis");

    const reply = await openrouterChat({
      model: process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o-mini",
      max_tokens: 1400,
      messages:[
        {
          role:"system",
          content:"Sen NeuraAI görsel analiz asistanısın. Görseli net, güvenli ve kısa analiz et. Emin olmadığın şeyi kesin söyleme."
        },
        {
          role:"user",
          content:[
            { type:"text", text: temizMesaj(message || "Bu görseli analiz et.", 1000) },
            { type:"image_url", image_url:{ url:image } }
          ]
        }
      ]
    });

    res.json({ ok:true, reply });
  }catch(err){
    console.error("chat-image hata:", err);
    res.json({ ok:false, reply:"Görsel analiz hatası oluştu." });
  }
});

/* =========================
   Görsel Üretim
========================= */

function boyutTemizle(size){
  const allowed = ["1024x1024", "768x768", "512x512"];
  return allowed.includes(size) ? size : "1024x1024";
}

function promptuIngilizceyeYaklastir(prompt){
  let p = temizMesaj(prompt, 1000).trim();

  const sozluk = [
    ["kedi", "cat"], ["köpek", "dog"], ["kopek", "dog"], ["tilki", "fox"],
    ["araba", "car"], ["kuş", "bird"], ["kus", "bird"], ["ejderha", "dragon"],
    ["orman", "forest"], ["uzay", "space"], ["kırmızı", "red"], ["kirmizi", "red"],
    ["mavi", "blue"], ["yeşil", "green"], ["yesil", "green"],
    ["siyah", "black"], ["beyaz", "white"], ["gerçekçi", "realistic"], ["gercekci", "realistic"]
  ];

  for(const [tr,en] of sozluk){
    p = p.replace(new RegExp("\\b" + tr + "\\b", "gi"), en);
  }

  return p;
}

function stilPromptu(style){
  if(style === "anime") return "anime style, clean detailed illustration";
  if(style === "3d") return "high quality 3D render, smooth lighting";
  if(style === "logo") return "simple modern logo design, centered, clean background";
  return "realistic photo, high detail, natural lighting";
}

async function pollinationsGorselAl(prompt, size){
  if(!process.env.POLLINATIONS_API_KEY){
    throw new Error("POLLINATIONS_API_KEY yok.");
  }

  const r = await fetch("https://gen.pollinations.ai/v1/images/generations", {
    method:"POST",
    headers:{
      "Authorization": `Bearer ${process.env.POLLINATIONS_API_KEY}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      prompt,
      model:"flux",
      n:1,
      size: boyutTemizle(size),
      quality:"medium",
      response_format:"b64_json",
      safe:false
    })
  });

  const data = await r.json().catch(() => ({}));

  if(!r.ok){
    throw new Error("Pollinations hata: " + r.status);
  }

  const b64 = data.data?.[0]?.b64_json;
  if(!b64) throw new Error("Base64 görsel yok.");

  return "data:image/png;base64," + b64;
}

app.post("/generate-image", async (req,res) => {
  try{
    const prompt = temizMesaj(req.body?.prompt || req.body?.message || "", 1000);
    const style = temizMesaj(req.body?.style || "realistic", 50);
    const size = boyutTemizle(req.body?.size || "1024x1024");

    if(!prompt.trim()){
      return res.json({ ok:false, reply:"Görsel için prompt yaz." });
    }

    statsArtir(req, "imageCreate");

    const finalPrompt = promptuIngilizceyeYaklastir(prompt) + ", " + stilPromptu(style);
    const image = await pollinationsGorselAl(finalPrompt, size);

    res.json({
      ok:true,
      image,
      url:image,
      reply:"Görsel oluşturuldu."
    });
  }catch(err){
    console.error("generate-image hata:", err);
    res.json({
      ok:false,
      reply:"Görsel üretim hatası: " + err.message
    });
  }
});

app.post("/api/generate-image", async (req,res) => {
  req.url = "/generate-image";
  app._router.handle(req,res);
});



/* =========================
   NeuraAI Voice V1
   - HTML tarafındaki sesli sohbet ekranı için güvenli endpoint
   - ElevenLabs yok: V1 sadece metin cevabı döndürür
   - Tarayıcı cevabı speechSynthesis ile seslendirir
========================= */

app.post("/api/voice/chat", async (req,res) => {
  try{
    const msg = temizMesaj(req.body?.message || req.body?.text || "", 4000).trim();
    const userKey = kullaniciKey(req);

    if(!msg){
      return res.json({
        ok:false,
        status:"listening",
        reply:"Ses algılanamadı. Tekrar konuşmayı dene."
      });
    }

    if(!process.env.OPENROUTER_API_KEY){
      return res.json({
        ok:false,
        status:"error",
        reply:"AI API key ayarlanmamış."
      });
    }

    statsArtir(req, "chat");
    hafizaKaydet(userKey, msg);

    const aiModelTipi = req.body?.aiModelTipi || "akilli";
    const konusmaModu = ["samimi","resmi","profesor"].includes(req.body?.konusmaModu)
      ? req.body.konusmaModu
      : "samimi";

    const profil = modelProfili(aiModelTipi);
    const gelenMesajlar = Array.isArray(req.body?.messages) ? req.body.messages.slice(-30) : [];

    const messages = [
      {
        role:"system",
        content:
          sistemPrompt({
            modeName:konusmaModu,
            aiModelTipi,
            customAi:req.body?.customAi,
            userKey
          }) +
          " Kullanıcı sesli sohbet modunda konuşuyor. Cevapların doğal, konuşma diline uygun, kısa ve akıcı olsun. " +
          "Çok uzun paragraflar yazma; sesli okununca anlaşılır şekilde cevap ver."
      },
      ...gelenMesajlar,
      { role:"user", content:msg }
    ];

    const ilkCevap = await openrouterChat({
      model: profil.model,
      max_tokens: 900,
      messages
    });

    const finalCevap = await kendiniKontrolEt({
      soru: msg,
      cevap: ilkCevap,
      model: profil.model,
      mode:"kisa"
    });

    res.json({
      ok:true,
      status:"speaking",
      reply: temizMesaj(finalCevap, 5000),
      voiceEngine:"browser",
      elevenLabs:false,
      summary:{
        lastUserMessage: msg,
        lastAiReply: temizMesaj(finalCevap, 700),
        time: Date.now()
      }
    });
  }catch(err){
    console.error("voice chat hata:", err);
    res.json({
      ok:false,
      status:"error",
      reply:"Sesli sohbet tarafında hata oluştu. Biraz sonra tekrar dene."
    });
  }
});

app.post("/voice-chat", (req,res) => {
  req.url = "/api/voice/chat";
  app._router.handle(req,res);
});
app.post("/api/voice", async (req, res) => {
  try{
    const text = temizMesaj(req.body?.text || req.body?.message || "", 2500).trim();

    if(!text){
      return res.json({
        ok:false,
        reply:"Seslendirilecek metin yok."
      });
    }

    if(!process.env.ELEVENLABS_API_KEY){
      return res.json({
        ok:false,
        reply:"ELEVENLABS_API_KEY ayarlanmamış."
      });
    }

    if(!ELEVENLABS_VOICE_ID || ELEVENLABS_VOICE_ID === "BURAYA_SENIN_VOICE_ID"){
      return res.json({
        ok:false,
        reply:"ELEVENLABS_VOICE_ID ayarlanmamış."
      });
    }

    const elevenRes = await fetch(
      `${ELEVENLABS_API_URL}/${ELEVENLABS_VOICE_ID}`,
      {
        method:"POST",
        headers:{
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type":"application/json",
          "Accept":"audio/mpeg"
        },
        body:JSON.stringify({
          text,
          model_id:"eleven_multilingual_v2",
          voice_settings:{
            stability:0.45,
            similarity_boost:0.80,
            style:0.25,
            use_speaker_boost:true
          }
        })
      }
    );

    if(!elevenRes.ok){
      const hataText = await elevenRes.text().catch(() => "");
      console.error("ElevenLabs hata:", elevenRes.status, hataText);

      return res.json({
        ok:false,
        reply:"ElevenLabs ses oluşturamadı.",
        status:elevenRes.status
      });
    }

    const audioBuffer = await elevenRes.arrayBuffer();

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(audioBuffer));
  }catch(err){
    console.error("/api/voice hata:", err);

    res.json({
      ok:false,
      reply:"Ses oluşturma hatası."
    });
  }
});
/* =========================
   Profil Stats
========================= */

app.get("/api/profile-stats", (req,res) => {
  const key = temizKey(req.query.userKey || req.query.nick || ipAl(req));
  const stats = profilHazirla(key);

  res.json({
    ok:true,
    chat: Number(stats.chat || 0),
    codex: Number(stats.codex || 0),
    imageAnalysis: Number(stats.imageAnalysis || 0),
    imageCreate: Number(stats.imageCreate || 0)
  });
});

app.post("/api/profile-stats", (req,res) => {
  const key = kullaniciKey(req);
  const stats = profilHazirla(key);

  res.json({
    ok:true,
    chat: Number(stats.chat || 0),
    codex: Number(stats.codex || 0),
    imageAnalysis: Number(stats.imageAnalysis || 0),
    imageCreate: Number(stats.imageCreate || 0)
  });
});

/* NeuraAI ad kilidi */
app.post("/api/check-nick", (req,res) => {
  const nick = String(req.body?.nick || "").trim();
  const founderKey = req.body?.founderKey || req.headers["x-founder-key"];

  if((nick.toLowerCase() === "neurai" || nick.toLowerCase() === "neuraai") && founderKey !== FOUNDER_KEY){
    return res.json({
      ok:false,
      allowed:false,
      reply:"NeuraAI adı kurucuya özeldir."
    });
  }

  res.json({ ok:true, allowed:true });
});

/* =========================
   Static + Start
========================= */

app.use(express.static(__dirname));

app.get("/", (req,res) => {
  const index = path.join(__dirname, "index.html");
  if(fs.existsSync(index)){
    return res.sendFile(index);
  }
  res.send("NeuraAI server çalışıyor.");
});

app.listen(PORT, () => {
  console.log("NeuraAI server çalışıyor. PORT:", PORT);
});
