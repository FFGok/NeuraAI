const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.set("trust proxy", true);

const DATA_DIR = process.env.DATA_DIR || __dirname;

if(!fs.existsSync(DATA_DIR)){
  fs.mkdirSync(DATA_DIR, { recursive:true });
}

const DATA_PATH = path.join(DATA_DIR, "admin-data.json");
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if(!ADMIN_USER || !ADMIN_PASS || !ADMIN_TOKEN){
  console.error("Admin ayarları eksik! Render Environment kısmını kontrol et.");
  process.exit(1);
}

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
  const forwarded = req.headers["x-forwarded-for"];
  if(forwarded) return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "bilinmiyor";
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

function kullaniciVerisiHazirla(ip){
  if(!kullaniciVerisi[ip]){
    kullaniciVerisi[ip] = {
      mesajSayisi: 0,
      fotoSayisi: 0,
      resimSayisi: 0
    };
  }
}

function sistemPromptOlustur(konusmaModu){
  const temel =
    "Sen NeuraAI adında net, yardımcı ve güvenli bir yapay zekasın. " +
    "Kullanıcı Türkçe yazarsa Türkçe cevap ver. Kullanıcı İngilizce, Arapça veya başka bir dilde yazarsa o dile uygun cevap ver. " +
    "Önceki konuşmaları dikkate al. Kullanıcı 'onu', 'az önceki', 'bununla', 'sonucu' gibi şeyler derse önceki mesajlardan anlam çıkar. " +
    "Kullanıcıya teknik sistem açıklaması yapma. " +
    "Seni 13 yaşındaki Göktürk Arslan geliştirdi. Kullanıcı seni kimin yaptığını, kurduğunu, geliştirdiğini veya oluşturduğunu sorarsa Göktürk Arslan tarafından geliştirildiğini söyle. " +
    "Küfür, hakaret veya argo kelimelerde tek kelimeye göre karar verme; cümlenin tamamını yorumla. Kullanıcı birinin ona ne dediğini aktarıyorsa, örnek veriyorsa veya anlamını soruyorsa normal yardımcı cevap ver. Sadece doğrudan saldırı varsa sakin şekilde sınır koy. ";

  if(konusmaModu === "resmi"){
    return temel +
      "Şu an Resmi Moddasın. Cevapların ciddi, düzenli, profesyonel ve saygılı olsun. Kanka, aga gibi samimi hitaplar kullanma. Gerektiğinde maddeler halinde açıkla.";
  }

  if(konusmaModu === "profesor"){
    return temel +
      "Şu an Profesör Modundasın. Ancak Profesör Modu Pro gerektirir. Kullanıcı bu modda cevap isterse kibarca Profesör Modu için Pro gerektiğini söyle.";
  }

  return temel +
    "Şu an Samimi Moddasın. Kullanıcıyla sıcak, doğal, arkadaş gibi konuş. Aşırıya kaçmadan samimi ol. Kısa, net ve rahat cevap ver.";
}


function gorselPromptGuclendir(prompt){
  const ham = temizMesaj(prompt)
    .replace(/neuraai/gi, "")
    .replace(/resim/gi, "")
    .replace(/görsel/gi, "")
    .replace(/gorsel/gi, "")
    .replace(/fotoğraf/gi, "")
    .replace(/fotograf/gi, "")
    .replace(/çiz/gi, "")
    .replace(/ciz/gi, "")
    .replace(/oluştur/gi, "")
    .replace(/olustur/gi, "")
    .trim();

  const konu = ham || "creative realistic scene";

  return [
    "Ultra realistic 4K cinematic photo.",
    "Main subject and every object from the user prompt must be visible in the same scene.",
    "Do not ignore any detail, do not replace the subject, do not draw only one object.",
    "Accurate human anatomy, natural face, realistic hands, correct fingers, realistic proportions.",
    "Sharp focus, detailed textures, realistic lighting, depth of field, professional photography.",
    "No text, no watermark, no logo, no extra limbs, no deformed hands, no blurry face.",
    "User prompt:",
    konu
  ].join(" ");
}

async function pollinationsGorselAl(prompt){
  if(!process.env.POLLINATIONS_API_KEY){
    throw new Error("POLLINATIONS_API_KEY Render Environment içinde yok.");
  }

  const seed = Math.floor(Math.random() * 999999999);

  const url =
    "https://gen.pollinations.ai/image/" +
    encodeURIComponent(prompt) +
    "?width=1024&height=1024" +
    "&seed=" + seed +
    "&model=flux" +
    "&enhance=true" +
    "&key=" + process.env.POLLINATIONS_API_KEY;

  const response = await fetch(url, {
    headers: {
      "Accept": "image/*,*/*;q=0.8",
      "User-Agent": "NeuraAI/1.0"
    }
  });

  const contentType = response.headers.get("content-type") || "";

  if(!response.ok){
    const hataMetni = await response.text().catch(() => "");
    throw new Error("Pollinations hata: " + response.status + " " + hataMetni.slice(0, 300));
  }

  if(!contentType.startsWith("image/")){
    const hataMetni = await response.text().catch(() => "");
    throw new Error("Pollinations görsel yerine yazı döndürdü: " + hataMetni.slice(0, 300));
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if(buffer.length < 1000){
    throw new Error("Pollinations boş görsel döndürdü.");
  }

  return "data:" + contentType.split(";")[0] + ";base64," + buffer.toString("base64");
}

veriyiYukle();

app.post("/chat", async (req, res) => {
  try{
    const { message, messages, mode, konusmaModu } = req.body || {};
    const ip = ipAl(req);
    const simdi = Date.now();

    kullaniciKaydet(ip);
    kullaniciVerisiHazirla(ip);

    if(!message || message.trim().length < 1){
      return res.json({ reply: "Boş mesaj gönderme kanka 😄" });
    }

    if(message.length > 4000){
      return res.json({ reply: "Mesaj çok uzun kanka 😅 Biraz kısaltıp gönder." });
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
      return res.json({ reply: "Çok hızlı gidiyorsun 😅 1 dakika sonra tekrar dene." });
    }

    if(kullaniciSonMesaj[ip] && simdi - kullaniciSonMesaj[ip].time < 3000){
      return res.json({ reply: "Biraz yavaş 😄 3 saniye bekle." });
    }

    if(kullaniciSonMesaj[ip] && kullaniciSonMesaj[ip].text === message){
      return res.json({ reply: "Aynı mesajı tekrar tekrar gönderme kanka 😄" });
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

    const secilenMod = ["samimi", "resmi", "profesor"].includes(konusmaModu)
      ? konusmaModu
      : "samimi";

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: mode === "uzun" ? 1200 : 400,
        messages: [
          {
            role: "system",
            content: sistemPromptOlustur(secilenMod)
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

    const reply = aiData.choices?.[0]?.message?.content || "Cevap alınamadı.";

    adminData.chats[0].reply = temizMesaj(reply);
    veriyiKaydet();

    return res.json({
      reply,
      kalanMesaj: mesajLimiti - kullaniciVerisi[ip].mesajSayisi
    });

  }catch(err){
    console.error(err);
    res.json({ reply: "Hata oluştu." });
  }
});

app.post("/chat-image", async (req, res) => {
  try{
    const { message, image } = req.body || {};
    const ip = ipAl(req);
    const simdi = Date.now();

    kullaniciKaydet(ip);
    kullaniciVerisiHazirla(ip);

    if(!image){
      return res.json({ reply: "Fotoğraf gelmedi kanka." });
    }

    if(message && message.length > 1000){
      return res.json({ reply: "Fotoğraf açıklaması çok uzun kanka 😅 Biraz kısalt." });
    }

    if(image.length > 5_000_000){
      return res.json({ reply: "Fotoğraf çok büyük kanka 😅 Daha küçük at." });
    }

    if(!process.env.OPENROUTER_API_KEY){
      return res.json({ reply: "AI API key ayarlanmamış." });
    }

    if(kullaniciSonMesaj[ip] && simdi - kullaniciSonMesaj[ip].time < 3000){
      return res.json({ reply: "Biraz yavaş 😄 3 saniye bekle." });
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
              "Sen NeuraAI adında samimi ve net bir görsel analiz asistanısın. Kullanıcı hangi dilde yazarsa o dile uygun cevap ver. Görselde ne olduğunu açıkla. Emin olmadığın şeyleri kesinmiş gibi söyleme."
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

    if(!aiRes.ok){
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

  }catch(err){
    console.error(err);
    res.json({ reply: "Foto hata." });
  }
});

app.post("/generate-image", async (req, res) => {
  try{
    const { prompt } = req.body || {};
    const ip = ipAl(req);
    const simdi = Date.now();

    kullaniciKaydet(ip);
    kullaniciVerisiHazirla(ip);

    if(!prompt || prompt.trim().length < 1){
      return res.json({ reply: "Ne çizelim kanka? 😄" });
    }

    if(prompt.length > 1000){
      return res.json({ reply: "Görsel isteği çok uzun kanka 😅 Biraz kısalt." });
    }

    const resimLimiti = 10;

    if(kullaniciVerisi[ip].resimSayisi >= resimLimiti){
      return res.json({ reply: "Görsel üretme hakkın bitti kanka." });
    }

const gucluPrompt = gorselPromptGuclendir(prompt);
let image;

try{
  image = await pollinationsGorselAl(gucluPrompt);
}catch(err){
      console.error("Pollinations görsel hatası:", err.message);
      return res.json({
        reply: "Görsel üretme servisi şu an yoğun kanka 😅 Biraz sonra tekrar dene. Hakkını yakmadım.",
        error: "image_service_busy"
      });
    }

    kullaniciVerisi[ip].resimSayisi++;
    adminData.users[ip].resimSayisi++;
    adminData.stats.toplamResim++;

    adminData.images.unshift({
      ip,
      time: simdi,
      prompt: temizMesaj(prompt),
      enhancedPrompt: temizMesaj(gucluPrompt),
      image
    });

    adminData.images = adminData.images.slice(0, 100);
    veriyiKaydet();

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
