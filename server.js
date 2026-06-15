const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const express = require("express");

const app = express();

app.use(express.json({ limit: "50mb" }));
app.set("trust proxy", true);

let kullaniciSonMesaj = {};
let kullaniciVerisi = {};
let kullaniciLimit = {};
let neuraUpdates = [];
let neuraNotifications = [];
let neuraUpcoming = [
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
let neuraPolls = [];

// ... BURAYA ÜSTTEKİ DOSYADAKİ TÜM KOD GELİYOR ...

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server çalışıyor. Port: ${PORT}`);
});
