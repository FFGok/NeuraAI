const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const express = require("express");

const app = express();

app.use(express.json({ limit: "50mb" }));
app.set("trust proxy", true);

let kullaniciSonMesaj = {};
let kullaniciVerisi = {};
let kullaniciLimit = {};

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

function sistemPromptOlustur(konusmaModu){
  const temel =
    "Sen NeuraAI adında net, yardımcı ve güvenli bir yapay zekasın. " +
    "Kullanıcı Türkçe yazarsa Türkçe cevap ver. Kullanıcı İngilizce, Arapça veya başka bir dilde yazarsa o dile uygun cevap ver. " +
    "Önceki konuşmaları güçlü şekilde dikkate al. Kullanıcı 'onu', 'az önceki', 'bununla', 'sonucu' gibi şeyler derse önceki mesajlardan anlam çıkar. Uzun konuşmalarda konu, kararlar, kodlar, hatalar ve kullanıcı tercihlerini takip et. " +
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
    const { message, messages, mode, konusmaModu } = req.body || {};
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
        max_tokens: mode === "uzun" ? 2500 : 1000,
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

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server çalışıyor. Port: ${PORT}`);
});
