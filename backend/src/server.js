require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

const app = require('./app');

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`AURA Sukhumvit 36 running at http://localhost:${port}`);
});
