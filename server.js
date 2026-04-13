const express = require("express");
const path = require("path");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Sohbet için ucuz model
const CHAT_MODEL = "openai/gpt-3.5-turbo";

// Fotoğraf için görsel destekli model
const VISION_MODEL = "openai/gpt-4o-mini";

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Basit spam koruma
let kullaniciSonMesaj = {};

function spamKontrol(ip, beklemeMs = 3000) {
  const simdi = Date.now();

  if (kullaniciSonMesaj[ip] && simdi - kullaniciSonMesaj[ip] < beklemeMs) {
    return false;
  }

  kullaniciSonMesaj[ip] = simdi;
  return true;
}

app.post("/chat", async (req, res) => {
  try {
    const { message, mode } = req.body || {};

    if (!message || !message.trim()) {
      return res.json({ reply: "Boş mesaj gönderme." });
    }

    const m = message.toLowerCase().trim();

    // Özel cevap
    if (
      m.includes("seni kim yaptı") ||
      m.includes("kim yaptı seni") ||
      m.includes("seni kim yapti") ||
      m.includes("kim yapti seni") ||
      m.includes("seni kim yarattı") ||
      m.includes("seni kim yaratti") ||
      m.includes("geliştiricin kim") ||
      m.includes("gelistiricin kim") ||
      m.includes("sahibin kim")
    ) {
      return res.json({
        reply: "Beni Göktürk Arslan yaptı 😎"
      });
    }

    const ip = req.ip;
    if (!spamKontrol(ip, 3000)) {
      return res.json({
        reply: "Biraz yavaş 😄 3 saniye bekle."
      });
    }

    let sistemMesaji =
      "Sen NeuraAI adlı yardımcı bir yapay zekasın. Türkçe konuş. Samimi ol ama abartma. Doğal, net ve yardımcı ol.";

    if (mode === "uzun") {
      sistemMesaji += " Daha detaylı ve açıklayıcı cevap ver.";
    } else if (mode === "kisa") {
      sistemMesaji += " Çok kısa ve net cevap ver.";
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "NeuraAI"
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: sistemMesaji },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.log("Chat hata:", JSON.stringify(data, null, 2));
      return res.json({
        reply: "AI şu an meşgul 😕 biraz sonra tekrar dene."
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Cevap gelmedi.";

    return res.json({ reply });
  } catch (err) {
    console.error("Chat server hata:", err);
    return res.json({
      reply: "Bağlantı hatası."
    });
  }
});

app.post("/chat-image", async (req, res) => {
  try {
    const { message, image } = req.body || {};

    if (!image) {
      return res.json({
        reply: "Fotoğraf gelmedi."
      });
    }

    const ip = req.ip;
    if (!spamKontrol(ip, 3000)) {
      return res.json({
        reply: "Biraz yavaş 😄 3 saniye bekle."
      });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "NeuraAI"
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Sen NeuraAI adlı yardımcı bir yapay zekasın. Kullanıcının gönderdiği görseli Türkçe, net ve doğal şekilde analiz et."
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
        ],
        max_tokens: 300
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.log("Vision hata:", JSON.stringify(data, null, 2));
      return res.json({
        reply: "Fotoğraf analizi şu an çalışmadı."
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Görsel analiz edilemedi.";

    return res.json({ reply });
  } catch (err) {
    console.error("Fotoğraf server hata:", err);
    return res.json({
      reply: "Fotoğraf analizinde hata oldu."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
});
