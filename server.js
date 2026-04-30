const express = require("express");

const app = express();

app.use((req, res) => {
  res.send("Site bakımda 🚧 Daha sonra gel.");
});

app.listen(3000, () => {
  console.log("Site bakım modunda 🚧");
});
