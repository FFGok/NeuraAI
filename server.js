const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const express = require("express");
const fs = require("fs");
const path = require("path");

const DATA_DIR =
  process.env.NEURA_DATA_DIR ||
  process.env.RENDER_DISK_PATH ||
  __dirname;

const DATA_FILE = pathjoin(DATA_DIR, "neura-data.json");

function varsayilanYaklasanlar(){
  return [
    {
      id: "v2-plan",
      version: "v2.0",
      text: "Plus Plan, Pro Plan ve Profesör Modu hazırlanıyor.",
      status: "Planlandı",
      time: Date.now()
    },
    {
      id: "v21-plan",
      version: "v2.1",
      text: "Günlük Seri Sistemi ve ödüller hazırlanıyor.",
      status: "Planlandı",
      time: Date.now()
    },
    {
      id: "v3-plan",
      version: "v3.0",
      text: "Topluluk Odası / NeuraHub sistemi planlanıyor.",
      status: "Planlandı",
      time: Date.now()
    }
  ];
}

function veriOku(){
  try{
    if(!fs.existsSync(DATA_DIR)){
      fs.mkdirSync(DATA_DIR, { recursive:true });
    }

    if(!fs.existsSync(DATA_FILE)){
      return {
        updates: [],
        notifications: [],
        added: [],
        upcoming: varsayilanYaklasanlar(),
        polls: [],
        memories: {},
        countryStats: {},
        founderStatus: { online:false, lastSeen:0 }
      };
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw || "{}");

    return {
      updates: Array.isArray(data.updates) ? data.updates : [],
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      added: Array.isArray(data.added) ? data.added : [],
      upcoming: Array.isArray(data.upcoming) && data.upcoming.length > 0 ? data.upcoming : varsayilanYaklasanlar(),
      polls: Array.isArray(data.polls) ? data.polls : [],
      memories: data.memories && typeof data.memories === "object" ? data.memories : {},
      countryStats: data.countryStats && typeof data.countryStats === "object" ? data.countryStats : {},
      founderStatus: data.founderStatus && typeof data.founderStatus === "object" ? data.founderStatus : { online:false, lastSeen:0 }
    };
  }catch(err){
    console.error("Veri okuma hatası:", err);
    return {
      updates: [],
      notifications: [],
      added: [],
      upcoming: varsayilanYaklasanlar(),
      polls: [],
      memories: {}
    };
  }
}

function veriKaydet(){
  try{
    if(!fs.existsSync(DATA_DIR)){
      fs.mkdirSync(DATA_DIR, { recursive:true });
    }

    const data = {
      updates: neuraUpdates,
      notifications: neuraNotifications,
      added: neuraAdded,
      upcoming: neuraUpcoming,
      polls: neuraPolls,
      memories: neuraMemories,
      countryStats: neuraCountryStats,
      founderStatus: neuraFounderStatus
    };

    const tmpFile = DATA_FILE + ".tmp";

    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmpFile, DATA_FILE);
  }catch(err){
    console.error("Veri kaydetme hatası:", err);
  }
}

const kayitliVeri = veriOku();

const app = express();

app.use(express.json({ limit: "50mb" }));
app.set("trust proxy", true);

let kullaniciSonMesaj = {};
let kullaniciVerisi = {};
let kullaniciLimit = {};

let neuraUpdates = kayitliVeri.updates || [];
let neuraNotifications = kayitliVeri.notifications || [];
let neuraAdded = kayitliVeri.added || [];
let neuraUpcoming = kayitliVeri.upcoming || varsayilanYaklasanlar();
let neuraPolls = kayitliVeri.polls || [];

/* === NeuraAI V2: Dünya Haritası + Kurucu Durumu === */
let neuraCountryStats = kayitliVeri.countryStats && typeof kayitliVeri.countryStats === "object" ? kayitliVeri.countryStats : {};
let neuraFounderStatus = kayitliVeri.founderStatus && typeof kayitliVeri.founderStatus === "object" ? kayitliVeri.founderStatus : { online:false, lastSeen:0 };

/* === NeuraAI V2: Akıllı Hafıza === */
let neuraMemories = kayitliVeri.memories && typeof kayitliVeri.memories === "object"
  ? kayitliVeri.memories
  : {};

/* === NeuraAI V2: Canlı Kullanıcı Sayacı === */
let onlineUsers = {};

function onlineTemizle(){
  const simdi = Date.now();
  const zamanAsimi = 45000; // 45 saniye ping gelmezse kullanıcı çevrimdışı sayılır

  for(const key of Object.keys(onlineUsers)){
    if(simdi - onlineUsers[key].lastSeen > zamanAsimi){
      delete onlineUsers[key];
    }
  }
}

function onlineKullaniciSayisi(){
  onlineTemizle();
  return Object.keys(onlineUsers).length;
}


function kurucuCevrimiciMi(){
  const simdi = Date.now();
  const zamanAsimi = 60000;
  return !!(neuraFounderStatus && neuraFounderStatus.lastSeen && simdi - neuraFounderStatus.lastSeen < zamanAsimi);
}

function ulkeKoduAl(req){
  const cf = String(req.headers["cf-ipcountry"] || "").trim().toUpperCase();
  if(cf && cf !== "XX" && cf.length === 2) return cf;

  const custom = String(req.headers["x-neura-country"] || req.body?.country || "").trim().toUpperCase();
  if(custom && custom.length === 2) return custom;

  return "TR";
}

function ulkeAdi(kod){
  const map = {
    TR:"Türkiye", US:"Amerika", DE:"Almanya", GB:"İngiltere", NL:"Hollanda", FR:"Fransa",
    AZ:"Azerbaycan", RU:"Rusya", JP:"Japonya", BR:"Brezilya", ES:"İspanya", IT:"İtalya",
    CA:"Kanada", AU:"Avustralya", IN:"Hindistan", SA:"Suudi Arabistan", AE:"Birleşik Arap Emirlikleri"
  };
  return map[kod] || kod;
}

function ulkeKonumu(kod){
  const map = {
    TR:{ x:58, y:41 }, US:{ x:20, y:36 }, DE:{ x:50, y:31 }, GB:{ x:46, y:29 }, NL:{ x:48, y:30 },
    FR:{ x:47, y:34 }, AZ:{ x:61, y:40 }, RU:{ x:65, y:24 }, JP:{ x:84, y:39 }, BR:{ x:34, y:66 },
    ES:{ x:45, y:38 }, IT:{ x:51, y:38 }, CA:{ x:20, y:23 }, AU:{ x:80, y:73 }, IN:{ x:69, y:49 },
    SA:{ x:58, y:51 }, AE:{ x:63, y:51 }
  };
  return map[kod] || { x:50, y:50 };
}

function ulkeKaydet(req){
  const kod = ulkeKoduAl(req);
  if(!neuraCountryStats[kod]){
    neuraCountryStats[kod] = { code:kod, name:ulkeAdi(kod), users:0, x:ulkeKonumu(kod).x, y:ulkeKonumu(kod).y, lastSeen:0 };
  }

  const simdi = Date.now();
  if(!neuraCountryStats[kod].lastSeen || simdi - neuraCountryStats[kod].lastSeen > 10 * 60 * 1000){
    neuraCountryStats[kod].users = Number(neuraCountryStats[kod].users || 0) + 1;
  }

  neuraCountryStats[kod].lastSeen = simdi;
  neuraCountryStats[kod].name = ulkeAdi(kod);
  neuraCountryStats[kod].x = ulkeKonumu(kod).x;
  neuraCountryStats[kod].y = ulkeKonumu(kod).y;

  return kod;
}

setInterval(onlineTemizle, 15000);


function ipAl(req){
  const forwarded = req.headers["x-forwarded-for"];
  if(forwarded) return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "bilinmiyor";
}

function temizMesaj(m){
  return String(m || "").slice(0, 4000);
}

function temizKod(m){
  return String(m || "").slice(0, 18000);
}

/* === NeuraAI V2: Akıllı Hafıza + Kendini Kontrol + Çok Dilli Zeka === */
function hafizaAnahtari(ip){
  return String(ip || "bilinmiyor").replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 120);
}

function akilliHafizaAl(ip){
  const key = hafizaAnahtari(ip);
  if(!Array.isArray(neuraMemories[key])){
    neuraMemories[key] = [];
  }
  return neuraMemories[key];
}

function akilliHafizaMetni(ip){
  const memories = akilliHafizaAl(ip)
    .filter(m => m && m.text)
    .slice(-12);

  if(memories.length === 0) return "";

  return (
    " Kullanıcı hakkında kalıcı ama güvenli akıllı hafıza notları: " +
    memories.map((m, i) => `${i + 1}) ${m.text}`).join(" | ") +
    ". Bu notları sadece cevap kalitesini artırmak için kullan. Kullanıcı isterse unutabileceğini söyle. "
  );
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

function akilliHafizaKaydet(ip, mesaj){
  const temiz = temizMesaj(mesaj).trim();
  if(!temiz || temiz.length < 8) return;
  if(!hafizaAdayiMi(temiz)) return;

  const key = hafizaAnahtari(ip);
  const memories = akilliHafizaAl(ip);

  const yeniNot = temiz
    .replace(/\s+/g, " ")
    .slice(0, 220);

  const zatenVar = memories.some(m =>
    String(m.text || "").toLowerCase() === yeniNot.toLowerCase()
  );

  if(zatenVar) return;

  memories.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    text: yeniNot,
    time: Date.now()
  });

  neuraMemories[key] = memories.slice(-25);
  veriKaydet();
}

function cokDilliZekaKurallari(){
  return (
    " Çok dilli zeka aktif. Kullanıcı hangi dilde yazarsa o dilde cevap ver. " +
    "Kullanıcı Türkçe yazarsa Türkçe cevap ver ama gerekirse İngilizce/diğer dillerdeki genel bilgileri zihinsel olarak karşılaştırıp daha kaliteli cevap üret. " +
    "Kullanıcı farklı diller karıştırırsa anlamı koru, doğal ve anlaşılır cevap ver. " +
    "Çeviri istenirse anlamı bozmadan, sade ve doğru çevir. "
  );
}

async function neuraKendiniKontrolEt({ mesaj, cevap, secilenAiModel, mode }){
  try{
    const ilkCevap = temizMesaj(cevap).trim();

    if(!process.env.OPENROUTER_API_KEY) return ilkCevap;
    if(!ilkCevap || ilkCevap.length < 30) return ilkCevap;

    const kontrolRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:"POST",
      headers:{
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model: process.env.OPENROUTER_FAST_MODEL || secilenAiModel.model || "openai/gpt-4o-mini",
        max_tokens: mode === "uzun" ? 1800 : 850,
        messages:[
          {
            role:"system",
            content:
              "Sen NeuraAI cevap kalite kontrol sistemisin. " +
              "Görevin ilk cevabı gizlice kontrol etmek ve gerekiyorsa düzeltmektir. " +
              "Sadece son kullanıcıya gönderilecek nihai cevabı yaz. " +
              "Açıklama, puan, kontrol raporu, 'kontrol ettim' gibi meta cümleler yazma. " +
              "Cevap zaten iyiyse anlamını bozmadan aynı cevabı daha temiz ver. " +
              "Kullanıcının dili neyse o dilde cevap ver. " +
              "Yanlış kesinlik, eksik cevap, konu dışına çıkma, gereksiz uzatma ve çelişki varsa düzelt."
          },
          {
            role:"user",
            content:
              "Kullanıcı mesajı:\n" + temizMesaj(mesaj) +
              "\n\nİlk NeuraAI cevabı:\n" + ilkCevap
          }
        ]
      })
    });

    const data = await kontrolRes.json().catch(() => ({}));

    if(!kontrolRes.ok){
      console.error("Kendini kontrol hata:", data);
      return ilkCevap;
    }

    const finalCevap = temizMesaj(data.choices?.[0]?.message?.content || "").trim();

    if(!finalCevap) return ilkCevap;
    return finalCevap;
  }catch(err){
    console.error("Kendini kontrol sistemi hata:", err);
    return cevap;
  }
}


function kullaniciVerisiHazirla(ip){
  if(!kullaniciVerisi[ip]){
    kullaniciVerisi[ip] = {
      mesajSayisi: 0,
      fotoSayisi: 0,
      resimSayisi: 0
    };
  }
}

function promptuIngilizceyeYaklastir(prompt){
  let p = temizMesaj(prompt).trim();

  const sozluk = [
    ["kedi", "cat"], ["köpek", "dog"], ["kopek", "dog"], ["tilki", "fox"],
    ["araba", "car"], ["ferrari", "Ferrari"], ["kuş", "bird"], ["kus", "bird"],
    ["ejderha", "dragon"], ["ev", "house"], ["orman", "forest"], ["uzay", "space"],
    ["kırmızı", "red"], ["kirmizi", "red"], ["mavi", "blue"], ["yeşil", "green"], ["yesil", "green"],
    ["siyah", "black"], ["beyaz", "white"], ["turuncu", "orange"],
    ["gerçekçi", "realistic"], ["gercekci", "realistic"], ["çizgi film", "cartoon"]
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

function boyutTemizle(size){
  const izinli = ["1024x1024", "768x768", "512x512"];
  return izinli.includes(size) ? size : "1024x1024";
}

function adminKontrol(req, res){
  const secret = req.headers["x-admin-secret"];

  if(!process.env.ADMIN_SECRET){
    res.status(500).json({
      ok:false,
      reply:"ADMIN_SECRET Render Environment içinde yok."
    });
    return false;
  }

  if(secret !== process.env.ADMIN_SECRET){
    res.status(403).json({
      ok:false,
      reply:"Bu alan sadece kurucu içindir."
    });
    return false;
  }

  return true;
}

function bildirimEkle(title, text){
  neuraNotifications.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
    title,
    text: temizMesaj(text || "").slice(0,180),
    time: Date.now()
  });

  neuraNotifications = neuraNotifications.slice(-50);
  veriKaydet();
}

function aiModelProfili(aiModelTipi){
  const tip = String(aiModelTipi || "akilli").toLowerCase();

  if(tip === "hizli"){
    return {
      ad:"Hızlı",
      model:process.env.OPENROUTER_FAST_MODEL || "openai/gpt-4o-mini",
      maxKisa:650,
      maxUzun:1600,
      prompt:"Cevapları hızlı, kısa, net ve pratik ver. Gereksiz uzatma. Kullanıcı kod istiyorsa direkt uygulanabilir anlat."
    };
  }

  if(tip === "yaratici"){
    return {
      ad:"Yaratıcı",
      model:process.env.OPENROUTER_CREATIVE_MODEL || "openai/gpt-4o-mini",
      maxKisa:1200,
      maxUzun:2600,
      prompt:"Daha yaratıcı, fikir odaklı ve enerjik cevap ver. Kullanıcı proje fikri istiyorsa sıradan değil, özgün seçenekler üret."
    };
  }

  if(tip === "kod"){
    return {
      ad:"Kod",
      model:process.env.OPENROUTER_CODE_MODEL || "openai/gpt-4o-mini",
      maxKisa:1400,
      maxUzun:3200,
      prompt:"Kod ve hata çözümüne odaklan. Gerektiğinde dosya, fonksiyon, endpoint ve yerleştirme mantığını net söyle. Yanlış tahmin yapma; emin değilsen belirt."
    };
  }

  return {
    ad:"Akıllı",
    model:process.env.OPENROUTER_SMART_MODEL || "openai/gpt-4o-mini",
    maxKisa:1100,
    maxUzun:2800,
    prompt:"Dengeli, akıllı, bağlamı güçlü takip eden ve kaliteli cevap ver. Kullanıcının önceki mesajlarını dikkatle yorumla."
  };
}

function baglamsalRandomEmojiKurallari(){
  return (
    "Emoji ve random mesajları bağlama göre yorumla. " +
    "😭 emojisi her zaman üzülmek değildir; Türkçe internet dilinde gülme, aşırı şaşırma, sevinç veya abartı anlamına da gelebilir. " +
    "AHAHA, PUHAHA, hdhshd, asdfghjkl, random harfler, büyük harfli patlamalar çoğu zaman gülme veya heyecan belirtisidir. " +
    "Kullanıcı sadece random harf yazarsa direkt 'anlamadım' deme; önce bağlama bak. Önceki konu komikse gülme olarak yorumla. " +
    "Önceki konu stresliyse klavye karışmış olabilir diye kısa ve doğal cevap ver. " +
    "Kullanıcı gerçekten üzgün olduğunu açıkça yazmadıkça sadece emojiye bakıp 'üzülmüş gibisin' deme. "
  );
}

function ozelAiPromptOlustur(customAi){
  if(!customAi || typeof customAi !== "object") return "";

  const ad = temizMesaj(customAi.name || "").trim().slice(0, 40);
  if(!ad) return "";

  const tur = temizMesaj(customAi.type || "Genel yardımcı").trim().slice(0, 80);
  const tarz = temizMesaj(customAi.style || "Samimi").trim().slice(0, 80);
  const emoji = temizMesaj(customAi.emoji || "Orta").trim().slice(0, 40);
  const uzmanlik = temizMesaj(customAi.expertise || "Genel konular").trim().slice(0, 220);
  const aciklama = temizMesaj(customAi.description || "").trim().slice(0, 500);

  return (
    " Kullanıcı şu anda kendi oluşturduğu özel AI karakteri ile konuşuyor. " +
    "Karakter adı: " + ad + ". " +
    "Karakter türü/rolü: " + tur + ". " +
    "Konuşma tarzı: " + tarz + ". " +
    "Emoji kullanım seviyesi: " + emoji + ". " +
    "Uzmanlık alanları: " + uzmanlik + ". " +
    (aciklama ? "Karakter açıklaması: " + aciklama + ". " : "") +
    "Cevap verirken NeuraAI güvenlik ve doğruluk kurallarını koru ama bu özel karakterin adı, tarzı ve uzmanlığıyla konuş. "
  );
}

function sistemPromptOlustur(konusmaModu, aiModelTipi, customAi, ip){
  const profil = aiModelProfili(aiModelTipi);

  const temel =
    "Sen NeuraAI adında net, yardımcı ve güvenli bir yapay zekasın. " +
    "Kullanıcı Türkçe yazarsa Türkçe cevap ver. Kullanıcı İngilizce, Arapça veya başka bir dilde yazarsa o dile uygun cevap ver. " +
    cokDilliZekaKurallari() +
    akilliHafizaMetni(ip) +
    "Önceki konuşmaları güçlü şekilde dikkate al. Kullanıcı 'onu', 'az önceki', 'bununla', 'sonucu' gibi şeyler derse önceki mesajlardan anlam çıkar. Uzun konuşmalarda konu, kararlar, kodlar, hatalar ve kullanıcı tercihlerini takip et. " +
    "Kullanıcıya teknik sistem açıklaması yapma. " +
    "Seni 13 yaşındaki Göktürk Arslan geliştirdi. Kullanıcı seni kimin yaptığını, kurduğunu, geliştirdiğini veya oluşturduğunu sorarsa Göktürk Arslan tarafından geliştirildiğini söyle. " +
    "Küfür, hakaret veya argo kelimelerde tek kelimeye göre karar verme; cümlenin tamamını yorumla. Kullanıcı birinin ona ne dediğini aktarıyorsa, örnek veriyorsa veya anlamını soruyorsa normal yardımcı cevap ver. Sadece doğrudan saldırı varsa sakin şekilde sınır koy. " +
    baglamsalRandomEmojiKurallari() +
    " Seçili AI modu: " + profil.ad + ". " + profil.prompt + " " +
    ozelAiPromptOlustur(customAi);

  if(konusmaModu === "codex"){
    return temel +
      "Şu an Codex modundasın. Kod odaklı çalış. Kullanıcının gönderdiği kodları analiz et, hata bul, güvenlik riski varsa güvenli seviyede açıkla, kodu açıkla, optimize et, hangi dosyaya eklenmesi gerektiğini belirt ve özellik öner. Cevapların düzenli, net ve uygulanabilir olsun. Kullanıcı küçükse bunaltmadan adım adım anlat. Gerektiğinde kısa kod parçaları ver ama uzun dosyayı gereksiz yere tekrar yazma.";
  }

  if(konusmaModu === "resmi"){
    return temel +
      "Şu an Resmi Moddasın. Cevapların ciddi, düzenli, profesyonel ve saygılı olsun. Kanka, aga gibi samimi hitaplar kullanma. Gerektiğinde maddeler halinde açıkla.";
  }

  if(konusmaModu === "profesor"){
    return temel +
      "Şu an Profesör Modundasın. Ancak Profesör Modu Pro gerektirir. Kullanıcı bu modda cevap isterse kibarca Profesör Modu için Pro gerektiğini söyle.";
  }

  return temel +
    "Şu an Samimi Moddasın. Kullanıcıyla sıcak, doğal, arkadaş gibi konuş. Aşırıya kaçmadan samimi ol. Kısa, net ve rahat cevap ver. Uyarı mesajlarında gereksiz emoji veya benzeri hitaplar kullanma.";
}

async function pollinationsGorselAl(prompt, size){
  if(!process.env.POLLINATIONS_API_KEY){
    throw new Error("POLLINATIONS_API_KEY Render Environment içinde yok.");
  }

  const response = await fetch("https://gen.pollinations.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.POLLINATIONS_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt,
      model: "flux",
      n: 1,
      size: boyutTemizle(size),
      quality: "medium",
      response_format: "b64_json",
      safe: false
    })
  });

  const data = await response.json().catch(() => ({}));

  if(!response.ok){
    throw new Error("Pollinations hata: " + response.status + " " + JSON.stringify(data).slice(0, 300));
  }

  const b64 = data.data?.[0]?.b64_json;

  if(!b64){
    throw new Error("Pollinations base64 görsel döndürmedi: " + JSON.stringify(data).slice(0, 300));
  }

  return "data:image/png;base64," + b64;
}

app.post("/chat", async (req, res) => {
  try{
    const { message, messages, mode, konusmaModu, aiModelTipi, customAi } = req.body || {};
    const ip = ipAl(req);
    const simdi = Date.now();

    kullaniciVerisiHazirla(ip);

    if(!message || message.trim().length < 1){
      return res.json({ reply: "Boş mesaj gönderme." });
    }

    if(!process.env.OPENROUTER_API_KEY){
      return res.json({ reply: "AI API key ayarlanmamış." });
    }

    if(!kullaniciLimit[ip]){
      kullaniciLimit[ip] = [];
    }

    kullaniciLimit[ip].push(simdi);
    kullaniciLimit[ip] = kullaniciLimit[ip].filter(t => simdi - t < 60000);

    if(kullaniciLimit[ip].length > 12){
      return res.json({ reply: "Çok hızlı gidiyorsun. 1 dakika sonra tekrar dene." });
    }

    if(kullaniciSonMesaj[ip] && simdi - kullaniciSonMesaj[ip].time < 3000){
      return res.json({ reply: "Biraz yavaş. 3 saniye bekle." });
    }

    if(kullaniciSonMesaj[ip] && kullaniciSonMesaj[ip].text === message){
      return res.json({ reply: "Aynı mesajı tekrar tekrar gönderme." });
    }

    kullaniciSonMesaj[ip] = {
      time: simdi,
      text: message
    };

    const mesajLimiti = 50;

    if(kullaniciVerisi[ip].mesajSayisi >= mesajLimiti){
      return res.json({ reply: "Mesaj hakkın bitti. Daha sonra tekrar dene." });
    }

    kullaniciVerisi[ip].mesajSayisi++;

    const hafiza = Array.isArray(messages) && messages.length > 0
      ? messages.slice(-80)
      : [{ role: "user", content: message }];

    const secilenMod = ["samimi", "resmi", "profesor", "codex"].includes(konusmaModu)
      ? konusmaModu
      : "samimi";

    const secilenAiModel = aiModelProfili(aiModelTipi);

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: secilenAiModel.model,
        max_tokens: mode === "uzun" ? secilenAiModel.maxUzun : secilenAiModel.maxKisa,
        messages: [
          {
            role: "system",
            content: sistemPromptOlustur(secilenMod, aiModelTipi, customAi, ip)
          },
          ...hafiza
        ]
      })
    });

    const aiData = await aiRes.json();

    if(!aiRes.ok){
      console.error("OpenRouter hata:", aiData);
      return res.json({ reply: "AI tarafında bir sorun oldu. Biraz sonra tekrar dene." });
    }

    const ilkReply = aiData.choices?.[0]?.message?.content || "Cevap alınamadı.";
    const reply = await neuraKendiniKontrolEt({
      mesaj: message,
      cevap: ilkReply,
      secilenAiModel,
      mode
    });

    akilliHafizaKaydet(ip, message);

    return res.json({
      reply,
      kalanMesaj: mesajLimiti - kullaniciVerisi[ip].mesajSayisi,
      akilliHafiza: true,
      kendiniKontrol: true,
      cokDilliZeka: true
    });

  }catch(err){
    console.error(err);
    res.json({ reply: "Hata oluştu." });
  }
});

app.post("/smart-title", async (req, res) => {
  try{
    const message = temizMesaj(req.body?.message || "").trim();
    const reply = temizMesaj(req.body?.reply || "").trim();

    if(!message){
      return res.json({ ok:false, title:"" });
    }

    if(!process.env.OPENROUTER_API_KEY){
      const local = message.split(/\s+/).slice(0, 4).join(" ");
      return res.json({ ok:true, title: local || "Yeni Sohbet" });
    }

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:"POST",
      headers:{
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model: process.env.OPENROUTER_FAST_MODEL || "openai/gpt-4o-mini",
        max_tokens: 30,
        messages:[
          {
            role:"system",
            content:"Sadece Türkçe, kısa bir sohbet başlığı üret. En fazla 4 kelime. Emoji kullanabilirsin. Tırnak, nokta, açıklama yazma."
          },
          {
            role:"user",
            content:"Kullanıcı mesajı: " + message + "\nAI cevabı: " + reply.slice(0, 500)
          }
        ]
      })
    });

    const data = await aiRes.json().catch(() => ({}));
    let title = data.choices?.[0]?.message?.content || "";

    title = String(title)
      .replace(/["'`]/g, "")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 38);

    if(!title){
      title = message.split(/\s+/).slice(0, 4).join(" ") || "Yeni Sohbet";
    }

    res.json({ ok:true, title });
  }catch(err){
    console.error("smart-title hata:", err);
    res.json({ ok:false, title:"" });
  }
});

app.post("/chat-image", async (req, res) => {
  try{
    const { message, image } = req.body || {};
    const ip = ipAl(req);
    const simdi = Date.now();

    kullaniciVerisiHazirla(ip);

    if(!image){
      return res.json({ reply: "Fotoğraf gelmedi." });
    }

    if(!process.env.OPENROUTER_API_KEY){
      return res.json({ reply: "AI API key ayarlanmamış." });
    }

    if(kullaniciSonMesaj[ip] && simdi - kullaniciSonMesaj[ip].time < 3000){
      return res.json({ reply: "Biraz yavaş. 3 saniye bekle." });
    }

    kullaniciSonMesaj[ip] = {
      time: simdi,
      text: message || "görsel"
    };

    const fotoLimiti = 10;

    if(kullaniciVerisi[ip].fotoSayisi >= fotoLimiti){
      return res.json({ reply: "Fotoğraf hakkın bitti." });
    }

    kullaniciVerisi[ip].fotoSayisi++;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "Sen NeuraAI adında samimi ve net bir görsel analiz asistanısın. Kullanıcı hangi dilde yazarsa o dile uygun cevap ver. Görselde ne olduğunu açıkla. Emin olmadığın şeyleri kesinmiş gibi söyleme. Kullanıcı fotoğrafı çizgi film/anime/3D yap derse fotoğrafa göre açıklayıcı bir prompt öner."
          },
          {
            role: "user",
            content: [
              { type: "text", text: message || "Bu görseli analiz et." },
              { type: "image_url", image_url: { url: image } }
            ]
          }
        ]
      })
    });

    const aiData = await aiRes.json();

    if(!aiRes.ok){
      console.error("Foto analiz OpenRouter hata:", aiData);
      return res.json({ reply: "Fotoğraf analizinde AI tarafında sorun oldu." });
    }

    const reply = aiData.choices?.[0]?.message?.content || "Fotoğraf analizi cevabı alınamadı.";

    return res.json({
      reply,
      kalanFoto: fotoLimiti - kullaniciVerisi[ip].fotoSayisi
    });

  }catch(err){
    console.error(err);
    res.json({ reply: "Foto hata." });
  }
});

app.post("/generate-image", async (req, res) => {
  try{
    const { prompt, style, size } = req.body || {};
    const ip = ipAl(req);

    kullaniciVerisiHazirla(ip);

    if(!prompt || prompt.trim().length < 1){
      return res.json({ reply: "Ne çizelim?" });
    }

    const resimLimiti = 100;

    if(kullaniciVerisi[ip].resimSayisi >= resimLimiti){
      return res.json({ reply: "Görsel üretme hakkın bitti." });
    }

    const temizPrompt = promptuIngilizceyeYaklastir(prompt);
    const secilenStil = stilPromptu(style);

    const gucluPrompt =
      secilenStil + ". " +
      temizPrompt +
      ". Only the requested subject. No extra people unless user asks. No text. No watermark. No warning sign. No blocked message. High quality.";

    let image;

    try{
      image = await pollinationsGorselAl(gucluPrompt, size);
    }catch(err){
      console.error("Pollinations görsel hatası:", err.message);
      return res.json({
        reply: "Görsel üretme servisi şu an yoğun. Biraz sonra tekrar dene. Hakkını yakmadım.",
        error: "image_service_busy"
      });
    }

    kullaniciVerisi[ip].resimSayisi++;

    return res.json({
      image,
      enhancedPrompt: gucluPrompt,
      kalanResim: resimLimiti - kullaniciVerisi[ip].resimSayisi
    });

  }catch(err){
    console.error(err);
    res.json({ reply: "Görsel üretme hatası oluştu." });
  }
});

app.get("/updates", (req, res) => {
  res.json({ updates: neuraUpdates.slice().reverse() });
});

app.post("/updates", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const text = temizMesaj(req.body?.text || "").trim();

  if(!text){
    return res.json({
      ok:false,
      reply:"Duyuru boş olamaz."
    });
  }

  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
    text,
    time: Date.now(),
    editedTime: null,
    reactions: {},
    reactedUsers: {}
  };

  neuraUpdates.push(item);
  neuraUpdates = neuraUpdates.slice(-50);

  bildirimEkle("Yeni güncelleme yayınlandı", text);
  veriKaydet();

  res.json({
    ok:true,
    update:item
  });
});

app.put("/updates/:id", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const id = req.params.id;
  const text = temizMesaj(req.body?.text || "").trim();

  if(!text){
    return res.json({
      ok:false,
      reply:"Duyuru boş olamaz."
    });
  }

  const item = neuraUpdates.find(u => u.id === id);

  if(!item){
    return res.status(404).json({
      ok:false,
      reply:"Duyuru bulunamadı."
    });
  }

  item.text = text;
  item.editedTime = Date.now();

  bildirimEkle("Bir güncelleme düzenlendi", text);
  veriKaydet();

  res.json({
    ok:true,
    update:item
  });
});

app.delete("/updates/:id", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const id = req.params.id;
  const oncekiUzunluk = neuraUpdates.length;

  neuraUpdates = neuraUpdates.filter(u => u.id !== id);

  if(neuraUpdates.length === oncekiUzunluk){
    return res.status(404).json({
      ok:false,
      reply:"Duyuru bulunamadı."
    });
  }

  neuraNotifications = neuraNotifications.filter(n => n.id !== id);
  veriKaydet();

  res.json({
    ok:true
  });
});

app.post("/updates/emoji", (req, res) => {
  const { id, emoji } = req.body || {};
  const userKey = ipAl(req);

  const izinli = ["🔥","💜","🚀","🦊","🏎️","👏","😎","🤯"];

  if(!izinli.includes(emoji)){
    return res.json({
      ok:false,
      reply:"Bu emoji desteklenmiyor."
    });
  }

  const item = neuraUpdates.find(u => u.id === id);

  if(!item){
    return res.json({
      ok:false,
      reply:"Güncelleme bulunamadı."
    });
  }

  if(!item.reactions) item.reactions = {};
  if(!item.reactedUsers) item.reactedUsers = {};

  const eskiEmoji = item.reactedUsers[userKey];

  if(eskiEmoji === emoji){
    return res.json({
      ok:true,
      reply:"Bu duyuruya zaten bu emojiyi attın.",
      reactions:item.reactions
    });
  }

  if(eskiEmoji && item.reactions[eskiEmoji]){
    item.reactions[eskiEmoji]--;

    if(item.reactions[eskiEmoji] <= 0){
      delete item.reactions[eskiEmoji];
    }
  }

  item.reactedUsers[userKey] = emoji;
  item.reactions[emoji] = (item.reactions[emoji] || 0) + 1;
  veriKaydet();

  res.json({
    ok:true,
    reactions:item.reactions
  });
});

app.get("/upcoming", (req, res) => {
  res.json({
    upcoming: neuraUpcoming.slice().reverse()
  });
});

app.post("/upcoming", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const version = temizMesaj(req.body?.version || "").trim();
  const text = temizMesaj(req.body?.text || "").trim();
  const status = temizMesaj(req.body?.status || "Planlandı").trim();

  if(!version || !text){
    return res.json({
      ok:false,
      reply:"Versiyon ve açıklama gerekli."
    });
  }

  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
    version,
    text,
    status: status || "Planlandı",
    time: Date.now()
  };

  neuraUpcoming.push(item);
  neuraUpcoming = neuraUpcoming.slice(-30);
  veriKaydet();

  res.json({
    ok:true,
    upcoming:item
  });
});

app.put("/upcoming/:id", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const item = neuraUpcoming.find(u => u.id === req.params.id);

  if(!item){
    return res.status(404).json({
      ok:false,
      reply:"Yaklaşan güncelleme bulunamadı."
    });
  }

  const version = temizMesaj(req.body?.version || "").trim();
  const text = temizMesaj(req.body?.text || "").trim();
  const status = temizMesaj(req.body?.status || item.status || "Planlandı").trim();

  if(!version || !text){
    return res.json({
      ok:false,
      reply:"Versiyon ve açıklama boş olamaz."
    });
  }

  item.version = version;
  item.text = text;
  item.status = status || "Planlandı";
  item.editedTime = Date.now();
  veriKaydet();

  res.json({
    ok:true,
    upcoming:item
  });
});

app.delete("/upcoming/:id", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const oncekiUzunluk = neuraUpcoming.length;
  neuraUpcoming = neuraUpcoming.filter(u => u.id !== req.params.id);

  if(neuraUpcoming.length === oncekiUzunluk){
    return res.status(404).json({
      ok:false,
      reply:"Yaklaşan güncelleme bulunamadı."
    });
  }

  veriKaydet();
  res.json({ ok:true });
});

app.get("/polls", (req, res) => {
  res.json({
    polls: neuraPolls.slice().reverse()
  });
});

app.post("/polls", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const title = temizMesaj(req.body?.title || "").trim();
  const rawOptions = Array.isArray(req.body?.options) ? req.body.options : [];
  const durationHours = Math.max(1, Math.min(72, Number(req.body?.durationHours || 24)));

  const options = rawOptions
    .map(o => temizMesaj(o).trim())
    .filter(Boolean)
    .slice(0, 8);

  if(!title || options.length < 2){
    return res.json({
      ok:false,
      reply:"Oylama başlığı ve en az 2 seçenek gerekli."
    });
  }

  const poll = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
    title,
    createdAt: Date.now(),
    endsAt: Date.now() + durationHours * 60 * 60 * 1000,
    voters: {},
    options: options.map((text, index) => ({
      id: "secenek_" + index,
      text,
      votes: 0
    }))
  };

  neuraPolls.push(poll);
  neuraPolls = neuraPolls.slice(-20);
  veriKaydet();

  res.json({
    ok:true,
    poll
  });
});

app.post("/polls/:id/vote", (req, res) => {
  const poll = neuraPolls.find(p => p.id === req.params.id);

  if(!poll){
    return res.status(404).json({
      ok:false,
      reply:"Oylama bulunamadı."
    });
  }

  if(Date.now() > Number(poll.endsAt || 0)){
    return res.json({
      ok:false,
      reply:"Bu oylamanın süresi dolmuş."
    });
  }

  const optionId = String(req.body?.optionId || "");
  const option = poll.options.find(o => o.id === optionId);

  if(!option){
    return res.json({
      ok:false,
      reply:"Seçenek bulunamadı."
    });
  }

  const userKey = ipAl(req);

  if(poll.voters[userKey]){
    return res.json({
      ok:false,
      reply:"Bu oylamaya zaten oy verdin."
    });
  }

  poll.voters[userKey] = optionId;
  option.votes++;
  veriKaydet();

  res.json({
    ok:true,
    poll
  });
});

app.delete("/polls/:id", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const oncekiUzunluk = neuraPolls.length;
  neuraPolls = neuraPolls.filter(p => p.id !== req.params.id);

  if(neuraPolls.length === oncekiUzunluk){
    return res.status(404).json({
      ok:false,
      reply:"Oylama bulunamadı."
    });
  }

  veriKaydet();
  res.json({ ok:true });
});

app.get("/added", (req, res) => {
  res.json({
    added: neuraAdded.slice().reverse()
  });
});

app.post("/added", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const text = temizMesaj(req.body?.text || "").trim();

  if(!text){
    return res.json({
      ok:false,
      reply:"Eklenenler yazısı boş olamaz."
    });
  }

  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
    text,
    time: Date.now(),
    editedTime: null
  };

  neuraAdded.push(item);
  neuraAdded = neuraAdded.slice(-50);
  veriKaydet();

  res.json({
    ok:true,
    added:item
  });
});

app.put("/added/:id", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const item = neuraAdded.find(a => a.id === req.params.id);
  const text = temizMesaj(req.body?.text || "").trim();

  if(!item){
    return res.status(404).json({
      ok:false,
      reply:"Eklenen kayıt bulunamadı."
    });
  }

  if(!text){
    return res.json({
      ok:false,
      reply:"Eklenenler yazısı boş olamaz."
    });
  }

  item.text = text;
  item.editedTime = Date.now();
  veriKaydet();

  res.json({
    ok:true,
    added:item
  });
});

app.delete("/added/:id", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const oncekiUzunluk = neuraAdded.length;
  neuraAdded = neuraAdded.filter(a => a.id !== req.params.id);

  if(neuraAdded.length === oncekiUzunluk){
    return res.status(404).json({
      ok:false,
      reply:"Eklenen kayıt bulunamadı."
    });
  }

  veriKaydet();
  res.json({ ok:true });
});

app.get("/notifications", (req, res) => {
  res.json({
    notifications: neuraNotifications.slice().reverse()
  });
});

app.get("/neura-data-backup", (req, res) => {
  if(!adminKontrol(req, res)) return;

  res.json({
    ok:true,
    data:{
      updates: neuraUpdates,
      notifications: neuraNotifications,
      added: neuraAdded,
      upcoming: neuraUpcoming,
      polls: neuraPolls
    }
  });
});

app.post("/neura-data-import", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const data = req.body?.data || req.body || {};

  if(Array.isArray(data.updates)) neuraUpdates = data.updates;
  if(Array.isArray(data.notifications)) neuraNotifications = data.notifications;
  if(Array.isArray(data.added)) neuraAdded = data.added;
  if(Array.isArray(data.upcoming)) neuraUpcoming = data.upcoming;
  if(Array.isArray(data.polls)) neuraPolls = data.polls;
  if(data.memories && typeof data.memories === "object") neuraMemories = data.memories;
  if(data.countryStats && typeof data.countryStats === "object") neuraCountryStats = data.countryStats;
  if(data.founderStatus && typeof data.founderStatus === "object") neuraFounderStatus = data.founderStatus;

  veriKaydet();

  res.json({ ok:true });
});


/* === NeuraAI V2: Canlı Kullanıcı Sayacı Endpointleri === */
app.post("/online-ping", (req, res) => {
  try{
    const ip = ipAl(req);
    const userAgent = String(req.headers["user-agent"] || "bilinmiyor").slice(0, 120);
    const key = ip + "|" + userAgent;
    const country = ulkeKaydet(req);

    onlineUsers[key] = {
      lastSeen: Date.now(),
      country
    };

    const gelenFounderKey = String(req.body?.founderKey || req.headers["x-founder-key"] || "").trim();
    const dogruFounderKey = String(process.env.FOUNDER_KEY || "ffgok-kurucu").trim();

    if(gelenFounderKey && gelenFounderKey === dogruFounderKey){
      neuraFounderStatus = {
        online:true,
        lastSeen: Date.now(),
        ip,
        country
      };
    }

    res.json({
      ok:true,
      online: onlineKullaniciSayisi(),
      founderOnline: kurucuCevrimiciMi(),
      founderName: "NeuraAI",
      founderLastSeen: Number(neuraFounderStatus.lastSeen || 0),
      country
    });
  }catch(err){
    console.error("Online ping hatası:", err);
    res.json({
      ok:false,
      online: onlineKullaniciSayisi(),
      founderOnline: kurucuCevrimiciMi(),
      founderName: "NeuraAI"
    });
  }
});

app.get("/online-count", (req, res) => {
  res.json({
    ok:true,
    online: onlineKullaniciSayisi(),
    founderOnline: kurucuCevrimiciMi(),
    founderName: "NeuraAI"
  });
});



/* === NeuraAI V2: Codex Chat + Dünya Haritası === */

app.post("/codex-chat", async (req, res) => {
  try{
    const message = temizMesaj(req.body?.message || "").trim();
    const code = temizKod(req.body?.code || "").trim();
    const projectMemory = Array.isArray(req.body?.projectMemory) ? req.body.projectMemory.slice(-10) : [];

    if(!message && !code){
      return res.json({ ok:false, reply:"Merhaba, ben Codex. Kodunu gönder, istediğini yaz; birlikte güçlü şekilde inceleyelim." });
    }

    if(!process.env.OPENROUTER_API_KEY){
      return res.json({ ok:false, reply:"Codex API key ayarlanmamış." });
    }

    const birlesik = (message + "\n" + code).trim();
    const kodIsareti = code.length > 0 || /```|function\s+|const\s+|let\s+|var\s+|class\s+|app\.|document\.|<html|<div|<script|require\(|import\s+|async\s+|await\s+|=>|SELECT\s+|INSERT\s+|router\.|module\.exports|\.then\(|try\{|catch\(|res\.json|fetch\(/i.test(birlesik);
    const kodNiyeti = /(kod|hata|bug|html|css|javascript|js|node|server|api|endpoint|optimize|güvenlik|guvenlik|dosya|fonksiyon|deploy|render|login|buton|site|proje|analiz|açıkla|acikla|ekle|düzelt|duzelt|çalışmıyor|calismiyor|çalışmıyor|neden|fix|refactor|performans|veritabanı|database)/i.test(message);

    if(!kodIsareti && !kodNiyeti){
      return res.json({
        ok:true,
        reply:"Merhaba, ben Codex. Ben kod ve proje tarafı için buradayım. Kodunu gönder; hata bulayım, açıklayayım, optimize edeyim veya hangi dosyada ne değişeceğini söyleyeyim."
      });
    }

    const hafizaMetni = projectMemory.map((item, i) => {
      if(typeof item === "string") return `${i + 1}) ${temizKod(item).slice(0, 1200)}`;
      const title = temizMesaj(item?.baslik || item?.title || item?.name || `Dosya ${i + 1}`).slice(0, 80);
      const content = temizKod(item?.kod || item?.content || item?.text || "").slice(0, 1500);
      return `${i + 1}) ${title}:\n${content}`;
    }).join("\n\n");

    const gorev = message || "Bu kodu güçlü şekilde analiz et. Hataları, güvenlik risklerini, performansı, dosya yerleşimini ve iyileştirmeleri net söyle.";

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:"POST",
      headers:{
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model: process.env.OPENROUTER_CODE_MODEL || process.env.OPENROUTER_SMART_MODEL || "openai/gpt-4o-mini",
        max_tokens: 3400,
        messages:[
          {
            role:"system",
            content:
              "Sen NeuraAI içindeki Codex Chat'sin. Normal sohbet asistanı değilsin; kod, yazılım, proje, hata, güvenlik, performans, dosya yapısı ve teknik geliştirme konularında uzman bir yardımcı gibi davran. " +
              "Kod yoksa ve kullanıcı günlük konu açarsa kısa cevap ver: 'Merhaba, ben Codex. Kodunu gönder, istediğini yapalım.' Kod iste. " +
              "Kod veya teknik istek varsa ASLA sadece tanıtım mesajı verme; mutlaka analiz yap. " +
              "Cevap düzenin: 1) Kısa teşhis, 2) Sorunun nedeni, 3) Net çözüm adımları, 4) Gerekirse kod parçası, 5) Hangi dosyada ne değişecek. " +
              "Kod büyükse tamamını tekrar yazma; değişecek kritik parçaları ver. Kullanıcı 'tam dosya ver' derse tam dosya ver. " +
              "Emin değilsen açıkça belirt. Güvenlik, performans, okunabilirlik ve kullanıcı deneyimini birlikte düşün. " +
              "Türkçe, net, güçlü, uygulanabilir ve geliştirici dostu cevap ver."
          },
          {
            role:"user",
            content:
              "Görev:\n" + gorev +
              "\n\nKod alanı:\n" + (code || "Kod alanı boş.") +
              "\n\nProje hafızası:\n" + (hafizaMetni || "Proje hafızası boş.")
          }
        ]
      })
    });

    const data = await aiRes.json().catch(() => ({}));

    if(!aiRes.ok){
      console.error("Codex Chat hata:", data);
      return res.json({ ok:false, reply:"Codex tarafında sorun oldu. Biraz sonra tekrar dene." });
    }

    const reply = data.choices?.[0]?.message?.content || "Codex cevap alamadı.";
    return res.json({ ok:true, reply });
  }catch(err){
    console.error("Codex Chat sistem hatası:", err);
    res.json({ ok:false, reply:"Codex Chat hata verdi." });
  }
});

app.get("/world-stats", (req, res) => {
  const varsayilan = {
    TR:{ code:"TR", name:"Türkiye", users:1, x:56, y:36, lastSeen:Date.now() }
  };

  if(!neuraCountryStats || Object.keys(neuraCountryStats).length === 0){
    neuraCountryStats = varsayilan;
  }

  const countries = Object.values(neuraCountryStats)
    .map(c => ({
      code:c.code,
      name:c.name || ulkeAdi(c.code),
      users:Number(c.users || 0),
      x:Number(c.x || ulkeKonumu(c.code).x),
      y:Number(c.y || ulkeKonumu(c.code).y)
    }))
    .sort((a,b) => b.users - a.users);

  const total = countries.reduce((sum,c) => sum + c.users, 0);
  const leader = countries[0] || null;

  res.json({
    ok:true,
    total,
    countryCount:countries.length,
    leader,
    countries
  });
});

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server çalışıyor. Port: ${PORT}`);
});
