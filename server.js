const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const express = require("express");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.set("trust proxy", true);

let kullaniciSonMesaj = {};
let kullaniciVerisi = {};
let kullaniciLimit = {};

app.post("/chat", async (req, res) => {
  try {
    const { message, messages, mode } = req.body || {};
    const ip = req.ip;
    const simdi = Date.now();

    if (!message || message.trim().length < 1) {
      return res.json({ reply: "Boş mesaj gönderme kanka 😄" });
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
            content: "Sen NeuraAI adında Türkçe konuşan samimi, net ve yardımcı bir yapay zekasın. Önceki konuşmaları dikkate al. Kullanıcı 'onu', 'az önceki', 'bununla', 'sonucu' gibi şeyler derse önceki mesajlardan anlam çıkar. Kullanıcıya asla 'önceki konuşmayı görüyorum' veya teknik açıklama söyleme. Normal, doğal cevap ver."
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
    const ip = req.ip;
    const simdi = Date.now();

    if (!image) {
      return res.json({ reply: "Fotoğraf gelmedi kanka." });
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
            content: "Sen NeuraAI adında Türkçe konuşan samimi ve net bir görsel analiz asistanısın. Görselde ne olduğunu açıkla. Emin olmadığın şeyleri kesinmiş gibi söyleme."
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
    const ip = req.ip;

    if (!prompt || prompt.trim().length < 1) {
      return res.json({ reply: "Ne çizelim kanka? 😄" });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.json({ reply: "API key yok." });
    }

    if (!kullaniciVerisi[ip]) {
      kullaniciVerisi[ip] = { mesajSayisi: 0, fotoSayisi: 0, resimSayisi: 0 };
    }

    if (kullaniciVerisi[ip].resimSayisi === undefined) {
      kullaniciVerisi[ip].resimSayisi = 0;
    }

    const resimLimiti = 3;

    if (kullaniciVerisi[ip].resimSayisi >= resimLimiti) {
      return res.json({ reply: "Görsel hakkın bitti kanka 😅" });
    }

    kullaniciVerisi[ip].resimSayisi++;

    const aiRes = await fetch("https://openrouter.ai/api/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/dall-e-3",
        prompt,
        size: "1024x1024"
      })
    });

    const data = await aiRes.json();

    if (!aiRes.ok) {
      console.error("Görsel üretme hatası:", data);
      return res.json({ reply: "Görsel üretilemedi kanka." });
    }

    const image = data.data?.[0]?.url;

    if (!image) {
      return res.json({ reply: "Görsel geldi ama link alınamadı." });
    }

    return res.json({
      image,
      kalanResim: resimLimiti - kullaniciVerisi[ip].resimSayisi
    });

  } catch (err) {
    console.error(err);
    res.json({ reply: "Görsel üretme hatası oluştu." });
  }
});

app.use(express.static(__dirname));

app.listen(3000, () => {
  console.log("Server çalışıyor 🚀");
});
