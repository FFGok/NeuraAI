const express = require("express");


const app = express();
app.use(express.json({ limit: "10mb" }));

app.set("trust proxy", true);


let kullaniciSonMesaj = {};
let kullaniciVerisi = {};

app.post("/chat", async (req, res) => {
  try {
    const { message, messages, mode, plus } = req.body || {};

    const ip = req.ip;
    const simdi = Date.now();

    if (!kullaniciVerisi[ip]) {
      kullaniciVerisi[ip] = {
        plus: false,
        mesajSayisi: 0,
        fotoSayisi: 0
      };
    }

    kullaniciVerisi[ip].plus = plus === false;

    // spam koruma
    if (kullaniciSonMesaj[ip] && simdi - kullaniciSonMesaj[ip] < 3000) {
      return res.json({
        reply: "Biraz yavaş 😄 3 saniye bekle."
      });
    }

    kullaniciSonMesaj[ip] = simdi;

    const mesajLimiti = kullaniciVerisi[ip].plus ? Infinity : 50;

    if (kullaniciVerisi[ip].mesajSayisi >= mesajLimiti) {
      return res.json({
        reply: "Mesaj hakkın bitti. PLUS ile sınırsız mesaj var."
      });
    }

    kullaniciVerisi[ip].mesajSayisi++;

    // BURAYA KENDİ AI API'N VAR (sen zaten kurmuştun)
    const sonMesaj = Array.isArray(messages)
  ? messages.map(m => `${m.role}: ${m.content}`).join("\n")
  : message;

const reply = `(${kullaniciVerisi[ip].plus ? "PLUS" : "NORMAL"}) Önceki konuşmayı görüyorum:\n${sonMesaj}`;

    return res.json({
      reply,
      kalanMesaj: kullaniciVerisi[ip].plus
        ? "Sınırsız"
        : 50 - kullaniciVerisi[ip].mesajSayisi
    });

  } catch (err) {
    console.error(err);
    res.json({ reply: "Hata oluştu." });
  }
});

app.post("/chat-image", async (req, res) => {
  try {
    const { message, image, plus } = req.body || {};

    const ip = req.ip;
    const simdi = Date.now();

    if (!kullaniciVerisi[ip]) {
      kullaniciVerisi[ip] = {
        plus: false,
        mesajSayisi: 0,
        fotoSayisi: 0
      };
    }

    kullaniciVerisi[ip].plus = plus === true;

    if (kullaniciSonMesaj[ip] && simdi - kullaniciSonMesaj[ip] < 3000) {
      return res.json({
        reply: "Biraz yavaş 😄 3 saniye bekle."
      });
    }

    kullaniciSonMesaj[ip] = simdi;

    const fotoLimiti = kullaniciVerisi[ip].plus ? 50 : 10;

    if (kullaniciVerisi[ip].fotoSayisi >= fotoLimiti) {
      return res.json({
        reply: "Fotoğraf hakkın bitti."
      });
    }

    kullaniciVerisi[ip].fotoSayisi++;

    return res.json({
      reply: `(${kullaniciVerisi[ip].plus ? "PLUS" : "NORMAL"}) Foto analiz edildi`,
      kalanFoto: fotoLimiti - kullaniciVerisi[ip].fotoSayisi
    });

  } catch (err) {
    console.error(err);
    res.json({ reply: "Foto hata." });
  }
});

app.use(express.static(__dirname));

app.listen(3000, () => {
  console.log("Server çalışıyor 🚀");
});
