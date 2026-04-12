const express = require("express");
const path = require("path");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// ENV'den al (GÜVENLİ)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 🔥 FREE DEĞİL → PARALI AMA UCUZ VE SINIRSIZ
const MODEL = "openai/gpt-3.5-turbo";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 🔥 BACKEND SPAM KORUMA (GERÇEK KORUMA)
let kullaniciSonMesaj = {};

app.post("/chat", async (req, res) => {
  try {
    const { message, mode } = req.body || {};

    if (!message || !message.trim()) {
      return res.json({ reply: "Boş mesaj gönderme." });
    }

    // 🧠 IP ile spam koruma
    const ip = req.ip;
    const simdi = Date.now();

    if (kullaniciSonMesaj[ip] && simdi - kullaniciSonMesaj[ip] < 3000) {
      return res.json({
        reply: "Biraz yavaş 😄 3 saniye bekle."
      });
    }

    kullaniciSonMesaj[ip] = simdi;

    let sistemMesaji =
      "Sen NeuraAI adlı yardımcı bir yapay zekasın. Türkçe konuş. Samimi ol ama cringe olma. Doğal, net ve yardımcı ol.";

    if (mode === "uzun") {
      sistemMesaji += " Daha detaylı cevap ver.";
    } else if (mode === "kisa") {
      sistemMesaji += " Çok kısa cevap ver.";
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
        model: MODEL,
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
      console.log("OpenRouter hata:", JSON.stringify(data, null, 2));
      return res.json({
        reply: "AI şu an meşgul 😕 biraz sonra tekrar dene."
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Cevap gelmedi.";

    return res.json({ reply });

  } catch (err) {
    console.error("Server hata:", err);
    return res.json({
      reply: "Bağlantı hatası."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
});