const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const express = require("express");
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "neura-data.json");

function varsayilanYaklasanlar(){
  return [
    { id: "v2-plan", version: "v2.0", text: "Plus Plan, Pro Plan ve Profesör Modu hazırlanıyor.", status: "Planlandı", time: Date.now() },
    { id: "v21-plan", version: "v2.1", text: "Günlük Seri Sistemi ve ödüller hazırlanıyor.", status: "Planlandı", time: Date.now() },
    { id: "v3-plan", version: "v3.0", text: "Topluluk Odası / NeuraHub sistemi planlanıyor.", status: "Planlandı", time: Date.now() }
  ];
}

function veriOku(){
  try{
    if(!fs.existsSync(DATA_FILE)){
      return { updates: [], notifications: [], added: [], upcoming: varsayilanYaklasanlar(), polls: [] };
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8") || "{}");

    return {
      updates: Array.isArray(data.updates) ? data.updates : [],
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      added: Array.isArray(data.added) ? data.added : [],
      upcoming: Array.isArray(data.upcoming) && data.upcoming.length > 0 ? data.upcoming : varsayilanYaklasanlar(),
      polls: Array.isArray(data.polls) ? data.polls : []
    };
  }catch(err){
    console.error("Veri okuma hatası:", err);
    return { updates: [], notifications: [], added: [], upcoming: varsayilanYaklasanlar(), polls: [] };
  }
}

function veriKaydet(){
  try{
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      updates: neuraUpdates,
      notifications: neuraNotifications,
      added: neuraAdded,
      upcoming: neuraUpcoming,
      polls: neuraPolls
    }, null, 2), "utf8");
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

function ipAl(req){
  const forwarded = req.headers["x-forwarded-for"];
  if(forwarded) return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "bilinmiyor";
}

function temizMesaj(m){
  return String(m || "").slice(0, 4000);
}

function kullaniciVerisiHazirla(ip){
  if(!kullaniciVerisi[ip]){
    kullaniciVerisi[ip] = { mesajSayisi: 0, fotoSayisi: 0, resimSayisi: 0 };
  }
}

function adminKontrol(req, res){
  const secret = req.headers["x-admin-secret"];
  if(!process.env.ADMIN_SECRET){
    res.status(500).json({ ok:false, reply:"ADMIN_SECRET Render Environment içinde yok." });
    return false;
  }
  if(secret !== process.env.ADMIN_SECRET){
    res.status(403).json({ ok:false, reply:"Bu alan sadece kurucu içindir." });
    return false;
  }
  return true;
}

function bildirimEkle(title, text){
  return;
}

function aiModelProfili(aiModelTipi){
  const tip = String(aiModelTipi || "akilli").toLowerCase();

  if(tip === "hizli"){
    return { ad:"Hızlı", model:process.env.OPENROUTER_FAST_MODEL || "openai/gpt-4o-mini", maxKisa:650, maxUzun:1600, prompt:"Cevapları hızlı, kısa, net ve pratik ver." };
  }

  if(tip === "yaratici"){
    return { ad:"Yaratıcı", model:process.env.OPENROUTER_CREATIVE_MODEL || "openai/gpt-4o-mini", maxKisa:1200, maxUzun:2600, prompt:"Daha yaratıcı, fikir odaklı ve enerjik cevap ver." };
  }

  if(tip === "kod"){
    return { ad:"Kod", model:process.env.OPENROUTER_CODE_MODEL || "openai/gpt-4o-mini", maxKisa:1400, maxUzun:3200, prompt:"Kod ve hata çözümüne odaklan." };
  }

  return { ad:"Akıllı", model:process.env.OPENROUTER_SMART_MODEL || "openai/gpt-4o-mini", maxKisa:1100, maxUzun:2800, prompt:"Dengeli, akıllı ve kaliteli cevap ver." };
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

function sistemPromptOlustur(konusmaModu, aiModelTipi, customAi){
  const profil = aiModelProfili(aiModelTipi);

  const temel =
    "Sen NeuraAI adında net, yardımcı ve güvenli bir yapay zekasın. " +
    "Kullanıcı Türkçe yazarsa Türkçe cevap ver. Kullanıcı başka dilde yazarsa o dile uygun cevap ver. " +
    "Önceki konuşmaları güçlü şekilde dikkate al. " +
    "Seni 13 yaşındaki Göktürk Arslan geliştirdi. " +
    "😭 emojisi her zaman üzülmek değildir; bazen gülme, sevinç veya abartı anlamına gelebilir. " +
    "Random harfleri bağlama göre gülme, heyecan veya klavye karışması olarak yorumla. " +
    "Seçili AI modu: " + profil.ad + ". " + profil.prompt + " " +
    ozelAiPromptOlustur(customAi);

  if(konusmaModu === "codex") return temel + " Şu an Codex modundasın. Kod odaklı çalış.";
  if(konusmaModu === "resmi") return temel + " Şu an Resmi Moddasın. Profesyonel konuş.";
  if(konusmaModu === "profesor") return temel + " Şu an Profesör Modundasın. Ancak Profesör Modu Pro gerektirir.";
  return temel + " Şu an Samimi Moddasın. Sıcak, doğal ve arkadaş gibi konuş.";
}

app.post("/chat", async (req, res) => {
  try{
    const { message, messages, mode, konusmaModu, aiModelTipi, customAi } = req.body || {};
    const ip = ipAl(req);
    const simdi = Date.now();

    kullaniciVerisiHazirla(ip);

    if(!message || message.trim().length < 1) return res.json({ reply:"Boş mesaj gönderme." });
    if(!process.env.OPENROUTER_API_KEY) return res.json({ reply:"AI API key ayarlanmamış." });

    if(!kullaniciLimit[ip]) kullaniciLimit[ip] = [];
    kullaniciLimit[ip].push(simdi);
    kullaniciLimit[ip] = kullaniciLimit[ip].filter(t => simdi - t < 60000);

    if(kullaniciLimit[ip].length > 12) return res.json({ reply:"Çok hızlı gidiyorsun. 1 dakika sonra tekrar dene." });
    if(kullaniciSonMesaj[ip] && simdi - kullaniciSonMesaj[ip].time < 3000) return res.json({ reply:"Biraz yavaş. 3 saniye bekle." });
    if(kullaniciSonMesaj[ip] && kullaniciSonMesaj[ip].text === message) return res.json({ reply:"Aynı mesajı tekrar tekrar gönderme." });

    kullaniciSonMesaj[ip] = { time: simdi, text: message };

    const mesajLimiti = 50;
    if(kullaniciVerisi[ip].mesajSayisi >= mesajLimiti) return res.json({ reply:"Mesaj hakkın bitti. Daha sonra tekrar dene." });

    kullaniciVerisi[ip].mesajSayisi++;

    const hafiza = Array.isArray(messages) && messages.length > 0 ? messages.slice(-80) : [{ role:"user", content:message }];
    const secilenMod = ["samimi","resmi","profesor","codex"].includes(konusmaModu) ? konusmaModu : "samimi";
    const secilenAiModel = aiModelProfili(aiModelTipi);

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:"POST",
      headers:{
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model: secilenAiModel.model,
        max_tokens: mode === "uzun" ? secilenAiModel.maxUzun : secilenAiModel.maxKisa,
        messages:[
          { role:"system", content:sistemPromptOlustur(secilenMod, aiModelTipi, customAi) },
          ...hafiza
        ]
      })
    });

    const aiData = await aiRes.json();

    if(!aiRes.ok){
      console.error("OpenRouter hata:", aiData);
      return res.json({ reply:"AI tarafında bir sorun oldu. Biraz sonra tekrar dene." });
    }

    const reply = aiData.choices?.[0]?.message?.content || "Cevap alınamadı.";

    return res.json({
      reply,
      kalanMesaj: mesajLimiti - kullaniciVerisi[ip].mesajSayisi
    });
  }catch(err){
    console.error(err);
    res.json({ reply:"Hata oluştu." });
  }
});

app.post("/smart-title", async (req, res) => {
  try{
    const message = temizMesaj(req.body?.message || "").trim();
    const reply = temizMesaj(req.body?.reply || "").trim();

    if(!message) return res.json({ ok:false, title:"" });

    if(!process.env.OPENROUTER_API_KEY){
      return res.json({ ok:true, title: message.split(/\s+/).slice(0, 4).join(" ") || "Yeni Sohbet" });
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
          { role:"system", content:"Sadece Türkçe, kısa bir sohbet başlığı üret. En fazla 4 kelime. Emoji kullanabilirsin. Tırnak, nokta, açıklama yazma." },
          { role:"user", content:"Kullanıcı mesajı: " + message + "\nAI cevabı: " + reply.slice(0, 500) }
        ]
      })
    });

    const data = await aiRes.json().catch(() => ({}));
    let title = data.choices?.[0]?.message?.content || "";

    title = String(title).replace(/["'`]/g, "").replace(/\n/g, " ").replace(/\s+/g, " ").trim().slice(0, 38);

    if(!title) title = message.split(/\s+/).slice(0, 4).join(" ") || "Yeni Sohbet";

    res.json({ ok:true, title });
  }catch(err){
    console.error("smart-title hata:", err);
    res.json({ ok:false, title:"" });
  }
});

app.get("/updates", (req, res) => {
  res.json({ updates: neuraUpdates.slice().reverse() });
});

app.post("/updates", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const text = temizMesaj(req.body?.text || "").trim();
  if(!text) return res.json({ ok:false, reply:"Duyuru boş olamaz." });

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
  veriKaydet();

  res.json({ ok:true, update:item });
});

app.put("/updates/:id", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const item = neuraUpdates.find(u => u.id === req.params.id);
  const text = temizMesaj(req.body?.text || "").trim();

  if(!text) return res.json({ ok:false, reply:"Duyuru boş olamaz." });
  if(!item) return res.status(404).json({ ok:false, reply:"Duyuru bulunamadı." });

  item.text = text;
  item.editedTime = Date.now();
  veriKaydet();

  res.json({ ok:true, update:item });
});

app.delete("/updates/:id", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const oncekiUzunluk = neuraUpdates.length;
  neuraUpdates = neuraUpdates.filter(u => u.id !== req.params.id);

  if(neuraUpdates.length === oncekiUzunluk) return res.status(404).json({ ok:false, reply:"Duyuru bulunamadı." });

  veriKaydet();
  res.json({ ok:true });
});

app.post("/updates/emoji", (req, res) => {
  const { id, emoji } = req.body || {};
  const userKey = ipAl(req);
  const izinli = ["🔥","💜","🚀","🦊","🏎️","👏","😎","🤯"];

  if(!izinli.includes(emoji)) return res.json({ ok:false, reply:"Bu emoji desteklenmiyor." });

  const item = neuraUpdates.find(u => u.id === id);
  if(!item) return res.json({ ok:false, reply:"Güncelleme bulunamadı." });

  if(!item.reactions) item.reactions = {};
  if(!item.reactedUsers) item.reactedUsers = {};

  const eskiEmoji = item.reactedUsers[userKey];

  if(eskiEmoji === emoji){
    return res.json({ ok:true, reply:"Bu duyuruya zaten bu emojiyi attın.", reactions:item.reactions });
  }

  if(eskiEmoji && item.reactions[eskiEmoji]){
    item.reactions[eskiEmoji]--;
    if(item.reactions[eskiEmoji] <= 0) delete item.reactions[eskiEmoji];
  }

  item.reactedUsers[userKey] = emoji;
  item.reactions[emoji] = (item.reactions[emoji] || 0) + 1;
  veriKaydet();

  res.json({ ok:true, reactions:item.reactions });
});

app.get("/added", (req, res) => {
  res.json({ added: neuraAdded.slice().reverse() });
});

app.post("/added", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const text = temizMesaj(req.body?.text || "").trim();
  if(!text) return res.json({ ok:false, reply:"Eklenenler yazısı boş olamaz." });

  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
    text,
    time: Date.now(),
    editedTime: null
  };

  neuraAdded.push(item);
  neuraAdded = neuraAdded.slice(-50);
  veriKaydet();

  res.json({ ok:true, added:item });
});

app.put("/added/:id", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const item = neuraAdded.find(a => a.id === req.params.id);
  const text = temizMesaj(req.body?.text || "").trim();

  if(!item) return res.status(404).json({ ok:false, reply:"Eklenen kayıt bulunamadı." });
  if(!text) return res.json({ ok:false, reply:"Eklenenler yazısı boş olamaz." });

  item.text = text;
  item.editedTime = Date.now();
  veriKaydet();

  res.json({ ok:true, added:item });
});

app.delete("/added/:id", (req, res) => {
  if(!adminKontrol(req, res)) return;

  const oncekiUzunluk = neuraAdded.length;
  neuraAdded = neuraAdded.filter(a => a.id !== req.params.id);

  if(neuraAdded.length === oncekiUzunluk) return res.status(404).json({ ok:false, reply:"Eklenen kayıt bulunamadı." });

  veriKaydet();
  res.json({ ok:true });
});

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server çalışıyor. Port: ${PORT}`);
});
