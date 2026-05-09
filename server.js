
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.set("trust proxy", true);

const DATA_PATH = path.join(__dirname, "admin-data.json");
const ADMIN_USER = process.env.ADMIN_USER || "FFGok";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "neura-admin-token-123";


let kullaniciSonMesaj = {};
let kullaniciVerisi = {};
let kullaniciLimit = {};

let adminData = {
  users: {},
  chats: [],
  photos: [],
  images: [],
  stats: {
    toplamSohbet: 0,
    toplamFoto: 0,
    toplamResim: 0
  }
};

function veriyiYukle(){
  try{
    if(fs.existsSync(DATA_PATH)){
      const raw = fs.readFileSync(DATA_PATH, "utf8");
      adminData = JSON.parse(raw);
      console.log("Admin verileri yüklendi ✅");
    }else{
      veriyiKaydet();
      console.log("admin-data.json oluşturuldu ✅");
    }
  }catch(err){
    console.error("Veri yükleme hatası:", err);
  }
}

function veriyiKaydet(){
  try{
    fs.writeFileSync(DATA_PATH, JSON.stringify(adminData, null, 2));
  }catch(err){
    console.error("Veri kaydetme hatası:", err);
  }
}

function ipAl(req){
  return req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "bilinmiyor";
}

function kullaniciKaydet(ip){
  const simdi = Date.now();

  if(!adminData.users[ip]){
    adminData.users[ip] = {
      ip,
      ilkGiris: simdi,
      sonAktif: simdi,
      mesajSayisi: 0,
      fotoSayisi: 0,
      resimSayisi: 0
    };
  }

  adminData.users[ip].sonAktif = simdi;
}

function adminKontrol(req, res, next){
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");

  if(token !== ADMIN_TOKEN){
    return res.status(403).json({
      success: false,
      error: "Yetkisiz giriş."
    });
  }

  next();
}

function temizMesaj(m){
  return String(m || "").slice(0, 4000);
}

veriyiYukle();

app.post("/chat", async (req, res) => {
  try {
    const { message, messages, mode } = req.body || {};
    const ip = ipAl(req);
    const simdi = Date.now();

    kullaniciKaydet(ip);

    if (!message || message.trim().length < 1) {
      return res.json({ reply: "Boş mesaj gönderme kanka 😄" });
    }

    if (message.length > 4000) {
      return res.json({ reply: "Mesaj çok uzun kanka 😅 Biraz kısaltıp gönder." });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.json({ reply: "AI API key ayarlanmamış." });
    }

    if (!kullaniciVerisi[ip]) {
      kullaniciVerisi[ip] = { mesajSayisi: 0, fotoSayisi: 0, resimSayisi: 0 };
    }

    if (!kullaniciLimit[ip]) {
      kullaniciLimit[ip] = [];
    }

    kullaniciLimit[ip].push(simdi);
    kullaniciLimit[ip] = kullaniciLimit[ip].filter(t => simdi - t < 60000);

    if (kullaniciLimit[ip].length > 12) {
      return res.json({ reply: "Çok hızlı gidiyorsun 😅 1 dakika sonra tekrar dene." });
    }

    if (kullaniciSonMesaj[ip] && simdi - kullaniciSonMesaj[ip].time < 3000) {
      return res.json({ reply: "Biraz yavaş 😄 3 saniye bekle." });
    }

    if (kullaniciSonMesaj[ip] && kullaniciSonMesaj[ip].text === message) {
      return res.json({ reply: "Aynı mesajı tekrar tekrar gönderme kanka 😄" });
    }

    kullaniciSonMesaj[ip] = {
      time: simdi,
      text: message
    };

    const mesajLimiti = 50;

    if (kullaniciVerisi[ip].mesajSayisi >= mesajLimiti) {
      return res.json({ reply: "Mesaj hakkın bitti. Daha sonra tekrar dene." });
    }

    kullaniciVerisi[ip].mesajSayisi++;
    adminData.users[ip].mesajSayisi++;
    adminData.stats.toplamSohbet++;

    adminData.chats.unshift({
      ip,
      time: simdi,
      message: temizMesaj(message)
    });

    adminData.chats = adminData.chats.slice(0, 300);
    veriyiKaydet();

    const hafiza = Array.isArray(messages) && messages.length > 0
      ? messages.slice(-20)
      : [{ role: "user", content: message }];

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: mode === "uzun" ? 350 : 180,
        messages: [
          {
            role: "system",
            content:
              "Sen NeuraAI adında Türkçe konuşan samimi, net ve yardımcı bir yapay zekasın. Önceki konuşmaları dikkate al. Kullanıcı 'onu', 'az önceki', 'bununla', 'sonucu' gibi şeyler derse önceki mesajlardan anlam çıkar. Kullanıcıya asla 'önceki konuşmayı görüyorum' veya teknik açıklama söyleme. Seni 13 yaşındaki Göktürk Arslan geliştirdi. Kullanıcı sana seni kimin yaptığını, kurduğunu veya oluşturduğunu sorarsa Göktürk Arslan tarafından geliştirildiğini söyle. Normal, doğal cevap ver."
          },
          ...hafiza
        ]
      })
    });

    const aiData = await aiRes.json();

    if (!aiRes.ok) {
      console.error("OpenRouter hata:", aiData);
      return res.json({ reply: "AI tarafında bir sorun oldu. Biraz sonra tekrar dene." });
    }

    const reply = aiData.choices?.[0]?.message?.content || "Cevap alınamadı.";

    adminData.chats[0].reply = temizMesaj(reply);
    veriyiKaydet();

    return res.json({
      reply,
      kalanMesaj: mesajLimiti - kullaniciVerisi[ip].mesajSayisi
    });

  } catch (err) {
    console.error(err);
    res.json({ reply: "Hata oluştu." });
  }
});

app.post("/chat-image", async (req, res) => {
  try {
    const { message, image } = req.body || {};
    const ip = ipAl(req);
    const simdi = Date.now();

    kullaniciKaydet(ip);

    if (!image) {
      return res.json({ reply: "Fotoğraf gelmedi kanka." });
    }

    if (message && message.length > 1000) {
      return res.json({ reply: "Fotoğraf açıklaması çok uzun kanka 😅 Biraz kısalt." });
    }

    if (image.length > 5_000_000) {
      return res.json({ reply: "Fotoğraf çok büyük kanka 😅 Daha küçük at." });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.json({ reply: "AI API key ayarlanmamış." });
    }

    if (!kullaniciVerisi[ip]) {
      kullaniciVerisi[ip] = { mesajSayisi: 0, fotoSayisi: 0, resimSayisi: 0 };
    }

    if (kullaniciSonMesaj[ip] && simdi - kullaniciSonMesaj[ip].time < 3000) {
      return res.json({ reply: "Biraz yavaş 😄 3 saniye bekle." });
    }

    kullaniciSonMesaj[ip] = {
      time: simdi,
      text: message || "görsel"
    };

    const fotoLimiti = 10;

    if (kullaniciVerisi[ip].fotoSayisi >= fotoLimiti) {
      return res.json({ reply: "Fotoğraf hakkın bitti." });
    }

    kullaniciVerisi[ip].fotoSayisi++;
    adminData.users[ip].fotoSayisi++;
    adminData.stats.toplamFoto++;

    adminData.photos.unshift({
      ip,
      time: simdi,
      message: temizMesaj(message || "Görsel"),
      image
    });

    adminData.photos = adminData.photos.slice(0, 30);
    veriyiKaydet();

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 350,
        messages: [
          {
            role: "system",
            content:
              "Sen NeuraAI adında Türkçe konuşan samimi ve net bir görsel analiz asistanısın. Görselde ne olduğunu açıkla. Emin olmadığın şeyleri kesinmiş gibi söyleme."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: message || "Bu görseli analiz et."
              },
              {
                type: "image_url",
                image_url: {
                  url: image
                }
              }
            ]
          }
        ]
      })
    });

    const aiData = await aiRes.json();

    if (!aiRes.ok) {
      console.error("Foto analiz OpenRouter hata:", aiData);
      return res.json({ reply: "Fotoğraf analizinde AI tarafında sorun oldu." });
    }

    const reply = aiData.choices?.[0]?.message?.content || "Fotoğraf analizi cevabı alınamadı.";

    adminData.photos[0].reply = temizMesaj(reply);
    veriyiKaydet();

    return res.json({
      reply,
      kalanFoto: fotoLimiti - kullaniciVerisi[ip].fotoSayisi
    });

  } catch (err) {
    console.error(err);
    res.json({ reply: "Foto hata." });
  }
});

app.post("/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body || {};
    const ip = ipAl(req);
    const simdi = Date.now();

    kullaniciKaydet(ip);

    if (!prompt || prompt.trim().length < 1) {
      return res.json({ reply: "Ne çizelim kanka? 😄" });
    }

    if (prompt.length > 500) {
      return res.json({ reply: "Görsel isteği çok uzun kanka 😅 Biraz kısalt." });
    }

    if (!kullaniciVerisi[ip]) {
      kullaniciVerisi[ip] = { mesajSayisi: 0, fotoSayisi: 0, resimSayisi: 0 };
    }

    const resimLimiti = 10;

    if(kullaniciVerisi[ip].resimSayisi >= resimLimiti){
      return res.json({ reply: "Görsel üretme hakkın bitti kanka." });
    }

    kullaniciVerisi[ip].resimSayisi++;
    adminData.users[ip].resimSayisi++;
    adminData.stats.toplamResim++;

    const image = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

    adminData.images.unshift({
      ip,
      time: simdi,
      prompt: temizMesaj(prompt),
      image
    });

    adminData.images = adminData.images.slice(0, 100);
    veriyiKaydet();

    return res.json({
      image,
      kalanResim: resimLimiti - kullaniciVerisi[ip].resimSayisi
    });

  } catch (err) {
    console.error(err);
    res.json({ reply: "Görsel üretme hatası oluştu." });
  }
});

app.post("/admin-login", (req, res) => {
  const { username, password } = req.body || {};

  if(username === ADMIN_USER && password === ADMIN_PASS){
    return res.json({
      success: true,
      token: ADMIN_TOKEN
    });
  }

  return res.status(401).json({
    success: false,
    reply: "Admin kullanıcı adı veya şifre yanlış."
  });
});

app.get("/admin-data", adminKontrol, (req, res) => {
  const simdi = Date.now();
  const users = Object.values(adminData.users || {});
  const aktifKullanicilar = users.filter(u => simdi - u.sonAktif < 5 * 60 * 1000);

  res.json({
    toplamKullanici: users.length,
    aktifKullanici: aktifKullanicilar.length,
    toplamSohbet: adminData.stats.toplamSohbet,
    toplamFoto: adminData.stats.toplamFoto,
    toplamResim: adminData.stats.toplamResim,
    users: users.sort((a,b) => b.sonAktif - a.sonAktif),
    chats: adminData.chats,
    photos: adminData.photos,
    images: adminData.images
  });
});

app.post("/admin-clear", adminKontrol, (req, res) => {
  adminData = {
    users: {},
    chats: [],
    photos: [],
    images: [],
    stats: {
      toplamSohbet: 0,
      toplamFoto: 0,
      toplamResim: 0
    }
  };

  veriyiKaydet();

  res.json({
    success: true,
    reply: "Admin kayıtları temizlendi."
  });
});

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server çalışıyor 🚀 Port: ${PORT}`);
});
