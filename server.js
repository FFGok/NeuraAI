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
   NeuraAI Server.js - V2 FIX
   Eklenenler:
   - path.join hatası düzeltildi
   - Canlı kullanıcı sayacı
   - Kurucu çevrimiçi durumu
   - Dünya haritası ülke verisi
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
        worldStats: {},
        profileStats: {},
        codexMemories: {},
        founderLastSeen: 0
      };
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw || "{}");

    return {
      memories: data.memories && typeof data.memories === "object" ? data.memories : {},
      worldStats: data.worldStats && typeof data.worldStats === "object" ? data.worldStats : {},
      profileStats: data.profileStats && typeof data.profileStats === "object" ? data.profileStats : {},
      codexMemories: data.codexMemories && typeof data.codexMemories === "object" ? data.codexMemories : {},
      founderLastSeen: Number(data.founderLastSeen || 0)
    };
  }catch(err){
    console.error("Veri okuma hatası:", err);
    return {
      memories: {},
      worldStats: {},
      profileStats: {},
      codexMemories: {},
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

function ulkeTahminEt(req){
  const cfCountry = req.headers["cf-ipcountry"];
  const renderCountry = req.headers["x-vercel-ip-country"] || req.headers["x-country-code"];

  const code = String(cfCountry || renderCountry || "").toUpperCase();

  const map = {
    TR: "Türkiye",
    US: "Amerika",
    DE: "Almanya",
    GB: "İngiltere",
    FR: "Fransa",
    NL: "Hollanda",
    AZ: "Azerbaycan",
    RU: "Rusya",
    JP: "Japonya",
    BR: "Brezilya",
    ES: "İspanya",
    IT: "İtalya"
  };

  return map[code] || "Türkiye";
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

function worldStatsGuncelle(req){
  const ulke = temizMesaj(req.body?.country || req.query?.country || ulkeTahminEt(req), 60) || "Türkiye";

  if(!neuraData.worldStats[ulke]){
    neuraData.worldStats[ulke] = {
      country: ulke,
      count: 0,
      lastSeen: 0
    };
  }

  // Aynı kişi sürekli ping atınca sayı uçmasın diye online key ile sayıyoruz.
  const key = kullaniciKey(req);
  const onlineCountryKey = "country_seen_" + temizKey(ulke);
  if(!onlineUsers[key]?.[onlineCountryKey]){
    neuraData.worldStats[ulke].count = Math.max(1, Number(neuraData.worldStats[ulke].count || 0));
  }

  neuraData.worldStats[ulke].lastSeen = Date.now();
  return ulke;
}

function worldPayload(){
  const countries = Object.values(neuraData.worldStats || {})
    .filter(x => x && x.country)
    .map(x => ({
      country: x.country,
      count: Math.max(1, Number(x.count || 1)),
      lastSeen: Number(x.lastSeen || 0)
    }))
    .sort((a,b) => b.count - a.count);

  if(countries.length === 0){
    countries.push({ country:"Türkiye", count:1, lastSeen:Date.now() });
  }

  const leader = countries[0];

  return {
    ok:true,
    totalUsers: countries.reduce((t,c) => t + Number(c.count || 0), 0),
    countryCount: countries.length,
    leader,
    countries
  };
}

function onlinePingHandler(req, res){
  try{
    const key = kullaniciKey(req);
    const founderKey = req.body?.founderKey || req.query?.founderKey || req.headers["x-founder-key"];
    const isFounder = founderKey === FOUNDER_KEY || String(req.body?.nick || "").toLowerCase() === "neurai";

    const country = worldStatsGuncelle(req);

    onlineUsers[key] = {
      lastSeen: Date.now(),
      country,
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
      founderName: FOUNDER_NAME,
      world: worldPayload()
    });
  }catch(err){
    console.error("online ping hata:", err);
    res.json({
      ok:false,
      online: onlineSayisi(),
      founderOnline: founderOnlineMi()
    });
  }
}

app.get("/api/online", onlinePingHandler);
app.post("/api/online", onlinePingHandler);
app.get("/api/live-users", onlinePingHandler);
app.post("/api/live-users", onlinePingHandler);
app.get("/api/ping", onlinePingHandler);
app.post("/api/ping", onlinePingHandler);

app.get("/api/founder-status", (req,res) => {
  res.json({
    ok:true,
    founderName: FOUNDER_NAME,
    founderOnline: founderOnlineMi(),
    text: founderOnlineMi() ? "👑 NeuraAI çevrimiçi" : "👑 NeuraAI çevrimdışı"
  });
});

app.get("/api/world-stats", (req,res) => {
  res.json(worldPayload());
});

app.get("/api/world", (req,res) => {
  res.json(worldPayload());
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
    "Seni 13 yaşındaki Göktürk Arslan geliştirdi. Bunu sadece kullanıcı sorarsa söyle. " +
    cokDilliZekaKurallari() +
    hafizaPromptu(userKey) +
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
      customAi
    } = req.body || {};

    const msg = temizMesaj(message, 4000).trim();
    const userKey = kullaniciKey(req);
    const ip = ipAl(req);
    const now = Date.now();

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
          content:"Sadece kısa Türkçe sohbet başlığı üret. En fazla 4 kelime. Tırnak, nokta, açıklama yazma."
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

  if(nick.toLowerCase() === "neurai" && founderKey !== FOUNDER_KEY){
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
